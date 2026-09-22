import { Pool } from "pg";

/**
 * Proactive alerting for the "Character Break Watch" admin panel (see
 * getCharacterBreakStats/trackCharacterBreak in server/analytics.ts).
 *
 * That panel only helps if someone remembers to open it. This module periodically
 * compares each persona's TODAY character-break volume against its own recent
 * baseline and, when it spikes well beyond normal, emails an admin — no dashboard
 * visit required.
 */

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  }
  return pool;
}

export async function initCharacterBreakAlertsTable() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS character_break_alerts (
      id SERIAL PRIMARY KEY,
      persona TEXT NOT NULL,
      alert_day TEXT NOT NULL,
      today_count INTEGER NOT NULL,
      baseline_daily_avg NUMERIC NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      last_attempt_at TIMESTAMP DEFAULT NOW(),
      sent_at TIMESTAMP,
      UNIQUE (persona, alert_day)
    )
  `);
  // Idempotent migration for tables created before status tracking existed.
  await db.query(`ALTER TABLE character_break_alerts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`);
  await db.query(`ALTER TABLE character_break_alerts ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP DEFAULT NOW()`);
  await db.query(`ALTER TABLE character_break_alerts ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP`);
  // sent_at must only ever be set on an actual successful send (see checkCharacterBreakSpikes).
  // An earlier iteration of this table defaulted it to NOW() on insert; drop that default so
  // existing rows/environments don't silently look "sent" before delivery is confirmed.
  await db.query(`ALTER TABLE character_break_alerts ALTER COLUMN sent_at DROP DEFAULT`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure spike-detection logic — no DB, directly unit-testable
// (see server/character-break-spike.test.js).
// ─────────────────────────────────────────────────────────────────────────────

export interface CharacterBreakSpikeInput {
  persona: string;
  /** retry + watch events for the persona so far today (see getCharacterBreakSpikeInputs). */
  todayCount: number;
  /** average daily retry+watch events over the trailing baseline window, excluding today. */
  baselineDailyAvg: number;
}

export interface CharacterBreakSpike extends CharacterBreakSpikeInput {
  /** todayCount / baselineDailyAvg, or null when there's no baseline history to divide by. */
  multiplier: number | null;
}

// A persona with only a couple of stray events today should never page anyone — both an
// absolute floor and a multiplier-over-baseline check are required so low-volume personas
// don't generate noisy false positives from single-digit swings.
export const SPIKE_MIN_TODAY_COUNT = 5;
export const SPIKE_MULTIPLIER_THRESHOLD = 3;
export const SPIKE_MIN_ABSOLUTE_INCREASE = 4;
// Personas with zero baseline history (brand new, or previously silent) need a higher bar
// since there's nothing to compute a multiplier against.
export const SPIKE_NO_BASELINE_MIN_TODAY_COUNT = 10;

export function detectCharacterBreakSpikes(
  inputs: CharacterBreakSpikeInput[],
): CharacterBreakSpike[] {
  const spikes: CharacterBreakSpike[] = [];
  for (const input of inputs) {
    const { persona, todayCount, baselineDailyAvg } = input;
    if (todayCount < SPIKE_MIN_TODAY_COUNT) continue;

    if (baselineDailyAvg <= 0) {
      if (todayCount >= SPIKE_NO_BASELINE_MIN_TODAY_COUNT) {
        spikes.push({ persona, todayCount, baselineDailyAvg, multiplier: null });
      }
      continue;
    }

    const multiplier = todayCount / baselineDailyAvg;
    const absoluteIncrease = todayCount - baselineDailyAvg;
    if (multiplier >= SPIKE_MULTIPLIER_THRESHOLD && absoluteIncrease >= SPIKE_MIN_ABSOLUTE_INCREASE) {
      spikes.push({ persona, todayCount, baselineDailyAvg, multiplier });
    }
  }
  return spikes;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB-backed input gathering + alert dispatch
// ─────────────────────────────────────────────────────────────────────────────

const BASELINE_WINDOW_DAYS = 14;

/**
 * Gathers today's-so-far and baseline counts per persona from the same feature_events rows
 * getCharacterBreakStats() reads. "Count" = retry + watch events; retry_failed is a
 * severity signal on the same incident as its paired retry, not a separate incident (see
 * character-break-analytics.test.js for why retry_failed must not be double-counted).
 */
export async function getCharacterBreakSpikeInputs(): Promise<CharacterBreakSpikeInput[]> {
  const db = getPool();

  const [todayRes, baselineRes] = await Promise.all([
    db.query(`
      SELECT
        COALESCE(metadata->>'personaId', 'unknown') AS persona,
        COUNT(*) FILTER (WHERE action IN ('retry', 'watch')) AS count
      FROM feature_events
      WHERE feature = 'character_break' AND created_at >= CURRENT_DATE
      GROUP BY persona
    `),
    db.query(`
      SELECT
        COALESCE(metadata->>'personaId', 'unknown') AS persona,
        COUNT(*) FILTER (WHERE action IN ('retry', 'watch')) AS total
      FROM feature_events
      WHERE feature = 'character_break'
        AND created_at >= CURRENT_DATE - make_interval(days => $1)
        AND created_at < CURRENT_DATE
      GROUP BY persona
    `, [BASELINE_WINDOW_DAYS]),
  ]);

  const todayMap = new Map<string, number>();
  for (const row of todayRes.rows) {
    todayMap.set(row.persona as string, parseInt(row.count) || 0);
  }
  const baselineMap = new Map<string, number>();
  for (const row of baselineRes.rows) {
    baselineMap.set(row.persona as string, (parseInt(row.total) || 0) / BASELINE_WINDOW_DAYS);
  }

  const personas = new Set<string>([...todayMap.keys(), ...baselineMap.keys()]);
  return Array.from(personas).map((persona) => ({
    persona,
    todayCount: todayMap.get(persona) || 0,
    baselineDailyAvg: baselineMap.get(persona) || 0,
  }));
}

function formatPersonaLabel(personaId: string): string {
  return personaId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type SpikeAlertDeliveryStatus = "sent" | "failed" | "skipped_no_config";

export interface SpikeAlertDeliveryResult {
  status: SpikeAlertDeliveryStatus;
  error?: string;
}

/**
 * Emails an admin about a single persona spike. Requires RESEND_API_KEY (already used for
 * verification emails, see server/email-auth.ts) and ADMIN_ALERT_EMAIL (the destination
 * inbox). Returns a truthful delivery status instead of swallowing failures — the caller
 * uses this to decide whether the spike may be retried on the next scheduled check, so a
 * missing config or a transient Resend outage must never look identical to a successful send.
 *
 * `fetchImpl` is injectable so delivery-failure paths are unit-testable without a real
 * network call (see server/character-break-alert-delivery.test.js).
 */
export async function sendCharacterBreakSpikeAlert(
  spike: CharacterBreakSpike,
  fetchImpl: typeof fetch = fetch,
): Promise<SpikeAlertDeliveryResult> {
  const personaLabel = formatPersonaLabel(spike.persona);
  const baselineLabel = spike.baselineDailyAvg > 0
    ? `${spike.baselineDailyAvg.toFixed(1)}/day`
    : "no recent history";
  const multiplierLabel = spike.multiplier !== null
    ? `${spike.multiplier.toFixed(1)}x above normal`
    : "no baseline to compare against";
  const summary = `${personaLabel} tripped ${spike.todayCount} character-break events today ` +
    `vs. a ${baselineLabel} baseline (${multiplierLabel}). Check the Character Break Watch panel in admin.`;

  console.warn(`[CHARACTER_BREAK_ALERT] ${summary}`);

  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!apiKey || !adminEmail) {
    console.warn(
      "[CHARACTER_BREAK_ALERT] RESEND_API_KEY and/or ADMIN_ALERT_EMAIL not configured — " +
      "spike was logged above only, no email sent. Will retry once configured.",
    );
    return { status: "skipped_no_config" };
  }

  const from = process.env.RESEND_FROM_EMAIL || "Dynamic AI <onboarding@resend.dev>";
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [adminEmail],
        subject: `\u26a0\ufe0f Character-break spike: ${personaLabel}`,
        text: summary,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
          <h2 style="color:#b91c1c">\u26a0\ufe0f Character-break spike detected</h2>
          <p><strong>${personaLabel}</strong> tripped <strong>${spike.todayCount}</strong> character-break events today.</p>
          <p>Recent baseline: <strong>${baselineLabel}</strong> (${multiplierLabel}).</p>
          <p>Open the Character Break Watch panel in the admin dashboard for the full breakdown.</p>
        </div>`,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      const error = `Resend API returned ${response.status}: ${detail.slice(0, 300)}`;
      console.error("Character break spike alert email failed:", error);
      return { status: "failed", error };
    }
    return { status: "sent" };
  } catch (e: any) {
    console.error("Character break spike alert email error:", e);
    return { status: "failed", error: e?.message || "Unknown error sending alert email" };
  }
}

