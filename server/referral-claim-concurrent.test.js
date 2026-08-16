#!/usr/bin/env node
/**
 * referral-claim-concurrent.test.js
 *
 * Integration test: two simultaneous POST /api/referral/claim requests sharing
 * the same x-browser-fp header (but different device IDs) must produce exactly
 * one 200 and one 409, with no duplicate rows in referral_grants.
 *
 * Two complementary test layers:
 *
 *  Layer A — DB-level barrier (deterministic race):
 *    Both pg transactions are explicitly stepped past the fingerprint SELECT
 *    before either executes the INSERT.  This guarantees the partial unique
 *    index — not the pre-check SELECT — is the deciding guard, proving the
 *    last-line defence works even when the SELECT races.
 *
 *  Layer B — HTTP-level concurrent requests:
 *    Two simultaneous requests are issued against the real handler
 *    (makeReferralClaimHandler from server/referral-handler.ts).  This proves
 *    the full application path returns the correct status codes and that the
 *    handler correctly translates unique-constraint violations to HTTP 409.
 *
 * The handler under test is imported directly from server/referral-handler.ts
 * — the same module registered by server/routes.ts in production — so changes
 * to the real implementation are reflected here automatically.
 *
 * Run:
 *   npx tsx server/referral-claim-concurrent.test.js
 *   npm run test:referral-concurrent
 *
 * Requires DATABASE_URL to be set (dev environment).
 */

import http from "node:http";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

// Import the shared handler used by routes.ts in production.
import {
  ensureReferralTable,
  makeReferralClaimHandler,
  _resetEnsuredFlagForTests,
  REFERRAL_LOCALHOST_IPS,
} from "./referral-handler.ts";

