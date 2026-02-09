#!/usr/bin/env node
const args = process.argv.slice(2);
const path = require("path");

if (args.includes("--localhost")) {
  const { execSync, spawn } = require("child_process");
  const METRO_PORT = 8082;

  function killMetroOnPort(port) {
    try {
      const result = execSync(
        `ps aux | grep "expo.*start.*--port.*${port}" | grep -v grep | awk '{print $2}'`,
        { encoding: "utf-8" }
      ).trim();
      if (result) {
        for (const pid of result.split("\n")) {
          try { process.kill(Number(pid), "SIGKILL"); } catch {}
        }
        console.log(`Killed stale Metro on port ${port}`);
      }
    } catch {}
    try {
      const pids = execSync(`lsof -i :${port} -t 2>/dev/null`, { encoding: "utf-8" }).trim();
      if (pids) {
        for (const pid of pids.split("\n")) {
          try { process.kill(Number(pid), "SIGKILL"); } catch {}
        }
      }
    } catch {}
  }

  killMetroOnPort(METRO_PORT);

  setTimeout(() => {
    const realExpoCli = path.resolve(__dirname, "..", "node_modules", "expo", "bin", "cli");
    console.log(`Starting Metro on port ${METRO_PORT}...`);
    const child = spawn(process.execPath, [realExpoCli, "start", "--port", String(METRO_PORT)], {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, CI: "0" },
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      process.exit(code || 0);
    });

    process.on("SIGTERM", () => { child.kill("SIGTERM"); });
    process.on("SIGINT", () => { child.kill("SIGINT"); });
  }, 2000);
} else {
  const { execFileSync } = require("child_process");
  const realExpo = path.resolve(__dirname, "..", "node_modules", "expo", "bin", "cli");
  try {
    execFileSync(process.execPath, [realExpo, ...args], { stdio: "inherit" });
  } catch (e) {
    process.exit(e.status || 1);
  }
}
