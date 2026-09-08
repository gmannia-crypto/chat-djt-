/**
 * mystery-box.ts
 *
 * Server-authoritative Daily Mystery Box.
 *
 * The daily lock, reward pick, and unlock write used to live entirely in
 * client AsyncStorage (app/index.tsx), which meant clearing app storage or
 * switching devices let a user replay the reward indefinitely, and premium
 * persona unlocks earned through the box could be lost on reinstall.
 *
 * This module makes eligibility, reward selection, and unlock persistence
 * server-side under a verified account identity.
 */

import { Pool } from "pg";

const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Mirrors ARENA_MYSTERY_PERSONA_IDS in lib/persona-unlocks.tsx — kept in sync
// manually since the client bundle can't be imported from the server.
export const ARENA_MYSTERY_PERSONA_IDS = [
  "alexjones",
  "obama",
  "melania",
  "schumer",
  "odonnell",
  "kamala",
  "mtg",
  "rfk",
] as const;

// Mirrors CARD_CATALOG in lib/collectibles.ts (id + rarity only — the server
// never needs card art/copy, just enough to pick a fair, weighted reward and
// record ownership so it survives a reinstall or device switch).
type CardRarity = "Common" | "Rare" | "Epic" | "Legendary";
const CARD_CATALOG_IDS: { id: string; rarity: CardRarity }[] = [
  { id: "sports-mvp", rarity: "Common" },
  { id: "sports-buzzer", rarity: "Rare" },
  { id: "sports-knockout", rarity: "Epic" },
  { id: "sports-dynasty", rarity: "Legendary" },
  { id: "finance-bull", rarity: "Common" },
  { id: "finance-diamond", rarity: "Rare" },
  { id: "finance-whale", rarity: "Epic" },
  { id: "finance-mogul", rarity: "Legendary" },
  { id: "debate-mic", rarity: "Common" },
  { id: "debate-knockout", rarity: "Rare" },
  { id: "debate-supreme", rarity: "Epic" },
  { id: "debate-undefeated", rarity: "Legendary" },
  { id: "fortune-star", rarity: "Common" },
  { id: "fortune-crystal", rarity: "Rare" },
  { id: "fortune-oracle", rarity: "Epic" },
  { id: "fortune-destiny", rarity: "Legendary" },
  { id: "therapy-breakthrough", rarity: "Common" },
  { id: "therapy-healed", rarity: "Rare" },
  { id: "therapy-enlightened", rarity: "Epic" },
  { id: "therapy-phoenix", rarity: "Legendary" },
  { id: "special-firstday", rarity: "Common" },
  { id: "special-collector", rarity: "Rare" },
  { id: "special-vip", rarity: "Epic" },
  { id: "special-genesis", rarity: "Legendary" },
  { id: "debate-alexjones", rarity: "Epic" },
  { id: "debate-obama", rarity: "Legendary" },
  { id: "debate-melania", rarity: "Epic" },
  { id: "debate-schumer", rarity: "Rare" },
];
const CARD_DROP_RATES: { rarity: CardRarity; weight: number }[] = [
  { rarity: "Common", weight: 50 },
  { rarity: "Rare", weight: 30 },
  { rarity: "Epic", weight: 15 },
  { rarity: "Legendary", weight: 5 },
];