// ─── Assertion harness ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function assertEqual(actual, expected, label) {
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(
      `  ✗ FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
    failed++;
  }
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

/** POST /api/referral/claim against the given port; returns { status, body }. */
function postClaim(port, { deviceId, fingerprint, code }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ code });
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/referral/claim",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
          "x-device-id": deviceId,
          "x-browser-fp": fingerprint,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let body;
          try { body = JSON.parse(raw); } catch { body = {}; }
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ─── Test runner ──────────────────────────────────────────────────────────────

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not set. Cannot run integration test.");
    process.exit(1);
  }

  // Use a large enough pool so both concurrent DB clients can be acquired.
  const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

  // 16-byte hex suffix makes IDs collision-resistant across concurrent runs.
  const RUN_ID = randomBytes(8).toString("hex");
  const tag = `rct-${RUN_ID}`; // referral-concurrent-test prefix

  const REFERRER_DEVICE = `${tag}-referrer`;
  const DEVICE_A = `${tag}-device-a`;
  const DEVICE_B = `${tag}-device-b`;
  const DEVICE_SERIAL = `${tag}-device-serial`;
  const DEVICE_DIFF_FP = `${tag}-device-diff-fp`;
  // Use a full 16-char code to make collisions astronomically unlikely.
  const REFERRAL_CODE = `RC${RUN_ID.toUpperCase()}`.slice(0, 20);
  const SHARED_FP = `fp-shared-${RUN_ID}`;
  const DIFF_FP = `fp-different-${RUN_ID}`;

  // Track all account IDs created during the test so we can purge their
  // token_transactions rows cleanly.
  const allDeviceIds = [
    REFERRER_DEVICE,
    DEVICE_A,
    DEVICE_B,
    DEVICE_SERIAL,
    DEVICE_DIFF_FP,
  ];

  console.log(`\nRun ID : ${RUN_ID}`);
  console.log(`Tag    : ${tag}`);
  console.log(`Code   : ${REFERRAL_CODE}\n`);

  let server;
  try {
    // ── Schema ────────────────────────────────────────────────────────────────
    _resetEnsuredFlagForTests(); // ensure ensureReferralTable runs fresh
    await ensureReferralTable(db);

    // ── Seed referrer account ─────────────────────────────────────────────────
    await db.query(
      `INSERT INTO token_accounts
         (device_id, tokens, free_prompts_used, subscription_active,
          subscription_tokens_granted, created_at, updated_at)
       VALUES ($1, 10, 0, false, false, NOW(), NOW())
       ON CONFLICT (device_id) DO NOTHING`,
      [REFERRER_DEVICE]
    );
    await db.query(
      `UPDATE token_accounts SET referral_code = $1 WHERE device_id = $2`,
      [REFERRAL_CODE, REFERRER_DEVICE]
    );

    // ── Layer A: DB-level barrier (deterministic race) ────────────────────────
    //
    // Both pg transactions are explicitly walked past the fingerprint SELECT
    // before either executes the INSERT.  This directly proves the partial
    // unique index catches the race that the SELECT pre-check cannot prevent
    // when two requests arrive simultaneously.
    //
    // Timeline:
    //   T1: BEGIN  →  SELECT fp (0 rows)  →  INSERT  →  COMMIT
    //   T2: BEGIN  →  SELECT fp (0 rows)  →  INSERT blocks on T1's index lock
    //                                       ← T1 commits
    //                                       ← T2 gets 23505, ROLLBACK

    console.log("=== Layer A: DB-level barrier race ===\n");
    console.log("Test A-1: unique index catches the race when both transactions");
    console.log("          pass the fingerprint SELECT before either INSERTs\n");

    // Unique device IDs and fingerprint for this sub-test.
    const RACE_FP = `fp-race-${RUN_ID}`;
    const RACE_DEVICE_WIN = `${tag}-race-win`;
    const RACE_DEVICE_LOSE = `${tag}-race-lose`;
    allDeviceIds.push(RACE_DEVICE_WIN, RACE_DEVICE_LOSE);

    // Pre-create both referred accounts so the handler path that checks
    // token_accounts does not introduce a write-lock race orthogonal to what
    // we are measuring.
    for (const dev of [RACE_DEVICE_WIN, RACE_DEVICE_LOSE]) {
      await db.query(
        `INSERT INTO token_accounts
           (device_id, tokens, free_prompts_used, subscription_active,
            subscription_tokens_granted, created_at, updated_at)
         VALUES ($1, 10, 0, false, false, NOW(), NOW())
         ON CONFLICT (device_id) DO NOTHING`,
        [dev]
      );
    }

    const c1 = await db.connect();
    const c2 = await db.connect();

    let indexCaughtRace = false;
    try {
      // ── Step 1: Both transactions BEGIN ──────────────────────────────────
      await c1.query("BEGIN");
      await c2.query("BEGIN");

      // ── Step 2: Both execute the fingerprint SELECT (returns 0 rows) ─────
      // At this point neither transaction has written anything, so both see an
      // empty result — exactly the condition a real race produces.
      const fp1 = await c1.query(
        `SELECT 1 FROM referral_grants WHERE browser_fingerprint = $1 LIMIT 1`,
        [RACE_FP]
      );
      const fp2 = await c2.query(
        `SELECT 1 FROM referral_grants WHERE browser_fingerprint = $1 LIMIT 1`,
        [RACE_FP]
      );
      assertEqual(fp1.rows.length, 0, "T1 sees 0 existing grants for race FP");
      assertEqual(fp2.rows.length, 0, "T2 sees 0 existing grants for race FP");

      // ── Step 3: T1 inserts but does NOT commit yet ────────────────────────
      // T1 now holds an uncommitted row + the unique-index lock for RACE_FP.
      await c1.query(
        `INSERT INTO referral_grants
           (referrer_device_id, referred_device_id, browser_fingerprint, granted_at)
         VALUES ($1, $2, $3, NOW())`,
        [REFERRER_DEVICE, RACE_DEVICE_WIN, RACE_FP]
      );
      // T1 is uncommitted at this point.

      // ── Step 4: T2 attempts the same INSERT — it BLOCKS on T1's lock ─────
      // We do NOT await yet; the promise will remain pending until T1 commits.
      const t2InsertPromise = c2.query(
        `INSERT INTO referral_grants
           (referrer_device_id, referred_device_id, browser_fingerprint, granted_at)
         VALUES ($1, $2, $3, NOW())`,
        [REFERRER_DEVICE, RACE_DEVICE_LOSE, RACE_FP]
      );

      // Give PostgreSQL a moment to register the lock wait.
      const BARRIER_WAIT_MS = 250;
      const raceOutcome = await Promise.race([
        t2InsertPromise.then(() => "resolved-ok").catch(() => "resolved-err"),
        new Promise((resolve) => setTimeout(() => resolve("pending"), BARRIER_WAIT_MS)),
      ]);
      assert(
        raceOutcome === "pending",
        `T2 INSERT is blocked (pending after ${BARRIER_WAIT_MS}ms) while T1 holds the uncommitted unique-index lock`
      );

      // ── Step 5: T1 commits — releases the lock, unblocks T2 ──────────────
      await c1.query("COMMIT");

      // ── Step 6: T2's INSERT resolves with a unique-constraint violation ───
      try {
        await t2InsertPromise;
        // Should not reach here
        await c2.query("COMMIT");
        console.error("  ✗ FAIL: T2 INSERT should have thrown a unique-constraint error");
        failed++;
      } catch (err) {
        if (err.code === "23505") {
          indexCaughtRace = true;
        } else {
          console.error("  ✗ T2 threw unexpected error:", err.code, err.message);
        }
        await c2.query("ROLLBACK").catch(() => {});
      }
    } finally {
      c1.release();
      c2.release();
    }

    assert(
      indexCaughtRace,
      "partial unique index threw 23505 when T2 unblocked after T1 committed (true race path)"
    );

    const raceRows = await db.query(
      `SELECT referred_device_id FROM referral_grants WHERE browser_fingerprint = $1`,
      [RACE_FP]
    );
    assertEqual(raceRows.rows.length, 1, "exactly one grant row after controlled race (no duplicate)");
    if (raceRows.rows.length === 1) {
      assertEqual(
        raceRows.rows[0].referred_device_id,
        RACE_DEVICE_WIN,
        "winning device matches the first committer"
      );
    }

    // ── Layer B: HTTP-level concurrent requests ───────────────────────────────
    //
    // Spin up a minimal HTTP server backed by the same makeReferralClaimHandler
    // that routes.ts registers in production, so any change to the real handler
    // is automatically covered.

    console.log("\n=== Layer B: HTTP-level concurrent requests ===\n");

    const claimDb = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    const claimHandler = makeReferralClaimHandler(claimDb);

    server = http.createServer((req, res) => {
      if (req.method === "POST" && req.url === "/api/referral/claim") {
        // Collect body and attach to req so the Express-style handler can read it.
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => {
          try { req.body = JSON.parse(raw); } catch { req.body = {}; }
          // Provide a minimal Express-compatible res shim for the handler.
          res.status = (code) => { res.statusCode = code; return res; };
          res.json = (obj) => {
            if (!res.headersSent) {
              res.setHeader("content-type", "application/json");
            }
            res.end(JSON.stringify(obj));
            return res;
          };
          claimHandler(req, res);
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    const port = await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => resolve(server.address().port));
      server.once("error", reject);
    });
    console.log(`Test server listening on port ${port}\n`);

    // Test B-1: Two simultaneous requests, same fingerprint, different devices
    console.log("Test B-1: concurrent same-fingerprint claims on different device IDs");

    const [resA, resB] = await Promise.all([
      postClaim(port, { deviceId: DEVICE_A, fingerprint: SHARED_FP, code: REFERRAL_CODE }),
      postClaim(port, { deviceId: DEVICE_B, fingerprint: SHARED_FP, code: REFERRAL_CODE }),
    ]);

    console.log(`  Response A: HTTP ${resA.status}  ${JSON.stringify(resA.body)}`);
    console.log(`  Response B: HTTP ${resB.status}  ${JSON.stringify(resB.body)}`);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    assertEqual(statuses[0], 200, "one request received HTTP 200");
    assertEqual(statuses[1], 409, "one request received HTTP 409");

    // Test B-2: Exactly one grant row with the shared fingerprint
    console.log("\nTest B-2: no duplicate grant rows after concurrent HTTP requests");

    const httpGrantRows = await db.query(
      `SELECT id, referred_device_id FROM referral_grants WHERE browser_fingerprint = $1`,
      [SHARED_FP]
    );
    assertEqual(httpGrantRows.rows.length, 1, "exactly one grant row for the shared fingerprint");
    if (httpGrantRows.rows.length === 1) {
      console.log(`  ✓ winning device: ${httpGrantRows.rows[0].referred_device_id}`);
    }

    // Test B-3: Serial retry with the same fingerprint also returns 409
    console.log("\nTest B-3: serial retry with the same fingerprint returns 409");

    const resSerial = await postClaim(port, {
      deviceId: DEVICE_SERIAL,
      fingerprint: SHARED_FP,
      code: REFERRAL_CODE,
    });
    console.log(`  Response: HTTP ${resSerial.status}  ${JSON.stringify(resSerial.body)}`);
    assertEqual(resSerial.status, 409, "serial retry with same fingerprint returns 409");

    // Test B-4: A different fingerprint on a new device succeeds
    console.log("\nTest B-4: a different fingerprint on a new device succeeds");

    const resDiff = await postClaim(port, {
      deviceId: DEVICE_DIFF_FP,
      fingerprint: DIFF_FP,
      code: REFERRAL_CODE,
    });
    console.log(`  Response: HTTP ${resDiff.status}  ${JSON.stringify(resDiff.body)}`);
    assertEqual(resDiff.status, 200, "different fingerprint on a new device succeeds");

    await claimDb.end();

    // ── Layer C: Per-IP rate-limit (4+ concurrent requests, same socket IP) ──
    //
    // The handler increments referral_ip_limits atomically inside the transaction.
    // This layer proves that 4 simultaneous claims from the same socket IP result
    // in exactly 3 grants (HTTP 200) and 1+ rejections (HTTP 429), and that
    // referral_ip_limits.claim_count never exceeds 3 for the test IP.
    //
    // Because the test HTTP server binds to 127.0.0.1 the socket's remoteAddress
    // is "127.0.0.1", which the handler normally exempts.  We temporarily remove
    // it from REFERRAL_LOCALHOST_IPS and switch NODE_ENV away from "development"
    // so the IP check runs, then restore both after the layer completes.

    console.log("\n=== Layer C: Per-IP rate-limit (4 concurrent, same socket IP) ===\n");

    const IP_DEVICE_1 = `${tag}-ip-dev-1`;
    const IP_DEVICE_2 = `${tag}-ip-dev-2`;
    const IP_DEVICE_3 = `${tag}-ip-dev-3`;
    const IP_DEVICE_4 = `${tag}-ip-dev-4`;
    const IP_DEVICES = [IP_DEVICE_1, IP_DEVICE_2, IP_DEVICE_3, IP_DEVICE_4];
    allDeviceIds.push(...IP_DEVICES);

    // Pre-create all four referred accounts so the handler doesn't race on that
    // write path — we want the IP-limit INSERT to be the bottleneck under test.
    for (const dev of IP_DEVICES) {
      await db.query(
        `INSERT INTO token_accounts
           (device_id, tokens, free_prompts_used, subscription_active,
            subscription_tokens_granted, created_at, updated_at)
         VALUES ($1, 10, 0, false, false, NOW(), NOW())
         ON CONFLICT (device_id) DO NOTHING`,
        [dev]
      );
    }

    // Each device uses a distinct fingerprint so the fingerprint-dedup guard
    // cannot trigger — only the IP rate-limit is under test here.
    const ipClaimDb = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    const ipClaimHandler = makeReferralClaimHandler(ipClaimDb);

    const ipServer = http.createServer((req, res) => {
      if (req.method === "POST" && req.url === "/api/referral/claim") {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => {
          try { req.body = JSON.parse(raw); } catch { req.body = {}; }
          res.status = (code) => { res.statusCode = code; return res; };
          res.json = (obj) => {
            if (!res.headersSent) res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(obj));
            return res;
          };
          ipClaimHandler(req, res);
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    const ipPort = await new Promise((resolve, reject) => {
      ipServer.listen(0, "127.0.0.1", () => resolve(ipServer.address().port));
      ipServer.once("error", reject);
    });
    console.log(`IP-limit test server listening on port ${ipPort}\n`);

    // Clean any leftover rows from previous runs so the counter starts at 0.
    await db.query(
      `DELETE FROM referral_ip_limits WHERE ip_address IN ('127.0.0.1', '::1', '::ffff:127.0.0.1')
         AND claim_day = CURRENT_DATE`
    );

    // ── Activate the IP check: remove localhost bypass + leave dev-mode ───────
    const savedNodeEnv = process.env.NODE_ENV;
    REFERRAL_LOCALHOST_IPS.delete("127.0.0.1");
    REFERRAL_LOCALHOST_IPS.delete("::1");
    REFERRAL_LOCALHOST_IPS.delete("::ffff:127.0.0.1");
    process.env.NODE_ENV = "test"; // anything other than "development"

    let ipResults;
    try {
      // Test C-1: Four simultaneous claims from the same socket IP.
      console.log("Test C-1: 4 concurrent claims from the same socket IP");

      ipResults = await Promise.all(
        IP_DEVICES.map((dev, i) =>
          postClaim(ipPort, {
            deviceId: dev,
            fingerprint: `fp-ip-${i}-${RUN_ID}`,
            code: REFERRAL_CODE,
          })
        )
      );

      ipResults.forEach((r, i) =>
        console.log(`  Device ${i + 1}: HTTP ${r.status}  ${JSON.stringify(r.body)}`)
      );
    } finally {
      // ── Restore state unconditionally ────────────────────────────────────
      process.env.NODE_ENV = savedNodeEnv;
      REFERRAL_LOCALHOST_IPS.add("127.0.0.1");
      REFERRAL_LOCALHOST_IPS.add("::1");
      REFERRAL_LOCALHOST_IPS.add("::ffff:127.0.0.1");
    }

    const ipStatuses = ipResults.map((r) => r.status);
    const successCount = ipStatuses.filter((s) => s === 200).length;
    const tooManyCount = ipStatuses.filter((s) => s === 429).length;

    assertEqual(successCount, 3, "exactly 3 requests received HTTP 200 (IP limit allows 3)");
    assert(tooManyCount >= 1, "at least 1 request received HTTP 429 (IP limit enforced)");

    // Test C-2: DB claim_count must not exceed 3 for the socket IP.
    console.log("\nTest C-2: referral_ip_limits.claim_count does not exceed 3");

    const ipLimitRows = await db.query(
      `SELECT claim_count FROM referral_ip_limits
       WHERE ip_address = ANY($1::text[]) AND claim_day = CURRENT_DATE`,
      [["127.0.0.1", "::1", "::ffff:127.0.0.1"]]
    );
    const maxCount = ipLimitRows.rows.reduce(
      (max, r) => Math.max(max, Number(r.claim_count)),
      0
    );
    console.log(`  claim_count in DB: ${maxCount}`);
    assert(maxCount <= 3, `referral_ip_limits.claim_count (${maxCount}) does not exceed 3`);

    // Test C-3: Exactly 3 grant rows were created for the IP devices.
    console.log("\nTest C-3: exactly 3 grant rows created (4th claim was rejected)");

    const ipGrantRows = await db.query(
      `SELECT referred_device_id FROM referral_grants
       WHERE referred_device_id = ANY($1::text[])`,
      [IP_DEVICES]
    );
    assertEqual(ipGrantRows.rows.length, 3, "exactly 3 grant rows exist for the IP-limited batch");

    await ipClaimDb.end();
    ipServer.close();

  } finally {
    // ── Full cleanup: grants, transactions, accounts ──────────────────────────
    // Delete in the correct dependency order (transactions → grants → accounts).
    try {
      // Collect all account IDs created during this run.
      const acctRows = await db.query(
        `SELECT id FROM token_accounts WHERE device_id = ANY($1::text[])`,
        [allDeviceIds]
      );
      const acctIds = acctRows.rows.map((r) => r.id);

      if (acctIds.length > 0) {
        await db.query(
          `DELETE FROM token_transactions WHERE account_id = ANY($1::text[])`,
          [acctIds]
        );
      }

      // Grants keyed on referrer or referred device ID.
      await db.query(
        `DELETE FROM referral_grants
         WHERE referrer_device_id = ANY($1::text[])
            OR referred_device_id = ANY($1::text[])
            OR browser_fingerprint LIKE $2`,
        [allDeviceIds, `%-${RUN_ID}`]
      );

      // Accounts last (foreign-key safety).
      await db.query(
        `DELETE FROM token_accounts WHERE device_id = ANY($1::text[])`,
        [allDeviceIds]
      );
    } catch (cleanupErr) {
      console.warn("  [warn] cleanup error:", cleanupErr.message);
    }

    if (server) server.close();
    await db.end();
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n──────────────────────────────────────────`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("All tests passed ✓");
  }
}

run().catch((err) => {
  console.error("Unexpected test error:", err);
  process.exit(1);
});
