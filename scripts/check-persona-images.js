#!/usr/bin/env node
/**
 * check-persona-images.js
 *
 * Hashes every assets/images/persona-*.png file and exits non-zero
 * if any two files share the same SHA-256 hash, indicating a duplicate
 * portrait was accidentally shipped.
 *
 * Usage:
 *   node scripts/check-persona-images.js
 *
 * Exit codes:
 *   0  — all persona images are unique
 *   1  — one or more duplicate pairs detected (details printed to stdout)
 *   2  — no persona images found (likely a path problem)
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");

const IMAGES_GLOB = "assets/images/persona-*.png";

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

function main() {
  const files = globSync(IMAGES_GLOB).sort();

  if (files.length === 0) {
    console.error(`ERROR: No files matched "${IMAGES_GLOB}"`);
    console.error("  Check that the script is run from the project root.");
    process.exit(2);
  }

  console.log(`Checking ${files.length} persona image(s) for duplicates...\n`);

  const hashMap = {};
  const duplicates = [];

  for (const file of files) {
    const hash = hashFile(file);
    if (hashMap[hash]) {
      duplicates.push({ hash, files: [hashMap[hash], file] });
    } else {
      hashMap[hash] = file;
    }
  }

  if (duplicates.length === 0) {
    console.log("✓ All persona images are unique. No duplicates found.");
    process.exit(0);
  } else {
    console.error(`✗ DUPLICATE PERSONA IMAGES DETECTED (${duplicates.length} collision(s)):\n`);
    for (const dup of duplicates) {
      console.error(`  Hash: ${dup.hash.slice(0, 16)}...`);
      for (const f of dup.files) {
        console.error(`    ${f}`);
      }
      console.error("");
    }
    console.error("Fix: replace the duplicate file(s) with the correct portrait before shipping.");
    process.exit(1);
  }
}

main();
