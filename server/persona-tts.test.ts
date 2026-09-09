#!/usr/bin/env node
/**
 * Regression checks for persona TTS streaming, caching, and in-flight
 * request de-duplication (server/persona-tts.ts). Fish Audio itself is
 * mocked throughout — these tests never make a real network call.
 *
 * Run:
 *   npx tsx server/persona-tts.test.ts
 */

import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import {
  sendPersonaTTS,
  fishAudioRequest,
  getCachedTTS,
  setCachedTTS,
  getFullTTSCacheKey,
  TTS_CACHE_MAX_BYTES,
  _testHooks,
  type SendPersonaTTSParams,
} from "./persona-tts.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed += 1;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed += 1;
  }
}

// A minimal stand-in for Express's Response: enough EventEmitter + writable
// surface for res.on/off("close"|"error"), setHeader, and Readable#pipe to
// work against it.
class FakeRes extends EventEmitter {
  headers: Record<string, string> = {};
  chunks: Buffer[] = [];
  writableEnded = false;
  sendCalled = false;

  setHeader(key: string, value: string) {
    this.headers[key] = value;
  }
  write(chunk: Buffer) {
    this.chunks.push(chunk);
    return true;
  }
  end() {
    this.writableEnded = true;
    this.emit("finish");
  }
  send(buf: Buffer) {
    this.sendCalled = true;
    this.chunks.push(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
    this.writableEnded = true;
    this.emit("finish");
  }
  off(event: string, listener: (...args: any[]) => void) {
    this.removeListener(event, listener);
    return this;
  }
  body(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

// Builds a fake fetch Response carrying a real Readable body so the
// production streaming code path (streamFactory identity in tests) runs
// unmodified against it.
function fakeUpstreamResponse(opts: {
  status?: number;
  bodyChunks?: Buffer[];
  chunkDelayMs?: number;
  streamError?: Error;
}): Response {
  const status = opts.status ?? 200;
  const ok = status >= 200 && status < 300;
  const bodyChunks = opts.bodyChunks ?? [Buffer.from("fish-audio-chunk-1"), Buffer.from("fish-audio-chunk-2")];
  const stream = new Readable({ read() {} });
  (async () => {
    // Always yield at least one tick before the first push/error so the
    // caller has a chance to attach its "data"/"error"/"end" listeners
    // first — mirrors real network timing where bytes never arrive
    // synchronously within the same tick the Response is constructed.
    await new Promise((r) => setImmediate(r));
    for (const chunk of bodyChunks) {
      if (opts.chunkDelayMs) await new Promise((r) => setTimeout(r, opts.chunkDelayMs));
      stream.push(chunk);
    }
    if (opts.streamError) {
      stream.emit("error", opts.streamError);
    } else {
      stream.push(null);
    }
  })();
  return {
    ok,
    status,
    body: stream,
    text: async () => `mock error body (status ${status})`,
    arrayBuffer: async () => {
      const buf = Buffer.concat(bodyChunks);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },
  } as unknown as Response;
}

function countingFetch(factory: () => Response, delayMs = 0) {
  let calls = 0;
  const fn = (async (..._args: any[]) => {
    calls += 1;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return factory();
  }) as unknown as typeof fetch;
  return { fetchImpl: fn, getCalls: () => calls };
}

function baseParams(overrides: Partial<SendPersonaTTSParams> = {}): SendPersonaTTSParams {
  return {
    text: "hello there",
    voiceId: "test-voice",
    speed: 1.0,
    apiKey: "test-key",
    bleepRequested: true,
    hasCurseWords: () => false,
    overlayBleeps: async (buf) => buf,
    ...overrides,
  };
}

// Streams straight through the Node identity stream passed to it so the
// fake upstream body drives the same pipe()/data/end wiring production uses.
const identityStreamFactory = (body: any) => body as Readable;

async function testCacheMissThenHit() {
  console.log("\ncache miss streams through Fish Audio, then a hit is served from cache without re-fetching");
  _testHooks().clear();
  const text = "unique line for cache-miss-then-hit test";
  const { fetchImpl, getCalls } = countingFetch(() => fakeUpstreamResponse({}));

  const res1 = new FakeRes();
  await sendPersonaTTS(res1 as any, baseParams({ text, fetchImpl, streamFactory: identityStreamFactory }));
  assert(res1.body().toString() === "fish-audio-chunk-1fish-audio-chunk-2", "streamed body matches upstream chunks");
  assert(getCalls() === 1, "exactly one Fish Audio call was made on cache miss");

  const key = getFullTTSCacheKey(text, "test-voice", 1.0, 0, undefined);
  assert(getCachedTTS(key) !== null, "the streamed audio populated the cache after completion");

  const res2 = new FakeRes();
  await sendPersonaTTS(res2 as any, baseParams({ text, fetchImpl, streamFactory: identityStreamFactory }));
  assert(res2.body().toString() === "fish-audio-chunk-1fish-audio-chunk-2", "cache-hit response matches original bytes");
  assert(getCalls() === 1, "no additional Fish Audio call was made on cache hit");
}

async function testConcurrentDuplicateRequestsDeduplicate() {
  console.log("\ntwo concurrent identical requests share a single Fish Audio call");
  _testHooks().clear();
  const text = "unique line for concurrency dedup test";
  // A delay ensures both requests' synchronous "is one already in flight?"
  // checks would race if the in-flight slot weren't reserved before the
  // network call starts.
  const { fetchImpl, getCalls } = countingFetch(() => fakeUpstreamResponse({}), 10);

  const res1 = new FakeRes();
  const res2 = new FakeRes();
  await Promise.all([
    sendPersonaTTS(res1 as any, baseParams({ text, fetchImpl, streamFactory: identityStreamFactory })),
    sendPersonaTTS(res2 as any, baseParams({ text, fetchImpl, streamFactory: identityStreamFactory })),
  ]);

  assert(getCalls() === 1, "only one upstream Fish Audio call happened for two concurrent identical requests");
  assert(res1.body().toString() === res2.body().toString(), "both callers received identical audio bytes");
  assert(_testHooks().inFlightSize() === 0, "the in-flight slot is released once the leader finishes");
}

async function testUpstreamFailurePropagatesAndCleansUp() {
  console.log("\nan upstream failure rejects, leaves nothing cached, and releases the in-flight slot");
  _testHooks().clear();
  const text = "unique line for upstream failure test";
  const fetchImpl = (async () => {
    throw new Error("network is down");
  }) as unknown as typeof fetch;

  let threw = false;
  try {
    await sendPersonaTTS(new FakeRes() as any, baseParams({ text, fetchImpl, streamFactory: identityStreamFactory }));
  } catch {
    threw = true;
  }
  assert(threw, "sendPersonaTTS rejects when Fish Audio never responds");

  const key = getFullTTSCacheKey(text, "test-voice", 1.0, 0, undefined);
  assert(getCachedTTS(key) === null, "a failed generation is not cached");
  assert(_testHooks().inFlightSize() === 0, "the in-flight slot is released after a connection failure");
}

async function testStreamErrorMidTransferEndsGracefully() {
  console.log("\na stream error after headers are sent ends the response instead of throwing");
  _testHooks().clear();
  const text = "unique line for mid-stream error test";
  const fetchImpl = (async () =>
    fakeUpstreamResponse({ bodyChunks: [Buffer.from("partial-chunk")], streamError: new Error("upstream dropped") })
  ) as unknown as typeof fetch;

  const res = new FakeRes();
  await sendPersonaTTS(res as any, baseParams({ text, fetchImpl, streamFactory: identityStreamFactory }));

  assert(res.writableEnded, "the client response is ended even though generation failed mid-stream");
  const key = getFullTTSCacheKey(text, "test-voice", 1.0, 0, undefined);
  assert(getCachedTTS(key) === null, "a partially-streamed, failed clip is not cached");
  assert(_testHooks().inFlightSize() === 0, "the in-flight slot is released after a stream error");
}

async function testClientDisconnectDoesNotCrash() {
  console.log("\na client disconnecting mid-stream is handled without throwing");
  _testHooks().clear();
  const text = "unique line for client disconnect test";
  const { fetchImpl } = countingFetch(() => fakeUpstreamResponse({ chunkDelayMs: 5 }));

  const res = new FakeRes();
  const donePromise = sendPersonaTTS(res as any, baseParams({ text, fetchImpl, streamFactory: identityStreamFactory }));
  setTimeout(() => res.emit("close"), 2);

  let threw = false;
  try {
    await donePromise;
  } catch {
    threw = true;
  }
  assert(!threw, "an early client disconnect does not reject sendPersonaTTS");
}

async function testBleepPathBuffersAndDeduplicates() {
  console.log("\nthe bleep-overlay path buffers fully, applies the overlay once, and dedupes concurrent callers");
  _testHooks().clear();
  const text = "this bullshit line needs a bleep";
  const { fetchImpl, getCalls } = countingFetch(() => fakeUpstreamResponse({ bodyChunks: [Buffer.from("raw-audio")] }), 5);
  let overlayCalls = 0;
  const overlayBleeps = async (buf: Buffer) => {
    overlayCalls += 1;
    return Buffer.concat([buf, Buffer.from("-bleeped")]);
  };
  const hasCurseWords = (t: string) => /bullshit/.test(t);

  const res1 = new FakeRes();
  const res2 = new FakeRes();
  await Promise.all([
    sendPersonaTTS(res1 as any, baseParams({ text, fetchImpl, bleepRequested: true, hasCurseWords, overlayBleeps, streamFactory: identityStreamFactory })),
    sendPersonaTTS(res2 as any, baseParams({ text, fetchImpl, bleepRequested: true, hasCurseWords, overlayBleeps, streamFactory: identityStreamFactory })),
  ]);

  assert(getCalls() === 1, "concurrent bleep-required requests for the same line share one Fish Audio call");
  assert(res1.body().toString() === "raw-audio-bleeped", "bleep overlay was applied to the buffered audio");
  assert(res1.body().toString() === res2.body().toString(), "both bleep-path callers received the same overlaid audio");
}

async function testFishAudioRequestDirectDedup() {
  console.log("\nfishAudioRequest itself de-duplicates concurrent identical buffered requests");
  _testHooks().clear();
  const { fetchImpl, getCalls } = countingFetch(() => fakeUpstreamResponse({ bodyChunks: [Buffer.from("buffered-audio")] }), 5);

  const [a, b] = await Promise.all([
    fishAudioRequest("shared narration line", "voiceA", 1.0, "key", 3, 0, undefined, fetchImpl),
    fishAudioRequest("shared narration line", "voiceA", 1.0, "key", 3, 0, undefined, fetchImpl),
  ]);

  assert(getCalls() === 1, "only one upstream call for two concurrent identical fishAudioRequest calls");
  assert(a.toString() === "buffered-audio" && b.toString() === a.toString(), "both callers get the same buffer");
}

async function testCacheKeyDoesNotCollideOnSharedPrefix() {
  console.log("\ntwo different lines sharing a 200+ character prefix get distinct cache entries and in-flight slots");
  _testHooks().clear();
  const prefix = "A".repeat(250);
  const textA = prefix + " ending in Alpha";
  const textB = prefix + " ending in Bravo";
  const bodyA = Buffer.from("audio-for-alpha");
  const bodyB = Buffer.from("audio-for-bravo");

  const fetchA = (async () => fakeUpstreamResponse({ bodyChunks: [bodyA] })) as unknown as typeof fetch;
  const fetchB = (async () => fakeUpstreamResponse({ bodyChunks: [bodyB] })) as unknown as typeof fetch;

  const resA = new FakeRes();
  const resB = new FakeRes();
  await Promise.all([
    sendPersonaTTS(resA as any, baseParams({ text: textA, fetchImpl: fetchA, streamFactory: identityStreamFactory })),
    sendPersonaTTS(resB as any, baseParams({ text: textB, fetchImpl: fetchB, streamFactory: identityStreamFactory })),
  ]);

  assert(resA.body().toString() === "audio-for-alpha", "the line ending in Alpha gets its own audio, not Bravo's");
  assert(resB.body().toString() === "audio-for-bravo", "the line ending in Bravo gets its own audio, not Alpha's");

  const keyA = getFullTTSCacheKey(textA, "test-voice", 1.0, 0, undefined);
  const keyB = getFullTTSCacheKey(textB, "test-voice", 1.0, 0, undefined);
  assert(keyA !== keyB, "cache keys for the two lines are distinct despite sharing a long common prefix");
  assert(getCachedTTS(keyA)?.toString() === "audio-for-alpha", "cache entry A holds Alpha's audio");
  assert(getCachedTTS(keyB)?.toString() === "audio-for-bravo", "cache entry B holds Bravo's audio");
}

function testOversizedBufferIsNotCached() {
  console.log("\na single clip larger than the whole byte budget is not cached (rather than breaking the budget)");
  _testHooks().clear();
  const key = "oversized-clip-test-key";
  const oversized = Buffer.alloc(TTS_CACHE_MAX_BYTES + 1024, 7);
  setCachedTTS(key, oversized);

  assert(getCachedTTS(key) === null, "an oversized clip is not stored in the cache");
  assert(_testHooks().cacheBytes() <= TTS_CACHE_MAX_BYTES, `cache bytes (${_testHooks().cacheBytes()}) never exceed the ${TTS_CACHE_MAX_BYTES} byte budget`);
  assert(_testHooks().cacheSize() === 0, "no entry was added for the oversized clip");
}

function testCacheByteBudgetEvictsOldestEntries() {
  console.log("\nthe cache evicts oldest entries once the total byte budget would be exceeded");
  _testHooks().clear();
  const chunkSize = 6 * 1024 * 1024; // 6MB; 6 of these exceed the 30MB budget
  const keys: string[] = [];
  for (let i = 0; i < 6; i++) {
    const key = `bytecap-test-key-${i}`;
    keys.push(key);
    setCachedTTS(key, Buffer.alloc(chunkSize, i));
  }

  const hooks = _testHooks();
  assert(hooks.cacheBytes() <= TTS_CACHE_MAX_BYTES, `total cached bytes (${hooks.cacheBytes()}) stay within the ${TTS_CACHE_MAX_BYTES} byte budget`);
  assert(getCachedTTS(keys[0]) === null, "the oldest entry was evicted once the byte budget was exceeded");
  assert(getCachedTTS(keys[keys.length - 1]) !== null, "the newest entry is retained");
}

async function main() {
  await testCacheMissThenHit();
  await testConcurrentDuplicateRequestsDeduplicate();
  await testUpstreamFailurePropagatesAndCleansUp();
  await testStreamErrorMidTransferEndsGracefully();
  await testClientDisconnectDoesNotCrash();
  await testBleepPathBuffersAndDeduplicates();
  await testFishAudioRequestDirectDedup();
  await testCacheKeyDoesNotCollideOnSharedPrefix();
  testOversizedBufferIsNotCached();
  testCacheByteBudgetEvictsOldestEntries();

  _testHooks().clear();

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed, ${passed} passed.`);
    process.exitCode = 1;
  } else {
    console.log(`\n${passed} assertions passed.`);
  }
}

void main();
