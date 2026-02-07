const { spawn } = require("child_process");
const http = require("http");

const env = {
  ...process.env,
  EXPO_PACKAGER_PROXY_URL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
  REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REPLIT_DEV_DOMAIN,
  EXPO_PUBLIC_DOMAIN: `${process.env.REPLIT_DEV_DOMAIN}:5000`,
};

const child = spawn("npx", ["expo", "start", "--localhost"], {
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

function waitForMetro() {
  const req = http.get("http://localhost:8081/status", (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      if (data.includes("packager-status:running")) {
        console.log("Metro is ready, warming up web bundle...");
        http.get("http://localhost:8081/", () => {});
      } else {
        setTimeout(waitForMetro, 2000);
      }
    });
  });
  req.on("error", () => {
    setTimeout(waitForMetro, 2000);
  });
}

setTimeout(waitForMetro, 5000);
