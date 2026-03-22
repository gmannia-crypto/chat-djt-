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

      /* Bundle cache disabled — Metro serves fresh bundles via HMR */

      return middleware(req, res, next);
    };
  },
};

module.exports = config;
