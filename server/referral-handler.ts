/**
 * referral-handler.ts
 *
 * Shared referral-claim handler factory.  Imported by both server/routes.ts
 * (production) and server/referral-claim-concurrent.test.js (integration tests)
 * so the test always exercises the real implementation.
 */

import type { Request, Response } from "express";
import { Pool } from "pg";
import { getOrCreateAccount } from "./tokens";

// Server-local IPs that bypass the per-connection rate limit.
export const REFERRAL_LOCALHOST_IPS = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "localhost",
]);

// Idempotent schema migration — safe to call on every startup / test run.
let _referralTableEnsured = false;
export async function ensureReferralTable(db: Pool): Promise<void> {
  if (_referralTableEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS referral_grants (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        referrer_device_id TEXT NOT NULL,
        referred_device_id TEXT NOT NULL UNIQUE,
        ip_address TEXT,
        browser_fingerprint TEXT,
        granted_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Add columns if table existed before this migration
    await db.query(`ALTER TABLE referral_grants ADD COLUMN IF NOT EXISTS ip_address TEXT`);
    await db.query(`ALTER TABLE referral_grants ADD COLUMN IF NOT EXISTS browser_fingerprint TEXT`);
    // Tracks whether the referrer has been shown the "your invite worked!" success moment yet.
    await db.query(`ALTER TABLE referral_grants ADD COLUMN IF NOT EXISTS acknowledged_by_referrer BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.query(`ALTER TABLE token_accounts ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE`);
    // Atomic per-IP rate-limit table
    await db.query(`
      CREATE TABLE IF NOT EXISTS referral_ip_limits (
        ip_address TEXT NOT NULL,
        claim_day DATE NOT NULL,
        claim_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ip_address, claim_day)
      )
    `);
    // Partial unique index: prevents the same fingerprint from claiming twice.
    // PARTIAL (WHERE NOT NULL) so rows without a fingerprint don't conflict with each other.
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS referral_grants_fingerprint_unique
      ON referral_grants (browser_fingerprint)
      WHERE browser_fingerprint IS NOT NULL
    `);
    _referralTableEnsured = true;
  } catch {
    // Non-fatal: table / index already exists
  }
}

/** Reset the ensured flag — used only by tests that need a clean schema run. */
export function _resetEnsuredFlagForTests(): void {
  _referralTableEnsured = false;
}

/**
 * Returns an Express request handler for POST /api/referral/claim.
 *
 * @param db   A pg Pool to use for DB access.  The handler borrows a client
 *             from this pool for the transaction; it does NOT call db.end().
 */
