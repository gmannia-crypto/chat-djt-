import { Pool } from "pg";

const FREE_PROMPT_LIMIT = 10;
const STANDARD_SUBSCRIPTION_TOKENS = 50;
const VIP_SUBSCRIPTION_TOKENS = 150;
const SUBSCRIPTION_TOKENS = STANDARD_SUBSCRIPTION_TOKENS;

export const TOKEN_PACKS = [
  { id: "pack_15", name: "15 Dynamic Tokens", tokens: 15, price: 299, priceDisplay: "$2.99" },
  { id: "pack_35", name: "35 Dynamic Tokens", tokens: 35, price: 499, priceDisplay: "$4.99" },
  { id: "pack_80", name: "80 Dynamic Tokens", tokens: 80, price: 999, priceDisplay: "$9.99" },
];

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return pool;
}

interface AccountContext {
  ipAddress?: string;
  fingerprint?: string;
}

const LOCALHOST_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);

let _columnsEnsured = false;
async function ensureColumns(db: Pool) {
  if (_columnsEnsured) return;
  try {
    await db.query(`ALTER TABLE token_accounts ADD COLUMN IF NOT EXISTS ip_address TEXT`);
    await db.query(`ALTER TABLE token_accounts ADD COLUMN IF NOT EXISTS browser_fingerprint TEXT`);
    _columnsEnsured = true;
  } catch {}
}

