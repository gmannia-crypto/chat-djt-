const { spawn } = require("child_process");
const http = require("http");
const net = require("net");

const PROXY_PORT = 8081;
const METRO_PORT = 8082;
let metroReady = false;

const proxy = http.createServer((req, res) => {
  if (req.url === "/status") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("packager-status:running");
    return;
  }

  if (!metroReady) {
    res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("Metro is starting up...");
    return;
  }

  const options = {
    hostname: "localhost",
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Metro not available");
  });

  req.pipe(proxyReq, { end: true });
});

proxy.on("upgrade", (req, socket, head) => {
  if (!metroReady) {
    socket.destroy();
    return;
  }

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

proxy.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`Proxy listening on port ${PROXY_PORT}, starting Metro on ${METRO_PORT}...`);
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

metro.on("exit", (code) => {
  console.log(`Metro exited with code ${code}`);
  process.exit(code || 0);
});

process.on("SIGTERM", () => {
  metro.kill("SIGTERM");
  proxy.close();
  setTimeout(() => process.exit(0), 2000);
});

process.on("SIGINT", () => {
  metro.kill("SIGTERM");
  proxy.close();
  setTimeout(() => process.exit(0), 2000);
});

function checkMetro() {
  const req = http.get(`http://localhost:${METRO_PORT}/status`, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      if (data.includes("packager-status:running")) {
        if (!metroReady) {
          metroReady = true;
          console.log("Metro is ready! Proxy now forwarding requests.");
          http.get(`http://localhost:${METRO_PORT}/`, () => {
            console.log("Web bundle warm-up request sent.");
          });
        }
      } else {
        setTimeout(checkMetro, 1500);
      }
    });
  });
  req.on("error", () => {
    setTimeout(checkMetro, 1500);
  });
}

setTimeout(checkMetro, 3000);