export function makeReferralClaimHandler(db: Pool) {
  return async function referralClaimHandler(req: Request, res: Response) {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }

      const { code } = req.body as { code?: unknown };
      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Referral code required" });
      }

      const isDev = process.env.NODE_ENV === "development";

      // Ensure schema is initialised (idempotent; fast on subsequent calls).
      await ensureReferralTable(db);

      // Find the referrer by code
      const referrerResult = await db.query(
        `SELECT id, device_id FROM token_accounts WHERE referral_code = $1`,
        [code.toUpperCase().trim()]
      );
      if (referrerResult.rows.length === 0) {
        return res.status(404).json({ error: "Invalid referral code" });
      }
      const referrerDeviceId = referrerResult.rows[0].device_id;
      const referrerAccountId = referrerResult.rows[0].id;

      // Prevent self-referral
      if (referrerDeviceId === deviceId) {
        return res.status(400).json({ error: "Cannot use your own referral code" });
      }

      // Server-derived socket address — cannot be spoofed via request headers.
      const socketIp: string = req.socket.remoteAddress || "";
      const reqFingerprint: string | undefined =
        (req.headers["x-browser-fp"] as string) || undefined;

      // Ensure referred account exists.
      await getOrCreateAccount(deviceId, {
        ipAddress: socketIp || undefined,
        fingerprint: reqFingerprint,
      });

      // Re-read the referred account to use its stored signals for all checks.
      const referredRow = await db.query(
        `SELECT id, created_at FROM token_accounts WHERE device_id = $1`,
        [deviceId]
      );
      if (referredRow.rows.length === 0) {
        return res.status(500).json({ error: "Account initialization failed" });
      }
      const referred = referredRow.rows[0];

      // Account must have been created within the last 48 hours.
      if (!isDev) {
        const ageMs = Date.now() - new Date(referred.created_at).getTime();
        if (ageMs > 48 * 60 * 60 * 1000) {
          return res.status(403).json({
            error:
              "Referral codes can only be claimed within 48 hours of creating your account.",
          });
        }
      }

      const REFERRAL_TOKENS = 2;

      // ── Atomic transaction: rate-limit + insert grant + credit both accounts ──
      const client = await db.connect();
      try {
        await client.query("BEGIN");

        // Per-connection rate-limit (skipped for localhost).
        if (!isDev && socketIp && !REFERRAL_LOCALHOST_IPS.has(socketIp)) {
          const limitRow = await client.query(
            `INSERT INTO referral_ip_limits (ip_address, claim_day, claim_count)
             VALUES ($1, CURRENT_DATE, 1)
             ON CONFLICT (ip_address, claim_day) DO UPDATE
               SET claim_count = referral_ip_limits.claim_count + 1
             RETURNING claim_count`,
            [socketIp]
          );
          if ((limitRow.rows[0]?.claim_count ?? 0) > 3) {
            await client.query("ROLLBACK");
            return res.status(429).json({
              error: "Too many referral claims from this connection. Try again later.",
            });
          }
        }

        // Explicit fingerprint pre-check.
        if (reqFingerprint) {
          const fpCheck = await client.query(
            `SELECT 1 FROM referral_grants WHERE browser_fingerprint = $1 LIMIT 1`,
            [reqFingerprint]
          );
          if (fpCheck.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({
              error: "Referral already claimed from this device",
            });
          }
        }

        // Insert grant record.
        // PARTIAL UNIQUE INDEX on browser_fingerprint is the last-line defence
        // for races that bypass the SELECT above.
        await client.query(
          `INSERT INTO referral_grants
             (referrer_device_id, referred_device_id, ip_address, browser_fingerprint, granted_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [referrerDeviceId, deviceId, socketIp || null, reqFingerprint || null]
        );

        // Credit referrer
        await client.query(
          `UPDATE token_accounts SET tokens = tokens + $1, updated_at = NOW()
           WHERE device_id = $2`,
          [REFERRAL_TOKENS, referrerDeviceId]
        );
        await client.query(
          `INSERT INTO token_transactions
             (account_id, type, amount, description, created_at)
           VALUES ($1, 'reward', $2, 'Referral reward — a friend joined with your invite link', NOW())`,
          [referrerAccountId, REFERRAL_TOKENS]
        );

        // Credit referred device
        await client.query(
          `UPDATE token_accounts SET tokens = tokens + $1, updated_at = NOW()
           WHERE device_id = $2`,
          [REFERRAL_TOKENS, deviceId]
        );
        await client.query(
          `INSERT INTO token_transactions
             (account_id, type, amount, description, created_at)
           VALUES ($1, 'reward', $2,
                   'Welcome referral bonus — joined via a friend''s invite link', NOW())`,
          [referred.id, REFERRAL_TOKENS]
        );

        await client.query("COMMIT");
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }

      return res.json({
        success: true,
        tokensGranted: REFERRAL_TOKENS,
        message: `+${REFERRAL_TOKENS} tokens added to your account and your friend's!`,
      });
    } catch (err: any) {
      // Unique constraint violation = race condition; device or fingerprint already claimed
      if (err.code === "23505") {
        return res.status(409).json({ error: "Referral already claimed for this device" });
      }
      console.error("[referral/claim] error:", err);
      return res.status(500).json({ error: "Failed to claim referral" });
    }
  };
}
