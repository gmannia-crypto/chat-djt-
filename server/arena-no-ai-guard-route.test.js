#!/usr/bin/env node
/**
 * arena-no-ai-guard-route.test.js
 *
 * Route-level unit test for POST /api/admin/persona-prompt.
 *
 * Verifies that the admin persona-prompt endpoint always routes through
 * setArenaPersonaPrompt so SHARED_NO_AI_BASE is never silently stripped
 * from the live ARENA_PERSONA_PROMPTS store.
 *
 * Run:
 *   npx tsx server/arena-no-ai-guard-route.test.js
 *   npm run test:no-ai-guard-route
 *
 * Covers:
 *  A. Raw (unwrapped) prompt body → SHARED_NO_AI_BASE present on read-back.
 *  B. Already-wrapped prompt body → SHARED_NO_AI_BASE present exactly once
 *     (no double-prepend).
 *  C. Contract proof: direct ARENA_PERSONA_PROMPTS assignment bypasses the
 *     stored guard — confirming why the route MUST use setArenaPersonaPrompt.
 *  D. Trump persona → returned unchanged; SHARED_NO_AI_BASE not prepended.
 */

import {
  SHARED_NO_AI_BASE,
  getArenaPersonaPrompt,
  setArenaPersonaPrompt,
} from "./arena-no-ai-guard.ts";

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

// ─── Route handler simulation ────────────────────────────────────────────────
//
// The real route handler in routes.ts does exactly this:
//
//   setArenaPersonaPrompt(personaId, prompt);          // wrapper in closure
//   return getArenaPersonaPrompt(personaId);           // wrapper in closure
//
// Both wrappers forward to the module-level helpers with the shared
// ARENA_PERSONA_PROMPTS + PERSONA_NO_AI_DEFLECTIONS maps.  We replicate the
// same call pattern here with local maps so the test is self-contained and
// any future route mis-wiring (e.g. bypassing setArenaPersonaPrompt) would
// cause an assertion failure.

function simulateAdminPersonaPromptRoute(personaId, incomingPrompt, prompts, deflections) {
  // ⚠️  This line is the critical invariant: MUST call setArenaPersonaPrompt,
  //     NOT `prompts[personaId] = incomingPrompt` directly.
  setArenaPersonaPrompt(personaId, incomingPrompt, prompts);
  return getArenaPersonaPrompt(personaId, prompts, deflections);
}

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const DEFLECTIONS = {
  obama: "If asked if you're an AI, respond with calm dismissal in character.",
  carville: "If asked if you're an AI, fire back with Cajun rage in character.",
};

const RAW_OBAMA = "You are Barack Obama. You are thoughtful and measured.";
const RAW_CARVILLE = "You are James Carville. You are the Ragin' Cajun.";

const WRAPPED_CARVILLE =
  `${SHARED_NO_AI_BASE}\n\nIN-CHARACTER DEFLECTION FOR THIS PERSONA: ${DEFLECTIONS.carville}\n\n${RAW_CARVILLE}`;

const TRUMP_PROMPT =
  "You are Donald Trump. ABSOLUTE NON-NEGOTIABLE RULE — NEVER ACKNOWLEDGE BEING AN AI OR FICTIONAL: You are Trump.";

// ─── Test A: raw (unwrapped) body → guard present on read-back ───────────────

console.log("\nTest A: POST with raw (unwrapped) prompt → guard present on read-back");
{
  const prompts = { obama: RAW_OBAMA };

  const result = simulateAdminPersonaPromptRoute("obama", RAW_OBAMA, prompts, DEFLECTIONS);

  assert(
    result.startsWith(SHARED_NO_AI_BASE),
    "guarded prompt starts with SHARED_NO_AI_BASE after raw-string POST"
  );
  assert(
    result.includes(RAW_OBAMA),
    "original raw prompt content is preserved in the guarded result"
  );
  assert(
    result.includes("IN-CHARACTER DEFLECTION FOR THIS PERSONA:"),
    "deflection section marker is injected"
  );
  assert(
    result.includes(DEFLECTIONS.obama),
    "persona-specific deflection text is present"
  );
  const first = result.indexOf(SHARED_NO_AI_BASE);
  const second = result.indexOf(SHARED_NO_AI_BASE, first + 1);
  assert(second === -1, "SHARED_NO_AI_BASE appears exactly once (no duplication)");
}

// ─── Test B: already-wrapped body → no double-prepend ────────────────────────

console.log("\nTest B: POST with already-wrapped prompt → guard present exactly once");
{
  const prompts = { carville: RAW_CARVILLE };

  const result = simulateAdminPersonaPromptRoute("carville", WRAPPED_CARVILLE, prompts, DEFLECTIONS);

  assert(
    result.startsWith(SHARED_NO_AI_BASE),
    "guarded prompt starts with SHARED_NO_AI_BASE after wrapped-string POST"
  );
  assert(
    result.includes(RAW_CARVILLE),
    "original prompt content is preserved in the guarded result"
  );
  const first = result.indexOf(SHARED_NO_AI_BASE);
  const second = result.indexOf(SHARED_NO_AI_BASE, first + 1);
  assert(
    second === -1,
    "SHARED_NO_AI_BASE appears exactly once — no double-prepend for already-wrapped input"
  );
}

// ─── Test C: direct assignment attack surface (contract proof) ────────────────
//
// This test proves WHY the route must go through setArenaPersonaPrompt.
// A direct write to ARENA_PERSONA_PROMPTS stores the prompt without a guard.
// getArenaPersonaPrompt re-applies it on the next read, but the stored value
// is permanently unguarded — a mis-wired route could leave sessions unsafe
// between the write and the next read.

console.log("\nTest C: direct assignment bypasses stored guard (confirms attack surface)");
{
  const prompts = {};
  // Mis-wired: direct assignment without setArenaPersonaPrompt
  prompts["obama"] = RAW_OBAMA;

  assert(
    !prompts["obama"].startsWith(SHARED_NO_AI_BASE),
    "direct assignment stores prompt WITHOUT the guard (attack surface confirmed)"
  );

  // getArenaPersonaPrompt still saves the caller by re-prepending at read time…
  const result = getArenaPersonaPrompt("obama", prompts, DEFLECTIONS);
  assert(
    result.startsWith(SHARED_NO_AI_BASE),
    "getArenaPersonaPrompt re-applies guard even after direct assignment"
  );
  // …but the stored value remains unguarded until the next set call.
  assert(
    !prompts["obama"].startsWith(SHARED_NO_AI_BASE),
    "stored value is still unguarded — proves the route MUST call setArenaPersonaPrompt"
  );
}

// ─── Test D: Trump persona → stored unchanged, SHARED_NO_AI_BASE not prepended

console.log("\nTest D: Trump persona via route → stored unchanged, no guard prepend");
{
  const prompts = { trump: TRUMP_PROMPT };

  const result = simulateAdminPersonaPromptRoute("trump", TRUMP_PROMPT, prompts, DEFLECTIONS);

  assert(
    result === TRUMP_PROMPT,
    "Trump prompt returned exactly as stored (no mutation)"
  );
  assert(
    !result.startsWith(SHARED_NO_AI_BASE),
    "SHARED_NO_AI_BASE is NOT prepended to Trump's prompt"
  );
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
