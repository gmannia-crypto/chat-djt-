// Persona TTS: Fish Audio network calls, in-memory caching, and streaming
// response delivery, isolated from server/routes.ts so this logic can be
// unit-tested in isolation (mocked fetch/Response) without booting Express
// or the rest of the route table.
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { setTimeout as nodeSetTimeout, clearTimeout as nodeClearTimeout } from "node:timers";
import { Pool } from "pg";
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

// ── Shared-store persistence ─────────────────────────────────────────────
// The in-memory cache above is wiped on every server restart/deploy, which
// meant the first debate after a deploy re-paid full Fish Audio latency
// (11-18s) for lines — persona openers, moderator stock phrases, common
// rebuttals — that were already cached moments before. This project's
// production deployment target is "autoscale", where a redeploy or a
// scale-to-zero cold start hands the process a brand-new, empty local
// filesystem — a same-instance disk file would never be visible to the
// replacement instance. So the cache is mirrored to a small table in the
// existing Postgres database instead: every instance (and the one that
// replaces it) reads and writes the same shared row set, regardless of
// which container ends up serving the request. Writes are debounced (a
// burst of cache writes during a live debate collapses into one sync) and
// only the newly-added entries since the last sync are upserted, keeping
// the steady-state write volume small.
let TTS_CACHE_TABLE = "tts_cache";
const ttsCacheDdl = () => `
  CREATE TABLE IF NOT EXISTS ${TTS_CACHE_TABLE} (
    cache_key TEXT PRIMARY KEY,
    audio_data BYTEA NOT NULL,
    created_at BIGINT NOT NULL
  )
`;
const TTS_CACHE_SAVE_DEBOUNCE_MS = 5000;

let persistenceEnabled = true;
// Typed as `any`: this project's tsconfig (expo/tsconfig.base) pulls in DOM
// lib globals, which shadows setTimeout's Node overload (NodeJS.Timeout)
// with the browser one (number) even when importing from "node:timers"
// directly — so neither NodeJS.Timeout nor ReturnType<typeof setTimeout>
// type-checks correctly here. This code only ever runs under Node.
let saveTimer: any = null;
let saveInFlight: Promise<void> | null = null;
let saveQueued = false;
let pendingSync = new Map<string, { buffer: Buffer; timestamp: number }>();

// Cache warming is a nice-to-have, never a startup requirement — an
// unreachable/black-holed database must not be able to hang server boot
// waiting on a connection that never resolves. Both a short connection
// timeout on the pool itself and the explicit race in loadPersistedTTSCache
// below exist to guarantee that.
const TTS_CACHE_DB_TIMEOUT_MS = 3000;

let dbPool: Pool | null = null;
function getDbPool(): Pool | null {
  // No DATABASE_URL means there's nowhere shared to persist to (e.g. some
  // local/offline dev contexts) — the in-memory cache still works for the
  // life of that one process, it just won't survive a restart.
  if (!process.env.DATABASE_URL) return null;
  if (!dbPool) {
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: TTS_CACHE_DB_TIMEOUT_MS,
      // Bounds EVERY query issued on this pool (DDL, transaction statements,
      // selects) at the driver level, not just connection acquisition — a
      // connected-but-stalled database (e.g. a lock held elsewhere) must not
      // be able to hang saveInFlight/startup warming indefinitely.
      statement_timeout: TTS_CACHE_DB_TIMEOUT_MS,
      query_timeout: TTS_CACHE_DB_TIMEOUT_MS,
    });
    dbPool.on("error", (err: any) => {
      // Idle-client errors (e.g. the connection dropping in the
      // background) must not crash the process — this pool is only ever
      // used for best-effort cache warming/persistence.
      console.warn("TTS cache: pool error:", err?.message || err);
    });
  }
  return dbPool;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // Typed as `any` for the same DOM-lib-shadowing reason as `saveTimer`
    // above — this only ever runs under Node.
    const timer: any = nodeSetTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    timer.unref();
    promise.then(
      (value) => { nodeClearTimeout(timer); resolve(value); },
      (err) => { nodeClearTimeout(timer); reject(err); }
    );
  });
}

// Test-only: lets a test force the next N persist attempts to fail before
// ever reaching the database, so the outage/retry-bounding paths can be
// exercised deterministically instead of needing a real DB outage.
let forcedPersistFailures = 0;

