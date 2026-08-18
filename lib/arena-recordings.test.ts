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

async function runDisqualificationPersistenceTest(): Promise<void> {
  console.log("\n5. Concurrent saves and a late disqualification preserve every replay");
  let stored: string | null = null;
  const storage = AsyncStorage as unknown as {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
  const originalGetItem = storage.getItem;
  const originalSetItem = storage.setItem;
  storage.getItem = async () => stored;
  storage.setItem = async (_key, value) => { stored = value; };

  try {
    const first = makeRecording({ id: "first" });
    const second = makeRecording({ id: "second" });
    const firstSave = saveRecording(first);
    const secondSave = saveRecording(second);
    const lateMark = markRecordingLieDisqualified(first.id);
    await Promise.all([firstSave, secondSave, lateMark]);
    const recordings = await getRecordings();

    assert(recordings.length === 2, "late marking does not remove concurrent saves");
    assert(
      recordings.find((recording) => recording.id === first.id)?.lieDisqualified === true,
      "marks only the disqualified recording",
    );
    assert(
      recordings.find((recording) => recording.id === second.id)?.lieDisqualified !== true,
      "does not mark unrelated recordings",
    );

    const pendingDisqualification = true;
    const preFlaggedRecording = makeRecording({
      id: "pre-flagged",
      lieDisqualified: pendingDisqualification ? true : undefined,
    });
    await saveRecording(preFlaggedRecording);
    const recordingsAfterPreFlaggedSave = await getRecordings();
    assert(
      recordingsAfterPreFlaggedSave.find((recording) => recording.id === preFlaggedRecording.id)?.lieDisqualified === true,
      "preserves a disqualification flagged before saving",
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
