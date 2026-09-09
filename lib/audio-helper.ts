import { Platform } from "react-native";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { getApiUrl } from "@/lib/query-client";

// Audio mode is set once for the lifetime of the app — calling setAudioModeAsync
// on every play causes audio session churn that produces lag and interference,
// especially when clips play in rapid succession.
let _audioModeSet = false;
async function ensureAudioMode() {
  if (_audioModeSet) return;
  _audioModeSet = true;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    // MixWithOthers (not DoNotMix) lets two of our own Sound instances play at
    // once. DoNotMix operates at the native OS audio-session level, BELOW our
    // own ducking/overlap logic (processTTSQueue's overlap window,
    // playInterruptionAudio, playReactionOverlap) — so even though the app
    // intentionally starts an overlapping/reaction clip while the prior line
    // is still speaking (often in its last ~500ms), DoNotMix made the OS kill
    // the first clip outright the instant the second one started, which read
    // as dialogue getting cut off right before it finished. MixWithOthers lets
    // both clips actually play concurrently, so our own setVolumeAsync-based
    // ducking is what the listener hears, not a hard OS-level stop.
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    // Android has no MixWithOthers value — DoNotMix/DuckOthers here only ever
    // governs focus arbitration with OTHER apps' audio, not between multiple
    // Sound instances inside our own app, so it was never the Android side of
    // this bug. DuckOthers is the platform default.
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

// Call this early (e.g. on screen mount) to pre-initialize the audio session
// before the first clip plays, avoiding the cold-start lag on the first TTS call.
export async function warmupAudio(): Promise<void> {
  await ensureAudioMode().catch(() => {});
}

// Every TTS/audio fetch in this file used to be a bare, unguarded fetch() —
// a slow or hung request (dead network, overloaded TTS provider) would await
// forever with nothing downstream ever timing out it. Callers like
// playReactionOverlap duck the main line's volume BEFORE this promise
// resolves, so a hung fetch here reads to the listener as literal dead air
// with no recovery, sometimes for tens of seconds until some unrelated timer
// elsewhere finally forces things to move on. Every fetch below goes through
// this helper so a stalled request fails fast and lets its caller's own
// catch/restore logic run instead of hanging indefinitely.
// 10s was aborting some legitimately-slow-but-successful TTS calls (real
// synthesis latency has been observed up to ~30-50s under provider load),
// and an aborted call means that persona silently skips its turn entirely —
// which reads to the user as a conversational dead-air gap, not a recovery.
// 15s trades a little worst-case wait for far fewer of those silent skips.
const TTS_FETCH_TIMEOUT_MS = 15000;
async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs: number = TTS_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(url, { ...(init || {}), signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`Audio fetch timed out after ${timeoutMs}ms: ${url}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function playAudioFromUrl(
  url: string,
  options?: { method?: string; body?: any; headers?: Record<string, string>; volume?: number; rate?: number; preferStreaming?: boolean }
): Promise<Audio.Sound> {
  const vol = options?.volume ?? 1.0;
  const rate = options?.rate ?? 1.0;

  await ensureAudioMode();

  if (Platform.OS === "web") {
    // Opt-in progressive streaming: hand the URL straight to expo-av's web
    // Sound (`new Audio(source)`), which the browser fetches and plays as
    // bytes arrive instead of waiting for the full response. This is NOT the
    // default for plain GET (see the NOTE below on why that was reverted) —
    // callers must explicitly request it via `preferStreaming`, and only
    // when there's nothing else here forcing the fetch+blob path
    // (a custom method or body). Today the only caller that opts in is
    // playTrumpAudioFromUrl (app/cabinet.tsx's Trump commentary), whose
    // playback completion is driven purely by the `didJustFinish` event, not
    // any duration-derived timer, so the inaccurate-durationMillis-while-
    // streaming problem below doesn't apply to it.
    if (options?.preferStreaming && (!options?.method || options.method === "GET") && !options?.body) {
      // Deliberately no fallback to the fetch+blob path below on failure:
      // this URL charges a token and triggers fresh LLM+TTS generation
      // server-side (e.g. GET /api/cabinet-speak-audio) on every request, so
      // silently re-requesting it here would double-charge the user and
      // double the generation cost for one playback attempt. Surface the
      // error to the caller instead, exactly like the native path below does.
      const { sound } = await Audio.Sound.createAsync(
        { uri: url, headers: options?.headers },
        { shouldPlay: false, volume: vol }
      );
      await sound.setRateAsync(rate, true).catch(() => {});
      await sound.playAsync();
      return sound;
    }
    // NOTE: web plain-GET playback used to hand the URL straight to expo-av's
    // web Sound as a progressive `<audio src>` (browser streams+plays bytes
    // as they arrive from server/persona-tts.ts's chunked, no-Content-Length
    // response) to start audio sooner instead of waiting for the full blob.
    // Reverted: expo-av's web status derives durationMillis from the raw
    // HTMLMediaElement (`media.duration * 1000`), which is only an ESTIMATE
    // while a chunked/unknown-length stream is still arriving and can read
    // far shorter than the true clip length. Every duration-based
    // safety-timer and conversational-overlap check across arena.tsx,
    // debate-stage.tsx, and interview.tsx trusted that number, so lines
    // (including moderator lines, which flow through the same TTS queue)
    // were getting force-finished or ducked out way too early — dialogue
    // reading as truncated and rushed. There are too many independent
    // duration-trusting call sites to safely patch one-by-one, so web goes
    // back to fetching the complete response before playback, exactly like
    // before that streaming change — a fully-downloaded blob always reports
    // accurate duration immediately. Native is untouched: it was never
    // affected by this (AVPlayer/ExoPlayer report accurate duration even
    // while genuinely streaming), so native keeps starting playback before
    // a clip finishes generating.
    if (!options?.method || options.method === "GET") {
      try {
        const res = await fetchWithTimeout(url, options?.headers ? { headers: options.headers } : undefined);
        if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/html")) throw new Error("Server returned HTML instead of audio");
        const blob = await res.blob();
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: dataUri },
          { shouldPlay: false, volume: vol }
        );
        await sound.setRateAsync(rate, true).catch(() => {});
        await sound.playAsync();
        return sound;
      } catch (e) {
        console.warn("Audio.Sound fallback failed, trying window.Audio:", e);
        const audio = new window.Audio(url);
        audio.volume = vol;
        audio.playbackRate = rate;
        await audio.play();
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: false, volume: vol }
        );
        return sound;
      }
    }
    const res = await fetchWithTimeout(url, {
      method: options.method,
      headers: options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) throw new Error("Server returned HTML instead of audio");
    const blob = await res.blob();
    const reader = new FileReader();
    const dataUri = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: dataUri },
      { shouldPlay: false, volume: vol }
    );
    await sound.setRateAsync(rate, true).catch(() => {});
    await sound.playAsync();
    return sound;
  }

  // Let the native Sound module fetch the URL directly and progressively —
  // don't validate with a separate JS-side fetch first. The server now
  // streams TTS audio as it's generated instead of buffering the whole clip
  // (see server/persona-tts.ts), so a validation fetch here would open a
  // SECOND concurrent request for the same (uncached) line and race the
  // real playback request while the first is still generating — doubling
  // Fish Audio cost/latency instead of saving it. A bad response (error
  // status, non-audio body) now simply surfaces as a rejected createAsync
  // call, which every caller already treats as a playback error.
  const { sound } = await Audio.Sound.createAsync(
    { uri: url, headers: options?.headers },
    { shouldPlay: false, volume: vol, rate, shouldCorrectPitch: true }
  );
  await sound.setRateAsync(rate, true).catch(() => {});
  await sound.playAsync();

  return sound;
}

function buildTTSUrl(endpoint: string, body: Record<string, any>): string {
  const baseUrl = getApiUrl().replace(/\/$/, "");
  const params = new URLSearchParams();
  Object.entries(body).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.append(k, String(v));
  });
  return `${baseUrl}${endpoint}?${params.toString()}`;
}

export async function prefetchTTSAudio(
  endpoint: string,
  body: Record<string, any>
): Promise<string> {
  const url = buildTTSUrl(endpoint, body);

  await ensureAudioMode();

  if (Platform.OS === "web") {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`TTS prefetch failed: ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) throw new Error("Server returned HTML instead of audio");
    const blob = await res.blob();
    const reader = new FileReader();
    const dataUri = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return dataUri;
  }

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`TTS prefetch failed: ${res.status}`);
  // The server now streams TTS audio to the client as it's generated instead
  // of buffering the whole clip before responding (see server/routes.ts,
  // sendPersonaTTS), so a bare fetch() here would resolve as soon as headers
  // arrive — well before the server's in-memory cache is actually populated.
  // Drain the body fully so that cache is warm by the time playback
  // re-requests this exact URL; otherwise the "prefetch" would race the real
  // playback fetch and both would hit Fish Audio, doubling cost and latency
  // instead of saving it.
  await res.arrayBuffer().catch(() => {});
  return url;
}

