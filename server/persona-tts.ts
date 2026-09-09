// Persona TTS: Fish Audio network calls, in-memory caching, and streaming
// response delivery, isolated from server/routes.ts so this logic can be
// unit-tested in isolation (mocked fetch/Response) without booting Express
// or the rest of the route table.
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import type { Response as ExpressResponse } from "express";

// Strips markdown-style formatting Fish Audio would otherwise read out loud
// verbatim (asterisks, headings, bullets, links, trailing stage-direction
// tags like [laughs] or [IQ:7,ALT:0]).
export function stripMarkdownForTTS(text: string): string {
  return text
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")  // **bold**, *italic*, ***both***
    .replace(/\*+/g, "")                           // lone asterisks (bullets, etc.)
    .replace(/_{1,2}([^_\n]+)_{1,2}/g, "$1")      // __bold__, _italic_
    .replace(/`{1,3}[^`]*`{1,3}/g, "")            // `code` / ```blocks```
    .replace(/^#{1,6}\s+/gm, "")                  // # headings
    .replace(/^[-•]\s+/gm, "")                    // - bullet / • bullet
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")      // [link](url) → link text only
    .replace(/(\s*\[[^\[\]\n]{1,60}\])+\s*$/, "") // trailing [tag] stage directions
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function fixTTSPronunciation(text: string): string {
  return stripMarkdownForTTS(text)
    .replace(/\bEpstein War\b/gi, "Ep-steen War")
    .replace(/\bEpstein's\b/gi, "Ep-steen's")
    .replace(/\bEpstein files\b/gi, "Ep-steen files")
    .replace(/\bEpstein Island\b/gi, "Ep-steen Island")
    .replace(/\bEpstein\b/gi, "Ep-steen")
    .replace(/\bDOGE's\b/g, "Dohj's")
    .replace(/\bDOGE\b/g, "Dohj")
    .replace(/\bm\s*[.,]?\s*e\b/gi, "me")
    .replace(/\bDr\.\s*/g, "Doctor ");
}

// ── In-memory cache ──────────────────────────────────────────────────────
// Bumped from 100 entries/30min: cache misses on Fish Audio cost 11-18s
// each, and a bigger/longer-lived cache means far more repeated lines
// (openers, common rebuttals, moderator prompts) get served instantly
// instead of re-hitting the slow upstream. TTS_CACHE_MAX_BYTES is a hard
// ceiling on total buffered audio (independent of entry count) so a run of
// unusually long clips (persona-speak allows up to 2000 chars) can't blow
// past a bounded memory budget.
export const TTS_CACHE_MAX = 300;
export const TTS_CACHE_MAX_BYTES = 30 * 1024 * 1024;
export const TTS_CACHE_TTL = 60 * 60 * 1000;

const ttsCache = new Map<string, { buffer: Buffer; timestamp: number }>();
let ttsCacheBytes = 0;

// Hash the FULL text rather than truncating it: two different lines sharing
// the same first ~200 characters must never collide onto the same cache
// entry or in-flight slot, or a caller can end up playing (or waiting on)
// audio for the wrong line entirely. SHA-1 keeps the key a fixed, short
// length regardless of how long the source text is (persona-speak allows
// up to 2000 chars) while remaining effectively collision-free for this.
export function getTTSCacheKey(text: string, voiceId: string, speed: number): string {
  const hash = createHash("sha1").update(text).digest("hex");
  return `${voiceId}:${speed}:${hash}`;
}

// Bump this whenever PERSONA_EMOTION_MAP changes so emotion-tagged cache
// keys are immediately invalidated across all personas rather than waiting
// for the TTL to expire.
const PERSONA_EMOTION_MAP_VERSION = 10;

export function getFullTTSCacheKey(text: string, voiceId: string, speed: number, volumeDb: number = 0, emotion?: string): string {
  return getTTSCacheKey(text, voiceId, speed) + (volumeDb !== 0 ? `_v${volumeDb}` : "") + (emotion ? `_e${emotion}_ev${PERSONA_EMOTION_MAP_VERSION}` : "");
}

export function getCachedTTS(key: string): Buffer | null {
  const entry = ttsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTS_CACHE_TTL) {
    ttsCacheBytes -= entry.buffer.length;
    ttsCache.delete(key);
    return null;
  }
  return entry.buffer;
}

export function setCachedTTS(key: string, buffer: Buffer): void {
  // A single clip larger than the whole budget can never be made to fit no
  // matter how much else gets evicted — inserting it anyway would leave
  // ttsCacheBytes permanently over TTS_CACHE_MAX_BYTES. Skip caching it
  // instead; the request that generated it still gets served (and the next
  // identical request just costs another Fish Audio call, same as pre-cache
  // behavior).
  if (buffer.length > TTS_CACHE_MAX_BYTES) {
    console.warn(`TTS cache: skipping cache for oversized clip (${buffer.length} bytes > ${TTS_CACHE_MAX_BYTES} byte budget)`);
    return;
  }

  const existing = ttsCache.get(key);
  if (existing) {
    ttsCacheBytes -= existing.buffer.length;
    ttsCache.delete(key);
  }
  while (ttsCache.size > 0 && (ttsCache.size >= TTS_CACHE_MAX || ttsCacheBytes + buffer.length > TTS_CACHE_MAX_BYTES)) {
    const oldestKey = ttsCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldestEntry = ttsCache.get(oldestKey);
    if (oldestEntry) ttsCacheBytes -= oldestEntry.buffer.length;
    ttsCache.delete(oldestKey);
  }
  ttsCache.set(key, { buffer, timestamp: Date.now() });
  ttsCacheBytes += buffer.length;
}

// ── In-flight raw-generation de-duplication ─────────────────────────────
// Two concurrent requests for the exact same (text, voice, speed, volume,
// emotion) combination — e.g. two clients requesting the same line, or a
// prefetch racing a direct play — must not each trigger their own Fish
// Audio call. The second caller joins the first's in-progress generation
// instead, so cache misses only ever cost one upstream request no matter
// how many callers ask for the same line at once.
const ttsRawInFlight = new Map<string, Promise<Buffer>>();

export function _testHooks() {
  return {
    clear() {
      ttsCache.clear();
      ttsCacheBytes = 0;
      ttsRawInFlight.clear();
    },
    cacheSize: () => ttsCache.size,
    cacheBytes: () => ttsCacheBytes,
    inFlightSize: () => ttsRawInFlight.size,
  };
}

// Connects to Fish Audio and returns the raw (un-consumed) Response as soon
// as headers arrive, retrying on transient failures. Callers decide how to
// consume the body — buffered in one shot (fishAudioRequest) or streamed
// straight through to a waiting HTTP client (see sendPersonaTTS) so
// playback can start before the full clip has finished generating.
export async function fishAudioFetchWithRetry(
  text: string,
  voiceId: string,
  speed: number,
  apiKey: string,
  retries: number = 3,
  volumeDb: number = 0,
  emotion?: string,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const ttsText = fixTTSPronunciation(text);
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      console.log(`TTS retry ${attempt + 1}/${retries} after ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const prosody: Record<string, any> = { speed };
      if (volumeDb !== 0) prosody.volume = volumeDb;
      if (emotion) prosody.emotion = emotion;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      let response: Response;
      try {
        response = await fetchImpl("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "model": "s2.1-pro-free",
          },
          body: JSON.stringify({
            text: ttsText,
            reference_id: voiceId,
            format: "mp3",
            latency: "balanced",
            prosody,
          }),
          signal: controller.signal,
        } as RequestInit);
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.status === 429 || response.status === 503 || response.status === 502) {
        const errorText = await response.text();
        console.warn(`Fish Audio ${response.status} (attempt ${attempt + 1}/${retries}):`, errorText);
        lastError = new Error(`Fish Audio error: ${response.status}`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Fish Audio TTS error:", response.status, errorText);
        throw new Error(`Fish Audio TTS failed: ${response.status}`);
      }

      return response;
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.warn(`Fish Audio request timed out (attempt ${attempt + 1}/${retries})`);
        lastError = new Error("Fish Audio error: timeout");
        continue;
      }
      if (err.message?.includes("rate limited") || err.message?.includes("Fish Audio error")) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Fish Audio TTS failed after retries");
}

