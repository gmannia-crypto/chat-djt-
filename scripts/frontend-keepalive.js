const http = require("http");
const net = require("net");

const METRO_PORT = 8082;
const LISTEN_PORT = 8081;
const BACKEND_PORT = 5000;

function proxyTo(port, req, res) {
  const options = {
    hostname: "localhost",
    port: port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${port}` },
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  proxyReq.on("error", () => {
    if (port === BACKEND_PORT) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Backend unavailable" }));
    } else {
      res.writeHead(200, { "content-type": "text/html" });
      res.end('<html><head><meta http-equiv="refresh" content="3"></head><body style="background:#0A0A0A;color:#D4A420;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><h2>Starting up...</h2></body></html>');
    }
  });
  req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "").split("?")[0];
  const platform = req.headers["expo-platform"];

  if (platform === "android" || platform === "ios") {
    return proxyTo(METRO_PORT, req, res);
  }

  if (urlPath.startsWith("/api/") || urlPath === "/api") {
    return proxyTo(BACKEND_PORT, req, res);
  }

  if (urlPath === "/status") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("packager-status:running");
    return;
  }

  proxyTo(METRO_PORT, req, res);
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

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`Frontend proxy on port ${LISTEN_PORT} -> Metro ${METRO_PORT} / Backend ${BACKEND_PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${LISTEN_PORT} busy, killing stale and retrying...`);
    try {
      const { execSync } = require("child_process");
      const pids = execSync(
        `ps aux | grep "frontend-keepalive" | grep -v grep | grep -v ${process.pid} | awk '{print $2}'`,
        { encoding: "utf-8" }
      ).trim();
      if (pids) {
        for (const p of pids.split("\n")) {
          try { process.kill(Number(p), 9); } catch {}
        }
      }
    } catch {}
    setTimeout(() => {
      server.close(() => {});
      const s2 = http.createServer(server.listeners("request")[0]);
      s2.on("upgrade", server.listeners("upgrade")[0]);
      s2.listen(LISTEN_PORT, "0.0.0.0", () => {
        console.log(`Frontend proxy on port ${LISTEN_PORT} (retry)`);
      });
      s2.on("error", (e) => {
        console.error("Failed to start frontend proxy:", e.message);
        process.exit(1);
      });
    }, 2000);
  } else {
    console.error("Failed to start frontend proxy:", err.message);
    process.exit(1);
  }
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