export interface CharacterBreakAlertHistoryEntry {
  persona: string;
  alertDay: string;
  todayCount: number;
  baselineDailyAvg: number;
  status: string;
  lastAttemptAt: string | null;
  sentAt: string | null;
}

/**
 * Recent spike alert history for the admin dashboard (see /api/admin/character-break-alerts
 * in server/routes.ts) — surfaces what has already fired in character_break_alerts so an
 * admin who missed the email can still see it without a DB console.
 */
export async function getCharacterBreakAlertHistory(limit = 50): Promise<CharacterBreakAlertHistoryEntry[]> {
  await initCharacterBreakAlertsTable();
  const db = getPool();
  const res = await db.query(
    `SELECT persona, alert_day, today_count, baseline_daily_avg, status, last_attempt_at, sent_at
     FROM character_break_alerts
     ORDER BY alert_day DESC, last_attempt_at DESC
     LIMIT $1`,
    [Math.min(200, Math.max(1, limit))],
  );
  return res.rows.map((row: any) => ({
    persona: row.persona as string,
    alertDay: row.alert_day as string,
    todayCount: parseInt(row.today_count) || 0,
    baselineDailyAvg: parseFloat(row.baseline_daily_avg) || 0,
    status: row.status as string,
    lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null,
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
  }));
}

