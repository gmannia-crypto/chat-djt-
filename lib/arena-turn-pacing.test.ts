import assert from "node:assert/strict";
import { test } from "node:test";
import {
  arenaResponseTimeoutMs, arenaPlaybackStalled,
  canPrepareArenaReply, prepareArenaAudio, waitForArenaHandoff, withArenaResponseDeadline,
} from "./arena-turn-pacing";

const ready = {
  voiceEnabled: true, preparingOrPlaying: true, isCurrentLine: true, queueLength: 0,
  hasPreparedReply: false, busy: false,
};

test("prepare one reply during synthesis, even before duration/playback is known", () => {
  assert(canPrepareArenaReply(ready));
  for (const state of [
    { voiceEnabled: false }, { preparingOrPlaying: false }, { isCurrentLine: false }, { queueLength: 1 },
    { hasPreparedReply: true }, { busy: true },
  ]) assert.equal(canPrepareArenaReply({ ...ready, ...state }), false, JSON.stringify(state));
});

test("different voices synthesize concurrently; the same voice request is reused", async () => {
  const cache = new Map<string, Promise<string>>();
  let loads = 0;
  let finishFirst!: (uri: string) => void;
  const first = prepareArenaAudio(cache, "first", () => {
    loads++;
    return new Promise((resolve) => { finishFirst = resolve; });
  });
  const next = prepareArenaAudio(cache, "next", async () => { loads++; return "next URI"; });
  assert.equal(await next, "next URI", "next synthesis must not wait behind a cold current voice");
  assert.equal(prepareArenaAudio(cache, "first", async () => "duplicate"), first);
  finishFirst("first URI");
  assert.equal(await first, "first URI");
  assert.equal(loads, 2);
});

test("response deadlines retain normal-latency headroom and capped backoff", () => {
  assert.equal(arenaResponseTimeoutMs([1000]), 18000);
  assert.equal(arenaResponseTimeoutMs([16000]), 25600);
  assert.equal(arenaResponseTimeoutMs([1000], 1), 23000);
  assert.equal(arenaResponseTimeoutMs([16000], 2), 30000);
  assert.equal(arenaResponseTimeoutMs([NaN, -1]), arenaResponseTimeoutMs([]));
});

test("a prepared reply stays invisible until speech finishes", async () => {
  let audioBusy = true;
  let published = false;
  let waits = 0;
  const handoff = await waitForArenaHandoff(() => true, () => audioBusy, async () => {
    assert.equal(published, false);
    if (++waits === 3) audioBusy = false;
  });
  if (handoff) published = true;
  assert(published);
  assert.equal(waits, 3);
});

test("stop, changed history, or a replaced generation cancels a prepared handoff", async () => {
  let current = true;
  assert.equal(await waitForArenaHandoff(() => current, () => true, async () => {
    current = false;
  }), false);
  assert.equal(await waitForArenaHandoff(() => false, () => false), false);
});

test("muted mode advances text without waiting for audio", async () => {
  let waited = false;
  assert.equal(await waitForArenaHandoff(() => true, () => false, async () => {
    waited = true;
  }), true);
  assert.equal(waited, false);
});

test("a hung AI request is aborted even while its caller awaits it", async () => {
  const controller = new AbortController();
  let skipped = 0;
  await assert.rejects(withArenaResponseDeadline(
    () => new Promise(() => {}), controller, 10, () => skipped++,
  ), { name: "AbortError" });
  assert(controller.signal.aborted);
  assert.equal(skipped, 1);
});

test("JSON body reading is also bounded; late responses cannot publish", async () => {
  const controller = new AbortController();
  let resolveBody!: (value: string) => void;
  let published = false;
  const operation = async () => {
    await Promise.resolve("headers received");
    return await new Promise<string>((resolve) => { resolveBody = resolve; });
  };
  const request = withArenaResponseDeadline(operation, controller, 10, () => {}).then(() => { published = true; });
  await assert.rejects(request, { name: "AbortError" });
  resolveBody("late reply");
  await Promise.resolve();
  assert.equal(published, false);
});

test("completed requests remove their deadline instead of aborting later", async () => {
  const controller = new AbortController();
  let timeouts = 0;
  assert.equal(await withArenaResponseDeadline(async () => "reply", controller, 10, () => timeouts++), "reply");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(timeouts, 0);
  assert.equal(controller.signal.aborted, false);
});

test("stalled startup/progress recovers; healthy long speech is not cut off", () => {
  assert.equal(arenaPlaybackStalled(11999, 0, false), false);
  assert.equal(arenaPlaybackStalled(12000, 0, false), true);
  assert.equal(arenaPlaybackStalled(7999, 0, true), false);
  assert.equal(arenaPlaybackStalled(8000, 0, true), true);
  assert.equal(arenaPlaybackStalled(90000, 89000, true), false);
});