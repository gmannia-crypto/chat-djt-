const { execSync } = require("child_process");
const net = require("net");

function isPortBusy(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(true));
    s.once("listening", () => { s.close(); resolve(false); });
    s.listen(port, "0.0.0.0");
  });
}

function killProcessOnPort(port) {
  const safePort = parseInt(port, 10);
  if (!safePort || safePort < 1 || safePort > 65535) return;
  try {
    execSync(`fuser -k ${safePort}/tcp 2>/dev/null || true`, { encoding: "utf-8" });
  } catch {}
  try {
    const pids = execSync(
      `lsof -ti :${safePort} 2>/dev/null || true`,
      { encoding: "utf-8" }
    ).trim();
    if (pids) {
      for (const p of pids.split("\n")) {
        const pid = Number(p.trim());
        if (pid && pid !== process.pid) {
          try { process.kill(pid, 9); } catch {}
        }
      }
    }
  } catch {}
}

async function main() {
  killProcessOnPort(5000);
  killProcessOnPort(8081);

  await new Promise(r => setTimeout(r, 2000));

  const busy = await isPortBusy(5000);
  if (busy) {
    console.log("Port 5000 still busy after cleanup!");
  }

  console.log("Ports ready");
}

main();
