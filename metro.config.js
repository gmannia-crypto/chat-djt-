const { getDefaultConfig } = require("expo/metro-config");
const { createProxyMiddleware } = require("http-proxy-middleware");

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
      if (req.url && req.url.startsWith("/api/")) {
        return proxy(req, res, next);
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
