#!/usr/bin/env node
const args = process.argv.slice(2);
const path = require("path");

if (args.includes("--localhost")) {
  const { spawn } = require("child_process");

  const keepalivePath = path.resolve(__dirname, "frontend-keepalive.js");
  const keepalive = spawn(process.execPath, [keepalivePath], {
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
    stdio: "inherit",
  });

  keepalive.on("exit", (code) => {
    process.exit(code || 0);
  });

  process.on("SIGTERM", () => { keepalive.kill("SIGTERM"); });
  process.on("SIGINT", () => { keepalive.kill("SIGINT"); });
} else {
  const { execFileSync } = require("child_process");
  const realExpo = path.resolve(__dirname, "..", "node_modules", "expo", "bin", "cli");
  try {
    execFileSync(process.execPath, [realExpo, ...args], { stdio: "inherit" });
  } catch (e) {
    process.exit(e.status || 1);
  }
}