// Buffered TTS generation shared by every non-streaming caller (bleep
// overlay, admin previews, game narration, etc). Cache- and in-flight-aware:
// a cache hit returns instantly, and a concurrent identical request joins
// whichever generation is already running instead of starting a second one.
export async function fishAudioRequest(
  text: string,
  voiceId: string,
  speed: number,
  apiKey: string,
  retries: number = 3,
  volumeDb: number = 0,
  emotion?: string,
  fetchImpl: typeof fetch = fetch
): Promise<Buffer> {
  const cacheKey = getFullTTSCacheKey(text, voiceId, speed, volumeDb, emotion);
  const cached = getCachedTTS(cacheKey);
  if (cached) {
    console.log(`TTS cache hit for voice=${voiceId}`);
    return cached;
  }

  const existing = ttsRawInFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const response = await fishAudioFetchWithRetry(text, voiceId, speed, apiKey, retries, volumeDb, emotion, fetchImpl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    setCachedTTS(cacheKey, buffer);
    return buffer;
  })();
  promise.catch(() => {}); // mark handled; the awaits below (or a joining caller) surface the real error
  ttsRawInFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    if (ttsRawInFlight.get(cacheKey) === promise) ttsRawInFlight.delete(cacheKey);
  }
}

function writeAudioResponse(res: ExpressResponse, buffer: Buffer, cacheControl?: boolean): void {
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Length", buffer.length.toString());
  if (cacheControl) res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(buffer);
}

