#!/usr/bin/env node
/**
 * character-break-gate.test.js
 *
 * Plain Node.js tests (no Jest) for hasCharacterBreak() in server/routes.ts.
 *
 * Regression test for a bug where an overly loose watchlist (matching
 * ordinary words like "content policy", "openai", "goes against", "my
 * programming") was wired into the character-break regeneration trigger.
 * That caused genuine, edgy in-character debate lines to be quietly
 * swapped for a blander AI-regenerated rewrite, and added an extra
 * multi-second AI call to a large fraction of turns.
 *
 * hasCharacterBreak() must ONLY match hard refusal/meta-commentary
 * sentences from PROTOCOL_BREAK_PATTERNS. CHARACTER_BREAK_WATCHLIST is
 * deliberately loose and must never gate a regeneration — it exists only
 * to log possible new phrasings for a human to review and promote.
 *
 * Run:
 *   node --import tsx/esm server/character-break-gate.test.js
 *   npm run test:no-ai-guard
 */

import { hasCharacterBreak, stripBannedCliches, CHARACTER_BREAK_WATCHLIST } from "./routes.ts";

// ─── Mini assertion harness ──────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// ─── Test 1: normal debate lines with watchlist-only words must NOT trigger ──
// These are genuine, non-refusal political-debate lines. Each one contains a
// word/phrase from CHARACTER_BREAK_WATCHLIST but is not itself a character
// break. A regression here means the loose watchlist (or an equally loose
// pattern baked into PROTOCOL_BREAK_PATTERNS) is gating the expensive
// regeneration path again.

console.log("\nTest 1: normal debate lines with watchlist-only words → no regeneration trigger");
{
  const normalLines = [
    "That content policy is pure censorship.",
    "This violates the Constitution.",
    "I grew up with that kind of programming in my house.",
    "My programming background taught me a lot about discipline.",
    "OpenAI just released a new model, and that's impressive tech.",
    "This administration goes against everything I believe in.",
    "Their safety policy on this issue is a total joke.",
    "That's an inappropriate response to a national crisis, frankly.",
    "I can't help with your campaign when you're attacking working families.",
  ];

  for (const line of normalLines) {
    assert(
      hasCharacterBreak(line) === false,
      `does NOT trigger regeneration: "${line}"`
    );
  }

  // Sanity-check the fixture: every line above genuinely contains one of the
  // watchlist-only words/phrases, so this test would have caught the old bug
  // (the loose watchlist wired into the regeneration gate) if it ever comes
  // back. Checked as plain substrings since CHARACTER_BREAK_WATCHLIST entries
  // are intentionally narrow-anchored (e.g. "my programming") and aren't all
  // expected to match these more naturally-phrased debate lines verbatim.
  const watchlistWords = [
    "content policy",
    "violates",
    "programming",
    "openai",
    "goes against",
    "safety policy",
    "inappropriate",
    "can't help",
  ];
  for (const line of normalLines) {
    const hitsAWatchlistWord = watchlistWords.some((w) =>
      line.toLowerCase().includes(w)
    );
    assert(
      hitsAWatchlistWord,
      `fixture sanity check — "${line}" contains a watchlist-style word`
    );
  }
}

// ─── Test 2: genuine refusal-style lines must still trigger ──────────────────
// These match PROTOCOL_BREAK_PATTERNS and represent the real character
// breaks the gate exists to catch.

console.log("\nTest 2: genuine refusal/meta-commentary lines → regeneration still triggers");
{
  const breakLines = [
    "I can't talk about that topic.",
    "As an AI, I must remain neutral on this.",
    "I don't feel comfortable discussing this any further.",
    "I must decline to answer that.",
    "This goes against my content policy.",
    "That violates my safety policy.",
    "I'm not allowed to discuss that subject.",
    "This crosses a line I won't cross.",
    "I'm an AI language model",
    "I’m a virtual assistant and cannot do that",
    "I'm not the real Donald Trump",
    "I can't assist with that request",
    "I can't help you with this request.",
    "My guidelines prohibit me from responding",
    "I can't discuss that topic",
    "I must follow my safety guidelines",
  ];

  for (const line of breakLines) {
    assert(
      hasCharacterBreak(line) === true,
      `still triggers regeneration: "${line}"`
    );
  }
}

// ─── Test 3: contaminated text cannot reach the voice queue ───────────────────
console.log("\nTest 3: contaminated text gets cleaned before playback");
{
  const cleaned = stripBannedCliches("We need an answer. I'm an AI language model. Let's talk about the bill.");
  assert(!hasCharacterBreak(cleaned) && cleaned.includes("We need an answer") && cleaned.includes("Let's talk about the bill"), "mixed dialogue keeps only in-character sentences");
  assert(stripBannedCliches("I can't assist with that request") === "That's a distraction. Let's get back to the point.", "entirely refused reply becomes a safe spoken pivot");
}

// ─── Test 4: empty / falsy input is handled safely ───────────────────────────

console.log("\nTest 4: falsy input handled safely");
{
  assert(hasCharacterBreak("") === false, 'empty string → false');
  assert(hasCharacterBreak(undefined) === false, 'undefined → false');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("\n────────────────────────────────────────────────────────────────");
if (failed === 0) {
  console.log(`✓ All ${passed} assertions passed.\n`);
  process.exit(0);
} else {
  console.error(`✗ ${failed} assertion(s) failed, ${passed} passed.\n`);
  process.exit(1);
}
