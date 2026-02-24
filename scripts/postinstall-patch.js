#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

if (process.env.NODE_ENV === "production") {
  console.log("Skipping expo CLI patch in production");
  process.exit(0);
}

const expoCli = path.resolve(__dirname, "..", "node_modules", "expo", "bin", "cli");

const wrapperContent = `#!/usr/bin/env node
const args = process.argv.slice(2);
const path = require("path");

if (args.includes("--localhost")) {
  const { spawn } = require("child_process");

  const keepalivePath = path.resolve(__dirname, "..", "..", "..", "scripts", "frontend-keepalive.js");
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
  require('@expo/cli');
}
`;

try {
  if (fs.existsSync(expoCli)) {
    fs.writeFileSync(expoCli, wrapperContent, { mode: 0o755 });
    console.log("Patched expo/bin/cli with keepalive wrapper");
  } else {
    console.log("expo CLI not found, skipping patch");
  }
} catch (err) {
  console.error("Failed to patch expo CLI:", err.message);
}
