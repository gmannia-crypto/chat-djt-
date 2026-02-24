const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

let metroProcess = null;
const BUILD_METRO_PORT = process.env.BUILD_METRO_PORT || 8081;

function exitWithError(message) {
  console.error(message);
  if (metroProcess) {
    metroProcess.kill();
  }
  process.exit(1);
}

function setupSignalHandlers() {
  const cleanup = () => {
    if (metroProcess) {
      console.log("Cleaning up Metro process...");
      metroProcess.kill();
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGHUP", cleanup);
}

function stripProtocol(domain) {
  let urlString = domain.trim();

  if (!/^https?:\/\//i.test(urlString)) {
    urlString = `https://${urlString}`;
  }

  return new URL(urlString).host;
}

function getDeploymentDomain() {
  // Check Replit deployment environment variables first
  if (process.env.REPLIT_INTERNAL_APP_DOMAIN) {
    return stripProtocol(process.env.REPLIT_INTERNAL_APP_DOMAIN);
  }

  if (process.env.REPLIT_DEV_DOMAIN) {
    return stripProtocol(process.env.REPLIT_DEV_DOMAIN);
  }

  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return stripProtocol(process.env.EXPO_PUBLIC_DOMAIN);
  }

  console.error(
    "ERROR: No deployment domain found. Set REPLIT_INTERNAL_APP_DOMAIN, REPLIT_DEV_DOMAIN, or EXPO_PUBLIC_DOMAIN",
  );
  process.exit(1);
}

function prepareDirectories(timestamp) {
  console.log("Preparing build directories...");

  if (fs.existsSync("static-build")) {
    fs.rmSync("static-build", { recursive: true });
  }

  const dirs = [
    path.join("static-build", timestamp, "_expo", "static", "js", "ios"),
    path.join("static-build", timestamp, "_expo", "static", "js", "android"),
    path.join("static-build", "ios"),
    path.join("static-build", "android"),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log("Build:", timestamp);
}

function clearMetroCache() {
  console.log("Clearing Metro cache...");

  const cacheDirs = [
    ...fs.globSync(".metro-cache"),
    ...fs.globSync("node_modules/.cache/metro"),
  ];

  for (const dir of cacheDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log("Cache cleared");
}

async function checkMetroHealth() {
  try {
    const response = await fetch(`http://localhost:${BUILD_METRO_PORT}/status`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function startMetro(expoPublicDomain) {
  const isRunning = await checkMetroHealth();
  if (isRunning) {
    console.log("Metro already running");
    return;
  }

  console.log("Starting Metro...");
  console.log(`Setting EXPO_PUBLIC_DOMAIN=${expoPublicDomain}`);
  const env = {
    ...process.env,
    EXPO_PUBLIC_DOMAIN: expoPublicDomain,
  };
  metroProcess = spawn("npx", ["expo", "start", "--no-dev", "--minify", "--port", String(BUILD_METRO_PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    env: { ...env, CI: "0" },
  });

  if (metroProcess.stdout) {
    metroProcess.stdout.on("data", (data) => {
      const output = data.toString().trim();
      if (output) console.log(`[Metro] ${output}`);
    });
  }
  if (metroProcess.stderr) {
    metroProcess.stderr.on("data", (data) => {
      const output = data.toString().trim();
      if (output) console.error(`[Metro Error] ${output}`);
    });
  }

  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const healthy = await checkMetroHealth();
    if (healthy) {
      console.log("Metro ready");
      return;
    }
  }

  console.error("Metro timeout");
  process.exit(1);
}

async function downloadFile(url, outputPath) {
  const controller = new AbortController();
  const fiveMinMS = 5 * 60 * 1_000;
  const timeoutId = setTimeout(() => controller.abort(), fiveMinMS);

  try {
    console.log(`Downloading: ${url}`);
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const file = fs.createWriteStream(outputPath);
    await pipeline(Readable.fromWeb(response.body), file);

    const fileSize = fs.statSync(outputPath).size;

    if (fileSize === 0) {
      fs.unlinkSync(outputPath);
      throw new Error("Downloaded file is empty");
    }
  } catch (error) {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    if (error.name === "AbortError") {
      throw new Error(`Download timeout after 5m: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function downloadBundle(platform, timestamp) {
  // For expo-router apps, the entry is node_modules/expo-router/entry
  const url = new URL(`http://localhost:${BUILD_METRO_PORT}/node_modules/expo-router/entry.bundle`);
  url.searchParams.set("platform", platform);
  url.searchParams.set("dev", "false");
  url.searchParams.set("hot", "false");
  url.searchParams.set("lazy", "false");
  url.searchParams.set("minify", "true");

  const output = path.join(
    "static-build",
    timestamp,
    "_expo",
    "static",
    "js",
    platform,
    "bundle.js",
  );

  console.log(`Fetching ${platform} bundle...`);
  await downloadFile(url.toString(), output);
  console.log(`${platform} bundle ready`);
}

function generateManifest(platform, timestamp, baseUrl) {
  console.log(`Generating ${platform} manifest...`);
  const appJson = JSON.parse(fs.readFileSync("app.json", "utf-8"));
  const config = appJson.expo || appJson;
  const id = `${config.slug || "app"}-${platform}-${timestamp}`;
  const host = baseUrl.replace("https://", "");

  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    runtimeVersion: config.runtimeVersion || (() => { try { const pkg = JSON.parse(fs.readFileSync("node_modules/expo/package.json", "utf-8")); return `exposdk:${pkg.version}`; } catch { return "1.0.0"; } })(),
    launchAsset: {
      url: `${baseUrl}/${timestamp}/_expo/static/js/${platform}/bundle.js`,
      key: `bundle-${timestamp}`,
    },
    assets: [],
    metadata: {},
    extra: {
      expoClient: {
        name: config.name || "App",
        slug: config.slug || "app",
        version: config.version || "1.0.0",
        orientation: config.orientation || "default",
        icon: config.icon || "",
        scheme: config.scheme || "",
        userInterfaceStyle: config.userInterfaceStyle || "automatic",
        splash: config.splash || {},
        ios: config.ios || {},
        android: config.android || {},
        web: config.web || {},
        plugins: config.plugins || [],
        experiments: config.experiments || {},
        hostUri: `${host}/${platform}`,
        _internal: { isDebug: false },
      },
      expoGo: {
        debuggerHost: `${host}/${platform}`,
        developer: { tool: "expo-cli" },
        packagerOpts: { dev: false },
        mainModuleName: "node_modules/expo-router/entry",
      },
    },
  };

  console.log(`${platform} manifest generated`);
  return manifest;
}

async function downloadBundles(timestamp) {
  console.log("Downloading bundles...");
  console.log("This may take several minutes for production builds...");

  try {
    const results = await Promise.allSettled([
      downloadBundle("ios", timestamp),
      downloadBundle("android", timestamp),
    ]);

    const failures = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === "rejected");

    if (failures.length > 0) {
      const errorMessages = failures.map(({ result, index }) => {
        const names = ["iOS bundle", "Android bundle"];
        return `  - ${names[index]}: ${result.reason?.message || result.reason}`;
      });

      exitWithError(`Download failed:\n${errorMessages.join("\n")}`);
    }

    console.log("All bundles downloaded successfully");
  } catch (error) {
    exitWithError(`Unexpected download error: ${error.message}`);
  }
}

function extractAssets(timestamp) {
  const bundles = {
    ios: fs.readFileSync(
      path.join(
        "static-build",
        timestamp,
        "_expo",
        "static",
        "js",
        "ios",
        "bundle.js",
      ),
      "utf-8",
    ),
    android: fs.readFileSync(
      path.join(
        "static-build",
        timestamp,
        "_expo",
        "static",
        "js",
        "android",
        "bundle.js",
      ),
      "utf-8",
    ),
  };

  const assetsMap = new Map();
  const assetPattern =
    /httpServerLocation:"([^"]+)"[^}]*hash:"([^"]+)"[^}]*name:"([^"]+)"[^}]*type:"([^"]+)"/g;

  const extractFromBundle = (bundle, platform) => {
    for (const match of bundle.matchAll(assetPattern)) {
      const originalPath = match[1];
      const filename = match[3] + "." + match[4];

      const tempUrl = new URL(`http://localhost:${BUILD_METRO_PORT}${originalPath}`);
      const unstablePath = tempUrl.searchParams.get("unstable_path");

      if (!unstablePath) {
        throw new Error(`Asset missing unstable_path: ${originalPath}`);
      }

      const decodedPath = decodeURIComponent(unstablePath);
      const key = path.posix.join(decodedPath, filename);

      if (!assetsMap.has(key)) {
        const asset = {
          url: path.posix.join("/", decodedPath, filename),
          originalPath: originalPath,
          filename: filename,
          relativePath: decodedPath,
          hash: match[2],
          platforms: new Set(),
        };

        assetsMap.set(key, asset);
      }
      assetsMap.get(key).platforms.add(platform);
    }
  };

  extractFromBundle(bundles.ios, "ios");
  extractFromBundle(bundles.android, "android");

  return Array.from(assetsMap.values());
}

async function downloadAssets(assets, timestamp) {
  if (assets.length === 0) {
    return 0;
  }

  console.log("Downloading assets...");
  let successCount = 0;
  const failures = [];

  const downloadPromises = assets.map(async (asset) => {
    const platform = Array.from(asset.platforms)[0];

    const tempUrl = new URL(`http://localhost:${BUILD_METRO_PORT}${asset.originalPath}`);
    const unstablePath = tempUrl.searchParams.get("unstable_path");

    if (!unstablePath) {
      throw new Error(`Asset missing unstable_path: ${asset.originalPath}`);
    }

    const decodedPath = decodeURIComponent(unstablePath);
    const metroUrl = new URL(
      `http://localhost:${BUILD_METRO_PORT}${path.posix.join("/assets", decodedPath, asset.filename)}`,
    );
    metroUrl.searchParams.set("platform", platform);
    metroUrl.searchParams.set("hash", asset.hash);

    const outputDir = path.join(
      "static-build",
      timestamp,
      "_expo",
      "static",
      "js",
      asset.relativePath,
    );
    fs.mkdirSync(outputDir, { recursive: true });
    const output = path.join(outputDir, asset.filename);

    try {
      await downloadFile(metroUrl.toString(), output);
      successCount++;
    } catch (error) {
      failures.push({
        filename: asset.filename,
        error: error.message,
        url: metroUrl.toString(),
      });
    }
  });

  await Promise.all(downloadPromises);

  if (failures.length > 0) {
    const errorMsg =
      `Failed to download ${failures.length} asset(s):\n` +
      failures
        .map((f) => `  - ${f.filename}: ${f.error} (${f.url})`)
        .join("\n");
    exitWithError(errorMsg);
  }

  console.log(`Downloaded ${successCount} assets`);
  return successCount;
}

function updateBundleUrls(timestamp, baseUrl) {
  const updateForPlatform = (platform) => {
    const bundlePath = path.join(
      "static-build",
      timestamp,
      "_expo",
      "static",
      "js",
      platform,
      "bundle.js",
    );
    let bundle = fs.readFileSync(bundlePath, "utf-8");

    bundle = bundle.replace(
      /httpServerLocation:"(\/[^"]+)"/g,
      (_match, capturedPath) => {
        const tempUrl = new URL(`http://localhost:${BUILD_METRO_PORT}${capturedPath}`);
        const unstablePath = tempUrl.searchParams.get("unstable_path");

        if (!unstablePath) {
          throw new Error(
            `Asset missing unstable_path in bundle: ${capturedPath}`,
          );
        }

        const decodedPath = decodeURIComponent(unstablePath);
        return `httpServerLocation:"${baseUrl}/${timestamp}/_expo/static/js/${decodedPath}"`;
      },
    );

    fs.writeFileSync(bundlePath, bundle);
  };

  updateForPlatform("ios");
  updateForPlatform("android");
  console.log("Updated bundle URLs");
}

function updateManifests(manifests, timestamp, baseUrl, assetsByHash) {
  const updateForPlatform = (platform, manifest) => {
    if (!manifest.launchAsset || !manifest.extra) {
      exitWithError(`Malformed manifest for ${platform}`);
    }

    manifest.launchAsset.url = `${baseUrl}/${timestamp}/_expo/static/js/${platform}/bundle.js`;
    manifest.launchAsset.key = `bundle-${timestamp}`;
    manifest.createdAt = new Date(
      Number(timestamp.split("-")[0]),
    ).toISOString();
    manifest.extra.expoClient.hostUri =
      baseUrl.replace("https://", "") + "/" + platform;
    manifest.extra.expoGo.debuggerHost =
      baseUrl.replace("https://", "") + "/" + platform;
    manifest.extra.expoGo.packagerOpts.dev = false;

    if (manifest.assets && manifest.assets.length > 0) {
      manifest.assets.forEach((asset) => {
        if (!asset.url) return;

        const hash = asset.hash;
        if (!hash) return;

        const assetInfo = assetsByHash.get(hash);
        if (!assetInfo) return;

        asset.url = `${baseUrl}/${timestamp}/_expo/static/js/${assetInfo.relativePath}/${assetInfo.filename}`;
      });
    }

    fs.writeFileSync(
      path.join("static-build", platform, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
  };

  updateForPlatform("ios", manifests.ios);
  updateForPlatform("android", manifests.android);
  console.log("Manifests updated");
}

function hasExistingMobileBuild() {
  const iosManifest = path.join("static-build", "ios", "manifest.json");
  const androidManifest = path.join("static-build", "android", "manifest.json");
  if (!fs.existsSync(iosManifest) || !fs.existsSync(androidManifest)) return false;

  const dirs = fs.readdirSync("static-build").filter(d => {
    const full = path.join("static-build", d);
    return fs.statSync(full).isDirectory() && d !== "ios" && d !== "android";
  });
  if (dirs.length === 0) return false;

  const bundleDir = dirs[0];
  const iosBundle = path.join("static-build", bundleDir, "_expo", "static", "js", "ios", "bundle.js");
  const androidBundle = path.join("static-build", bundleDir, "_expo", "static", "js", "android", "bundle.js");
  return fs.existsSync(iosBundle) && fs.existsSync(androidBundle);
}

async function main() {
  console.log("Building for deployment...");

  setupSignalHandlers();

  const domain = getDeploymentDomain();
  const baseUrl = `https://${domain}`;

  if (hasExistingMobileBuild()) {
    console.log("Existing mobile build found, skipping Metro bundle download");
    if (fs.existsSync("dist/index.html")) {
      console.log("Existing web export found, skipping web export");
    } else {
      console.log("Building web export only...");
      await buildWebExport(domain);
    }
    console.log("Build complete! Deploy to:", baseUrl);
    process.exit(0);
    return;
  }

  console.log("No existing mobile build, running full build...");
  const timestamp = `${Date.now()}-${process.pid}`;

  prepareDirectories(timestamp);
  clearMetroCache();

  await startMetro(domain);

  const downloadTimeout = 300000;
  const downloadPromise = downloadBundles(timestamp);
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Overall download timeout after ${downloadTimeout / 1000} seconds. ` +
            "Metro may be struggling to generate bundles. Check Metro logs above.",
        ),
      );
    }, downloadTimeout);
  });

  await Promise.race([downloadPromise, timeoutPromise]);

  const manifests = {
    ios: generateManifest("ios", timestamp, baseUrl),
    android: generateManifest("android", timestamp, baseUrl),
  };

  console.log("Processing assets...");
  const assets = extractAssets(timestamp);
  console.log("Found", assets.length, "unique asset(s)");

  const assetsByHash = new Map();
  for (const asset of assets) {
    assetsByHash.set(asset.hash, {
      relativePath: asset.relativePath,
      filename: asset.filename,
    });
  }

  const assetCount = await downloadAssets(assets, timestamp);

  if (assetCount > 0) {
    updateBundleUrls(timestamp, baseUrl);
  }

  console.log("Updating manifests and creating landing page...");
  updateManifests(manifests, timestamp, baseUrl, assetsByHash);

  if (metroProcess) {
    metroProcess.kill();
    metroProcess = null;
  }

  console.log("Building web export...");
  await buildWebExport(domain);

  console.log("Build complete! Deploy to:", baseUrl);
  process.exit(0);
}

async function buildWebExport(domain) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      EXPO_PUBLIC_DOMAIN: domain + ":5000",
      NODE_ENV: "production",
      CI: "0",
    };

    const exportProcess = spawn("npx", ["expo", "export", "--platform", "web", "--output-dir", "dist"], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";
    exportProcess.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });
    exportProcess.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    const timeout = setTimeout(() => {
      exportProcess.kill();
      reject(new Error("Web export timed out after 120 seconds"));
    }, 120000);

    exportProcess.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log("Web export completed successfully");
        resolve();
      } else {
        console.warn("Web export failed (non-critical), app will still work via Expo Go");
        console.warn("stderr:", stderr.slice(-500));
        resolve();
      }
    });

    exportProcess.on("error", (err) => {
      clearTimeout(timeout);
      console.warn("Web export error (non-critical):", err.message);
      resolve();
    });
  });
}

main().catch((error) => {
  console.error("Build failed:", error.message);
  if (metroProcess) {
    metroProcess.kill();
  }
  process.exit(1);
});
