import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import { type LinkedAccount } from "./tokens";

const CODE_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 90;
const MAX_ATTEMPTS = 5;
const REQUEST_WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 3;

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return pool;
}

let tablesEnsured = false;
async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS linked_accounts (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      google_id TEXT,
      apple_id TEXT,
      twitter_id TEXT,
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email TEXT NOT NULL,
      device_id TEXT NOT NULL,
      name TEXT,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed_at TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS email_verification_codes_lookup
    ON email_verification_codes (email, device_id, created_at DESC)
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      token_hash TEXT UNIQUE NOT NULL,
      linked_account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      last_used_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP`);
  await db.query(`ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS email_bonus_granted BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE token_accounts ADD COLUMN IF NOT EXISTS linked_account_id TEXT`);
  await db.query(`ALTER TABLE token_accounts ADD COLUMN IF NOT EXISTS email_bonus_granted BOOLEAN DEFAULT FALSE`);
  tablesEnsured = true;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is required");
  return value;
}

function hash(value: string): string {
  return createHash("sha256").update(`${secret()}:${value}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function sendVerificationEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email delivery is not configured");
  const from = process.env.RESEND_FROM_EMAIL || "Dynamic AI <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} is your Dynamic AI verification code`,
      text: `Your Dynamic AI verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you did not request this code, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px"><h2>Verify your email</h2><p>Enter this code in Dynamic AI:</p><div style="font-size:36px;font-weight:800;letter-spacing:8px;margin:24px 0">${code}</div><p>This code expires in ${CODE_TTL_MINUTES} minutes.</p><p style="color:#666">If you did not request it, you can ignore this email.</p></div>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Resend verification email failed:", response.status, detail.slice(0, 300));
    throw new Error("Verification email could not be sent");
  }
}

export async function requestEmailVerification(
  deviceId: string,
  rawEmail: string,
  name: string,
): Promise<void> {
  await ensureTables();
  const email = normalizeEmail(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email required");
  const db = getPool();
  const code = String(randomInt(100000, 1000000));
  const client = await db.connect();
  let codeId: string | null = null;
  try {
    await client.query("BEGIN");
    // Serialize requests for one email so concurrent calls cannot all pass the
    // request-count check before any of them records a code.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [email]);
    const recent = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM email_verification_codes
       WHERE email = $1 AND created_at > NOW() - ($2 * INTERVAL '1 minute')`,
      [email, REQUEST_WINDOW_MINUTES],
    );
    if ((recent.rows[0]?.count || 0) >= MAX_REQUESTS_PER_WINDOW) {
      throw new Error("Too many codes requested. Please wait 15 minutes.");
    }
    await client.query(
      `UPDATE email_verification_codes
       SET consumed_at = NOW()
       WHERE email = $1 AND device_id = $2 AND consumed_at IS NULL`,
      [email, deviceId],
    );
    const inserted = await client.query(
      `INSERT INTO email_verification_codes
         (email, device_id, name, code_hash, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 minute'))
       RETURNING id`,
      [email, deviceId, name.trim() || null, hash(`${email}:${deviceId}:${code}`), CODE_TTL_MINUTES],
    );
    codeId = inserted.rows[0].id;
    await client.query("COMMIT");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
  try {
    await sendVerificationEmail(email, code);
  } catch (error) {
    if (codeId) await db.query(`DELETE FROM email_verification_codes WHERE id = $1`, [codeId]);
    throw error;
  }
}