function pickRandomCardId(): string {
  const total = CARD_DROP_RATES.reduce((sum, d) => sum + d.weight, 0);
  let roll = Math.random() * total;
  let selectedRarity: CardRarity = "Common";
  for (const dr of CARD_DROP_RATES) {
    roll -= dr.weight;
    if (roll <= 0) {
      selectedRarity = dr.rarity;
      break;
    }
  }
  const pool = CARD_CATALOG_IDS.filter((c) => c.rarity === selectedRarity);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

const MYSTERY_REWARDS = [
  { label: "Free Roast", icon: "flame", description: "Trump will personally roast you — for FREE. No D.C. tokens needed." },
  { label: "Double Fortune", icon: "crystal-ball", description: "Your next Fortune Parlor reading is DOUBLED. Twice the prophecy!" },
  { label: "Dynamic Stock Tip", icon: "trending-up", description: "An exclusive AI-generated stock hot take from the Don himself." },
  { label: "Property Discount", icon: "home", description: "VIP access to Dynamic Realty's top pick of the day. TREMENDOUS." },
  { label: "Cabinet Roast", icon: "people", description: "Unlock a bonus Cabinet Hot Seat roast. Savage and FREE." },
  { label: "Golden Tweet", icon: "logo-twitter", description: "Generate a viral Trump tweet on ANY topic. Pure gold." },
  { label: "Therapy Session", icon: "medical", description: "A free therapy session with Trump Therapy. Healing through WINNING." },
  { label: "VIP Fortune", icon: "star", description: "A rare PREMIUM fortune reading. Only winners get this." },
  { label: "Collectible Card", icon: "cards", description: "A DJT Collectible card has been added to your collection!" },
  { label: "Collectible Card", icon: "cards", description: "A DJT Collectible card has been added to your collection!" },
  { label: "Arena Persona Unlock", icon: "person-add", description: "A mystery arena debater has been unlocked! Check The Arena." },
] as const;

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return pool;
}