/**
 * Runs the spike check: gathers today-vs-baseline inputs, detects spikes, and emails an
 * admin for any spike not already SUCCESSFULLY delivered today.
 *
 * Delivery status is tracked per persona/day (character_break_alerts.status): only a
 * 'sent' row blocks a future attempt for the same persona+day. A missing-config or failed
 * send is recorded as 'skipped_no_config' / 'failed' and is retried the next time this runs
 * (every 30 minutes, see server/routes.ts) — so a spike detected before ADMIN_ALERT_EMAIL is
 * configured, or during a transient Resend outage, is not silently lost for the rest of the
 * day.
 *
 * Each persona's row is atomically claimed (moved out of 'sent') before sending, so two
 * overlapping runs can't both report a successful delivery for the same persona/day.
 */
export async function checkCharacterBreakSpikes(
  fetchImpl: typeof fetch = fetch,
): Promise<{ checked: number; alerted: string[]; failed: string[]; skippedNoConfig: string[] }> {
  await initCharacterBreakAlertsTable();
  const inputs = await getCharacterBreakSpikeInputs();
  const spikes = detectCharacterBreakSpikes(inputs);
  const alerted: string[] = [];
  const failed: string[] = [];
  const skippedNoConfig: string[] = [];
  if (spikes.length === 0) {
    return { checked: inputs.length, alerted, failed, skippedNoConfig };
  }

  const db = getPool();
  const today = new Date().toISOString().slice(0, 10);
  for (const spike of spikes) {
    try {
      // Claim this persona/day for a delivery attempt — no-op (0 rows) if a previous
      // attempt already succeeded ('sent'), so a successful alert is never re-sent.
      const claimRes = await db.query(
        `INSERT INTO character_break_alerts
           (persona, alert_day, today_count, baseline_daily_avg, status, last_attempt_at)
         VALUES ($1, $2, $3, $4, 'sending', NOW())
         ON CONFLICT (persona, alert_day) DO UPDATE SET
           today_count = EXCLUDED.today_count,
           baseline_daily_avg = EXCLUDED.baseline_daily_avg,
           status = 'sending',
           last_attempt_at = NOW()
         WHERE character_break_alerts.status != 'sent'
         RETURNING id`,
        [spike.persona, today, spike.todayCount, spike.baselineDailyAvg],
      );
      if (claimRes.rowCount === 0) continue; // already successfully alerted today

      const delivery = await sendCharacterBreakSpikeAlert(spike, fetchImpl);
      await db.query(
        `UPDATE character_break_alerts
         SET status = $3, last_attempt_at = NOW(), sent_at = CASE WHEN $3 = 'sent' THEN NOW() ELSE sent_at END
         WHERE persona = $1 AND alert_day = $2`,
        [spike.persona, today, delivery.status],
      );

      if (delivery.status === "sent") alerted.push(spike.persona);
      else if (delivery.status === "failed") failed.push(spike.persona);
      else skippedNoConfig.push(spike.persona);
    } catch (e) {
      console.error(`Character break spike alert error for ${spike.persona}:`, e);
      failed.push(spike.persona);
    }
  }
  return { checked: inputs.length, alerted, failed, skippedNoConfig };
}
