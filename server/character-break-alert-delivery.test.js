#!/usr/bin/env node
/**
 * character-break-alert-delivery.test.js
 *
 * Integration test for the delivery + dedup behavior of checkCharacterBreakSpikes()
 * (server/character-break-alerts.ts).
 *
 * Regression coverage for a bug where a detected spike was marked "alerted" (and
 * permanently suppressed for the rest of the day) even when the email was never actually
 * delivered — e.g. ADMIN_ALERT_EMAIL not configured yet, or a transient Resend failure.
 * A spike must only be treated as handled once delivery actually succeeds; a missing
 * config or a failed send must be retried on the next check.
 *
 * Requires DATABASE_URL to be set (dev environment). Injects a fake fetch so no real
 * network call is made.
 *
 * Run:
 *   npx tsx server/character-break-alert-delivery.test.js
 *   npm run test:character-break-alert-delivery
 */

import { Pool } from "pg";
import { trackCharacterBreak, initAnalyticsTables } from "./analytics.ts";
import { checkCharacterBreakSpikes } from "./character-break-alerts.ts";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.error(`  \u2717 FAIL: ${message}`);
    failed++;
  }
}

async function seedSpike(pool, persona) {
  // Baseline: small trickle in the past so the day's burst is a clear spike.
  for (let d = 1; d <= 5; d++) {
    await pool.query(
      `INSERT INTO feature_events (device_id, feature, action, metadata, created_at)
       VALUES ('system','character_break','retry', $1, NOW() - ($2 || ' days')::interval)`,
      [JSON.stringify({ personaId: persona }), d],
    );
  }
  // Today's burst.
  for (let i = 0; i < 20; i++) {
    await trackCharacterBreak(persona, "retry", { snippet: "spike" });
  }
}

async function main() {
  await initAnalyticsTables();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

  const originalApiKey = process.env.RESEND_API_KEY;
  const originalAdminEmail = process.env.ADMIN_ALERT_EMAIL;

  const persona1 = `spike-delivery-nofconfig-${Date.now()}`;
  const persona2 = `spike-delivery-failthenretry-${Date.now()}`;

  try {
    console.log("\nMissing config: spike is detected but NOT permanently suppressed:");
    delete process.env.RESEND_API_KEY;
    delete process.env.ADMIN_ALERT_EMAIL;
    await seedSpike(pool, persona1);

    const neverCalledFetch = async () => {
      throw new Error("fetch should not be called when config is missing");
    };
    const r1 = await checkCharacterBreakSpikes(neverCalledFetch);
    assert(r1.skippedNoConfig.includes(persona1), "first check records skipped_no_config, not a silent no-op");
    assert(!r1.alerted.includes(persona1), "first check does not falsely report the spike as alerted");

    const statusRow1 = await pool.query(
      `SELECT status, sent_at FROM character_break_alerts WHERE persona = $1`,
      [persona1],
    );
    assert(statusRow1.rows[0]?.status === "skipped_no_config", "DB row reflects skipped_no_config, not sent");
    assert(statusRow1.rows[0]?.sent_at === null, "sent_at stays null when nothing was actually sent");

    // Now "configure" the destination (still using a fake fetch so no real network call
    // happens) and confirm the SAME persona/day is retried and can now succeed.
    process.env.RESEND_API_KEY = "test-key";
    process.env.ADMIN_ALERT_EMAIL = "admin@example.com";
    const successFetch = async () => ({ ok: true, json: async () => ({}) });
    const r2 = await checkCharacterBreakSpikes(successFetch);
    assert(r2.alerted.includes(persona1), "once configured, the earlier-detected spike is retried and delivered");

    const statusRow2 = await pool.query(
      `SELECT status, sent_at FROM character_break_alerts WHERE persona = $1`,
      [persona1],
    );
    assert(statusRow2.rows[0]?.status === "sent", "DB row is updated to sent after successful delivery");
    assert(statusRow2.rows[0]?.sent_at !== null, "sent_at is populated once delivery actually succeeds");

    // A third check with a fetch that would fail if called must NOT re-send.
    const shouldNotBeCalled = async () => {
      throw new Error("fetch should not be called again for an already-sent alert");
    };
    const r3 = await checkCharacterBreakSpikes(shouldNotBeCalled);
    assert(!r3.alerted.includes(persona1), "an already-sent alert is not re-delivered on a later check");
    assert(!r3.failed.includes(persona1), "an already-sent alert does not show up as failed either");

    console.log("\nDelivery failure (e.g. Resend outage): spike is retried, not permanently dropped:");
    await seedSpike(pool, persona2);
    const failingFetch = async () => ({ ok: false, status: 500, text: async () => "internal error" });
    const r4 = await checkCharacterBreakSpikes(failingFetch);
    assert(r4.failed.includes(persona2), "a non-2xx response is recorded as failed, not alerted");
    assert(!r4.alerted.includes(persona2), "a failed delivery is never reported as alerted");

    const failRow = await pool.query(
      `SELECT status FROM character_break_alerts WHERE persona = $1`,
      [persona2],
    );
    assert(failRow.rows[0]?.status === "failed", "DB row reflects failed status");

    const retryFetch = async () => ({ ok: true, json: async () => ({}) });
    const r5 = await checkCharacterBreakSpikes(retryFetch);
    assert(r5.alerted.includes(persona2), "a previously-failed alert is retried and can succeed on a later check");
  } finally {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalAdminEmail === undefined) delete process.env.ADMIN_ALERT_EMAIL;
    else process.env.ADMIN_ALERT_EMAIL = originalAdminEmail;

    await pool.query(
      `DELETE FROM feature_events WHERE metadata->>'personaId' IN ($1, $2)`,
      [persona1, persona2],
    );
    await pool.query(
      `DELETE FROM character_break_alerts WHERE persona IN ($1, $2)`,
      [persona1, persona2],
    );
    await pool.end();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Test crashed:", e);
  process.exit(1);
});
