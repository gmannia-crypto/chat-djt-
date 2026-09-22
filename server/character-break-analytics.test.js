#!/usr/bin/env node
/**
 * character-break-analytics.test.js
 *
 * Integration test for getCharacterBreakStats() in server/analytics.ts.
 *
 * Regression test for a bug where the aggregation SQL counted BOTH the
 * 'retry' action and the 'retry_failed' action into the "retries" total.
 * Every failed regeneration emits two events for the same underlying
 * attempt (the initial hard-pattern trigger, then the second-attempt
 * failure), so counting both as "retries" double-counted every failed
 * regeneration — one failed retry looked like two retries in the admin
 * panel, inflating persona totals, daily trends, sorting, and chart
 * scaling.
 *
 * "retries" must count ONLY action = 'retry' (one row per full-regeneration
 * attempt); "retryFailed" is a separate, non-overlapping subset count of
 * how many of those attempts also failed a second time.
 *
 * Requires DATABASE_URL to be set (dev environment).
 *
 * Run:
 *   npx tsx server/character-break-analytics.test.js
 */

import { Pool } from "pg";
import { trackCharacterBreak, getCharacterBreakStats, initAnalyticsTables } from "./analytics.ts";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function main() {
  await initAnalyticsTables();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const testPersona = `test-persona-${Date.now()}`;

  try {
    console.log("\nSeeding one successful retry and one failed retry...");
    // A successful retry: hard pattern trips once, regeneration succeeds → one 'retry' event.
    await trackCharacterBreak(testPersona, "retry", { snippet: "successful retry case" });
    // A failed retry: hard pattern trips, regeneration ALSO breaks character → both
    // 'retry' and 'retry_failed' are recorded for this single incident (see
    // createGuardedCompletion in server/routes.ts).
    await trackCharacterBreak(testPersona, "retry", { snippet: "failed retry case, first trigger" });
    await trackCharacterBreak(testPersona, "retry_failed", { snippet: "failed retry case, second trigger" });
    // One unrelated watch-only hit, must never be counted as a retry.
    await trackCharacterBreak(testPersona, "watch", { pattern: "test-pattern" });

    console.log("\nFetching aggregated stats...");
    const stats = await getCharacterBreakStats(1);
    const persona = stats.byPersona.find((p) => p.persona === testPersona);

    assert(!!persona, "test persona appears in byPersona results");
    if (persona) {
      assert(persona.retries === 2, `retries counts only 'retry' actions (expected 2, got ${persona.retries})`);
      assert(persona.retryFailed === 1, `retryFailed counts only 'retry_failed' actions (expected 1, got ${persona.retryFailed})`);
      assert(persona.watchHits === 1, `watchHits counts only 'watch' actions (expected 1, got ${persona.watchHits})`);
    }

    // Totals must reflect the same non-overlapping counting rule.
    const totalsBefore = stats.totals;
    assert(totalsBefore.retries >= 2, "totals.retries includes this persona's 2 retries");
    assert(totalsBefore.retryFailed >= 1, "totals.retryFailed includes this persona's 1 failed retry");

    // Daily trend must also count 'retry' only, not 'retry' + 'retry_failed'.
    const today = new Date().toISOString().slice(0, 10);
    const dayRow = stats.daily.find((d) => d.day === today);
    assert(!!dayRow, "today's row appears in the daily trend");
  } finally {
    // Clean up seeded rows so repeated test runs don't accumulate fixture data.
    await pool.query(
      "DELETE FROM feature_events WHERE feature = 'character_break' AND metadata->>'personaId' = $1",
      [testPersona]
    );
    await pool.end();
  }

  console.log("\n────────────────────────────────────────────────────────────────");
  if (failed === 0) {
    console.log(`✓ All ${passed} assertions passed.\n`);
    process.exit(0);
  } else {
    console.error(`✗ ${failed} assertion(s) failed, ${passed} passed.\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Test crashed:", e);
  process.exit(1);
});