export async function getOrCreateAccount(deviceId: string, ctx?: AccountContext) {
  const db = getPool();

  // Ensure ip_address + browser_fingerprint columns exist (idempotent, cached)
  await ensureColumns(db);

  let result = await db.query(
    `SELECT * FROM token_accounts WHERE device_id = $1`,
    [deviceId]
  );

  if (result.rows.length === 0) {
    const WELCOME_BONUS_TOKENS = 25;
    const isDev = process.env.NODE_ENV === "development";
    let startingTokens = isDev ? 100 : 15; // 15 free welcome tokens

    // — Abuse detection: same fingerprint or same IP already has welcome tokens —
    if (!isDev && ctx && (ctx.fingerprint || (ctx.ipAddress && !LOCALHOST_IPS.has(ctx.ipAddress)))) {
      try {
        const orClauses: string[] = [];
        const params: any[] = [deviceId];

        if (ctx.fingerprint) {
          params.push(ctx.fingerprint);
          orClauses.push(`browser_fingerprint = $${params.length}`);
        }

        if (ctx.ipAddress && !LOCALHOST_IPS.has(ctx.ipAddress)) {
          params.push(ctx.ipAddress);
          // Only flag IPs that have created another account in the last 60 minutes
          orClauses.push(`(ip_address = $${params.length} AND created_at > NOW() - INTERVAL '60 minutes')`);
        }

        if (orClauses.length > 0) {
          const dupCheck = await db.query(
            `SELECT id FROM token_accounts WHERE device_id != $1 AND (${orClauses.join(" OR ")}) LIMIT 1`,
            params
          );
          if (dupCheck.rows.length > 0) {
            startingTokens = 0; // Already claimed welcome bonus from same browser/IP
          }
        }
      } catch { /* non-fatal — don't block account creation */ }
    }

    result = await db.query(
      `INSERT INTO token_accounts (device_id, tokens, free_prompts_used, subscription_active, subscription_tokens_granted, ip_address, browser_fingerprint, created_at, updated_at)
       VALUES ($1, $2, 0, false, false, $3, $4, NOW(), NOW())
       ON CONFLICT (device_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [deviceId, startingTokens, ctx?.ipAddress || null, ctx?.fingerprint || null]
    );

    if (startingTokens > 0) {
      await db.query(
        `INSERT INTO token_transactions (account_id, type, amount, description, created_at)
         VALUES ($1, 'reward', $2, $3, NOW())`,
        [result.rows[0].id, startingTokens, isDev ? 'Development mode starting tokens' : 'Welcome bonus - 25 free tokens to explore the app']
      );
    }
  } else {
    // Account exists — opportunistically update IP/fingerprint if missing
    if (ctx?.ipAddress || ctx?.fingerprint) {
      try {
        await db.query(
          `UPDATE token_accounts SET
             ip_address = COALESCE(ip_address, $2),
             browser_fingerprint = COALESCE(browser_fingerprint, $3),
             updated_at = NOW()
           WHERE device_id = $1`,
          [deviceId, ctx.ipAddress || null, ctx.fingerprint || null]
        );
      } catch {}
    }
  }

  return result.rows[0];
}

export async function getTokenBalance(deviceId: string, ctx?: AccountContext) {
  const account = await getOrCreateAccount(deviceId, ctx);

  const freeRemaining = Math.max(0, FREE_PROMPT_LIMIT - account.free_prompts_used);
  const isSubscribed = account.subscription_active &&
    account.subscription_expires_at &&
    new Date(account.subscription_expires_at) > new Date();

  return {
    tokens: account.tokens,
    freeRemaining,
    isSubscribed,
    totalAvailable: account.tokens + freeRemaining,
    subscriptionExpiresAt: account.subscription_expires_at,
    subscriptionTier: account.subscription_tier || null,
  };
}

export async function useTokens(deviceId: string, count: number = 1, description: string = 'Token used'): Promise<{ success: boolean; error?: string; balance?: any }> {
  const db = getPool();
  const account = await getOrCreateAccount(deviceId);
  const freeRemaining = Math.max(0, FREE_PROMPT_LIMIT - account.free_prompts_used);

  if (count <= 1) {
    return useToken(deviceId);
  }

  let charged = 0;
  const freeToUse = Math.min(freeRemaining, count);
  if (freeToUse > 0) {
    await db.query(
      `UPDATE token_accounts SET free_prompts_used = free_prompts_used + $2, updated_at = NOW() WHERE device_id = $1`,
      [deviceId, freeToUse]
    );
    await db.query(
      `INSERT INTO token_transactions (account_id, type, amount, description, created_at)
       VALUES ($1, 'use_free', $2, $3, NOW())`,
      [account.id, -freeToUse, description]
    );
    charged += freeToUse;
  }

  const remaining = count - charged;
  if (remaining > 0) {
    if (account.tokens < remaining) {
      return {
        success: false,
        error: `Not enough tokens. Video costs ${count} tokens. You have ${account.tokens + (freeRemaining - freeToUse)} remaining.`,
        balance: await getTokenBalance(deviceId),
      };
    }
    await db.query(
      `UPDATE token_accounts SET tokens = tokens - $2, updated_at = NOW() WHERE device_id = $1 AND tokens >= $2`,
      [deviceId, remaining]
    );
    await db.query(
      `INSERT INTO token_transactions (account_id, type, amount, description, created_at)
       VALUES ($1, 'use_token', $2, $3, NOW())`,
      [account.id, -remaining, description]
    );
  }

  return { success: true, balance: await getTokenBalance(deviceId) };
}

export async function useToken(deviceId: string): Promise<{ success: boolean; error?: string; balance?: any }> {
  const db = getPool();
  const account = await getOrCreateAccount(deviceId);

  const freeRemaining = Math.max(0, FREE_PROMPT_LIMIT - account.free_prompts_used);

  if (freeRemaining > 0) {
    await db.query(
      `UPDATE token_accounts SET free_prompts_used = free_prompts_used + 1, updated_at = NOW() WHERE device_id = $1`,
      [deviceId]
    );
    await db.query(
      `INSERT INTO token_transactions (account_id, type, amount, description, created_at)
       VALUES ($1, 'use_free', -1, 'Free prompt used', NOW())`,
      [account.id]
    );
    const balance = await getTokenBalance(deviceId);
    return { success: true, balance };
  }

  if (account.tokens > 0) {
    await db.query(
      `UPDATE token_accounts SET tokens = tokens - 1, updated_at = NOW() WHERE device_id = $1 AND tokens > 0`,
      [deviceId]
    );
    await db.query(
      `INSERT INTO token_transactions (account_id, type, amount, description, created_at)
       VALUES ($1, 'use_token', -1, 'D.C. Token used for prompt', NOW())`,
      [account.id]
    );
    const balance = await getTokenBalance(deviceId);
    return { success: true, balance };
  }

  return {
    success: false,
    error: "No tokens remaining. Subscribe or buy Dynamic Tokens to continue!",
    balance: await getTokenBalance(deviceId),
  };
}

export async function grantRewardTokens(deviceId: string, amount: number, description: string) {
  const db = getPool();
  const account = await getOrCreateAccount(deviceId);
  await db.query(
    `UPDATE token_accounts SET tokens = tokens + $2, updated_at = NOW() WHERE device_id = $1`,
    [deviceId, amount]
  );
  await db.query(
    `INSERT INTO token_transactions (account_id, type, amount, description, created_at)
     VALUES ($1, 'reward', $2, $3, NOW())`,
    [account.id, amount, description]
  );
  return await getTokenBalance(deviceId);
}

export async function grantSubscriptionTokens(deviceId: string, stripeCustomerId: string, stripeSubscriptionId: string, tier: "standard" | "vip" = "standard", stripeSessionId?: string) {
  const db = getPool();
  const account = await getOrCreateAccount(deviceId);
  const tokenAmount = tier === "vip" ? VIP_SUBSCRIPTION_TOKENS : STANDARD_SUBSCRIPTION_TOKENS;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 31);

  await db.query(
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_accounts' AND column_name = 'subscription_tier') THEN
         ALTER TABLE token_accounts ADD COLUMN subscription_tier TEXT DEFAULT 'standard';
       END IF;
     END $$`
  );

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    if (stripeSessionId) {
      const existing = await client.query(
        `SELECT id FROM token_transactions WHERE stripe_session_id = $1 FOR UPDATE`,
        [stripeSessionId]
      );
      if (existing.rows.length > 0) {
        await client.query("COMMIT");
        console.log(`[tokens] Subscription already fulfilled for session ${stripeSessionId}, skipping duplicate`);
        return await getTokenBalance(deviceId);
      }
    }

    await client.query(
      `UPDATE token_accounts
       SET tokens = tokens + $1,
           subscription_active = true,
           subscription_expires_at = $2,
           subscription_tokens_granted = true,
           last_monthly_reset = NOW(),
           stripe_customer_id = $3,
           stripe_subscription_id = $4,
           subscription_tier = $5,
           updated_at = NOW()
       WHERE device_id = $6`,
      [tokenAmount, expiresAt, stripeCustomerId, stripeSubscriptionId, tier, deviceId]
    );

    await client.query(
      `INSERT INTO token_transactions (account_id, type, amount, description, stripe_session_id, created_at)
       VALUES ($1, 'subscription', $2, $3, $4, NOW())`,
      [account.id, tokenAmount, `${tier === "vip" ? "VIP" : "Standard"} subscription - ${tokenAmount} Dynamic Tokens`, stripeSessionId || null]
    );

    await client.query("COMMIT");
    console.log(`[tokens] Subscription granted: ${tokenAmount} tokens to ${deviceId} (${tier})`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return await getTokenBalance(deviceId);
}

export async function grantTokenPack(deviceId: string, packId: string, stripeSessionId: string) {
  const db = getPool();

  const existing = await db.query(
    `SELECT id FROM token_transactions WHERE stripe_session_id = $1`,
    [stripeSessionId]
  );
  if (existing.rows.length > 0) {
    console.log(`[tokens] Already fulfilled session ${stripeSessionId}, skipping duplicate`);
    return await getTokenBalance(deviceId);
  }

  const pack = TOKEN_PACKS.find(p => p.id === packId);
  if (!pack) throw new Error("Invalid token pack");

  const account = await getOrCreateAccount(deviceId);

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const existsInTx = await client.query(
      `SELECT id FROM token_transactions WHERE stripe_session_id = $1 FOR UPDATE`,
      [stripeSessionId]
    );
    if (existsInTx.rows.length > 0) {
      await client.query("COMMIT");
      console.log(`[tokens] Already fulfilled session ${stripeSessionId}, skipping duplicate (race)`);
      return await getTokenBalance(deviceId);
    }

    await client.query(
      `UPDATE token_accounts SET tokens = tokens + $1, updated_at = NOW() WHERE device_id = $2`,
      [pack.tokens, deviceId]
    );

    await client.query(
      `INSERT INTO token_transactions (account_id, type, amount, description, stripe_session_id, created_at)
       VALUES ($1, 'purchase', $2, $3, $4, NOW())`,
      [account.id, pack.tokens, `Purchased ${pack.name}`, stripeSessionId]
    );

    await client.query("COMMIT");
    console.log(`[tokens] Granted ${pack.tokens} tokens to ${deviceId} for pack ${packId} (session: ${stripeSessionId})`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return await getTokenBalance(deviceId);
}

export async function refreshSubscriptionTokens(stripeSubscriptionId: string) {
  const db = getPool();
  const result = await db.query(
    `SELECT * FROM token_accounts WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId]
  );

  if (result.rows.length === 0) return;
  const account = result.rows[0];
  const tier = account.subscription_tier || "standard";
  const tokenAmount = tier === "vip" ? VIP_SUBSCRIPTION_TOKENS : STANDARD_SUBSCRIPTION_TOKENS;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 31);

  await db.query(
    `UPDATE token_accounts
     SET tokens = tokens + $1,
         subscription_expires_at = $2,
         last_monthly_reset = NOW(),
         updated_at = NOW()
     WHERE id = $3`,
    [tokenAmount, expiresAt, account.id]
  );

  await db.query(
    `INSERT INTO token_transactions (account_id, type, amount, description, created_at)
     VALUES ($1, 'subscription_renewal', $2, $3, NOW())`,
    [account.id, tokenAmount, `Monthly renewal - ${tokenAmount} Dynamic Tokens (${tier})`]
  );
}

export async function cancelSubscription(stripeSubscriptionId: string) {
  const db = getPool();
  await db.query(
    `UPDATE token_accounts
     SET subscription_active = false,
         updated_at = NOW()
     WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId]
  );
}

// ── Linked Account Auth ───────────────────────────────────────────────────────

const EMAIL_BONUS_TOKENS = 5;
let _authTablesEnsured = false;

export async function ensureAuthTables(db: Pool) {
  if (_authTablesEnsured) return;
  try {
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
    await db.query(`ALTER TABLE token_accounts ADD COLUMN IF NOT EXISTS linked_account_id TEXT`);
    await db.query(`ALTER TABLE token_accounts ADD COLUMN IF NOT EXISTS email_bonus_granted BOOLEAN DEFAULT FALSE`);
    _authTablesEnsured = true;
  } catch {}
}

export interface LinkedAccount {
  id: string;
  email: string;
  name: string | null;
}

export async function linkDeviceToEmail(
  deviceId: string,
  email: string,
  name: string
): Promise<{ user: LinkedAccount; bonusGranted: boolean }> {
  const db = getPool();
  await ensureAuthTables(db);

  // Upsert the linked_accounts row
  const upsert = await db.query<LinkedAccount & { id: string }>(
    `INSERT INTO linked_accounts (email, name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (email) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, linked_accounts.name),
       updated_at = NOW()
     RETURNING id, email, name`,
    [email.toLowerCase().trim(), name.trim() || null]
  );
  const user = upsert.rows[0];

  // Ensure device has a token_accounts row (idempotent — balance endpoint normally creates it first)
  await db.query(
    `INSERT INTO token_accounts (device_id, tokens, free_prompts_used, subscription_active, subscription_tokens_granted, created_at, updated_at)
     VALUES ($1, 0, 0, false, false, NOW(), NOW())
     ON CONFLICT (device_id) DO NOTHING`,
    [deviceId]
  );

  // Check if this device already got the bonus
  const existing = await db.query(
    `SELECT email_bonus_granted FROM token_accounts WHERE device_id = $1`,
    [deviceId]
  );
  const alreadyBonused = existing.rows[0]?.email_bonus_granted ?? false;

  // Link device → account
  await db.query(
    `UPDATE token_accounts
     SET linked_account_id = $1,
         email_bonus_granted = true,
         updated_at = NOW()
     WHERE device_id = $2`,
    [user.id, deviceId]
  );

  let bonusGranted = false;
  if (!alreadyBonused) {
    await db.query(
      `UPDATE token_accounts SET tokens = tokens + $1, updated_at = NOW() WHERE device_id = $2`,
      [EMAIL_BONUS_TOKENS, deviceId]
    );
    await db.query(
      `INSERT INTO token_transactions (account_id, type, amount, description, created_at)
       SELECT id, 'reward', $1, 'Email signup bonus — 5 tokens', NOW()
       FROM token_accounts WHERE device_id = $2`,
      [EMAIL_BONUS_TOKENS, deviceId]
    );
    bonusGranted = true;
  }

  return { user: { id: user.id, email: user.email, name: user.name }, bonusGranted };
}

export async function getLinkedAccount(deviceId: string): Promise<LinkedAccount | null> {
  const db = getPool();
  await ensureAuthTables(db);
  const res = await db.query(
    `SELECT la.id, la.email, la.name
     FROM token_accounts ta
     JOIN linked_accounts la ON la.id = ta.linked_account_id
     WHERE ta.device_id = $1`,
    [deviceId]
  );
  return res.rows[0] ?? null;
}

export { FREE_PROMPT_LIMIT, SUBSCRIPTION_TOKENS, STANDARD_SUBSCRIPTION_TOKENS, VIP_SUBSCRIPTION_TOKENS };
