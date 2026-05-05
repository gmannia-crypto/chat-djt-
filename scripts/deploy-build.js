#!/usr/bin/env node
// THIS IS THE ONLY SCRIPT THAT SHOULD POPULATE dist/.
// dist/ is a production artifact served by the Express app when NODE_ENV !== "development".
// Do NOT call `npx expo export --output-dir dist` from any other script (post-merge,
// dev workflows, etc.) — see task #68. In dev, Metro on port 8081 serves fresh code via
// the proxy in server/index.ts; a stale dist/ would shadow those changes on the preview.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("Deploy build starting...");

if (fs.existsSync("dist") && !fs.existsSync(path.join("dist", "index.html"))) {
  console.log("Removing stale dist/ directory (no index.html)...");
  fs.rmSync("dist", { recursive: true, force: true });
}

console.log("Running expo static build (always refresh dist/ so new routes are included)...");
execSync("node scripts/build.js", { stdio: "inherit" });

console.log("Building server...");
execSync("npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=server_dist", { stdio: "inherit" });

console.log("Deploy build complete!");
