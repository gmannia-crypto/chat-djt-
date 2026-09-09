// billionaire-submit-guard.ts
//
// Anti-farming guard for POST /api/game/submit-result: a per-device AND per-IP cooldown, plus
// the actual result persistence, all inside ONE PostgreSQL transaction.
//
// validateBillionaireSubmission (billionaire-game-validation.ts) only checks that a single
// submission is internally plausible — it says nothing about how often submissions arrive. A
// script can fire many individually-valid submissions back to back to fish for a lucky high
// score. This module closes that gap.
//
// Why the cooldown lives in Postgres, not a process-local Map: this app is deployed as
// autoscale, which can run multiple server instances concurrently (and cycles instances on
// scale-to-zero). A Map is scoped to one process, so two requests routed to different instances
// would each see an empty cooldown and both would be allowed through — the guard would silently
// stop working under real production topology. Postgres is the one piece of state every instance
// shares, so the reservation has to live there.
//
// Why the cooldown reservation and the game-result write share one transaction: reserving the
// cooldown and then persisting the result as two separate operations reopens a different gap —
// if persistence fails after the cooldown was already committed, or succeeds after the cooldown
// commit failed, the two can disagree about what actually happened. Doing both inside a single
// BEGIN/COMMIT means they succeed or fail together: a caller only ever sees "submitted" when the
// completed row AND the cooldown are both durably in place, and "rejected" leaves neither behind.
//
// Why atomicity holds across concurrent requests/instances without any in-process locking: each
// cooldown key reservation is a single `INSERT ... ON CONFLICT (key) DO UPDATE ... WHERE <expired>`
// statement. Postgres takes a row lock on the conflicting key for the duration of the statement,
// so two transactions racing for the same key are serialized by the database itself — the second
// one blocks until the first commits or rolls back, then re-evaluates the WHERE clause against
// the now-current row. This is true regardless of which server instance issued either statement.

import type { Pool, PoolClient } from "pg";
import { BILLIONAIRE_MIN_SECONDS_PER_TURN, BILLIONAIRE_MIN_TURNS_FOR_WIN } from "./billionaire-game-validation";

// A key's very first reservation (no prior row) is bounded by the fastest theoretically possible
// win — nothing shorter than that can be a genuine result.
export const BILLIONAIRE_MIN_SUBMIT_COOLDOWN_SECONDS = BILLIONAIRE_MIN_TURNS_FOR_WIN * BILLIONAIRE_MIN_SECONDS_PER_TURN;

// Subsequent submissions must wait at least as long as the previous submission's own reported
// duration (you can't have started, played, and finished another full game faster than your last
// one claimed to take). That duration is client-reported and validateBillionaireSubmission places
// no upper bound on it, so the cooldown itself is capped here — otherwise one submission with an
// inflated (but individually "valid") duration could lock out every other user sharing that key
// for an unreasonable length of time.
export const BILLIONAIRE_MAX_SUBMIT_COOLDOWN_SECONDS = 120;

export interface BillionaireResultToPersist {
  deviceId: string;
  /** Verified account id (linked_accounts.id), when the caller is signed in. */
  accountId: string | null;
  playerName: string;
  status: "won" | "lost";
  netWorth: number;
  turns: number;
  durationSeconds: number;
  milestonesHitCount: number;
  bestStreak: number;
  karma: number;
  darkDeals: number;
}

export interface BillionaireSubmitOutcome {
  allowed: boolean;
  /** Seconds the caller must still wait when allowed is false. */
  waitSeconds: number;
}

export function capReportedDurationSeconds(reportedDurationSeconds: number): number {
  return Math.min(Math.max(Number(reportedDurationSeconds) || 0, 0), BILLIONAIRE_MAX_SUBMIT_COOLDOWN_SECONDS);
}

