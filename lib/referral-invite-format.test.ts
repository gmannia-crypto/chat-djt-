#!/usr/bin/env node
/**
 * Regression checks for the invite-success banner text (app/index.tsx),
 * which must show a distinguishable time for EVERY pending referral grant
 * so a sharer can tell which specific friend's invite converted.
 *
 * Run:
 *   npx tsx lib/referral-invite-format.test.ts
 */

import { formatInviteSuccessDetail, formatGrantTime } from "./referral-invite-format.js";

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

function grant(id: string, isoTime: string) {
  return { id, grantedAt: isoTime };
}

console.log("formatInviteSuccessDetail — single referral");
{
  const text = formatInviteSuccessDetail({
    newReferrals: 1,
    grants: [grant("a", "2026-09-09T15:42:00.000Z")],
  });
  assert(text.includes("A friend joined"), "mentions a single friend");
  assert(text.includes(formatGrantTime("2026-09-09T15:42:00.000Z")), "includes that friend's join time");
}

console.log("formatInviteSuccessDetail — two referrals");
{
  const t1 = "2026-09-09T15:42:00.000Z";
  const t2 = "2026-09-09T17:05:00.000Z";
  const text = formatInviteSuccessDetail({ newReferrals: 2, grants: [grant("a", t1), grant("b", t2)] });
  assert(text.includes("2 friends"), "mentions both friends");
  assert(text.includes(formatGrantTime(t1)), "includes the first friend's time");
  assert(text.includes(formatGrantTime(t2)), "includes the second friend's time");
}

console.log("formatInviteSuccessDetail — three+ referrals lists every timestamp (no collapsing)");
{
  const times = ["2026-09-09T09:00:00.000Z", "2026-09-09T12:15:00.000Z", "2026-09-09T18:30:00.000Z"];
  const text = formatInviteSuccessDetail({
    newReferrals: 3,
    grants: times.map((t, i) => grant(`g${i}`, t)),
  });
  assert(text.includes("3 friends"), "mentions all three friends");
  for (const t of times) {
    assert(text.includes(formatGrantTime(t)), `includes timestamp for grant at ${t}`);
  }
  assert(!/most recently/i.test(text), "does not collapse into a 'most recently' summary");
}

console.log("formatInviteSuccessDetail — falls back gracefully on malformed timestamps");
{
  const text = formatInviteSuccessDetail({
    newReferrals: 2,
    grants: [grant("a", "not-a-date"), grant("b", "also-not-a-date")],
  });
  assert(text.includes("2 friends"), "still reports the referral count");
  assert(!text.includes("undefined") && !text.includes("Invalid Date"), "never leaks a raw invalid-date string");
}

console.log("formatInviteSuccessDetail — mixed valid/malformed timestamps falls back to plain count");
{
  const text = formatInviteSuccessDetail({
    newReferrals: 2,
    grants: [grant("a", "2026-09-09T15:42:00.000Z"), grant("b", "not-a-date")],
  });
  assert(text === "2 friends joined The Arena using your link.", "uses the plain aggregate message when any timestamp is unusable");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
