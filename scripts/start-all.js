const { spawn } = require("child_process");
const http = require("http");

const METRO_PORT = 8081;

console.log("Starting Express backend and Metro bundler...");

const backend = spawn("npx", ["tsx", "server/index.ts"], {
  env: { ...process.env, NODE_ENV: "development" },
  stdio: "inherit",
  cwd: process.cwd(),
});

const metroEnv = {
  ...process.env,
  EXPO_PACKAGER_PROXY_URL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
  REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REPLIT_DEV_DOMAIN,
  EXPO_PUBLIC_DOMAIN: `${process.env.REPLIT_DEV_DOMAIN}:5000`,
};

const metro = spawn("npx", ["expo", "start", "--localhost", "--port", String(METRO_PORT)], {
  env: metroEnv,
  stdio: "inherit",
  cwd: process.cwd(),
});

function cleanup() {
  backend.kill("SIGTERM");
  metro.kill("SIGTERM");
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);

backend.on("exit", (code) => {
  console.log(`Backend exited with code ${code}`);
  metro.kill("SIGTERM");
  process.exit(code || 0);
});

metro.on("exit", (code) => {
  console.log(`Metro exited with code ${code}`);
});

function warmUpBundle() {
  const req = http.get(`http://localhost:${METRO_PORT}/status`, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      if (data.includes("packager-status:running")) {
        console.log("Metro is ready, pre-building web bundle...");
        http.get(`http://localhost:${METRO_PORT}/`, () => {
          console.log("Web bundle warm-up request sent");
        });
      } else {
        setTimeout(warmUpBundle, 2000);
      }
    });
  });
  req.on("error", () => {
    setTimeout(warmUpBundle, 2000);
  });
}

setTimeout(warmUpBundle, 3000);
