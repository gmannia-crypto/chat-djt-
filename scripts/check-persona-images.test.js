#!/usr/bin/env node
/**
 * check-persona-images.test.js
 *
 * Plain Node.js tests for scripts/check-persona-images.js
 *
 * Run:
 *   node scripts/check-persona-images.test.js
 *   npm run test:persona-check
 *
 * Exercises all three meaningful exit paths without Jest:
 *   - Exit 0 when files are clean and match the manifest
 *   - Exit 1 when a duplicate hash is detected (Layer 1)
 *   - Exit 1 when a portrait is saved under the wrong persona name (Layer 2)
 *
 * Strategy: create tiny temp PNG-like files, temporarily swap the
 * manifest for a test fixture, run the script via spawnSync with an
 * explicit file list (the partial-scan path), then restore the manifest
 * in a finally block regardless of outcome.
 */

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "check-persona-images.js");
const MANIFEST_PATH = path.join(__dirname, "persona-image-manifest.json");

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function makeFakeFile(dir, filename, content) {
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, content);
  return filepath;
}

function runScript(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
  });
}

/**
 * Temporarily replace the real manifest with a test fixture, call fn(),
 * then restore the original — even if fn() throws.
 */
function withTempManifest(fixture, fn) {
  const original = fs.readFileSync(MANIFEST_PATH);
  try {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(fixture, null, 2) + "\n");
    fn();
  } finally {
    fs.writeFileSync(MANIFEST_PATH, original);
  }
}

// ─── Test 1: clean files → exit 0 ────────────────────────────────────────────

function testCleanFiles() {
  console.log("\nTest 1: clean files (unique hashes, all match manifest) → exit 0");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "persona-test-"));
  try {
    const contentA = Buffer.from("unique fake png bytes for persona-trump");
    const contentB = Buffer.from("unique fake png bytes for persona-obama");

    const fileA = makeFakeFile(tmpDir, "persona-trump.png", contentA);
    const fileB = makeFakeFile(tmpDir, "persona-obama.png", contentB);

    const fixture = { trump: sha256(contentA), obama: sha256(contentB) };

    withTempManifest(fixture, () => {
      const result = runScript([fileA, fileB]);
      assert(result.status === 0, `exit code is 0 (got ${result.status})`);
      const output = result.stdout + result.stderr;
      assert(
        output.includes("All checks passed") ||
          output.includes("All files match"),
        "output confirms all checks passed"
      );
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Test 2: duplicate hash → exit 1 (Layer 1 fires) ────────────────────────

function testDuplicateHash() {
  console.log("\nTest 2: duplicate hash (same content in two slots) → exit 1");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "persona-test-"));
  try {
    // Both files share the same byte content → same SHA-256 hash
    const sameContent = Buffer.from("identical portrait bytes used for both personas");
    const hash = sha256(sameContent);

    const fileA = makeFakeFile(tmpDir, "persona-trump.png", sameContent);
    const fileB = makeFakeFile(tmpDir, "persona-obama.png", sameContent);

    // Manifest reflects the (wrong) state where both entries share the hash.
    // Layer 1 will fire before Layer 2 even matters.
    const fixture = { trump: hash, obama: hash };

    withTempManifest(fixture, () => {
      const result = runScript([fileA, fileB]);
      assert(result.status === 1, `exit code is 1 (got ${result.status})`);
      const output = result.stdout + result.stderr;
      assert(
        output.includes("DUPLICATE"),
        "output reports DUPLICATE IMAGES"
      );
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Test 3: wrong-name swap → exit 1 (Layer 2 fires) ───────────────────────

function testWrongNameSwap() {
  console.log(
    "\nTest 3: portrait saved under wrong persona name (swap) → exit 1"
  );
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "persona-test-"));
  try {
    const trumpBytes = Buffer.from("trump unique portrait content aaa");
    const obamaBytes = Buffer.from("obama unique portrait content bbb");
    const hashTrump = sha256(trumpBytes);
    const hashObama = sha256(obamaBytes);

    // The swap: obama's bytes are written to the trump filename and vice versa
    const fileTrump = makeFakeFile(tmpDir, "persona-trump.png", obamaBytes);
    const fileObama = makeFakeFile(tmpDir, "persona-obama.png", trumpBytes);

    // Manifest has the *correct* expected hashes, so the swap will be caught
    const fixture = { trump: hashTrump, obama: hashObama };

    withTempManifest(fixture, () => {
      const result = runScript([fileTrump, fileObama]);
      assert(result.status === 1, `exit code is 1 (got ${result.status})`);
      const output = result.stdout + result.stderr;
      assert(
        output.includes("MISMATCHED"),
        "output reports MISMATCHED NAMES"
      );
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Run all tests ────────────────────────────────────────────────────────────

console.log("Running check-persona-images.js tests…");

testCleanFiles();
testDuplicateHash();
testWrongNameSwap();

console.log("\n────────────────────────────────────────────────────────────────");
if (failed === 0) {
  console.log(`✓ All ${passed} assertions passed.\n`);
  process.exit(0);
} else {
  console.error(`✗ ${failed} assertion(s) failed, ${passed} passed.\n`);
  process.exit(1);
}
