import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as net from "net";
import { spawn, execSync } from "child_process";
import { runMigrations } from "stripe-replit-sync";

import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";

const app = express();
const log = console.log;

const METRO_PORT = 8082;
let metroProcess: ReturnType<typeof spawn> | null = null;
let shuttingDown = false;

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => { server.close(); resolve(false); });
    server.listen(port, "127.0.0.1");
  });
}

async function spawnMetro() {
  if (process.env.NODE_ENV !== "development" || shuttingDown) return;

  const portBusy = await isPortInUse(METRO_PORT);
  if (portBusy) {
    try {
      const res = await fetch(`http://127.0.0.1:${METRO_PORT}/status`);
      const text = await res.text();
      if (text.includes("packager-status:running")) {
        log(`Metro already running on port ${METRO_PORT}, reusing`);
        return;
      }
    } catch {}
    try {
      const result = execSync(
        `lsof -ti :${METRO_PORT} 2>/dev/null`,
        { encoding: "utf-8" }
      ).trim();
      if (result) {
        for (const pid of result.split("\n")) {
          try { process.kill(Number(pid), "SIGKILL"); } catch {}
        }
        log(`Killed stale process on port ${METRO_PORT}`);
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch {}
  }

  const expoCli = path.resolve(process.cwd(), "node_modules", "expo", "bin", "cli");
  log(`Spawning Metro bundler on port ${METRO_PORT}...`);
  const devDomain = process.env.REPLIT_DEV_DOMAIN || "";
  metroProcess = spawn(process.execPath, [expoCli, "start", "--port", String(METRO_PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: "0",
      EXPO_PACKAGER_PROXY_URL: devDomain ? `https://${devDomain}` : "",
      REACT_NATIVE_PACKAGER_HOSTNAME: devDomain || "localhost",
      EXPO_PUBLIC_DOMAIN: devDomain ? `${devDomain}:5000` : "localhost:5000",
    },
    stdio: ["pipe", "inherit", "inherit"],
  });

  metroProcess.on("exit", (code) => {
    metroProcess = null;
    if (!shuttingDown) {
      log(`Metro exited with code ${code}, restarting in 10s...`);
      setTimeout(spawnMetro, 10000);
    }
  });
}

process.on("SIGTERM", () => { shuttingDown = true; metroProcess?.kill("SIGTERM"); });
process.on("SIGINT", () => { shuttingDown = true; metroProcess?.kill("SIGINT"); });

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

function generateFallbackManifest(platform: string): object {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    const config = appJson.expo || appJson;
    const timestamp = Date.now().toString();
    const sdkVersion = getExpoSdkVersion();

    return {
      id: `${config.slug || "app"}-${platform}-${timestamp}`,
      createdAt: new Date().toISOString(),
      runtimeVersion: `exposdk:${sdkVersion}`,
      launchAsset: { url: "", key: `bundle-${timestamp}` },
      assets: [],
      metadata: {},
      extra: {
        expoClient: {
          name: config.name || "App",
          slug: config.slug || "app",
          version: config.version || "1.0.0",
          sdkVersion,
          orientation: config.orientation || "default",
          userInterfaceStyle: config.userInterfaceStyle || "automatic",
          platforms: ["ios", "android", "web"],
          ios: config.ios || {},
          android: config.android || {},
          web: config.web || {},
        },
      },
    };
  } catch {
    return { id: "app", createdAt: new Date().toISOString(), assets: [] };
  }
}

function getExpoSdkVersion(): string {
  try {
    const pkgPath = path.resolve(process.cwd(), "node_modules", "expo", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "54.0.0";
  } catch {
    return "54.0.0";
  }
}

function serveExpoManifest(platform: string, req: Request, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  if (fs.existsSync(manifestPath)) {
    const manifestData = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    const forwardedHost = req.header("x-forwarded-host");
    const host = forwardedHost || req.get("host") || "";
    const forwardedProto = req.header("x-forwarded-proto") || "https";
    const currentBaseUrl = `${forwardedProto}://${host}`;

    const sdkVersion = getExpoSdkVersion();
    manifestData.runtimeVersion = `exposdk:${sdkVersion}`;

    if (manifestData.launchAsset?.url) {
      try {
        const oldUrl = new URL(manifestData.launchAsset.url);
        manifestData.launchAsset.url = `${currentBaseUrl}${oldUrl.pathname}`;
      } catch {}
    }

    if (manifestData.extra?.expoClient) {
      const client = manifestData.extra.expoClient;
      client.sdkVersion = sdkVersion;
      client.platforms = client.platforms || ["ios", "android", "web"];
      client.hostUri = host;

      if (client.splash?.imageUrl) {
        client.splash.imageUrl = `${currentBaseUrl}/assets/images/splash-icon.png`;
      }
      if (client.iconUrl) {
        client.iconUrl = `${currentBaseUrl}/assets/images/icon.png`;
      }
      if (client.android?.adaptiveIcon?.foregroundImageUrl) {
        client.android.adaptiveIcon.foregroundImageUrl = `${currentBaseUrl}/assets/images/icon.png`;
      }
    }

    if (!manifestData.extra) manifestData.extra = {};
    manifestData.extra.expoGo = {
      debuggerHost: host,
      developer: { tool: "expo-cli" },
      packagerOpts: { dev: false },
      mainModuleName: "node_modules/expo-router/entry",
    };

    return res.json(manifestData);
  }

  const fallback = generateFallbackManifest(platform);
  res.json(fallback);
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
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.status(200).send(html);
}

function proxyToMetro(req: Request, res: Response) {
  const isRootPage = req.path === "/" && req.method === "GET";

  const proxyPath = isRootPage ? req.originalUrl : req.originalUrl.replace(/lazy=true/g, "lazy=false");

  const proxyHeaders = { ...req.headers, host: `localhost:${METRO_PORT}` };
  delete proxyHeaders.origin;
  delete proxyHeaders.referer;

  const options: http.RequestOptions = {
    hostname: "localhost",
    port: METRO_PORT,
    path: proxyPath,
    method: req.method,
    headers: proxyHeaders,
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
    log(`[proxy] Waiting for Metro on ${req.path}`);
    res.status(200).send(`<!DOCTYPE html><html><head><title>Chat DJT</title><meta http-equiv="refresh" content="3"></head><body style="background:#0A0A0A;color:#D4A420;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><h2>Starting up...</h2></body></html>`);
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
  const appName = getAppName();
  const isDev = process.env.NODE_ENV === "development";
  let landingPageTemplate = fs.readFileSync(templatePath, "utf-8");

  log("Serving static Expo files with dynamic manifest routing");

  const distDir = path.resolve(process.cwd(), "dist");
  const hasWebBuild = fs.existsSync(path.join(distDir, "index.html"));

  if (hasWebBuild) {
    log("Production web build found in dist/, serving static files");
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api") || req.path === "/status" || req.path === "/therapy-viral" || req.path === "/therapy-multi" || req.path === "/financial-faceoff" || req.path === "/sports-betting" || (req.path === "/subscribe" && (req.query.success || req.query.canceled))) {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      if (isDev) {
        return proxyToMetro(req, res);
      }
      if (req.path === "/" || req.path === "/manifest") {
        return serveExpoManifest(platform, req, res);
      }
    }

    if (req.path === "/manifest" && !platform) {
      if (isDev) {
        return proxyToMetro(req, res);
      }
      return serveExpoManifest("ios", req, res);
    }

    if (isDev && !hasWebBuild) {
      if (req.path === "/" ) {
        const freshTemplate = fs.readFileSync(templatePath, "utf-8");
        return serveLandingPage({ req, res, landingPageTemplate: freshTemplate, appName });
      }
      if (req.path === "/server/assets" || req.path.startsWith("/server/assets/") || req.path.startsWith("/js/") || req.path.startsWith("/assets/") || req.path.startsWith("/public/")) {
        return next();
      }
      return proxyToMetro(req, res);
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use("/server/assets", express.static(path.resolve(process.cwd(), "server", "assets")));
  app.use("/public", express.static(path.resolve(process.cwd(), "server", "public"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".m4a")) {
        res.setHeader("Content-Type", "audio/mp4");
      } else if (filePath.endsWith(".mp3")) {
        res.setHeader("Content-Type", "audio/mpeg");
      } else if (filePath.endsWith(".wav")) {
        res.setHeader("Content-Type", "audio/wav");
      } else if (filePath.endsWith(".mp4")) {
        res.setHeader("Content-Type", "video/mp4");
      }
    },
  }));
  app.use("/js", express.static(path.resolve(process.cwd(), "server", "templates", "js")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  if (hasWebBuild) {
    app.use(express.static(distDir, {
      maxAge: "1h",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    }));

    const affiliateScript = `<script>(function(){var T='trumpbot-20';var L=[{k:['book','books','reading'],u:'https://www.amazon.com/s?k=trump+books&tag='+T},{k:['hat','hats','cap','make america great again'],u:'https://www.amazon.com/s?k=maga+hat&tag='+T},{k:['flag','american flag','patriotic flag'],u:'https://www.amazon.com/s?k=american+flag&tag='+T},{k:['shirt','tshirt','apparel'],u:'https://www.amazon.com/s?k=trump+shirt&tag='+T},{k:['gold','silver','bullion','invest'],u:'https://www.amazon.com/s?k=gold+coins&tag='+T},{k:['wall','border'],u:'https://www.amazon.com/s?k=build+the+wall&tag='+T},{k:['truth social','social media'],u:'https://www.amazon.com/s?k=trump+social&tag='+T}];function run(){document.querySelectorAll('[data-testid]').forEach(function(el){if(el.hasAttribute('data-aff')||el.querySelector('a'))return;var h=el.innerHTML,m=false;L.forEach(function(item){item.k.forEach(function(kw){var r=new RegExp('\\\\b'+kw+'\\\\b','gi');if(r.test(h)){h=h.replace(r,function(mt){return'<a href="'+item.u+'" target="_blank" rel="nofollow sponsored" style="color:#ff4d4d;text-decoration:underline;">'+mt+'</a>';});m=true;}});});if(m){el.innerHTML=h;el.setAttribute('data-aff','1');}});}var dt;var ob=new MutationObserver(function(){clearTimeout(dt);dt=setTimeout(run,1500);});document.addEventListener('DOMContentLoaded',function(){setTimeout(run,3000);ob.observe(document.body,{childList:true,subtree:true});});})();</script>`;

    app.get("/{*path}", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/js/") || req.path.startsWith("/assets/") || req.path.startsWith("/server/assets/") || req.path === "/status" || req.path === "/manifest" || req.path === "/therapy-viral" || req.path === "/therapy-multi" || (req.path === "/subscribe" && (req.query.success || req.query.canceled))) {
        return next();
      }
      const platform = req.header("expo-platform");
      if (platform) return next();

      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      const htmlPath = path.join(distDir, "index.html");
      let html = fs.readFileSync(htmlPath, "utf-8");
      if (!html.includes("data-aff")) {
        html = html.replace("</body>", affiliateScript + "</body>");
      }
      return res.send(html);
    });
  } else if (!isDev) {
    app.get("/", (req: Request, res: Response) => {
      return serveLandingPage({ req, res, landingPageTemplate, appName });
    });
  }

  log("Web app ready");
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

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log("DATABASE_URL not set, skipping Stripe initialization");
    return;
  }

  try {
    log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    log("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    try {
      const result = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      log(`Stripe webhook configured: ${JSON.stringify(result)}`);
    } catch (webhookErr) {
      log(`Stripe webhook setup skipped (non-critical): ${webhookErr}`);
    }

    stripeSync.syncBackfill()
      .then(() => log("Stripe data synced"))
      .catch((err: any) => console.error("Error syncing Stripe data:", err));
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
}