let _tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (_tableEnsured) return;
  const db = getPool();
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS mystery_box_state (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        account_key TEXT UNIQUE NOT NULL,
        last_claimed_at TIMESTAMP,
        unlocked_personas JSONB NOT NULL DEFAULT '[]'::jsonb,
        owned_cards JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.query(`ALTER TABLE mystery_box_state ADD COLUMN IF NOT EXISTS owned_cards JSONB NOT NULL DEFAULT '[]'::jsonb`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS mystery_box_device_map (
        device_id TEXT PRIMARY KEY,
        account_key TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS mystery_box_claims (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        account_key TEXT NOT NULL,
        device_id TEXT,
        reward_label TEXT NOT NULL,
        reward_detail JSONB,
        claimed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    _tableEnsured = true;
  } catch {
    // non-fatal: table already exists (race with another instance)
  }
}

interface MysteryBoxRow {
  id: string;
  account_key: string;
  last_claimed_at: string | null;
  unlocked_personas: string[];
  owned_cards: string[];
}

async function resolveAccountKey(deviceId: string, authenticatedAccountId: string): Promise<string> {
  const db = getPool();
  const accountKey = `account:${authenticatedAccountId}`;
  await db.query(
    `INSERT INTO mystery_box_device_map (device_id, account_key, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (device_id) DO UPDATE SET account_key = EXCLUDED.account_key, updated_at = NOW()`,
    [deviceId, accountKey],
  );
  return accountKey;
}

async function getOrCreateState(accountKey: string): Promise<MysteryBoxRow> {
  const db = getPool();
  const existing = await db.query(
    `SELECT * FROM mystery_box_state WHERE account_key = $1`,
    [accountKey],
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const inserted = await db.query(
    `INSERT INTO mystery_box_state (account_key, last_claimed_at, unlocked_personas, owned_cards, created_at, updated_at)
     VALUES ($1, NULL, '[]'::jsonb, '[]'::jsonb, NOW(), NOW())
     ON CONFLICT (account_key) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [accountKey],
  );
  return inserted.rows[0];
}

function computeStatus(row: MysteryBoxRow) {
  if (!row.last_claimed_at) {
    return { ready: true, secondsRemaining: 0 };
  }
  const elapsedMs = Date.now() - new Date(row.last_claimed_at).getTime();
  const remainingMs = CLAIM_COOLDOWN_MS - elapsedMs;
  if (remainingMs <= 0) return { ready: true, secondsRemaining: 0 };
  return { ready: false, secondsRemaining: Math.ceil(remainingMs / 1000) };
}

export async function getMysteryBoxStatus(deviceId: string, authenticatedAccountId: string) {
  await ensureTable();
  const accountKey = await resolveAccountKey(deviceId, authenticatedAccountId);
  const row = await getOrCreateState(accountKey);
  const status = computeStatus(row);
  return {
    ...status,
    unlockedPersonaIds: row.unlocked_personas || [],
    ownedCardIds: row.owned_cards || [],
  };
}

/**
 * Atomically claims the daily mystery box for a device. Rejects with
 * { ok: false, reason: "cooldown", secondsRemaining } if the account has
 * already claimed within the last 24 hours — this is the tamper-proof gate;
 * clearing app storage or reinstalling on the same or a linked device can no
 * longer replay the reward because eligibility lives in Postgres, not
 * AsyncStorage.
 */
export async function claimMysteryBox(deviceId: string, authenticatedAccountId: string) {
  await ensureTable();
  const accountKey = await resolveAccountKey(deviceId, authenticatedAccountId);
  const db = getPool();

  // Ensure the row exists *before* opening the claim transaction. Doing the
  // insert-if-missing inside the transaction races two concurrent first-ever
  // claims for the same account into a duplicate-key error, since
  // `SELECT ... FOR UPDATE` on a not-yet-existing row locks nothing. This
  // upsert is idempotent and safe to run outside the transaction.
  await db.query(
    `INSERT INTO mystery_box_state (account_key, last_claimed_at, unlocked_personas, owned_cards, created_at, updated_at)
     VALUES ($1, NULL, '[]'::jsonb, '[]'::jsonb, NOW(), NOW())
     ON CONFLICT (account_key) DO NOTHING`,
    [accountKey],
  );

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Lock the row for the duration of the transaction so two concurrent
    // claims (e.g. double-tap racing two requests, or two devices on the
    // same linked account claiming simultaneously) can't both succeed.
    const result = await client.query(
      `SELECT * FROM mystery_box_state WHERE account_key = $1 FOR UPDATE`,
      [accountKey],
    );
    const row: MysteryBoxRow = result.rows[0];
    const status = computeStatus(row);
    if (!status.ready) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "cooldown" as const, secondsRemaining: status.secondsRemaining };
    }

    const prize = MYSTERY_REWARDS[Math.floor(Math.random() * MYSTERY_REWARDS.length)];
    let rewardDetail: { personaId?: string; allPersonasUnlocked?: boolean; cardId?: string; duplicateCardId?: string } = {};
    let unlockedPersonas: string[] = Array.isArray(row.unlocked_personas) ? row.unlocked_personas : [];
    let ownedCards: string[] = Array.isArray(row.owned_cards) ? row.owned_cards : [];

    if (prize.label === "Arena Persona Unlock") {
      const locked = ARENA_MYSTERY_PERSONA_IDS.filter((id) => !unlockedPersonas.includes(id));
      if (locked.length > 0) {
        const personaId = locked[Math.floor(Math.random() * locked.length)];
        unlockedPersonas = [...unlockedPersonas, personaId];
        rewardDetail = { personaId };
      } else {
        // Every mystery persona already unlocked — fall back to a bonus card.
        const cardId = pickRandomCardId();
        if (ownedCards.includes(cardId)) {
          rewardDetail = { allPersonasUnlocked: true, duplicateCardId: cardId };
        } else {
          ownedCards = [...ownedCards, cardId];
          rewardDetail = { allPersonasUnlocked: true, cardId };
        }
      }
    } else if (prize.label === "Collectible Card") {
      const cardId = pickRandomCardId();
      if (ownedCards.includes(cardId)) {
        rewardDetail = { duplicateCardId: cardId };
      } else {
        ownedCards = [...ownedCards, cardId];
        rewardDetail = { cardId };
      }
    }

    const now = new Date();
    await client.query(
      `UPDATE mystery_box_state
       SET last_claimed_at = $2, unlocked_personas = $3::jsonb, owned_cards = $4::jsonb, updated_at = NOW()
       WHERE account_key = $1`,
      [accountKey, now, JSON.stringify(unlockedPersonas), JSON.stringify(ownedCards)],
    );
    await client.query(
      `INSERT INTO mystery_box_claims (account_key, device_id, reward_label, reward_detail, claimed_at)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [accountKey, deviceId, prize.label, JSON.stringify(rewardDetail), now],
    );

    await client.query("COMMIT");

    return {
      ok: true as const,
      reward: { label: prize.label, icon: prize.icon, description: prize.description, detail: rewardDetail },
      unlockedPersonaIds: unlockedPersonas,
      ownedCardIds: ownedCards,
      secondsUntilNextClaim: Math.floor(CLAIM_COOLDOWN_MS / 1000),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
