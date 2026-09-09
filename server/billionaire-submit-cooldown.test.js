#!/usr/bin/env node
/**
 * billionaire-submit-cooldown.test.js
 *
 * Tests the anti-farming cooldown guard for POST /api/game/submit-result
 * (server/billionaire-submit-guard.ts). Requires DATABASE_URL — the guard is deliberately
 * database-backed (not process memory) so it holds across an autoscaled deployment's multiple
 * server instances, so these tests exercise the real table via a real Pool.
 *
 * Layer A — Single-call behavior:
 *   First submission for a new device/IP succeeds; an immediate repeat (same device, or a
 *   different device sharing the same IP) is rejected with a positive retryAfterSeconds;
 *   submitting again after the cooldown window elapses succeeds; a huge reported duration is
 *   capped rather than locking the key out for an unbounded time.
 *
 * Layer B — Concurrency (proves the atomicity claim, not just the happy path):
 *   Fires truly concurrent calls against the SAME shared database (using independent Pool
 *   instances per call, standing in for independent autoscale server instances) and confirms
 *   exactly one succeeds — for both the same-device and same-IP-different-device cases.
 *
 * Layer C — Transactional coupling:
 *   Forces the result write to fail (a NOT NULL violation) after the cooldown reservation would
 *   otherwise have been taken, and confirms the whole transaction rolled back: no completed row
 *   exists, no cooldown was recorded, and an immediate retry with valid data succeeds.
 *
 * Run:
 *   npx tsx server/billionaire-submit-cooldown.test.js
 *   npm run test:billionaire-submit-cooldown
 */

import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import {
  submitBillionaireGameResult,
  capReportedDurationSeconds,
  BILLIONAIRE_MIN_SUBMIT_COOLDOWN_SECONDS,
  BILLIONAIRE_MAX_SUBMIT_COOLDOWN_SECONDS,
} from "./billionaire-submit-guard.ts";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${message}`);
  } else {
    failed++;
    console.log(`  \u2717 FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} \u2014 expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function sampleResult(deviceId, overrides = {}) {
  return {
    deviceId,
    playerName: "Tester",
    status: "won",
    netWorth: 1_000_000_000,
    turns: 6,
    durationSeconds: 10,
    milestonesHitCount: 0,
    bestStreak: 6,
    karma: 0,
    darkDeals: 0,
    ...overrides,
  };
}

async function cleanupKeys(pool, keys) {
  await pool.query(`DELETE FROM billionaire_submit_cooldown WHERE cooldown_key = ANY($1)`, [keys]);
}

async function cleanupDevices(pool, deviceIds) {
  await pool.query(`DELETE FROM billionaire_games WHERE device_id = ANY($1)`, [deviceIds]);
}