export async function verifyEmailCode(
  deviceId: string,
  rawEmail: string,
  code: string,
): Promise<{ user: LinkedAccount; bonusGranted: boolean; sessionToken: string }> {
  await ensureTables();
  const email = normalizeEmail(rawEmail);
  const db = getPool();
  const client = await db.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const result = await client.query(
      `SELECT * FROM email_verification_codes
       WHERE email = $1 AND device_id = $2 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [email, deviceId],
    );
    const row = result.rows[0];
    if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
      throw new Error("Code expired. Request a new one.");
    }
    if (row.attempts >= MAX_ATTEMPTS) throw new Error("Too many attempts. Request a new code.");
    const expected = hash(`${email}:${deviceId}:${String(code).trim()}`);
    if (!safeEqual(expected, row.code_hash)) {
      await client.query(
        `UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1`,
        [row.id],
      );
      await client.query("COMMIT");
      transactionOpen = false;
      throw new Error("That code is incorrect.");
    }
    const linkedAccount = await client.query<LinkedAccount & { email_bonus_granted: boolean }>(
      `INSERT INTO linked_accounts (email, name, email_verified_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, linked_accounts.name),
         email_verified_at = COALESCE(linked_accounts.email_verified_at, NOW()),
         updated_at = NOW()
       RETURNING id, email, name, email_bonus_granted`,
      [email, row.name?.trim() || null],
    );
    const user = linkedAccount.rows[0];
    await client.query(
      `INSERT INTO token_accounts
         (device_id, tokens, free_prompts_used, subscription_active, subscription_tokens_granted, created_at, updated_at)
       VALUES ($1, 0, 0, false, false, NOW(), NOW())
       ON CONFLICT (device_id) DO NOTHING`,
      [deviceId],
    );
    await client.query(
      `UPDATE token_accounts
       SET linked_account_id = $1, email_bonus_granted = true, updated_at = NOW()
       WHERE device_id = $2`,
      [user.id, deviceId],
    );
    const bonusGranted = !user.email_bonus_granted;
    if (bonusGranted) {
      await client.query(
        `UPDATE linked_accounts SET email_bonus_granted = true WHERE id = $1`,
        [user.id],
      );
      await client.query(
        `UPDATE token_accounts SET tokens = tokens + 5, updated_at = NOW() WHERE device_id = $1`,
        [deviceId],
      );
      await client.query(
        `INSERT INTO token_transactions (account_id, type, amount, description, created_at)
         SELECT id, 'reward', 5, 'Email signup bonus — 5 tokens', NOW()
         FROM token_accounts WHERE device_id = $1`,
        [deviceId],
      );
    }
    const sessionToken = randomBytes(32).toString("base64url");
    await client.query(
      `INSERT INTO auth_sessions (token_hash, linked_account_id, device_id, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 day'))`,
      [hash(sessionToken), user.id, deviceId, SESSION_TTL_DAYS],
    );
    await client.query(
      `UPDATE email_verification_codes SET consumed_at = NOW() WHERE id = $1`,
      [row.id],
    );
    await client.query("COMMIT");
    transactionOpen = false;
    return {
      user: { id: user.id, email: user.email, name: user.name },
      bonusGranted,
      sessionToken,
    };
  } catch (error) {
    if (transactionOpen) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function authenticateSession(
  authorizationHeader: string | undefined,
): Promise<{ accountId: string; deviceId: string; user: LinkedAccount } | null> {
  await ensureTables();
  const token = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const db = getPool();
  const result = await db.query(
    `SELECT s.linked_account_id, s.device_id, la.id, la.email, la.name
     FROM auth_sessions s
     JOIN linked_accounts la ON la.id = s.linked_account_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND la.email_verified_at IS NOT NULL`,
    [hash(token)],
  );
  if (!result.rows[0]) return null;
  await db.query(
    `UPDATE auth_sessions SET last_used_at = NOW() WHERE token_hash = $1`,
    [hash(token)],
  );
  return {
    accountId: result.rows[0].linked_account_id,
    deviceId: result.rows[0].device_id,
    user: {
      id: result.rows[0].id,
      email: result.rows[0].email,
      name: result.rows[0].name,
    },
  };
}

export async function getVerifiedLinkedAccount(
  authorizationHeader: string | undefined,
): Promise<LinkedAccount | null> {
  const session = await authenticateSession(authorizationHeader);
  return session?.user || null;
}