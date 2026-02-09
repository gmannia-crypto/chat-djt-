const http = require("http");
const net = require("net");
const { execSync } = require("child_process");

const METRO_PORT = 8082;
const LISTEN_PORT = 8081;

function killPort(port) {
  try {
    const pids = execSync(`lsof -i :${port} -t 2>/dev/null`).toString().trim();
    if (pids) {
      for (const pid of pids.split("\n")) {
        try { process.kill(Number(pid), "SIGKILL"); } catch {}
      }
      console.log(`Killed stale process on port ${port}`);
    }
  } catch {}
}

const server = http.createServer((req, res) => {
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
    res.writeHead(200);
    res.end("ok");
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
      console.log(`Port ${LISTEN_PORT} busy, killing stale process (attempt ${attempt}/3)...`);
      killPort(LISTEN_PORT);
      setTimeout(() => {
        server.removeAllListeners("error");
        startServer(attempt + 1);
      }, 1500);
    } else {
      console.error("Failed to start frontend proxy:", err.message);
      process.exit(1);
    }
  });
}

killPort(LISTEN_PORT);
setTimeout(() => startServer(1), 500);

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
