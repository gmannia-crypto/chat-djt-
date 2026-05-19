#!/usr/bin/env node
/**
 * Smoke-check: verify that the Express server running in dev mode
 * does NOT serve stale content from dist/ even when dist/index.html exists.
 *
 * This guards the fix introduced in task #68 (server/index.ts ~line 444):
 *   const hasWebBuild = !isDev && fs.existsSync(path.join(distDir, "index.html"));
 *
 * Usage:
 *   node scripts/check-dev-no-stale-dist.js
 *   npm run test:stale-dist
 *
 * Exit codes:
 *   0  guard is in place — dist/ is correctly ignored in dev mode
 *   1  regression detected or check could not complete
 */

"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST_INDEX = path.join(ROOT, "dist", "index.html");
const MARKER = "STALE_DIST_SMOKE_CHECK_MARKER_DO_NOT_SERVE";
const STARTUP_LOG_PATTERN = "dist/ present but ignored in dev mode";
const READY_POLL_INTERVAL_MS = 300;
const READY_TIMEOUT_MS = 12_000;

let serverProc = null;
let originalContent = null;
let markerWritten = false;
let serverExitedEarly = false;
let serverExitCode = null;
let testPort = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find a free TCP port by binding to :0 and reading the assigned port.
 * This is atomic — the OS guarantees uniqueness until we bind properly.
 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.on("error", reject);
  });
}

function fail(msg) {
  console.error(`\n╔══════════════════════════════════════════════════════════╗`);
  console.error(`║  STALE-DIST SMOKE CHECK — FAILED                         ║`);
  console.error(`╚══════════════════════════════════════════════════════════╝`);
  console.error(`\n${msg}\n`);
  process.exit(1);
}

function pass(msg) {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  STALE-DIST SMOKE CHECK — PASSED                         ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`\n${msg}\n`);
}

function restoreDistFile() {
  if (!markerWritten) return;
  try {
    if (originalContent === null) {
      fs.unlinkSync(DIST_INDEX);
      console.log("[INFO] Removed synthetic dist/index.html (it did not exist before).");
    } else {
      fs.writeFileSync(DIST_INDEX, originalContent, "utf-8");
      console.log("[INFO] dist/index.html restored to original content.");
    }
  } catch (e) {
    console.warn(`[WARN] Could not restore dist/index.html: ${e.message}`);
  }
  markerWritten = false;
}

/**
 * Kill the server and its entire process group so no orphan listeners remain.
 * We spawn with `detached: true` which puts the child in its own process group
 * (PGID = child PID on Linux). Sending SIGTERM to -pgid kills the whole tree.
 */
async function killServer() {
  if (!serverProc) return;
  try {
    // Kill the process group (negative PID = PGID on POSIX)
    process.kill(-serverProc.pid, "SIGTERM");
  } catch {
    // process group may already be gone — try the PID directly
    try { serverProc.kill("SIGTERM"); } catch { /* already dead */ }
  }
  await sleep(600);
  try {
    process.kill(-serverProc.pid, "SIGKILL");
  } catch {
    try { serverProc.kill("SIGKILL"); } catch { /* already dead */ }
  }
}

async function cleanup() {
  await killServer();
  restoreDistFile();
}

process.on("SIGINT", async () => { await cleanup(); process.exit(1); });
process.on("SIGTERM", async () => { await cleanup(); process.exit(1); });

