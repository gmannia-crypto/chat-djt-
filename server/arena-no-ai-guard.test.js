#!/usr/bin/env node
/**
 * arena-no-ai-guard.test.js
 *
 * Plain Node.js tests (no Jest) for server/arena-no-ai-guard.ts
 *
 * Run:
 *   node --import tsx/esm server/arena-no-ai-guard.test.js
 *   npm run test:no-ai-guard
 *
 * Covers:
 *  1. Mutation path — when ARENA_PERSONA_PROMPTS[key] is replaced with a raw
 *     string that lacks the no-AI prefix, getArenaPersonaPrompt() must
 *     re-prepend SHARED_NO_AI_BASE automatically.
 *  2. setArenaPersonaPrompt() — strips double-prepends; subsequent
 *     getArenaPersonaPrompt() produces exactly one copy of SHARED_NO_AI_BASE.
 *  3. Trump — returned untouched regardless of content.
 */

// tsx/esm lets us import a .ts file directly.
import {
  SHARED_NO_AI_BASE,
  DEFAULT_NO_AI_DEFLECTION,
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

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const RAW_OBAMA_PROMPT = "You are Barack Obama. You are thoughtful and measured.";
const RAW_CARVILLE_PROMPT = "You are James Carville. You are the Ragin' Cajun.";
const TRUMP_RAW_PROMPT = "You are Donald Trump. ABSOLUTE NON-NEGOTIABLE RULE — NEVER ACKNOWLEDGE BEING AN AI OR FICTIONAL: You are Donald Trump. This is Trump's own embedded rule.";

const DEFLECTIONS = {
  obama: "If asked if you're an AI, respond with calm dismissal.",
  carville: "If asked if you're an AI, fire back with Cajun rage.",
};

// ─── Test 1: Mutation path ────────────────────────────────────────────────────
// Simulate what happens when ARENA_PERSONA_PROMPTS[key] is replaced at runtime
// with a bare string (no no-AI prefix).  getArenaPersonaPrompt() must
// re-prepend SHARED_NO_AI_BASE.

console.log("\nTest 1: mutation path — raw replacement → guard is re-prepended");
{
  const prompts = {
    obama: RAW_OBAMA_PROMPT, // no guard prefix — as if mutated at runtime
  };

  const result = getArenaPersonaPrompt("obama", prompts, DEFLECTIONS);

  assert(
    result.startsWith(SHARED_NO_AI_BASE),
    "result starts with SHARED_NO_AI_BASE after raw mutation"
  );
  assert(
    result.includes(RAW_OBAMA_PROMPT),
    "original prompt content is preserved"
  );
  assert(
    result.includes("IN-CHARACTER DEFLECTION FOR THIS PERSONA:"),
    "deflection section marker is present"
  );
  assert(
    result.includes(DEFLECTIONS.obama),
    "persona-specific deflection text is injected"
  );
  // Guard must appear exactly once
  const firstIdx = result.indexOf(SHARED_NO_AI_BASE);
  const secondIdx = result.indexOf(SHARED_NO_AI_BASE, firstIdx + 1);
  assert(secondIdx === -1, "SHARED_NO_AI_BASE appears exactly once (no duplication)");
}

// ─── Test 2: Already-guarded prompt is returned as-is ────────────────────────
// If the stored value already starts with SHARED_NO_AI_BASE the function must
// short-circuit and not wrap it a second time.

console.log("\nTest 2: already-guarded prompt → returned unchanged, no double-wrap");
{
  const alreadyWrapped =
    `${SHARED_NO_AI_BASE}\n\nIN-CHARACTER DEFLECTION FOR THIS PERSONA: ${DEFLECTIONS.carville}\n\n${RAW_CARVILLE_PROMPT}`;

  const prompts = { carville: alreadyWrapped };
  const result = getArenaPersonaPrompt("carville", prompts, DEFLECTIONS);

  assert(result === alreadyWrapped, "returns the stored value unchanged");
  // Only one occurrence of the guard
  const firstIdx = result.indexOf(SHARED_NO_AI_BASE);
  const secondIdx = result.indexOf(SHARED_NO_AI_BASE, firstIdx + 1);
  assert(secondIdx === -1, "SHARED_NO_AI_BASE still appears exactly once");
}

// ─── Test 3: setArenaPersonaPrompt strips double-prepend ─────────────────────
// If the caller passes a prompt that already carries the guard prefix,
// setArenaPersonaPrompt must strip it before storing, so that the next call
// to getArenaPersonaPrompt produces exactly one copy.

console.log("\nTest 3: setArenaPersonaPrompt strips guard prefix → getArenaPersonaPrompt re-applies once");
{
  const prompts = {};

  // Simulate receiving a full wrapped prompt from getArenaPersonaPrompt
  const alreadyWrapped =
    `${SHARED_NO_AI_BASE}\n\nIN-CHARACTER DEFLECTION FOR THIS PERSONA: ${DEFLECTIONS.obama}\n\n${RAW_OBAMA_PROMPT}`;

  setArenaPersonaPrompt("obama", alreadyWrapped, prompts);

  // The stored value should NOT start with SHARED_NO_AI_BASE (prefix stripped)
  assert(
    !prompts["obama"].startsWith(SHARED_NO_AI_BASE),
    "stored value has the guard prefix stripped after setArenaPersonaPrompt"
  );
  assert(
    prompts["obama"].includes(RAW_OBAMA_PROMPT),
    "stored value still contains the raw prompt content"
  );

  // Now getArenaPersonaPrompt should re-apply the guard exactly once
  const result = getArenaPersonaPrompt("obama", prompts, DEFLECTIONS);

  assert(
    result.startsWith(SHARED_NO_AI_BASE),
    "getArenaPersonaPrompt re-prepends the guard after setArenaPersonaPrompt"
  );
  const firstIdx = result.indexOf(SHARED_NO_AI_BASE);
  const secondIdx = result.indexOf(SHARED_NO_AI_BASE, firstIdx + 1);
  assert(secondIdx === -1, "guard appears exactly once after round-trip through set→get");
}

// ─── Test 4: setArenaPersonaPrompt with raw prompt (no prefix) ───────────────
// When the caller passes a raw prompt without the guard prefix, set stores it
// as-is, and get re-applies the guard on the next read.

console.log("\nTest 4: setArenaPersonaPrompt with raw prompt → get re-applies guard");
{
  const prompts = {};
  setArenaPersonaPrompt("carville", RAW_CARVILLE_PROMPT, prompts);

  assert(
    prompts["carville"] === RAW_CARVILLE_PROMPT,
    "raw prompt stored verbatim when it has no guard prefix"
  );

  const result = getArenaPersonaPrompt("carville", prompts, DEFLECTIONS);
  assert(
    result.startsWith(SHARED_NO_AI_BASE),
    "getArenaPersonaPrompt applies guard to raw-stored prompt"
  );
  assert(
    result.includes(RAW_CARVILLE_PROMPT),
    "raw prompt content is present in final output"
  );
}

// ─── Test 5: Trump is returned untouched ─────────────────────────────────────
// Trump's prompt contains its own no-AI rule; the function must not touch it.

console.log("\nTest 5: Trump prompt is returned untouched");
{
  const prompts = { trump: TRUMP_RAW_PROMPT };
  const result = getArenaPersonaPrompt("trump", prompts, DEFLECTIONS);

  assert(result === TRUMP_RAW_PROMPT, "Trump prompt returned exactly as stored");
  // Confirm SHARED_NO_AI_BASE was NOT prepended (Trump has its own version)
  assert(
    !result.startsWith(SHARED_NO_AI_BASE),
    "SHARED_NO_AI_BASE is NOT prepended to Trump's prompt"
  );
}

// ─── Test 6: setArenaPersonaPrompt does not strip Trump's prompt ──────────────
// Even if Trump's prompt happened to start with something that looks like the
// guard, set must leave it unchanged (the id === "trump" guard).

console.log("\nTest 6: setArenaPersonaPrompt leaves Trump prompt unchanged");
{
  const prompts = {};
  setArenaPersonaPrompt("trump", TRUMP_RAW_PROMPT, prompts);

  assert(
    prompts["trump"] === TRUMP_RAW_PROMPT,
    "Trump prompt stored verbatim by setArenaPersonaPrompt"
  );
}

// ─── Test 7: Unknown persona uses default deflection ─────────────────────────
// When a persona key has no entry in DEFLECTIONS, the DEFAULT_NO_AI_DEFLECTION
// fallback must be used.

console.log("\nTest 7: unknown persona key → falls back to DEFAULT_NO_AI_DEFLECTION");
{
  const prompts = { newpersona: "You are a brand-new debate persona." };
  const result = getArenaPersonaPrompt("newpersona", prompts, DEFLECTIONS);

  assert(
    result.startsWith(SHARED_NO_AI_BASE),
    "guard prepended for unknown persona"
  );
  assert(
    result.includes(DEFAULT_NO_AI_DEFLECTION),
    "DEFAULT_NO_AI_DEFLECTION used when persona has no deflection entry"
  );
}

// ─── Test 8: Missing persona key returns empty string ────────────────────────

console.log("\nTest 8: missing persona key → returns empty string");
{
  const result = getArenaPersonaPrompt("doesnotexist", {}, DEFLECTIONS);
  assert(result === "", "returns empty string for unknown key");
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
