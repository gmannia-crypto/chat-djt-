#!/usr/bin/env node
/**
 * arena-recordings.test.ts
 *
 * Plain tsx tests for generateShareText / pickBiggestOddsFlip in
 * lib/arena-recordings.ts
 *
 * Run:
 *   npx tsx lib/arena-recordings.test.ts
 *
 * Covers:
 *  1. Legacy recording (oddsHistory === undefined) → share text contains the
 *     "odds data unavailable" note, never a flip line.
 *  2. New recording with an empty oddsHistory ([]) → share text contains
 *     neither the flip line nor the unavailable note.
 *  3. New recording with odds shifts but no shift that qualifies as a flip
 *     (same rank, i.e. delta === 0) → no flip line, no unavailable note.
 *  4. New recording with a qualifying odds flip → share text contains the
 *     flip line and does NOT contain the unavailable note.
 *  5. A disqualification that arrives before a replay save finishes is
 *     persisted on that replay only.
 *  6. A disqualification that arrives after a replay save finishes is
 *     persisted on that replay only.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  generateShareText,
  getRecordings,
  markRecordingLieDisqualified,
  pickBiggestOddsFlip,
  saveRecording,
  type ArenaRecording,
  type OddsShift,
} from "./arena-recordings.js";

// ─── Mini assertion harness ───────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// ─── Shared fixture helpers ───────────────────────────────────────────────────

function makeRecording(
  overrides: Partial<ArenaRecording> = {}
): ArenaRecording {
  return {
    id: "test-1",
    topic: "Test Topic",
    startTime: 0,
    duration: 120,
    personas: ["trump", "biden"],
    messages: [],
    messageCount: 10,
    ...overrides,
  };
}

const QUALIFYING_SHIFT: OddsShift = {
  personaId: "trump",
  personaName: "Donald Trump",
  fromLabel: "UNDERDOG",
  toLabel: "FAVORITE",
  atTime: 45000,
};

const NON_QUALIFYING_SHIFT: OddsShift = {
  personaId: "trump",
  personaName: "Donald Trump",
  fromLabel: "FAVORITE",
  toLabel: "FAVORITE", // same rank — delta === 0
  atTime: 10000,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("\n1. Legacy recording (oddsHistory === undefined)");
{
  const rec = makeRecording(); // no oddsHistory key → undefined
  const text = generateShareText(rec);
  assert(
    text.includes("odds data unavailable"),
    "share text contains the unavailable note"
  );
  assert(
    !text.includes("flipped"),
    "share text does NOT contain a flip line"
  );
}

console.log("\n2. New recording with empty oddsHistory");
{
  const rec = makeRecording({ oddsHistory: [] });
  const text = generateShareText(rec);
  assert(
    !text.includes("odds data unavailable"),
    "share text does NOT contain the unavailable note"
  );
  assert(
    !text.includes("flipped"),
    "share text does NOT contain a flip line"
  );
}

console.log("\n3. New recording with shifts but no qualifying flip");
{
  const rec = makeRecording({ oddsHistory: [NON_QUALIFYING_SHIFT] });
  const flip = pickBiggestOddsFlip(rec.oddsHistory);
  assert(flip === null, "pickBiggestOddsFlip returns null for zero-delta shifts");
  const text = generateShareText(rec);
  assert(
    !text.includes("odds data unavailable"),
    "share text does NOT contain the unavailable note"
  );
  assert(
    !text.includes("flipped"),
    "share text does NOT contain a flip line"
  );
}

console.log("\n4. New recording with a qualifying odds flip");
{
  const rec = makeRecording({ oddsHistory: [QUALIFYING_SHIFT] });
  const flip = pickBiggestOddsFlip(rec.oddsHistory);
  assert(flip !== null, "pickBiggestOddsFlip returns a shift");
  assert(
    flip?.personaName === "Donald Trump",
    "pickBiggestOddsFlip returns the correct persona"
  );
  const text = generateShareText(rec);
  assert(text.includes("flipped"), "share text contains the flip line");
  assert(
    text.includes("UNDERDOG → FAVORITE"),
    "share text contains the correct labels"
  );
  assert(
    !text.includes("odds data unavailable"),
    "share text does NOT contain the unavailable note"
  );
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function runDisqualificationPersistenceTest(): Promise<void> {
  let stored: string | null = null;
  const storage = AsyncStorage as unknown as {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
  const originalGetItem = storage.getItem;
  const originalSetItem = storage.setItem;
  storage.getItem = async () => stored;

  try {
    console.log("\n5. Verdict arrives before the local replay save completes");
    const saveStarted = deferred<void>();
    const finishSave = deferred<void>();
    storage.setItem = async (_key, value) => {
      stored = value;
      saveStarted.resolve();
      await finishSave.promise;
    };

    const beforeSave = makeRecording({ id: "verdict-first" });
    const unrelatedBeforeSave = makeRecording({ id: "unrelated-before" });
    const saveBeforeSaveCompletes = saveRecording(beforeSave);
    await saveStarted.promise;
    // This is the ordering used when the verdict callback wins the race with
    // AsyncStorage: the marker is requested while the replay write is open.
    const markBeforeSaveCompletes = markRecordingLieDisqualified(beforeSave.id);
    const unrelatedSave = saveRecording(unrelatedBeforeSave);
    finishSave.resolve();
    await Promise.all([saveBeforeSaveCompletes, markBeforeSaveCompletes, unrelatedSave]);

    let recordings = await getRecordings();
    assert(
      recordings.find((recording) => recording.id === beforeSave.id)?.lieDisqualified === true,
      "persists the marker when the verdict arrives before the replay save completes",
    );
    assert(
      recordings.find((recording) => recording.id === unrelatedBeforeSave.id)?.lieDisqualified !== true,
      "does not mark an unrelated replay in the verdict-first path",
    );

    console.log("\n6. Verdict arrives after the local replay save completes");
    stored = null;
    storage.setItem = async (_key, value) => {
      stored = value;
    };

    const afterSave = makeRecording({ id: "save-first" });
    const unrelatedAfterSave = makeRecording({ id: "unrelated-after" });
    await saveRecording(afterSave);
    const markAfterSaveCompletes = markRecordingLieDisqualified(afterSave.id);
    await saveRecording(unrelatedAfterSave);
    await markAfterSaveCompletes;

    recordings = await getRecordings();
    assert(
      recordings.find((recording) => recording.id === afterSave.id)?.lieDisqualified === true,
      "persists the marker when the verdict arrives after the replay save completes",
    );
    assert(
      recordings.find((recording) => recording.id === unrelatedAfterSave.id)?.lieDisqualified !== true,
      "does not mark an unrelated replay in the save-first path",
    );
  } finally {
    storage.getItem = originalGetItem;
    storage.setItem = originalSetItem;
  }
}

runDisqualificationPersistenceTest()
  .then(() => {
    console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
