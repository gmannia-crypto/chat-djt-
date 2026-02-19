const http = require("http");
const net = require("net");
const { execSync } = require("child_process");

const METRO_PORT = 8082;
const LISTEN_PORT = 8081;

try {
  const pids = execSync(`lsof -ti :${LISTEN_PORT} 2>/dev/null`, { encoding: "utf-8" }).trim();
  if (pids) {
    for (const pid of pids.split("\n")) {
      const p = Number(pid);
      if (p && p !== process.pid) {
        try { process.kill(p, "SIGKILL"); } catch {}
      }
    }
    console.log(`Killed stale processes on port ${LISTEN_PORT}`);
  }
} catch {}

function generateFallbackManifest() {
  try {
    const fs = require("fs");
    const path = require("path");
    const appJsonPath = path.resolve(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    const config = appJson.expo || appJson;
    const timestamp = Date.now().toString();
    return JSON.stringify({
      id: `${config.slug || "app"}-fallback-${timestamp}`,
      createdAt: new Date().toISOString(),
      runtimeVersion: "1.0.0",
      launchAsset: { url: "", key: `bundle-${timestamp}` },
      assets: [],
      metadata: {},
      extra: {
        expoClient: {
          name: config.name || "App",
          slug: config.slug || "app",
          version: config.version || "1.0.0",
          platforms: ["ios", "android", "web"],
        },
      },
    });
  } catch {
    return JSON.stringify({ id: "app", createdAt: new Date().toISOString(), assets: [] });
  }
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "").split("?")[0];

  if (urlPath === "/manifest") {
    res.writeHead(200, {
      "content-type": "application/json",
      "expo-protocol-version": "1",
      "expo-sfv-version": "0",
    });
    res.end(generateFallbackManifest());
    return;
  }

  if (urlPath === "/status") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("packager-status:running");
    return;
  }

  const options = {
    hostname: "localhost",
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${METRO_PORT}` },
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  proxyReq.on("error", () => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="3"></head><body style="background:#0A0A0A;color:#D4A420;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><h2>Starting up...</h2></body></html>');
  });
  req.pipe(proxyReq, { end: true });
});

server.on("upgrade", (req, socket, head) => {
  const proxySocket = net.connect(METRO_PORT, "localhost", () => {
    const reqLine = `${req.method} ${req.url} HTTP/1.1\r\n`;
    let headers = "";
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      headers += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    }
    proxySocket.write(reqLine + headers + "\r\n");
    if (head.length > 0) proxySocket.write(head);
    socket.pipe(proxySocket).pipe(socket);
  });
  proxySocket.on("error", () => socket.destroy());
  socket.on("error", () => proxySocket.destroy());
});

function startServer(attempt) {
  attempt = attempt || 1;
  server.listen(LISTEN_PORT, "0.0.0.0", () => {
    console.log(`Frontend proxy on port ${LISTEN_PORT} -> Metro on ${METRO_PORT}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && attempt <= 3) {
      console.log(`Port ${LISTEN_PORT} busy, force killing and retrying (attempt ${attempt}/3)...`);
      try {
        execSync(`lsof -ti :${LISTEN_PORT} 2>/dev/null | xargs kill -9 2>/dev/null`, { encoding: "utf-8" });
      } catch {}
      setTimeout(() => {
        server.removeAllListeners("error");
        server.close(() => {});
        startServer(attempt + 1);
      }, 2000);
    } else {
      console.error("Failed to start frontend proxy:", err.message);
      process.exit(1);
    }
  });
}

startServer(1);

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
