const { getDefaultConfig } = require("expo/metro-config");
const { createProxyMiddleware } = require("http-proxy-middleware");
const fs = require("fs");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /server[\\/]assets[\\/].*/,
  /\.local[\\/].*/,
  /node_modules[\\/]\.cache[\\/].*/,
];

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    const proxy = createProxyMiddleware({
      target: "http://localhost:5000",
      changeOrigin: true,
      ws: true,
      logLevel: "warn",
    });

    return (req, res, next) => {
      if (req.url && (
        req.url.startsWith("/api/") ||
        req.url.startsWith("/public/") ||
        req.url.startsWith("/server/assets/") ||
        req.url.startsWith("/js/") ||
        req.url === "/status" ||
        req.url === "/subscribe"
      )) {
        return proxy(req, res, next);
      }

      if (req.url && req.url.includes(".bundle") && req.url.includes("platform=android")) {
        const cacheDir = path.resolve(__dirname, ".bundle-cache");
        const acceptsGzip = (req.headers["accept-encoding"] || "").includes("gzip");
        const gzPath = path.join(cacheDir, "android.bundle.gz");
        const rawPath = path.join(cacheDir, "android.bundle");

        if (acceptsGzip && fs.existsSync(gzPath)) {
          console.log("[metro-cache] Serving cached gzip Android bundle");
          res.setHeader("Content-Type", "application/javascript");
          res.setHeader("Content-Encoding", "gzip");
          res.setHeader("Content-Length", fs.statSync(gzPath).size);
          return fs.createReadStream(gzPath).pipe(res);
        }
        if (fs.existsSync(rawPath)) {
          console.log("[metro-cache] Serving cached raw Android bundle");
          res.setHeader("Content-Type", "application/javascript");
          res.setHeader("Content-Length", fs.statSync(rawPath).size);
          return fs.createReadStream(rawPath).pipe(res);
        }
      }

      return middleware(req, res, next);
    };
  },
};

module.exports = config;
