const net = require("net");

const TARGET_PORT = 5000;

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
  if (err.code === "EADDRINUSE") {
    console.log("Port 80 already in use, skipping forwarder");
  } else {
    console.error("Port 80 forwarder error:", err.message);
  }
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
