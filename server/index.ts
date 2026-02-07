import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { spawn, execSync, type ChildProcess } from "child_process";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: "10mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

const METRO_PORT = 19006;

function proxyToMetro(req: Request, res: Response) {
  const isRootPage = req.path === "/" && req.method === "GET";

  const proxyPath = isRootPage ? req.originalUrl : req.originalUrl.replace(/lazy=true/g, "lazy=false");

  const options: http.RequestOptions = {
    hostname: "localhost",
    port: METRO_PORT,
    path: proxyPath,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${METRO_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const status = proxyRes.statusCode || 502;
    if (status >= 400) {
      log(`[proxy] ${status} ${req.method} ${req.path}`);
    }

    if (isRootPage && proxyRes.headers["content-type"]?.includes("text/html")) {
      let body = "";
      proxyRes.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      proxyRes.on("end", () => {
        body = body.replace(/lazy=true/g, "lazy=false");
        const headers = { ...proxyRes.headers };
        delete headers["content-length"];
        delete headers["transfer-encoding"];
        headers["content-length"] = String(Buffer.byteLength(body));
        res.writeHead(status, headers);
        res.end(body);
      });
    } else {
      res.writeHead(status, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    }
  });

  proxyReq.on("error", () => {
    log(`[proxy] ERROR connecting to Metro for ${req.path}`);
    res.status(502).send("Metro bundler is starting up... Please refresh in a few seconds.");
  });

  req.pipe(proxyReq, { end: true });
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  const isDev = process.env.NODE_ENV === "development";

  log("Serving static Expo files with dynamic manifest routing");

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api") || req.path === "/status") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      if (req.path === "/" || req.path === "/manifest") {
        return serveExpoManifest(platform, res);
      }
    }

    if (isDev) {
      if (req.path === "/server/assets" || req.path.startsWith("/server/assets/")) {
        return next();
      }
      return proxyToMetro(req, res);
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use("/server/assets", express.static(path.resolve(process.cwd(), "server", "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

function waitForPortReady(port: number, maxAttempts = 60): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      const net = require("net");
      const socket = net.createConnection(port, "localhost");
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => {
        attempts++;
        if (attempts >= maxAttempts) {
          resolve(false);
        } else {
          setTimeout(check, 1000);
        }
      });
    };
    check();
  });
}

function startMetroBundler(): ChildProcess | null {
  if (process.env.NODE_ENV !== "development") return null;

  try {
    execSync(`pkill -9 -f "expo start" 2>/dev/null; sleep 2`, { stdio: "ignore", timeout: 10000 });
  } catch {}

  const metroEnv = {
    ...process.env,
    CI: undefined,
    EXPO_PACKAGER_PROXY_URL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
    REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REPLIT_DEV_DOMAIN || "",
    EXPO_PUBLIC_DOMAIN: `${process.env.REPLIT_DEV_DOMAIN}:5000`,
  };

  const metro = spawn("npx", ["expo", "start", "--localhost", "--port", String(METRO_PORT)], {
    env: metroEnv,
    stdio: "inherit",
    cwd: process.cwd(),
  });

  metro.on("exit", (code) => {
    log(`Metro bundler exited with code ${code}`);
  });

  log(`Metro bundler spawned on port ${METRO_PORT}`);
  return metro;
}

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  app.get("/status", (_req: Request, res: Response) => {
    res.status(200).send("ok");
  });

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);

  if (process.env.NODE_ENV === "development") {
    const net = await import("net");
    server.on("upgrade", (req: http.IncomingMessage, socket: any, head: Buffer) => {
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
  }

  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`express server serving on port ${port}`);

      if (process.env.NODE_ENV === "development") {
        const metro = startMetroBundler();
        if (metro) {
          process.on("SIGTERM", () => { metro.kill("SIGTERM"); });
          process.on("SIGINT", () => { metro.kill("SIGTERM"); });
          const started = await waitForPortReady(METRO_PORT, 60);
          log(started ? `Metro is ready on port ${METRO_PORT}` : `Metro failed to start on port ${METRO_PORT}`);
        }
      }
    },
  );
})();