async function waitForServer(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // Bail immediately if the server process already exited with an error
    if (serverExitedEarly) return false;
    try {
      const res = await fetch(`http://localhost:${port}/status`);
      if (res.ok) return true;
    } catch {
      // not ready yet — keep polling
    }
    await sleep(READY_POLL_INTERVAL_MS);
  }
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log("[INFO] Starting stale-dist smoke check …\n");

  // ── Step 1: allocate a guaranteed-free port ───────────────────────────────
  try {
    testPort = await getFreePort();
  } catch (err) {
    fail(`Could not allocate a free port: ${err.message}`);
  }
  console.log(`[INFO] Using dynamically allocated port ${testPort}`);

  // ── Step 2: inject a unique marker into dist/index.html ──────────────────
  if (fs.existsSync(DIST_INDEX)) {
    originalContent = fs.readFileSync(DIST_INDEX, "utf-8");
    fs.writeFileSync(DIST_INDEX, `<!-- ${MARKER} -->\n` + originalContent, "utf-8");
    markerWritten = true;
    console.log("[INFO] Injected marker into existing dist/index.html");
  } else {
    originalContent = null;
    fs.writeFileSync(
      DIST_INDEX,
      `<!-- ${MARKER} --><html><body>STALE CONTENT</body></html>`,
      "utf-8"
    );
    markerWritten = true;
    console.log("[INFO] Created synthetic dist/index.html with marker");
  }

  // ── Step 3: spawn server in dev mode on the free port ────────────────────
  const env = {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(testPort),
    SMOKE_CHECK: "1",
  };

  let combinedOutput = "";

  // detached: true → child gets its own process group (PGID = child.pid on Linux)
  // This lets us kill the entire tree with process.kill(-pid, signal)
  serverProc = spawn(
    "npx",
    ["tsx", path.join(ROOT, "server", "index.ts")],
    { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"], detached: true }
  );

  // Unref so this process doesn't wait for the child to exit on its own
  serverProc.unref();

  serverProc.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    process.stdout.write(text.replace(/^(?=.)/gm, "[SERVER] "));
  });
  serverProc.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    process.stderr.write(text.replace(/^(?=.)/gm, "[SERVER] "));
  });

  // Detect premature exits (e.g. EADDRINUSE or startup crash)
  serverProc.on("exit", (code) => {
    serverExitedEarly = true;
    serverExitCode = code;
  });

  serverProc.on("error", (err) => {
    serverExitedEarly = true;
    cleanup().then(() =>
      fail(`Could not start server process: ${err.message}`)
    );
  });

  // ── Step 4: wait for readiness ────────────────────────────────────────────
  console.log(`[INFO] Waiting for server on port ${testPort} …`);
  const ready = await waitForServer(testPort, READY_TIMEOUT_MS);

  if (!ready) {
    await cleanup();
    if (serverExitedEarly) {
      fail(
        `Server process exited prematurely (exit code ${serverExitCode}).\n` +
        "This usually means the port was already in use or server/index.ts\n" +
        "crashed during startup. Check the [SERVER] output above."
      );
    } else {
      fail(
        `Server did not become ready within ${READY_TIMEOUT_MS}ms.\n` +
        "Check that server/index.ts is syntactically valid and can start."
      );
    }
  }

  // Double-check the process hasn't exited right after we thought it was ready
  if (serverExitedEarly) {
    await cleanup();
    fail(
      `Server process exited unexpectedly after appearing ready (exit code ${serverExitCode}).`
    );
  }

  console.log(`[INFO] Server is ready on port ${testPort}.`);

  // ── Step 5: check startup log for the expected "ignored" message ──────────
  if (combinedOutput.includes(STARTUP_LOG_PATTERN)) {
    console.log(`[INFO] ✓ Startup log correctly contains: "${STARTUP_LOG_PATTERN}"`);
  } else {
    console.warn(
      `[WARN] Startup log did NOT contain: "${STARTUP_LOG_PATTERN}"\n` +
      `       Expected when dist/index.html exists in dev mode. The guard\n` +
      `       may still work — continuing with the HTTP assertion …`
    );
  }

  // ── Step 6: GET / and assert the marker is absent ─────────────────────────
  let responseText;
  try {
    const res = await fetch(`http://localhost:${testPort}/`);
    responseText = await res.text();
  } catch (err) {
    await cleanup();
    fail(`HTTP GET http://localhost:${testPort}/ failed: ${err.message}`);
  }

  if (responseText.includes(MARKER)) {
    await cleanup();
    fail(
      "REGRESSION DETECTED — GET / returned content containing the stale-dist marker.\n\n" +
      "The server is serving dist/index.html in dev mode, which breaks the preview port\n" +
      "and hides fresh edits. The guard in server/index.ts has been removed or bypassed.\n\n" +
      "Fix: ensure ~line 444 of server/index.ts reads:\n\n" +
      "  const hasWebBuild = !isDev && fs.existsSync(\n" +
      "    path.join(distDir, 'index.html')\n" +
      "  );\n\n" +
      "and that the dev-mode middleware at ~line 503 returns early for GET / before\n" +
      "reaching the static dist/ handler."
    );
  }

  // ── Step 7: sanity-check we got a real response ───────────────────────────
  if (responseText.trim().length < 50) {
    await cleanup();
    fail(
      `GET / returned a suspiciously short response (${responseText.trim().length} chars).\n` +
      "Expected a full HTML landing page from server/templates/landing-page.html."
    );
  }

  // ── All clear ─────────────────────────────────────────────────────────────
  await cleanup();
  pass(
    "dist/ is correctly ignored in dev mode.\n" +
    "GET / did not contain the stale marker — the hasWebBuild guard in\n" +
    "server/index.ts is intact and working as expected."
  );
})();
