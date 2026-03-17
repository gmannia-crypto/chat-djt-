import { Pool } from "pg";

const FREE_PROMPT_LIMIT = 3;
const STANDARD_SUBSCRIPTION_TOKENS = 50;
const VIP_SUBSCRIPTION_TOKENS = 150;
const SUBSCRIPTION_TOKENS = STANDARD_SUBSCRIPTION_TOKENS;

export const TOKEN_PACKS = [
  { id: "pack_15", name: "15 Trump Tokens", tokens: 15, price: 299, priceDisplay: "$2.99" },
  { id: "pack_35", name: "35 Trump Tokens", tokens: 35, price: 499, priceDisplay: "$4.99" },
  { id: "pack_80", name: "80 Trump Tokens", tokens: 80, price: 999, priceDisplay: "$9.99" },
];

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return pool;
}

export async function getOrCreateAccount(deviceId: string) {
  const db = getPool();
  let result = await db.query(
    `SELECT * FROM token_accounts WHERE device_id = $1`,
    [deviceId]
  );

  if (result.rows.length === 0) {
    result = await db.query(
      `INSERT INTO token_accounts (device_id, tokens, free_prompts_used, subscription_active, subscription_tokens_granted, created_at, updated_at)
       VALUES ($1, 0, 0, false, false, NOW(), NOW())
       RETURNING *`,
      [deviceId]
    );
  }

  return result.rows[0];
}

export async function getTokenBalance(deviceId: string) {
  const account = await getOrCreateAccount(deviceId);

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
       VALUES ($1, 'use_token', -1, 'Trump Token used for prompt', NOW())`,
      [account.id]
    );
    const balance = await getTokenBalance(deviceId);
    return { success: true, balance };
  }

  return {
    success: false,
    error: "No tokens remaining. Subscribe or buy Trump Tokens to continue!",
    balance: await getTokenBalance(deviceId),
  };
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
      [account.id, tokenAmount, `${tier === "vip" ? "VIP" : "Standard"} subscription - ${tokenAmount} Trump Tokens`, stripeSessionId || null]
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
    [account.id, tokenAmount, `Monthly renewal - ${tokenAmount} Trump Tokens (${tier})`]
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

export { FREE_PROMPT_LIMIT, SUBSCRIPTION_TOKENS, STANDARD_SUBSCRIPTION_TOKENS, VIP_SUBSCRIPTION_TOKENS };
