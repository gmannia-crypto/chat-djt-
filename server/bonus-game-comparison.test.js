#!/usr/bin/env node
/**
 * bonus-game-comparison.test.js
 *
 * Unit test: resolveBonusGameComparisonWindow / validateBonusGameComparisonRange
 * (server/analytics.ts) must resolve the correct comparison window for the default
 * (auto), relative-offset, and fixed-date-range modes admins can pick on the bonus-game
 * trend dashboard — including inclusive same-day fixed ranges and rejection of malformed
 * or reversed date ranges.
 *
 * Run:
 *   npx tsx server/bonus-game-comparison.test.js
 *   npm run test:bonus-game-comparison
 *
 * No database or server required — this exercises the pure functions directly.
 */

import {
  resolveBonusGameComparisonWindow,
  validateBonusGameComparisonRange,
} from "./analytics.ts";

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertNull(actual, label) {
  assertEqual(actual, null, label);
}

function assertTruthy(actual, label) {
  if (actual) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 FAIL: ${label} — expected a truthy value, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// Fixed reference "now" so date math is deterministic regardless of when the test runs.
const NOW = new Date("2026-02-15T12:00:00.000Z").getTime();
const DAY = 86400000;

console.log("\nDefault (auto) mode — immediately preceding period of equal length:");
{
  const w = resolveBonusGameComparisonWindow(7, {}, NOW);
  assertEqual(w.isCustomComparison, false, "default 7-day window is not flagged custom");
  assertEqual(w.prevUntil.getTime(), NOW - 7 * DAY, "prevUntil is exactly `days` ago");
  assertEqual(w.prevSince.getTime(), NOW - 14 * DAY, "prevSince is exactly 2x `days` ago");
  assertEqual(w.label, "the previous 7 days", "label reads as the previous N days");
}

console.log("\nRelative offset/length mode:");
{
  // "Same 7 days last month": report is 7 days, comparison ends 30 days ago and spans 7 days.
  const w = resolveBonusGameComparisonWindow(7, { compareOffsetDays: 30, compareLengthDays: 7 }, NOW);
  assertEqual(w.isCustomComparison, true, "offset/length override is flagged custom");
  assertEqual(w.prevUntil.getTime(), NOW - 30 * DAY, "prevUntil respects compareOffsetDays");
  assertEqual(w.prevSince.getTime(), NOW - 37 * DAY, "prevSince is offset + length back");
}
{
  // Passing the same offset/length as the report window should NOT be flagged custom — it's
  // the same window the default mode would have produced.
  const w = resolveBonusGameComparisonWindow(30, { compareOffsetDays: 30, compareLengthDays: 30 }, NOW);
  assertEqual(w.isCustomComparison, false, "offset/length matching defaults isn't flagged custom");
}

console.log("\nFixed calendar date range — inclusive of the end date:");
{
  const w = resolveBonusGameComparisonWindow(30, { compareStart: "2026-01-01", compareEnd: "2026-01-07" }, NOW);
  assertEqual(w.isCustomComparison, true, "fixed range is flagged custom");
  assertEqual(w.prevSince.toISOString(), "2026-01-01T00:00:00.000Z", "prevSince is midnight of the start date");
  // The exclusive SQL upper bound must be pushed to the start of the *following* day so all of
  // Jan 7 is included — this was the bug the code review caught.
  assertEqual(w.prevUntil.toISOString(), "2026-01-08T00:00:00.000Z", "prevUntil covers all of the end date (exclusive bound = day after)");
}
{
  // Same-day range must still include that one day, not resolve to an empty window.
  const w = resolveBonusGameComparisonWindow(30, { compareStart: "2026-01-05", compareEnd: "2026-01-05" }, NOW);
  assertTruthy(w.prevUntil.getTime() > w.prevSince.getTime(), "same-day fixed range yields a non-empty window");
  assertEqual(w.prevUntil.getTime() - w.prevSince.getTime(), DAY, "same-day fixed range spans exactly one day");
}

console.log("\nvalidateBonusGameComparisonRange — rejects malformed/reversed input:");
assertNull(validateBonusGameComparisonRange(undefined, undefined), "no range provided is valid (falls back to default)");
assertNull(validateBonusGameComparisonRange("2026-01-01", "2026-01-07"), "well-formed start<=end range is valid");
assertNull(validateBonusGameComparisonRange("2026-01-05", "2026-01-05"), "same-day range is valid");
assertTruthy(validateBonusGameComparisonRange("2026-01-01", undefined), "start without end is rejected");
assertTruthy(validateBonusGameComparisonRange(undefined, "2026-01-07"), "end without start is rejected");
assertTruthy(validateBonusGameComparisonRange("01/01/2026", "2026-01-07"), "non-ISO date format is rejected");
assertTruthy(validateBonusGameComparisonRange("2026-13-40", "2026-01-07"), "unparseable calendar date is rejected");
assertTruthy(validateBonusGameComparisonRange("2026-01-10", "2026-01-01"), "reversed start/end range is rejected");

console.log("\nresolveBonusGameComparisonWindow throws for an invalid fixed range (route validates first, but defense in depth matters):");
{
  let threw = false;
  try {
    resolveBonusGameComparisonWindow(30, { compareStart: "2026-01-10", compareEnd: "2026-01-01" }, NOW);
  } catch {
    threw = true;
  }
  assertTruthy(threw, "reversed fixed range throws instead of silently producing an empty/inverted window");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