async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billionaire_submit_cooldown (
      cooldown_key TEXT PRIMARY KEY,
      last_submit_at TIMESTAMPTZ NOT NULL,
      last_duration_seconds INTEGER NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billionaire_games (
      id SERIAL PRIMARY KEY,
      device_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      game_state JSONB,
      choice_history JSONB DEFAULT '[]',
      used_titles JSONB DEFAULT '[]',
      final_net_worth BIGINT DEFAULT 0,
      turns INTEGER DEFAULT 0,
      duration_seconds INTEGER DEFAULT 0,
      milestones_hit INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      karma INTEGER DEFAULT 0,
      dark_deals INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPureTests(pool) {
  console.log("\n=== Pure helper: duration capping ===\n");
  assertEqual(capReportedDurationSeconds(-5), 0, "a negative reported duration floors to 0");
  assertEqual(capReportedDurationSeconds(50), 50, "a reasonable reported duration passes through unchanged");
  assertEqual(capReportedDurationSeconds(999_999), BILLIONAIRE_MAX_SUBMIT_COOLDOWN_SECONDS, "a huge reported duration is capped");
  assert(BILLIONAIRE_MIN_SUBMIT_COOLDOWN_SECONDS > 0, "the floor cooldown is a positive number derived from win-timing bounds");
}

async function runSingleCallTests(pool) {
  console.log("\n=== Layer A: single-call cooldown behavior (real DB) ===\n");

  const RUN_ID = randomBytes(6).toString("hex");
  const deviceKey = `d:test-${RUN_ID}-a`;
  const ipKey = `ip:test-${RUN_ID}-a`;
  const deviceId = `dev-${RUN_ID}-a`;

  try {
    const first = await submitBillionaireGameResult(pool, deviceKey, ipKey, 10, sampleResult(deviceId));
    assert(first.allowed, "first submission for a new device/IP is allowed");

    const second = await submitBillionaireGameResult(pool, deviceKey, ipKey, 10, sampleResult(deviceId));
    assert(!second.allowed, "immediate second submission from the same device/IP is rejected");
    assert(second.waitSeconds > 0, "rejection reports a positive wait time");

    const differentDeviceSameIp = await submitBillionaireGameResult(
      pool, `d:test-${RUN_ID}-a-other`, ipKey, 10, sampleResult(`dev-${RUN_ID}-a-other`)
    );
    assert(!differentDeviceSameIp.allowed, "a different device sharing the same IP is also rejected");

    const rows = await pool.query(`SELECT status FROM billionaire_games WHERE device_id = $1`, [deviceId]);
    assertEqual(rows.rows.length, 1, "exactly one completed row exists for the device after the allowed submission");
  } finally {
    await cleanupKeys(pool, [deviceKey, ipKey, `d:test-${RUN_ID}-a-other`]);
    await cleanupDevices(pool, [deviceId, `dev-${RUN_ID}-a-other`]);
  }
}

async function runCooldownExpiryTest(pool) {
  console.log("\n=== Layer A2: cooldown clears after its own window elapses ===\n");

  const RUN_ID = randomBytes(6).toString("hex");
  const deviceKey = `d:test-${RUN_ID}-b`;
  const ipKey = `ip:test-${RUN_ID}-b`;
  const deviceId = `dev-${RUN_ID}-b`;
  // A short reported duration keeps the wait at the floor cooldown, small enough to actually
  // sleep past in a fast test run.
  const shortDuration = 1;

  try {
    // Seed a cooldown row directly, dated far enough in the past to have already expired,
    // rather than sleeping out a multi-second real floor cooldown.
    await pool.query(
      `INSERT INTO billionaire_submit_cooldown (cooldown_key, last_submit_at, last_duration_seconds) VALUES ($1, NOW() - INTERVAL '1 hour', $2)`,
      [deviceKey, shortDuration]
    );
    await pool.query(
      `INSERT INTO billionaire_submit_cooldown (cooldown_key, last_submit_at, last_duration_seconds) VALUES ($1, NOW() - INTERVAL '1 hour', $2)`,
      [ipKey, shortDuration]
    );

    const result = await submitBillionaireGameResult(pool, deviceKey, ipKey, shortDuration, sampleResult(deviceId));
    assert(result.allowed, "submission is allowed once the previously reserved window has elapsed");
  } finally {
    await cleanupKeys(pool, [deviceKey, ipKey]);
    await cleanupDevices(pool, [deviceId]);
  }
}

async function runConcurrencyTests() {
  console.log("\n=== Layer B: concurrent submissions across independent connections share the DB guard ===\n");

  const RUN_ID = randomBytes(6).toString("hex");

  // Each concurrent call gets its own Pool, standing in for independent autoscale server
  // instances all talking to the same shared database — proving the guard is not merely
  // safe within one process's connection pool.
  function freshPool() {
    return new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  }

  // Test B-1: 5 truly concurrent submissions from the same device — exactly one must succeed.
  {
    const deviceKey = `d:test-${RUN_ID}-conc-same`;
    const ipKey = `ip:test-${RUN_ID}-conc-same`;
    const deviceId = `dev-${RUN_ID}-conc-same`;
    const pools = Array.from({ length: 5 }, () => freshPool());
    try {
      const results = await Promise.all(
        pools.map((p) => submitBillionaireGameResult(p, deviceKey, ipKey, 10, sampleResult(deviceId)))
      );
      const successes = results.filter((r) => r.allowed);
      const rejections = results.filter((r) => !r.allowed);
      assertEqual(successes.length, 1, "exactly one of 5 concurrent same-device submissions succeeds");
      assertEqual(rejections.length, 4, "the other 4 concurrent same-device submissions are rejected");
      assert(rejections.every((r) => r.waitSeconds > 0), "every rejection reports a positive wait time");
    } finally {
      await Promise.all(pools.map((p) => p.end()));
      const cleanupPool = freshPool();
      await cleanupKeys(cleanupPool, [deviceKey, ipKey]);
      await cleanupDevices(cleanupPool, [deviceId]);
      await cleanupPool.end();
    }
  }

  // Test B-2: concurrent submissions from different devices sharing the same IP — exactly one
  // must succeed, proving the per-IP cooldown is race-free too, not just the per-device one.
  {
    const ipKey = `ip:test-${RUN_ID}-conc-ip`;
    const deviceIds = [`dev-${RUN_ID}-ip-a`, `dev-${RUN_ID}-ip-b`, `dev-${RUN_ID}-ip-c`];
    const deviceKeys = deviceIds.map((id) => `d:${id}`);
    const pools = deviceIds.map(() => freshPool());
    try {
      const results = await Promise.all(
        pools.map((p, i) => submitBillionaireGameResult(p, deviceKeys[i], ipKey, 10, sampleResult(deviceIds[i])))
      );
      const successes = results.filter((r) => r.allowed);
      assertEqual(successes.length, 1, "exactly one of 3 concurrent different-device (same-IP) submissions succeeds");
    } finally {
      await Promise.all(pools.map((p) => p.end()));
      const cleanupPool = freshPool();
      await cleanupKeys(cleanupPool, [ipKey, ...deviceKeys]);
      await cleanupDevices(cleanupPool, deviceIds);
      await cleanupPool.end();
    }
  }
}

async function runTransactionalCouplingTest(pool) {
  console.log("\n=== Layer C: cooldown reservation and result write share one transaction ===\n");

  const RUN_ID = randomBytes(6).toString("hex");
  const deviceKey = `d:test-${RUN_ID}-c`;
  const ipKey = `ip:test-${RUN_ID}-c`;
  const deviceId = `dev-${RUN_ID}-c`;

  try {
    // Seed a pre-existing in-progress row so we can prove it survives a rolled-back write.
    await pool.query(
      `INSERT INTO billionaire_games (device_id, player_name, status) VALUES ($1, $2, 'in_progress')`,
      [deviceId, "Seed"]
    );

    let threw = false;
    try {
      // player_name is NOT NULL — this forces the write to fail partway through the shared
      // transaction, after the cooldown rows would otherwise have been committed.
      await submitBillionaireGameResult(pool, deviceKey, ipKey, 10, sampleResult(deviceId, { playerName: null }));
    } catch {
      threw = true;
    }
    assert(threw, "submitBillionaireGameResult throws on a NOT NULL violation partway through the transaction");

    const cooldownRows = await pool.query(`SELECT cooldown_key FROM billionaire_submit_cooldown WHERE cooldown_key = ANY($1)`, [[deviceKey, ipKey]]);
    assertEqual(cooldownRows.rows.length, 0, "no cooldown row was left behind by the rolled-back transaction");

    const gameRows = await pool.query(`SELECT status, player_name FROM billionaire_games WHERE device_id = $1`, [deviceId]);
    assertEqual(gameRows.rows.length, 1, "exactly one row remains for the device after the failed write (no partial commit)");
    if (gameRows.rows.length === 1) {
      assertEqual(gameRows.rows[0].status, "in_progress", "the original in-progress row was rolled back to its pre-write state, not deleted");
      assertEqual(gameRows.rows[0].player_name, "Seed", "the original row's data is untouched \u2014 nothing from the failed write leaked in");
    }

    // Because the failed attempt rolled back cleanly, a valid retry right away must succeed \u2014
    // there is no leftover cooldown blocking it.
    const retry = await submitBillionaireGameResult(pool, deviceKey, ipKey, 10, sampleResult(deviceId));
    assert(retry.allowed, "an immediate valid retry succeeds since the failed attempt left no cooldown behind");

    const finalRows = await pool.query(`SELECT status FROM billionaire_games WHERE device_id = $1`, [deviceId]);
    assertEqual(finalRows.rows.length, 1, "exactly one row remains after the valid retry commits");
    if (finalRows.rows.length === 1) {
      assertEqual(finalRows.rows[0].status, "won", "the valid retry committed and updated status to 'won'");
    }
  } finally {
    await cleanupKeys(pool, [deviceKey, ipKey]);
    await cleanupDevices(pool, [deviceId]);
  }
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set \u2014 these tests require a real database. Skipping.");
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  try {
    await ensureSchema(pool);
    await runPureTests(pool);
    await runSingleCallTests(pool);
    await runCooldownExpiryTest(pool);
    await runConcurrencyTests();
    await runTransactionalCouplingTest(pool);
  } finally {
    await pool.end();
  }

  console.log(`\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("All tests passed \u2713");
  }
}

run().catch((err) => {
  console.error("Unexpected test error:", err);
  process.exit(1);
});
