import { Pool } from "pg";

const FREE_PROMPT_LIMIT = 3;
const SUBSCRIPTION_TOKENS = 30;

export const TOKEN_PACKS = [
  { id: "pack_10", name: "10 Trump Tokens", tokens: 10, price: 199, priceDisplay: "$1.99" },
  { id: "pack_25", name: "25 Trump Tokens", tokens: 25, price: 399, priceDisplay: "$3.99" },
  { id: "pack_50", name: "50 Trump Tokens", tokens: 50, price: 699, priceDisplay: "$6.99" },
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

export async function grantSubscriptionTokens(deviceId: string, stripeCustomerId: string, stripeSubscriptionId: string) {
  const db = getPool();
  const account = await getOrCreateAccount(deviceId);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 31);

  await db.query(
    `UPDATE token_accounts
     SET tokens = tokens + $1,
         subscription_active = true,
         subscription_expires_at = $2,
         subscription_tokens_granted = true,
         last_monthly_reset = NOW(),
         stripe_customer_id = $3,
         stripe_subscription_id = $4,
         updated_at = NOW()
     WHERE device_id = $5`,
    [SUBSCRIPTION_TOKENS, expiresAt, stripeCustomerId, stripeSubscriptionId, deviceId]
  );

  await db.query(
    `INSERT INTO token_transactions (account_id, type, amount, description, created_at)
     VALUES ($1, 'subscription', $2, 'Monthly subscription - 30 Trump Tokens', NOW())`,
    [account.id, SUBSCRIPTION_TOKENS]
  );

  return await getTokenBalance(deviceId);
}

export async function grantTokenPack(deviceId: string, packId: string, stripeSessionId: string) {
  const db = getPool();
  const pack = TOKEN_PACKS.find(p => p.id === packId);
  if (!pack) throw new Error("Invalid token pack");

  const account = await getOrCreateAccount(deviceId);

  await db.query(
    `UPDATE token_accounts SET tokens = tokens + $1, updated_at = NOW() WHERE device_id = $2`,
    [pack.tokens, deviceId]
  );

  await db.query(
    `INSERT INTO token_transactions (account_id, type, amount, description, stripe_session_id, created_at)
     VALUES ($1, 'purchase', $2, $3, $4, NOW())`,
    [account.id, pack.tokens, `Purchased ${pack.name}`, stripeSessionId]
  );

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

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 31);

  await db.query(
    `UPDATE token_accounts
     SET tokens = tokens + $1,
         subscription_expires_at = $2,
         last_monthly_reset = NOW(),
         updated_at = NOW()
     WHERE id = $3`,
    [SUBSCRIPTION_TOKENS, expiresAt, account.id]
  );

  await db.query(
    `INSERT INTO token_transactions (account_id, type, amount, description, created_at)
     VALUES ($1, 'subscription_renewal', $2, 'Monthly renewal - 30 Trump Tokens', NOW())`,
    [account.id, SUBSCRIPTION_TOKENS]
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

export { FREE_PROMPT_LIMIT, SUBSCRIPTION_TOKENS };