async function reserveCooldownKey(client: PoolClient, key: string, cappedDurationSeconds: number): Promise<{ allowed: boolean; waitSeconds: number }> {
  const upsert = await client.query(
    `INSERT INTO billionaire_submit_cooldown (cooldown_key, last_submit_at, last_duration_seconds)
     VALUES ($1, NOW(), $2)
     ON CONFLICT (cooldown_key) DO UPDATE
       SET last_submit_at = EXCLUDED.last_submit_at,
           last_duration_seconds = EXCLUDED.last_duration_seconds
     WHERE billionaire_submit_cooldown.last_submit_at
             <= NOW() - make_interval(secs => GREATEST(billionaire_submit_cooldown.last_duration_seconds, $3::float))
     RETURNING cooldown_key`,
    [key, cappedDurationSeconds, BILLIONAIRE_MIN_SUBMIT_COOLDOWN_SECONDS]
  );
  if (upsert.rows.length > 0) {
    return { allowed: true, waitSeconds: 0 };
  }

  const existing = await client.query(
    `SELECT GREATEST(0, EXTRACT(EPOCH FROM (
       last_submit_at + make_interval(secs => GREATEST(last_duration_seconds, $2::float)) - NOW()
     ))) AS remaining
     FROM billionaire_submit_cooldown WHERE cooldown_key = $1`,
    [key, BILLIONAIRE_MIN_SUBMIT_COOLDOWN_SECONDS]
  );
  const remaining = existing.rows.length > 0 ? Number(existing.rows[0].remaining) : 0;
  return { allowed: false, waitSeconds: Number.isFinite(remaining) ? remaining : 0 };
}

async function persistResult(client: PoolClient, result: BillionaireResultToPersist): Promise<void> {
  // A signed-in caller's in-progress row is the one keyed to their account (it may have been
  // started/saved on a different device); guests fall back to the device-only row.
  const existing = result.accountId
    ? await client.query(
        `SELECT id FROM billionaire_games WHERE account_id = $1 AND status = 'in_progress' ORDER BY updated_at DESC LIMIT 1`,
        [result.accountId]
      )
    : await client.query(
        `SELECT id FROM billionaire_games WHERE device_id = $1 AND account_id IS NULL AND status = 'in_progress' ORDER BY updated_at DESC LIMIT 1`,
        [result.deviceId]
      );

  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE billionaire_games SET status = $1, final_net_worth = $2, turns = $3, duration_seconds = $4, milestones_hit = $5, best_streak = $6, karma = $7, dark_deals = $8, player_name = $9, device_id = $10, account_id = $11, completed_at = NOW(), updated_at = NOW() WHERE id = $12`,
      [result.status, result.netWorth, result.turns, result.durationSeconds, result.milestonesHitCount, result.bestStreak, result.karma, result.darkDeals, result.playerName, result.deviceId, result.accountId, existing.rows[0].id]
    );
  } else {
    await client.query(
      `INSERT INTO billionaire_games (device_id, account_id, player_name, status, final_net_worth, turns, duration_seconds, milestones_hit, best_streak, karma, dark_deals, completed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [result.deviceId, result.accountId, result.playerName, result.status, result.netWorth, result.turns, result.durationSeconds, result.milestonesHitCount, result.bestStreak, result.karma, result.darkDeals]
    );
  }

  if (result.accountId) {
    await client.query(
      `DELETE FROM billionaire_games WHERE account_id = $1 AND status = 'in_progress'`,
      [result.accountId]
    );
  } else {
    await client.query(
      `DELETE FROM billionaire_games WHERE device_id = $1 AND account_id IS NULL AND status = 'in_progress'`,
      [result.deviceId]
    );
  }
}

/**
 * Reserves the device+IP cooldown and persists the completed game result as one atomic
 * transaction. If either cooldown is still active, the transaction is rolled back and nothing
 * changes. If both reservations succeed, the result is written in the same transaction before
 * commit, so a caller only ever observes "allowed" once the completed row is durably persisted.
 */
export async function submitBillionaireGameResult(
  pool: Pool,
  deviceKey: string,
  ipKey: string,
  reportedDurationSeconds: number,
  result: BillionaireResultToPersist
): Promise<BillionaireSubmitOutcome> {
  const cappedDuration = capReportedDurationSeconds(reportedDurationSeconds);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Keys are always reserved in the same order (device, then IP) across every call site, so
    // concurrent requests can never form a lock-wait cycle between the two.
    const deviceReservation = await reserveCooldownKey(client, deviceKey, cappedDuration);
    const ipReservation = await reserveCooldownKey(client, ipKey, cappedDuration);

    if (!deviceReservation.allowed || !ipReservation.allowed) {
      await client.query("ROLLBACK");
      return { allowed: false, waitSeconds: Math.max(deviceReservation.waitSeconds, ipReservation.waitSeconds) };
    }

    await persistResult(client, result);

    await client.query("COMMIT");
    return { allowed: true, waitSeconds: 0 };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Periodic sweep so the table doesn't grow unbounded; safe to call on an interval. */
export async function pruneBillionaireSubmitCooldownTable(pool: Pool, maxAgeSeconds: number): Promise<void> {
  await pool.query(
    `DELETE FROM billionaire_submit_cooldown WHERE last_submit_at < NOW() - make_interval(secs => $1::float)`,
    [maxAgeSeconds]
  );
}