export interface SendPersonaTTSParams {
  text: string;
  voiceId: string;
  speed: number;
  apiKey: string;
  volumeDb?: number;
  emotion?: string;
  bleepRequested: boolean;
  cacheControl?: boolean;
  retries?: number;
  // Injected rather than imported directly so this module has no dependency
  // on routes.ts (avoids a circular import) and stays unit-testable with
  // simple fakes.
  hasCurseWords: (text: string) => boolean;
  overlayBleeps: (buffer: Buffer, text: string) => Promise<Buffer>;
  fetchImpl?: typeof fetch;
  streamFactory?: (body: any) => Readable;
}

// Serves a persona-speak request, streaming Fish Audio's response straight
// through to the client as it arrives whenever no bleep overlay is needed.
// Bleep overlay (ffmpeg) needs the complete audio buffer up front to compute
// where the bleep tone goes, so that path still buffers fully — but curse
// words are detected from the TEXT, not the audio, so we know up front
// whether a given line needs it, without waiting for any audio at all.
// Streaming is what actually cuts time-to-first-audio on a cache miss:
// previously the client waited out the entire 11-18s Fish Audio generation
// before a single byte reached it; now playback can start as soon as the
// first chunk of audio exists.
export async function sendPersonaTTS(res: ExpressResponse, params: SendPersonaTTSParams): Promise<void> {
  const {
    text, voiceId, speed, apiKey, volumeDb = 0, emotion, bleepRequested, cacheControl,
    retries = 3, hasCurseWords, overlayBleeps, fetchImpl = fetch,
  } = params;
  const streamFactory = params.streamFactory || ((body: any) => Readable.fromWeb(body));
  const cacheKey = getFullTTSCacheKey(text, voiceId, speed, volumeDb, emotion);

  const cached = getCachedTTS(cacheKey);
  if (cached) {
    console.log(`TTS cache hit for voice=${voiceId}`);
    const finalBuffer = bleepRequested ? await overlayBleeps(cached, text) : cached;
    writeAudioResponse(res, finalBuffer, cacheControl);
    return;
  }

  const needsBleepOverlay = bleepRequested && hasCurseWords(text);
  if (needsBleepOverlay) {
    const raw = await fishAudioRequest(text, voiceId, speed, apiKey, retries, volumeDb, emotion, fetchImpl);
    const buffer = await overlayBleeps(raw, text);
    writeAudioResponse(res, buffer, cacheControl);
    return;
  }

  // No bleep needed. Join an in-flight raw generation if one is already
  // running for this exact line; otherwise become the "leader" that
  // streams the freshly generated audio straight through to this client.
  const existing = ttsRawInFlight.get(cacheKey);
  if (existing) {
    const raw = await existing;
    writeAudioResponse(res, raw, cacheControl);
    return;
  }

  // Reserve this cacheKey's in-flight slot SYNCHRONOUSLY — before the first
  // await below — so a concurrent duplicate request landing in the `existing`
  // check above cannot race past it. If the reservation happened after
  // awaiting the network call instead, two requests issued back-to-back could
  // both observe "no in-flight entry" and each trigger their own Fish Audio
  // generation, defeating the whole point of de-duplication.
  let resolveRaw!: (buf: Buffer) => void;
  let rejectRaw!: (err: any) => void;
  const rawPromise = new Promise<Buffer>((resolve, reject) => { resolveRaw = resolve; rejectRaw = reject; });
  rawPromise.catch(() => {}); // a joining caller (above) is the real consumer; mark handled either way
  ttsRawInFlight.set(cacheKey, rawPromise);
  const releaseInFlight = () => {
    if (ttsRawInFlight.get(cacheKey) === rawPromise) ttsRawInFlight.delete(cacheKey);
  };

  let upstream: Response;
  try {
    upstream = await fishAudioFetchWithRetry(text, voiceId, speed, apiKey, retries, volumeDb, emotion, fetchImpl);
  } catch (err) {
    // No response bytes have been written yet, so the caller's own catch
    // block can still send a normal 500 — just make sure the reservation
    // above doesn't leak and any joiner is unblocked with the same error.
    releaseInFlight();
    rejectRaw(err);
    throw err;
  }

  res.setHeader("Content-Type", "audio/mpeg");
  if (cacheControl) res.setHeader("Cache-Control", "public, max-age=3600");

  const chunks: Buffer[] = [];
  const nodeStream = streamFactory(upstream.body);

  await new Promise<void>((resolve) => {
    let settled = false;
    // A disconnected client only means THIS response can no longer receive
    // bytes — it does not mean the in-progress Fish Audio generation should
    // stop. We deliberately let it run to completion so the result still
    // populates the cache for the next (possibly identical) request. Note:
    // we intentionally do NOT use Readable#pipe(res) here, because pipe()
    // auto-unpipes (and can destroy the source) when the destination emits
    // "close" — which would abandon the generation entirely and, worse,
    // could leave this promise unresolved forever if that happens before
    // "end"/"error" fires. Writing to `res` manually keeps that entirely
    // decoupled from consuming `nodeStream` to completion.
    let clientClosed = false;
    const onClientClosed = () => {
      clientClosed = true;
    };
    const finishOk = () => {
      if (settled) return;
      settled = true;
      res.off("close", onClientClosed);
      const buffer = Buffer.concat(chunks);
      setCachedTTS(cacheKey, buffer);
      releaseInFlight();
      resolveRaw(buffer);
      if (!clientClosed) {
        try { if (!res.writableEnded) res.end(); } catch {}
      }
      resolve();
    };
    const finishErr = (err: any) => {
      if (settled) return;
      settled = true;
      res.off("close", onClientClosed);
      console.error("TTS stream error:", err?.message || err);
      releaseInFlight();
      rejectRaw(err instanceof Error ? err : new Error(String(err)));
      if (!clientClosed) {
        try { if (!res.writableEnded) res.end(); } catch {}
      }
      resolve();
    };
    res.on("close", onClientClosed);
    nodeStream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      if (!clientClosed) {
        try { res.write(chunk as any); } catch {}
      }
    });
    nodeStream.on("error", finishErr);
    res.on("error", finishErr);
    nodeStream.on("end", finishOk);
  });
}