export async function playPrefetchedAudio(
  audioUri: string,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const vol = options?.volume ?? 1.0;

  await ensureAudioMode();

  const { sound } = await Audio.Sound.createAsync(
    { uri: audioUri },
    { shouldPlay: false, volume: vol }
  );
  await sound.playAsync();
  return sound;
}

// Strips markdown-style stage directions (*laughs*, *scoffs, laughing*, etc.)
// from text before it reaches the TTS engine. These are meant as flavor for
// on-screen transcript text, not literal words — without this, Fish Audio
// reads the asterisks and action words out loud verbatim (e.g. "asterisk
// laughs asterisk boy you musta..."), which is exactly what makes canned
// reaction/catchphrase lines sound broken when spoken.
export function stripStageDirectionsForTTS(text: string): string {
  return text.replace(/\*[^*]*\*/g, "").replace(/\s{2,}/g, " ").trim();
}

export async function playTTS(
  endpoint: string,
  body: Record<string, any>,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const cleanedBody = typeof body.text === "string" ? { ...body, text: stripStageDirectionsForTTS(body.text) } : body;
  const url = buildTTSUrl(endpoint, cleanedBody);
  return playAudioFromUrl(url, { volume: options?.volume });
}

let _trumpSpeakingCount = 0;
let _trumpQueue: Promise<void> = Promise.resolve();