async function killPortIfBusy(port: number): Promise<void> {
  const busy = await isPortInUse(port);
  if (busy) {
    log(`Port ${port} in use, killing stale process...`);
    const myPid = process.pid;
    const myPpid = process.ppid;
    try {
      const allPids = execSync(
        `ps aux | grep -E "tsx.*server|expo.*cli.*start|jest-worker" | grep -v grep | awk '{print $2}'`,
        { encoding: "utf-8" }
      ).trim();
      if (allPids) {
        for (const pidStr of allPids.split("\n")) {
          const pid = Number(pidStr);
          if (pid && pid !== myPid && pid !== myPpid) {
            try { process.kill(pid, "SIGKILL"); } catch {}
          }
        }
      }
      await new Promise(r => setTimeout(r, 3000));
      log(`Killed stale processes on port ${port}`);
    } catch {}
  }
}

(async () => {
  const port = parseInt(process.env.PORT || "5000", 10);
  await killPortIfBusy(port);
  await killPortIfBusy(METRO_PORT);

  setupCors(app);

  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature" });
      }

      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        if (!Buffer.isBuffer(req.body)) {
          return res.status(500).json({ error: "Webhook processing error" });
        }
        await WebhookHandlers.processWebhook(req.body as Buffer, sig);
        res.status(200).json({ received: true });
      } catch (error: any) {
        console.error("Webhook error:", error.message);
        res.status(400).json({ error: "Webhook processing error" });
      }
    }
  );

  setupBodyParsing(app);
  setupRequestLogging(app);

  app.get("/status", (_req: Request, res: Response) => {
    res.status(200).send("ok");
  });

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  if (process.env.NODE_ENV === "development") {
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
    },
    () => {
      log(`express server serving on port ${port}`);
      spawnMetro();
      initStripe().catch((err) => console.error("Stripe init error:", err));
    },
  );
})();