let tableEnsured: Promise<void> | null = null;
function ensureTable(pool: Pool): Promise<void> {
  if (forcedPersistFailures > 0) {
    forcedPersistFailures--;
    return Promise.reject(new Error("forced test failure"));
  }
  if (!tableEnsured) {
    tableEnsured = pool.query(ttsCacheDdl()).then(() => {}).catch((err: any) => {
      tableEnsured = null; // allow the next sync to retry DDL creation
      throw err;
    });
  }
  return tableEnsured as Promise<void>;
}

function scheduleCachePersist(): void {
  if (!persistenceEnabled || saveTimer) return;
  saveTimer = nodeSetTimeout(() => {
    saveTimer = null;
    void persistCacheToStore();
  }, TTS_CACHE_SAVE_DEBOUNCE_MS);
  saveTimer.unref();
}

async function persistCacheToStore(): Promise<void> {
  if (saveInFlight) {
    saveQueued = true;
    return;
  }
  saveInFlight = (async () => {
    try {
      const pool = getDbPool();
      if (!pool || pendingSync.size === 0) return;
      await withTimeout(ensureTable(pool), TTS_CACHE_DB_TIMEOUT_MS, "TTS cache: ensure table");

      const toSync = pendingSync;
      pendingSync = new Map();

      try {
        const client: any = await withTimeout<any>(pool.connect(), TTS_CACHE_DB_TIMEOUT_MS, "TTS cache: DB connect");
        try {
          await client.query("BEGIN");
          for (const [key, entry] of toSync) {
            await client.query(
              `INSERT INTO ${TTS_CACHE_TABLE} (cache_key, audio_data, created_at) VALUES ($1, $2, $3)
               ON CONFLICT (cache_key) DO UPDATE SET audio_data = EXCLUDED.audio_data, created_at = EXCLUDED.created_at`,
              [key, entry.buffer, entry.timestamp]
            );
          }
          // Bound the shared table the same way the in-memory cache is
          // bounded — by TTL, by row count, AND by aggregate bytes. Rows
          // can each be as large as the full TTS_CACHE_MAX_BYTES budget, so
          // row count alone could let the table (shared across every
          // autoscale instance that has ever written to it) grow to
          // TTS_CACHE_MAX * TTS_CACHE_MAX_BYTES in the worst case — the
          // byte-budget delete below prevents that regardless of row sizes.
          await client.query(`DELETE FROM ${TTS_CACHE_TABLE} WHERE created_at < $1`, [Date.now() - TTS_CACHE_TTL]);
          await client.query(
            `DELETE FROM ${TTS_CACHE_TABLE} WHERE cache_key NOT IN (
               SELECT cache_key FROM ${TTS_CACHE_TABLE} ORDER BY created_at DESC LIMIT $1
             )`,
            [TTS_CACHE_MAX]
          );
          await client.query(
            `DELETE FROM ${TTS_CACHE_TABLE} WHERE cache_key IN (
               SELECT cache_key FROM (
                 SELECT cache_key,
                        SUM(octet_length(audio_data)) OVER (ORDER BY created_at DESC ROWS UNBOUNDED PRECEDING) AS bytes_through
                 FROM ${TTS_CACHE_TABLE}
               ) ranked
               WHERE bytes_through > $1
             )`,
            [TTS_CACHE_MAX_BYTES]
          );
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        // The batch never made it to the shared store (connection failure,
        // timeout, or a failed/rolled-back transaction) — put it back so
        // the next debounced sync retries it instead of silently losing
        // whatever was generated in this window. Entries the caller has
        // since overwritten in pendingSync (newer timestamp already queued)
        // are left as-is rather than clobbered by this stale retry data.
        for (const [key, entry] of toSync) {
          // Only restore entries still live in the in-memory cache. One
          // that was evicted while this batch was in flight is gone for
          // good — re-queuing it would let the retry buffer outlive (and
          // outgrow) the bounded in-memory cache during a prolonged outage.
          if (!pendingSync.has(key) && ttsCache.has(key)) pendingSync.set(key, entry);
        }
        saveQueued = true; // make sure the restored batch gets retried even if nothing new arrives
        throw err;
      }
    } catch (err: any) {
      console.warn("TTS cache: failed to persist cache to shared store:", err?.message || err);
      // Covers failures before the batch was even taken out of pendingSync
      // (e.g. ensureTable() timing out) — those entries are still sitting
      // in pendingSync untouched, so make sure a retry gets scheduled
      // rather than leaving them stuck there until the next unrelated
      // setCachedTTS call happens to trigger one.
      if (pendingSync.size > 0) saveQueued = true;
    } finally {
      saveInFlight = null;
      if (saveQueued) {
        saveQueued = false;
        scheduleCachePersist();
      }
    }
  })();
  await saveInFlight;
}

// Loads whatever survived from a previous instance into this process's
// in-memory cache. Call once at server boot, before traffic starts
// flowing, so frequently-reused clips are already warm for the first
// request after a restart, redeploy, or autoscale cold start — on any
// instance — instead of needing to be regenerated from scratch.
//
// Entries are re-validated exactly like a normal cache hit would be: TTL
// expiry still applies (a row that sat past TTS_CACHE_TTL is dropped, same
// as if it had aged out in memory), and emotion-tagged keys embed
// PERSONA_EMOTION_MAP_VERSION, so a version bump between the instance that
// wrote the row and the one loading it means the key simply won't match
// anything looked up post-boot — those stale rows are skipped here rather
// than wasting cache slots on clips nothing will ever request again.
export async function loadPersistedTTSCache(): Promise<void> {
  const pool = getDbPool();
  if (!pool) return;
  try {
    await withTimeout(ensureTable(pool), TTS_CACHE_DB_TIMEOUT_MS, "TTS cache: ensure table");

    // Step 1: fetch metadata only (no audio_data) so we can pick exactly
    // which rows fit the existing 30MB byte budget WITHOUT ever pulling a
    // full table's worth of BYTEA payloads across the wire first. Up to
    // TTS_CACHE_MAX rows at up to TTS_CACHE_MAX_BYTES each could otherwise
    // mean materializing gigabytes before the in-process budget check ever
    // runs — octet_length() is computed server-side and returns only an
    // integer per row.
    const { rows: meta } = await withTimeout<{ rows: Array<{ cache_key: string; created_at: string; sz: string }> }>(
      pool.query(
        `SELECT cache_key, created_at, octet_length(audio_data) AS sz FROM ${TTS_CACHE_TABLE}
         WHERE created_at >= $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [Date.now() - TTS_CACHE_TTL, TTS_CACHE_MAX]
      ),
      TTS_CACHE_DB_TIMEOUT_MS,
      "TTS cache: load metadata query"
    );

    // Walk newest-first (matching setCachedTTS/getCachedTTS recency
    // semantics) and keep only the keys that fit within the same
    // TTS_CACHE_MAX_BYTES budget the in-memory cache itself enforces, so
    // the follow-up fetch below never pulls more than one cache's worth of
    // audio bytes regardless of how large the table has grown.
    const keysToLoad: string[] = [];
    let staleVersionCount = 0;
    let budgetBytes = 0;
    for (const row of meta) {
      const emotionVersionMatch = row.cache_key.match(/_ev(\d+)(?:_|$)/);
      if (emotionVersionMatch && Number(emotionVersionMatch[1]) !== PERSONA_EMOTION_MAP_VERSION) {
        staleVersionCount++;
        continue;
      }
      const sz = Number(row.sz);
      if (sz <= 0 || sz > TTS_CACHE_MAX_BYTES) continue;
      if (keysToLoad.length >= TTS_CACHE_MAX || budgetBytes + sz > TTS_CACHE_MAX_BYTES) break;
      keysToLoad.push(row.cache_key);
      budgetBytes += sz;
    }

    let loaded = 0;
    if (keysToLoad.length > 0) {
      // Step 2: fetch actual audio bytes only for the keys selected above —
      // bounded to at most TTS_CACHE_MAX_BYTES total, the same ceiling the
      // in-memory cache already enforces.
      const { rows } = await withTimeout<{ rows: Array<{ cache_key: string; audio_data: Buffer; created_at: string }> }>(
        pool.query(
          `SELECT cache_key, audio_data, created_at FROM ${TTS_CACHE_TABLE}
           WHERE cache_key = ANY($1)
           ORDER BY created_at ASC`,
          [keysToLoad]
        ),
        TTS_CACHE_DB_TIMEOUT_MS,
        "TTS cache: load audio query"
      );

      // The in-memory Map preserves insertion order and setCachedTTS's
      // eviction always removes the FIRST (oldest-inserted) key when the
      // cache is full — so rows must be inserted oldest-to-newest here, or
      // freshly-warmed entries would look "oldest" to the eviction loop
      // and get evicted first by the very next cache writes. The query
      // above already orders ascending by created_at for that reason.
      for (const row of rows) {
        const buffer = Buffer.isBuffer(row.audio_data) ? row.audio_data : Buffer.from(row.audio_data);
        if (buffer.length === 0 || buffer.length > TTS_CACHE_MAX_BYTES) continue;
        if (ttsCache.size >= TTS_CACHE_MAX || ttsCacheBytes + buffer.length > TTS_CACHE_MAX_BYTES) break;

        ttsCache.set(row.cache_key, { buffer, timestamp: Number(row.created_at) });
        ttsCacheBytes += buffer.length;
        loaded++;
      }
    }
    const skippedStaleVersion = staleVersionCount;

    if (loaded > 0 || skippedStaleVersion > 0) {
      console.log(
        `TTS cache: warmed ${loaded} entr${loaded === 1 ? "y" : "ies"} from the shared store` +
        (skippedStaleVersion > 0 ? ` (skipped ${skippedStaleVersion} from a stale emotion-map version)` : "") +
        ` — ${(ttsCacheBytes / (1024 * 1024)).toFixed(1)}MB warm`
      );
    }
  } catch (err: any) {
    console.warn("TTS cache: failed to load persisted cache from the shared store:", err?.message || err);
  }
}

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
    // A TTL-expired entry is gone from the live cache — it must not keep
    // living on in the pending-write/retry buffer either, or a long-running
    // process with a stalled DB could accumulate expired-but-still-pending
    // buffers indefinitely even though the live cache stays bounded.
    pendingSync.delete(key);
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
    // A clip evicted from the in-memory cache is gone for good — it must
    // not linger in the pending-write/retry buffer either, or a prolonged
    // DB outage would let pendingSync grow without bound (every generated
    // clip ever evicted, forever) even though the live cache stays capped.
    pendingSync.delete(oldestKey);
  }
  const timestamp = Date.now();
  ttsCache.set(key, { buffer, timestamp });
  ttsCacheBytes += buffer.length;
  if (persistenceEnabled) {
    pendingSync.set(key, { buffer, timestamp });
    scheduleCachePersist();
  }
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
      pendingSync.clear();
    },
    cacheSize: () => ttsCache.size,
    cacheBytes: () => ttsCacheBytes,
    inFlightSize: () => ttsRawInFlight.size,
    pendingSyncSize: () => pendingSync.size,
    // Tests exercise setCachedTTS directly and must never touch the real
    // filesystem (no ambient TTS_CACHE_DIR override, no shared machine
    // state to pollute). Disabled by default in the test suite; see
    // persona-tts.test.ts.
    disablePersistence() {
      persistenceEnabled = false;
      if (saveTimer) {
        nodeClearTimeout(saveTimer);
        saveTimer = null;
      }
      pendingSync.clear();
    },
    enablePersistence() {
      persistenceEnabled = true;
    },
    // Points shared-store persistence at a scratch table so a test can
    // round-trip the actual save/load path against the real database
    // without touching the "tts_cache" table a live server would use.
    setTableName(name: string) {
      TTS_CACHE_TABLE = name;
      tableEnsured = null; // force re-running CREATE TABLE for the new name
    },
    // Forces an immediate sync, bypassing the debounce timer, so a test
    // doesn't have to wait TTS_CACHE_SAVE_DEBOUNCE_MS for the write to land.
    async flushPersistence() {
      if (saveTimer) {
        nodeClearTimeout(saveTimer);
        saveTimer = null;
      }
      await persistCacheToStore();
    },
    async dropTestTable() {
      const pool = getDbPool();
      if (pool) await pool.query(`DROP TABLE IF EXISTS ${TTS_CACHE_TABLE}`);
    },
    // Forces the next N persist attempts to fail before ever reaching the
    // database, so outage/retry-bounding behavior can be exercised
    // deterministically instead of needing a real DB outage.
    forceNextPersistFailures(n: number) {
      forcedPersistFailures = n;
    },
    // Directly back-dates a live cache entry's timestamp so a test can
    // force deterministic TTL expiry on the next getCachedTTS() call
    // instead of waiting out the real TTS_CACHE_TTL window.
    expireEntry(key: string) {
      const entry = ttsCache.get(key);
      if (entry) entry.timestamp = 0;
    },
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
