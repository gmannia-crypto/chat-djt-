#!/usr/bin/env node
/**
 * check-no-ai-deflections.js
 *
 * Verify that every key in ARENA_PERSONA_PROMPTS (excluding "trump") has a
 * corresponding tailored entry in PERSONA_NO_AI_DEFLECTIONS inside
 * server/routes.ts.
 *
 * A missing entry means that persona will fall back to the generic
 * DEFAULT_NO_AI_DEFLECTION instead of a character-authentic response —
 * this check catches that gap before it ships.
 *
 * Usage:
 *   node scripts/check-no-ai-deflections.js
 *   npm run test:no-ai-deflections
 *
 * Exit codes:
 *   0  every non-trump persona has a tailored PERSONA_NO_AI_DEFLECTIONS entry
 *   1  one or more entries are missing (or the file could not be parsed)
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROUTES_FILE = path.resolve(__dirname, "../server/routes.ts");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the top-level keys from a TypeScript object literal that starts at
 * `startLine` (1-based) in `lines`.
 *
 * Strategy: a "key line" inside an object literal looks like:
 *   <whitespace><identifier>: `...
 *   <whitespace><identifier>: "...
 *   <whitespace><identifier>: '...
 * at the *same or deeper* indentation as the opening brace.
 *
 * We stop as soon as we see a line that closes the outer object at the
 * same indentation level as the "const …= {" line (i.e. `};` after
 * potentially some whitespace).
 *
 * Template literals can span many lines and contain colons, so we do NOT
 * try to parse the values — we only look for the key-start pattern.
 */
function extractObjectKeys(lines, startLine) {
  // startLine is the 0-based index of the "const X: ... = {" line.
  const declarationIndent = lines[startLine].match(/^(\s*)/)[1].length;
  const keyPattern = /^\s+([a-zA-Z][a-zA-Z0-9_]*):\s*[`"']/;
  const closingPattern = new RegExp(`^\\s{0,${declarationIndent + 1}}\\};?\\s*$`);

  const keys = [];

  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];

    // Detect the closing brace of the outer object.
    // The outer object's `};` sits at declarationIndent spaces (same as the
    // `const` keyword).  We stop before collecting any more keys.
    if (closingPattern.test(line) && line.trim().startsWith("}")) {
      break;
    }

    const m = keyPattern.exec(line);
    if (m) {
      keys.push(m[1]);
    }
  }

  return keys;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let src;
try {
  src = fs.readFileSync(ROUTES_FILE, "utf8");
} catch (err) {
  console.error(`[no-ai-deflections] ERROR: Cannot read ${ROUTES_FILE}`);
  console.error(err.message);
  process.exit(1);
}

const lines = src.split("\n");

// Locate the two object declarations.
let promptsStartLine = -1;
let deflectionsStartLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (promptsStartLine === -1 && /const ARENA_PERSONA_PROMPTS\s*[:=]/.test(lines[i])) {
    promptsStartLine = i;
  }
  if (deflectionsStartLine === -1 && /const PERSONA_NO_AI_DEFLECTIONS\s*[:=]/.test(lines[i])) {
    deflectionsStartLine = i;
  }
  if (promptsStartLine !== -1 && deflectionsStartLine !== -1) break;
}

if (promptsStartLine === -1) {
  console.error("[no-ai-deflections] ERROR: Could not find ARENA_PERSONA_PROMPTS in " + ROUTES_FILE);
  process.exit(1);
}
if (deflectionsStartLine === -1) {
  console.error("[no-ai-deflections] ERROR: Could not find PERSONA_NO_AI_DEFLECTIONS in " + ROUTES_FILE);
  process.exit(1);
}

const promptKeys = extractObjectKeys(lines, promptsStartLine);
const deflectionKeys = new Set(extractObjectKeys(lines, deflectionsStartLine));

if (promptKeys.length === 0) {
  console.error("[no-ai-deflections] ERROR: Extracted 0 keys from ARENA_PERSONA_PROMPTS — regex may need updating.");
  process.exit(1);
}
if (deflectionKeys.size === 0) {
  console.error("[no-ai-deflections] ERROR: Extracted 0 keys from PERSONA_NO_AI_DEFLECTIONS — regex may need updating.");
  process.exit(1);
}

// "trump" is deliberately excluded — it embeds its own no-AI rule.
const nonTrumpPersonas = promptKeys.filter((k) => k !== "trump");
const missing = nonTrumpPersonas.filter((k) => !deflectionKeys.has(k));

console.log(`[no-ai-deflections] ARENA_PERSONA_PROMPTS: ${promptKeys.length} personas (${promptKeys.length - 1} non-trump)`);
console.log(`[no-ai-deflections] PERSONA_NO_AI_DEFLECTIONS: ${deflectionKeys.size} entries`);
console.log();

if (missing.length === 0) {
  console.log(`✓ All ${nonTrumpPersonas.length} non-trump persona(s) have a tailored PERSONA_NO_AI_DEFLECTIONS entry.\n`);
  process.exit(0);
} else {
  console.error(`✗ ${missing.length} persona(s) are missing a tailored PERSONA_NO_AI_DEFLECTIONS entry:\n`);
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  console.error(
    "\nAdd a tailored entry for each missing persona to PERSONA_NO_AI_DEFLECTIONS in server/routes.ts.\n" +
    "The entry should be an in-character deflection that sounds authentic for that persona.\n" +
    "See existing entries for examples.\n"
  );
  process.exit(1);
}
