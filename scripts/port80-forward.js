const net = require("net");
const { execSync } = require("child_process");

const TARGET_PORT = 5000;

function findAndKillPort80() {
  try {
    const pids = execSync(
      `ps aux | grep "port80-forward" | grep -v grep | grep -v ${process.pid} | awk '{print $2}'`,
      { encoding: "utf-8" }
    ).trim();
    if (pids) {
      for (const p of pids.split("\n")) {
        const pid = Number(p);
        if (pid && pid !== process.pid) {
          try { process.kill(pid, 9); } catch {}
        }
      }
      return true;
    }
  } catch {}
  return false;
}

function startForwarder(retries) {
  const server = net.createServer((clientSocket) => {
    const targetSocket = net.connect(TARGET_PORT, "localhost", () => {
      clientSocket.pipe(targetSocket);
      targetSocket.pipe(clientSocket);
    });
    targetSocket.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => targetSocket.destroy());
  });

  server.listen(80, "0.0.0.0", () => {
    console.log("Port 80 -> 5000 forwarder ready");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && retries > 0) {
      console.log("Port 80 in use, killing stale process and retrying...");
      findAndKillPort80();
      setTimeout(() => startForwarder(retries - 1), 1000);
    } else if (err.code === "EADDRINUSE") {
      console.log("Port 80 still in use after retries, skipping forwarder");
    } else {
      console.error("Port 80 forwarder error:", err.message);
    }
  });
}

startForwarder(3);

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
