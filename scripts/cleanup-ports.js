const { execSync } = require("child_process");
const net = require("net");

const PORTS = [5000, 8081, 8082];

function isPortBusy(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(true));
    s.once("listening", () => { s.close(); resolve(false); });
    s.listen(port, "0.0.0.0");
  });
}

async function main() {
  try {
    execSync(`pkill -9 -f "expo.*start.*--port" 2>/dev/null || true`, { encoding: "utf-8" });
  } catch {}
  try {
    execSync(`pkill -9 -f "jest-worker" 2>/dev/null || true`, { encoding: "utf-8" });
  } catch {}
  try {
    execSync(`pkill -9 -f "esbuild.*--service" 2>/dev/null || true`, { encoding: "utf-8" });
  } catch {}

  const allPids = execSync(
    `ps aux | grep "nodejs-22" | grep -v grep | grep -v cleanup-ports | awk '{print $2}'`,
    { encoding: "utf-8" }
  ).trim();

  if (allPids) {
    console.log("Killing all Node 22 server processes:", allPids.split("\n").join(", "));
    for (const p of allPids.split("\n")) {
      const pid = Number(p);
      if (pid && pid !== process.pid) {
        try { process.kill(pid, 9); } catch {}
      }
    }
  }

  await new Promise(r => setTimeout(r, 3000));

  for (const port of PORTS) {
    const busy = await isPortBusy(port);
    if (busy) {
      console.log(`Port ${port} still busy after cleanup!`);
    }
  }

  console.log("Ports ready");
}

main();