export function isTrumpCurrentlySpeaking(): boolean {
  return _trumpSpeakingCount > 0;
}

export async function playTrumpTTS(
  endpoint: string,
  body: Record<string, any>,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const previous = _trumpQueue;
  let completionResolve: () => void;
  let completed = false;

  const finish = () => {
    if (!completed) {
      completed = true;
      _trumpSpeakingCount = Math.max(0, _trumpSpeakingCount - 1);
      completionResolve!();
    }
  };

  const completionPromise = new Promise<void>((resolve) => {
    completionResolve = resolve;
  });

  _trumpQueue = completionPromise;
  _trumpSpeakingCount++;

  try {
    await previous;
  } catch {}

  let sound: Audio.Sound;
  try {
    sound = await playTTS(endpoint, body, options);
  } catch (err) {
    finish();
    throw err;
  }

  const origSetHandler = sound.setOnPlaybackStatusUpdate.bind(sound);
  let externalHandler: ((status: any) => void) | null = null;

  origSetHandler((status: any) => {
    if (externalHandler) externalHandler(status);
    if (!status.isLoaded || status.didJustFinish) {
      finish();
    }
  });

  const origUnload = sound.unloadAsync.bind(sound);
  sound.unloadAsync = async () => {
    finish();
    return origUnload();
  };

  sound.setOnPlaybackStatusUpdate = (handler: (status: any) => void) => {
    externalHandler = handler;
  };

  return sound;
}

export async function playTrumpAudioFromUrl(
  url: string,
  options?: { method?: string; body?: any; headers?: Record<string, string>; volume?: number; rate?: number }
): Promise<Audio.Sound> {
  const previous = _trumpQueue;
  let completionResolve: () => void;
  let completed = false;

  const finish = () => {
    if (!completed) {
      completed = true;
      _trumpSpeakingCount = Math.max(0, _trumpSpeakingCount - 1);
      completionResolve!();
    }
  };

  const completionPromise = new Promise<void>((resolve) => {
    completionResolve = resolve;
  });

  _trumpQueue = completionPromise;
  _trumpSpeakingCount++;

  try {
    await previous;
  } catch {}

  let sound: Audio.Sound;
  try {
    sound = await playAudioFromUrl(url, { ...options, preferStreaming: true });
  } catch (err) {
    finish();
    throw err;
  }

  const origSetHandler = sound.setOnPlaybackStatusUpdate.bind(sound);
  let externalHandler: ((status: any) => void) | null = null;

  origSetHandler((status: any) => {
    if (externalHandler) externalHandler(status);
    if (!status.isLoaded || status.didJustFinish) {
      finish();
    }
  });

  const origUnload = sound.unloadAsync.bind(sound);
  sound.unloadAsync = async () => {
    finish();
    return origUnload();
  };

  sound.setOnPlaybackStatusUpdate = (handler: (status: any) => void) => {
    externalHandler = handler;
  };

  return sound;
}
