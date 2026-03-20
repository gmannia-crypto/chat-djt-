const { execSync } = require("child_process");
const net = require("net");

const PORTS = [5000, 8082];

function isPortBusy(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(true));
    s.once("listening", () => { s.close(); resolve(false); });
    s.listen(port, "0.0.0.0");
  });
}

async function main() {
  for (const port of PORTS) {
    const busy = await isPortBusy(port);
    if (busy) {
      console.log(`Port ${port} busy, cleaning up...`);
      try {
        const pids = execSync(
          `ps aux | grep -E "tsx.*server|expo.*cli|jest-worker" | grep -v grep | grep -v cleanup-ports | awk '{print $2}'`,
          { encoding: "utf-8" }
        ).trim();
        if (pids) {
          for (const p of pids.split("\n")) {
            try { process.kill(Number(p), 9); } catch {}
          }
        }
      } catch {}
      await new Promise(r => setTimeout(r, 2000));
      console.log(`Port ${port} cleaned`);
    }
  }
  console.log("Ports ready");
}

main();
