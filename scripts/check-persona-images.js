#!/usr/bin/env node
/**
 * check-persona-images.js
 *
 * Two layers of protection for persona portrait files:
 *
 *  Layer 1 — Duplicate hash check (original)
 *    Catches two files that are byte-for-byte identical, meaning a portrait
 *    was accidentally copied to a second slot.
 *
 *  Layer 2 — Manifest mismatch check (new)
 *    Catches a correctly-unique image saved under the wrong persona name
 *    (e.g. Pressley's portrait saved as persona-aoc.png).  Works by comparing
 *    each file's SHA-256 hash against a known-good manifest stored in
 *    scripts/persona-image-manifest.json.  Two failure modes are reported:
 *
 *      a) Wrong-name swap — the file's hash matches a *different* persona's
 *         manifest entry, which is the classic misnamed-file bug.
 *
 *      b) Unexpected change — the file's hash matches nothing in the manifest,
 *         meaning it was replaced without updating the manifest.  Run
 *         --update to bless the new portrait and silence this warning.
 *
 * Usage:
 *   node scripts/check-persona-images.js                        # check all portrait files
 *   node scripts/check-persona-images.js f1.png f2.png ...      # check only the listed files
 *   node scripts/check-persona-images.js --update               # regenerate manifest from current files
 *
 * When file paths are supplied as positional arguments the script only checks
 * those files (e.g. the ones staged by the pre-commit hook) instead of
 * scanning the full assets/images/ folder.
 *
 * Exit codes:
 *   0  — all checks passed (or manifest successfully updated)
 *   1  — one or more problems detected
 *   2  — no persona images found (likely a path problem)
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");

const IMAGES_GLOB = "assets/images/persona-*.png";
const MANIFEST_PATH = path.join("scripts", "persona-image-manifest.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

function personaNameFromPath(filePath) {
  return path.basename(filePath, ".png").replace(/^persona-/, "");
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    console.error(`ERROR: Could not parse ${MANIFEST_PATH}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// --update mode: regenerate manifest from current images
// ---------------------------------------------------------------------------

function updateManifest(files) {
  const manifest = {};
  for (const file of files) {
    const name = personaNameFromPath(file);
    manifest[name] = hashFile(file);
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `✓ Manifest updated with ${files.length} persona(s) → ${MANIFEST_PATH}`
  );
  console.log(
    "  Commit this file so future checks have a baseline to compare against."
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Layer 1: duplicate hash check
// ---------------------------------------------------------------------------

function checkDuplicates(files, hashes) {
  const hashMap = {};
  const duplicates = [];

  for (const file of files) {
    const hash = hashes[file];
    if (hashMap[hash]) {
      duplicates.push({ hash, files: [hashMap[hash], file] });
    } else {
      hashMap[hash] = file;
    }
  }

  if (duplicates.length === 0) {
    console.log("  ✓ No duplicate images found.");
    return true;
  }

  console.error(
    `  ✗ DUPLICATE IMAGES (${duplicates.length} collision(s)) — same file saved under two names:\n`
  );
  for (const dup of duplicates) {
    console.error(`    Hash: ${dup.hash.slice(0, 16)}...`);
    for (const f of dup.files) {
      console.error(`      ${f}`);
    }
    console.error("");
  }
  console.error(
    "  Fix: replace the duplicate file(s) with the correct portrait."
  );
  return false;
}

// ---------------------------------------------------------------------------
// Layer 2: manifest mismatch check
// ---------------------------------------------------------------------------

function checkManifest(files, hashes, manifest, { partial = false } = {}) {
  // Build reverse map: hash → persona name (from manifest)
  const hashToManifestName = {};
  for (const [name, hash] of Object.entries(manifest)) {
    hashToManifestName[hash] = name;
  }

  const wrongName = [];
  const unexpectedChange = [];
  const newPersonas = [];

  for (const file of files) {
    const name = personaNameFromPath(file);
    const hash = hashes[file];
    const expectedHash = manifest[name];

    if (!expectedHash) {
      // Persona exists on disk but not in manifest — new addition
      newPersonas.push({ name, file, hash });
      continue;
    }

    if (hash === expectedHash) {
      // Perfect match — nothing to report
      continue;
    }

    // Hash doesn't match this persona's manifest entry.
    // Check if the hash matches a *different* persona in the manifest.
    const actualOwner = hashToManifestName[hash];
    if (actualOwner && actualOwner !== name) {
      wrongName.push({ file, name, actualOwner, hash });
    } else {
      // Genuinely new/changed image — not in manifest at all
      unexpectedChange.push({ file, name, expectedHash, hash });
    }
  }

  // Check for personas that are in the manifest but missing from disk.
  // Skip this when doing a partial (staged-files-only) scan — unstaged files
  // are not "missing", they just weren't part of this commit.
  const diskNames = new Set(files.map(personaNameFromPath));
  const missingFromDisk = partial
    ? []
    : Object.keys(manifest).filter((n) => !diskNames.has(n));

  let passed = true;

  if (wrongName.length > 0) {
    passed = false;
    console.error(
      `  ✗ MISMATCHED NAMES (${wrongName.length} file(s)) — portrait belongs to a different persona:\n`
    );
    for (const w of wrongName) {
      console.error(`    File:      ${w.file}`);
      console.error(`    Saved as:  ${w.name}`);
      console.error(`    Looks like: ${w.actualOwner}  (hash matches ${w.actualOwner}'s manifest entry)`);
      console.error(
        `    Hash:      ${w.hash.slice(0, 16)}...`
      );
      console.error("");
    }
    console.error(
      "  Fix: rename the file to the correct persona or supply the right portrait.\n"
    );
  }

  if (unexpectedChange.length > 0) {
    passed = false;
    console.error(
      `  ✗ UNEXPECTED CHANGES (${unexpectedChange.length} file(s)) — hash no longer matches manifest:\n`
    );
    for (const u of unexpectedChange) {
      console.error(`    File:     ${u.file}`);
      console.error(
        `    Expected: ${u.expectedHash.slice(0, 16)}...`
      );
      console.error(
        `    Got:      ${u.hash.slice(0, 16)}...`
      );
      console.error("");
    }
    console.error(
      "  If this replacement was intentional, run:  node scripts/check-persona-images.js --update\n"
    );
  }

  if (missingFromDisk.length > 0) {
    passed = false;
    console.error(
      `  ✗ MISSING FILES (${missingFromDisk.length}) — in manifest but not found on disk:\n`
    );
    for (const m of missingFromDisk) {
      console.error(`    assets/images/persona-${m}.png`);
    }
    console.error("");
  }

  if (newPersonas.length > 0) {
    console.log(
      `  ⚠ NEW PERSONAS (${newPersonas.length}) — not yet in manifest (run --update to register):`
    );
    for (const n of newPersonas) {
      console.log(`    ${n.file}`);
    }
    console.log("");
  }

  if (passed && newPersonas.length === 0) {
    console.log("  ✓ All files match the manifest. No mismatches detected.");
  }

  return passed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const isUpdate = args.includes("--update");

  // Positional args (non-flag) are treated as an explicit file list supplied
  // by the pre-commit hook (only staged portrait files).
  const explicitFiles = args.filter(
    (a) => !a.startsWith("--") && a.endsWith(".png")
  );

  // When --update is requested always scan the full folder so the manifest
  // covers every portrait on disk, not just staged ones.
  const files = isUpdate || explicitFiles.length === 0
    ? globSync(IMAGES_GLOB).sort()
    : explicitFiles.filter((f) => fs.existsSync(f)).sort();

  if (files.length === 0 && explicitFiles.length === 0) {
    console.error(`ERROR: No files matched "${IMAGES_GLOB}"`);
    console.error("  Check that the script is run from the project root.");
    process.exit(2);
  }

  // Explicit list supplied but none of the paths exist on disk (e.g. deletions)
  if (files.length === 0) {
    console.log("⚡ None of the supplied portrait file(s) exist on disk — nothing to check.");
    process.exit(0);
  }

  if (isUpdate) {
    console.log(`Scanning ${files.length} persona image(s)...\n`);
    updateManifest(files);
    return;
  }

  const scope = explicitFiles.length > 0
    ? `${files.length} staged portrait(s)`
    : `${files.length} persona image(s)`;
  console.log(`Checking ${scope}...\n`);

  // Pre-compute all hashes once (used by both checks)
  const hashes = {};
  for (const file of files) {
    hashes[file] = hashFile(file);
  }

  // Layer 1
  console.log("── Layer 1: Duplicate hash check ──────────────────────────────");
  const layer1Pass = checkDuplicates(files, hashes);

  // Layer 2
  console.log("\n── Layer 2: Manifest mismatch check ───────────────────────────");
  const manifest = loadManifest();
  let layer2Pass = true;
  if (!manifest) {
    console.error(
      "  ✗ Manifest file missing (scripts/persona-image-manifest.json).\n" +
      "    Regenerate it with:  node scripts/check-persona-images.js --update\n" +
      "    Then stage the updated manifest:  git add scripts/persona-image-manifest.json"
    );
    layer2Pass = false;
  } else {
    layer2Pass = checkManifest(files, hashes, manifest, { partial: explicitFiles.length > 0 });
  }

  console.log("\n───────────────────────────────────────────────────────────────");
  if (layer1Pass && layer2Pass) {
    console.log("✓ All checks passed.\n");
    process.exit(0);
  } else {
    console.error("✗ One or more checks failed. See details above.\n");
    process.exit(1);
  }
}

main();
