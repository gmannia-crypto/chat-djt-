#!/usr/bin/env node
/**
 * billionaire-game-validation.test.js
 *
 * Unit test: validateBillionaireSubmission (server/billionaire-game-validation.ts) must reject
 * every practical way a direct API call could spoof a Billionaires Game leaderboard result, while
 * still accepting the real boundary cases the game itself can produce.
 *
 * Run:
 *   npx tsx server/billionaire-game-validation.test.js
 *   npm run test:billionaire-validation
 *
 * No database or server required — this exercises the pure validation function directly.
 */

import {
  validateBillionaireSubmission,
  clampBillionaireKarma,
  BILLIONAIRE_MAX_WIN_NET_WORTH,
  BILLIONAIRE_MIN_TURNS_FOR_WIN,
  BILLIONAIRE_MAX_KARMA_PER_CHOICE,
} from "./billionaire-game-validation.ts";

let passed = 0;
let failed = 0;

function assertRejected(gameState, durationSeconds, label) {
  const err = validateBillionaireSubmission(gameState, durationSeconds);
  if (err) {
    console.log(`  ✓ ${label} (rejected: "${err}")`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — expected rejection, but was accepted`);
    failed++;
  }
}

function assertAccepted(gameState, durationSeconds, label) {
  const err = validateBillionaireSubmission(gameState, durationSeconds);
  if (err === null) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — expected acceptance, but got error "${err}"`);
    failed++;
  }
}

console.log("=== Spoofing attempts must be rejected ===\n");

// The original exploit: claim a huge number of turns to inflate the plausible net-worth ceiling.
assertRejected(
  { netWorth: 1_125_000_000_000, turn: 2000, karma: 90000, bestStreak: 2000, darkDeals: 0, milestonesHit: [5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 750_000_000] },
  2000,
  "trillion-dollar net worth padded out with 2000 fake turns"
);

// Zero-turn / one-turn instant win — no real game can reach $1B this fast.
assertRejected({ netWorth: 1_000_000_000, turn: 0, karma: 0, bestStreak: 0, darkDeals: 0, milestonesHit: [] }, 0, "win claimed at turn 0");
assertRejected({ netWorth: 1_000_000_000, turn: 1, karma: 0, bestStreak: 1, darkDeals: 0, milestonesHit: [] }, 5, "win claimed at turn 1");
assertRejected(
  { netWorth: 1_000_000_000, turn: BILLIONAIRE_MIN_TURNS_FOR_WIN - 1, karma: 0, bestStreak: 1, darkDeals: 0, milestonesHit: [] },
  60,
  `win claimed one turn short of the fastest possible win (${BILLIONAIRE_MIN_TURNS_FOR_WIN - 1} turns)`
);

// Net worth beyond what even the richest possible single winning turn can produce.
assertRejected(
  { netWorth: BILLIONAIRE_MAX_WIN_NET_WORTH + 1, turn: 10, karma: 10, bestStreak: 5, darkDeals: 0, milestonesHit: [] },
  120,
  "net worth one dollar past the maximum a single winning turn can produce"
);

// Impossible stat combinations: streak/dark-deals exceeding the number of turns played.
assertRejected({ netWorth: 0, turn: 3, karma: 0, bestStreak: 4, darkDeals: 0, milestonesHit: [] }, 10, "best streak longer than turns played");
assertRejected({ netWorth: 0, turn: 3, karma: 0, bestStreak: 0, darkDeals: 4, milestonesHit: [] }, 10, "dark deal count exceeding turns played");

// Karma padded far beyond what any number of real choices could produce.
assertRejected({ netWorth: 0, turn: 2, karma: 500, bestStreak: 0, darkDeals: 0, milestonesHit: [] }, 5, "karma far beyond the per-turn maximum times turns played");

// Fake or duplicated milestone thresholds.
assertRejected({ netWorth: 1_050_000_000, turn: 10, karma: 10, bestStreak: 3, darkDeals: 0, milestonesHit: [123] }, 120, "unrecognized milestone threshold");
assertRejected({ netWorth: 1_050_000_000, turn: 10, karma: 10, bestStreak: 3, darkDeals: 0, milestonesHit: [5_000_000, 5_000_000] }, 120, "duplicate milestone entries");

// Non-terminal net worth (neither a win nor the exact $0 loss state) should never be submitted.
assertRejected({ netWorth: 500_000_000, turn: 10, karma: 10, bestStreak: 3, darkDeals: 0, milestonesHit: [] }, 120, "mid-game net worth that is neither a win nor a loss");

// Fractional values on integer-backed fields.
assertRejected({ netWorth: 1_050_000_000.5, turn: 10, karma: 10, bestStreak: 3, darkDeals: 0, milestonesHit: [] }, 120, "fractional net worth");
assertRejected({ netWorth: 1_050_000_000, turn: 10.5, karma: 10, bestStreak: 3, darkDeals: 0, milestonesHit: [] }, 120, "fractional turn count");
assertRejected({ netWorth: 1_050_000_000, turn: 10, karma: 10, bestStreak: 3, darkDeals: 0, milestonesHit: [] }, 120.5, "fractional duration");

// Instant/automated submission — duration far too short for the claimed number of turns.
assertRejected({ netWorth: 0, turn: 20, karma: -10, bestStreak: 0, darkDeals: 2, milestonesHit: [] }, 1, "duration too short for the claimed turn count");

console.log("\n=== Real boundary cases must be accepted ===\n");

// The fastest theoretically possible win (see BILLIONAIRE_MIN_TURNS_FOR_WIN derivation).
assertAccepted(
  { netWorth: BILLIONAIRE_MAX_WIN_NET_WORTH, turn: BILLIONAIRE_MIN_TURNS_FOR_WIN, karma: 0, bestStreak: BILLIONAIRE_MIN_TURNS_FOR_WIN, darkDeals: 0, milestonesHit: [5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 750_000_000] },
  30,
  "maximum-luck event-assisted win at the fastest possible turn count"
);

// A typical, unremarkable win.
assertAccepted(
  { netWorth: 1_050_000_000, turn: 20, karma: 40, bestStreak: 5, darkDeals: 2, milestonesHit: [5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 750_000_000] },
  600,
  "typical realistic win"
);

// A minimal, one-turn loss (a harsh ethical choice can zero out the $1M starting balance).
assertAccepted({ netWorth: 0, turn: 1, karma: 20, bestStreak: 0, darkDeals: 0, milestonesHit: [] }, 5, "one-turn loss");

// A longer, grindy loss.
assertAccepted({ netWorth: 0, turn: 40, karma: -80, bestStreak: 3, darkDeals: 10, milestonesHit: [5_000_000] }, 900, "longer loss with mixed history");

console.log("\n=== Scenario karma clamp matches the validator's assumed bound ===\n");
if (clampBillionaireKarma(9999) === BILLIONAIRE_MAX_KARMA_PER_CHOICE && clampBillionaireKarma(-9999) === -BILLIONAIRE_MAX_KARMA_PER_CHOICE) {
  console.log(`  ✓ clampBillionaireKarma caps out-of-range AI-generated karma to ±${BILLIONAIRE_MAX_KARMA_PER_CHOICE}`);
  passed++;
} else {
  console.error("  ✗ FAIL: clampBillionaireKarma did not clamp to the expected bound");
  failed++;
}

console.log(`\n──────────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
