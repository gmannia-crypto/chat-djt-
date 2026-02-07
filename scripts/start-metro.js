const { spawn } = require("child_process");
const http = require("http");
const httpProxy = require("http");

const METRO_PORT = 8081;

const env = {
  ...process.env,
  EXPO_PACKAGER_PROXY_URL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
  REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REPLIT_DEV_DOMAIN,
  EXPO_PUBLIC_DOMAIN: `${process.env.REPLIT_DEV_DOMAIN}:5000`,
};

const child = spawn("npx", ["expo", "start", "--localhost", "--port", String(METRO_PORT)], {
  env,
  stdio: "inherit",
  cwd: process.cwd(),
});

child.on("exit", (code) => {
  process.exit(code || 0);
});

process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});

process.on("SIGINT", () => {
  child.kill("SIGINT");
});

function warmUpBundle() {
  const req = http.get(`http://localhost:${METRO_PORT}/status`, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      if (data.includes("packager-status:running")) {
        console.log("Metro is ready, pre-building web bundle...");
        http.get(`http://localhost:${METRO_PORT}/`, () => {});
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
