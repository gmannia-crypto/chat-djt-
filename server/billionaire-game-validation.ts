// billionaire-game-validation.ts
//
// Sanity-checks a submitted Billionaires Game result against what the game's own rules can
// actually produce, so a direct API call can't trivially spoof a leaderboard-topping score.
//
// The client (app/game.tsx) only ever calls POST /api/game/submit-result at the exact moment
// a game ends: either the turn that pushes net worth to >= $1B (a "win"), or the turn that
// drops it to exactly $0 (a "loss"). Every bound here is derived from that mechanic plus the
// server-side profit/karma clamps applied in the /api/game/generate-scenario handler — not
// from turn count — because scaling a bound by turn count is exactly what let an earlier
// version of this check accept a claimed trillion-dollar net worth over enough fake turns.
//
// Shared constants also drive the profit/karma clamps in the scenario generator, so the two
// stay in lockstep: if the generator's clamp range changes, this validator's bounds must move
// with it.

export const BILLIONAIRE_MAX_PROFIT_PER_TURN = 250_000_000; // top of tier-5 "ruthless" range
export const BILLIONAIRE_MAX_STREAK_MULTIPLIER = 1.5; // 5+ turn win streak bonus
export const BILLIONAIRE_MAX_EVENT_MULTIPLIER = 1.25; // best random event ("ipo")
export const BILLIONAIRE_MAX_KARMA_PER_CHOICE = 45; // top of the "ruthless"/"ethical" karma range
export const BILLIONAIRE_START_NET_WORTH = 1_000_000;
export const BILLIONAIRE_WIN_THRESHOLD = 1_000_000_000;

// A random event multiplies the ENTIRE post-choice balance, not just that turn's profit, so
// the richest possible winning turn is (pre-win balance + max profit * max streak bonus) * max
// event multiplier. Pre-win balance is capped just under the win threshold (otherwise the game
// would already have ended on an earlier turn), so we use the threshold itself as that ceiling.
// A small headroom multiplier absorbs intermediate Math.round() steps the client applies.
const BILLIONAIRE_WIN_HEADROOM = 1.02;
export const BILLIONAIRE_MAX_WIN_NET_WORTH = Math.ceil(
  (BILLIONAIRE_WIN_THRESHOLD + BILLIONAIRE_MAX_PROFIT_PER_TURN * BILLIONAIRE_MAX_STREAK_MULTIPLIER) *
    BILLIONAIRE_MAX_EVENT_MULTIPLIER *
    BILLIONAIRE_WIN_HEADROOM
);

// The fastest theoretically possible win: always picking the tier-max "ruthless" choice (so the
// win streak — and its multiplier — builds every turn) and getting the best random event on
// every turn where one can trigger, starting from the $1M opening balance. Simulated exhaustively,
// this takes exactly 6 turns; nothing shorter can reach $1B under the game's own tier/profit
// caps, so a submitted win claiming fewer turns cannot be genuine.
export const BILLIONAIRE_MIN_TURNS_FOR_WIN = 6;

// No turn cap is enforced in gameplay (a player can grind through many losing/ethical turns
// before eventually winning), so this is a generous upper bound against garbage data only —
// it is not load-bearing for anti-spoofing, since the net-worth bound above no longer scales
// with turn count.
export const BILLIONAIRE_MAX_TURNS = 500;

// Guards against instant/automated submissions claiming many turns in zero time.
export const BILLIONAIRE_MIN_SECONDS_PER_TURN = 0.5;

export const BILLIONAIRE_KNOWN_MILESTONES = new Set([
  5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 750_000_000,
]);

export interface BillionaireGameStateInput {
  netWorth?: unknown;
  turn?: unknown;
  karma?: unknown;
  bestStreak?: unknown;
  darkDeals?: unknown;
  milestonesHit?: unknown;
}

/** Clamp a scenario choice's karma to the same range the submission validator assumes. */
export function clampBillionaireKarma(karma: number): number {
  return Math.max(-BILLIONAIRE_MAX_KARMA_PER_CHOICE, Math.min(BILLIONAIRE_MAX_KARMA_PER_CHOICE, karma));
}

/** Returns an error message if the submission is invalid/implausible, or null if it passes. */
export function validateBillionaireSubmission(gameState: BillionaireGameStateInput, durationSeconds: unknown): string | null {
  const netWorth = gameState?.netWorth;
  const turns = gameState?.turn;
  const karma = gameState?.karma;
  const bestStreak = gameState?.bestStreak ?? 0;
  const darkDeals = gameState?.darkDeals ?? 0;
  const milestones = Array.isArray(gameState?.milestonesHit) ? (gameState!.milestonesHit as unknown[]) : [];
  const duration = durationSeconds;

  if (!Number.isFinite(netWorth) || !Number.isInteger(netWorth) || (netWorth as number) < 0) return "Invalid net worth";
  if (!Number.isFinite(turns) || !Number.isInteger(turns) || (turns as number) < 1) return "A submitted result must have played at least one turn";
  if ((turns as number) > BILLIONAIRE_MAX_TURNS) return "Turn count out of range";
  if (!Number.isFinite(karma) || !Number.isInteger(karma)) return "Invalid karma";
  if (Math.abs(karma as number) > BILLIONAIRE_MAX_KARMA_PER_CHOICE * (turns as number)) return "Karma out of range for turn count";
  if (!Number.isFinite(bestStreak) || !Number.isInteger(bestStreak) || (bestStreak as number) < 0 || (bestStreak as number) > (turns as number)) return "Invalid streak";
  if (!Number.isFinite(darkDeals) || !Number.isInteger(darkDeals) || (darkDeals as number) < 0 || (darkDeals as number) > (turns as number)) return "Invalid dark deal count";
  if (milestones.length > BILLIONAIRE_KNOWN_MILESTONES.size) return "Invalid milestone count";
  if (new Set(milestones).size !== milestones.length) return "Duplicate milestone entries";
  if (!milestones.every((m) => Number.isInteger(m) && BILLIONAIRE_KNOWN_MILESTONES.has(m as number))) return "Unrecognized milestone value";
  if (!Number.isFinite(duration) || !Number.isInteger(duration) || (duration as number) < 0) return "Invalid duration";
  if ((duration as number) < (turns as number) * BILLIONAIRE_MIN_SECONDS_PER_TURN) return "Duration too short for turn count";

  // Terminal state: a game only submits on a win (net worth crosses $1B) or a loss (net worth
  // hits exactly $0) — anything else is not a state the client is allowed to submit.
  const isWin = (netWorth as number) >= BILLIONAIRE_WIN_THRESHOLD;
  if (isWin) {
    if ((netWorth as number) > BILLIONAIRE_MAX_WIN_NET_WORTH) return "Net worth exceeds what a single winning turn can produce";
    if ((turns as number) < BILLIONAIRE_MIN_TURNS_FOR_WIN) return "Too few turns to reach $1B";
  } else if ((netWorth as number) !== 0) {
    return "Net worth must be $0 (loss) or at least $1B (win)";
  }

  return null;
}
