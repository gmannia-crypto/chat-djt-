// Runs the real Expo queue with local AI/audio fixtures, never paid AI/TTS calls.
// CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/test-arena-turn-pacing-browser.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");

function wav(seconds = 15) {
  const sampleRate = 8000, bytes = seconds * sampleRate * 2;
  const buffer = Buffer.alloc(44 + bytes);
  buffer.write("RIFF"); buffer.writeUInt32LE(36 + bytes, 4); buffer.write("WAVE", 8);
  buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(bytes, 40);
  return buffer;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for Arena playback");
    await sleep(100);
  }
}

async function session(browser, { voice = true, hungOpening = false, forbidden = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  const requests = [], errors = [], audioRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(({ voice }) => {
    localStorage.setItem("chatdjt_onboarding_done", "true");
    localStorage.setItem("chatdjt_disclaimer_accepted", "true");
    localStorage.setItem("arena_setup_design", "classic");
    localStorage.setItem("interview_voice_enabled_v1", voice ? "1" : "0");
    Math.random = () => 0.99; // Avoid random interruptions/rapid exchanges in this timing check.
    window.flowAudio = [];
    window.flowMedia = [];
    const play = HTMLMediaElement.prototype.play;
    const observed = new WeakSet();
    HTMLMediaElement.prototype.play = function () {
      if (!observed.has(this) && (this.src.includes("audio/wav") || this.src.includes("persona-speak"))) {
        observed.add(this); // Expo may call play() repeatedly on the same sound.
        window.flowMedia.push(this); // Expo's audio elements are detached from the DOM.
        const clip = { startedAt: Date.now(), endedAt: null, lastTime: 0, duration: this.duration, pauses: [] };
        window.flowAudio.push(clip);
        this.addEventListener("ended", () => { clip.endedAt = Date.now(); }, { once: true, capture: true });
        this.addEventListener("timeupdate", () => {
          // Expo's target-phase handler unloads/reset the element on completion.
          // Observe the real ending in capture phase before that reset.
          if (Number.isFinite(this.duration)) {
            clip.lastTime = this.currentTime;
            clip.duration = this.duration;
            if (this.ended) clip.endedAt = Date.now();
          }
        }, true);
        this.addEventListener("pause", () => { clip.pauses.push({ at: Date.now(), time: this.currentTime }); });
      }
      return play.call(this);
    };
  }, { voice });
  const json = (route, data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
  await page.route("**/api/arena/status", (route) => json(route, {
    hasSession: true, freeRemaining: 15, sessionExpiresAt: Date.now() + 1800000,
  }));
  await page.route("**/api/persona-speak**", async (route) => {
    audioRequests.push(route.request().url());
    await sleep(voice ? 1500 : 0);
    await route.fulfill({ status: 200, contentType: "audio/wav", body: wav() });
  });
  await page.route("**/api/arena/respond", async (route) => {
    const body = route.request().postDataJSON();
    const index = requests.length + 1;
    requests.push({ at: Date.now(), body });
    if (hungOpening && index === 1) return; // Browser's own request deadline must recover.
    if (forbidden) return json(route, { error: "arena_locked", freeRemaining: 0 }, 403);
    await sleep(voice ? 4000 : 300);
    await json(route, {
      response: `Timing fixture turn ${index}. Public infrastructure can be compared using measurable outcomes. The evidence includes investment, maintenance and accessibility.`,
      freeRemaining: 15, hasSession: true, sessionExpiresAt: Date.now() + 1800000,
    });
  });
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/arena`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("arena-full-roster-toggle").waitFor({ timeout: 60000 });
  const done = page.getByRole("button", { name: "Done", exact: true });
  if (await done.count()) await done.click();
  const music = page.getByTestId("setup-music-toggle");
  if ((await music.innerText()).includes("MUSIC ON")) await music.click();
  await page.getByTestId("arena-preset-crossfire").click();
  await page.getByText("START DEBATE", { exact: true }).click();
  const skip = page.getByText("TAP TO SKIP", { exact: true });
  if (await skip.count()) await skip.click();
  await until(() => requests.length > 0);
  return { page, requests, errors, audioRequests };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || "chromium",
    headless: true, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const live = await session(browser);
    await until(() => live.page.evaluate(() => window.flowAudio.length >= 1));
    await until(() => live.requests.length >= 2);
    const first = (await live.page.evaluate(() => window.flowAudio))[0];
    assert(live.requests[1].at >= first.startedAt && !first.endedAt, "prepare reply while first clip is playing");
    assert.notEqual(live.requests[0].body.responderId, live.requests[1].body.responderId);
    assert.equal(live.requests[1].body.toSpeakerId, live.requests[0].body.responderId);
    assert.equal(live.requests[0].body.activePersonas.length, 6);
    await sleep(6000);
    assert(!(await live.page.locator("body").innerText()).includes("Timing fixture turn 2"), "transcript cannot run ahead");
    await until(() => live.page.evaluate(() => window.flowAudio.length >= 2));
    const clips = await live.page.evaluate(() => window.flowAudio);
    assert(clips[0].endedAt, "first clip completes instead of being interrupted");
    const gap = clips[1].startedAt - clips[0].endedAt;
    assert(gap >= 0 && gap < 1500, `prepared handoff gap ${gap}ms`);
    // Simulate stalled playback: the recovery check must release this turn.
    await until(() => live.requests.length >= 3 && live.page.evaluate(() => window.flowMedia[1].currentTime > 5));
    await live.page.evaluate(() => window.flowMedia[1].pause());
    await until(() => live.page.evaluate(() => window.flowAudio.length >= 3), 20000);
    assert.equal(live.errors.length, 0, live.errors.join("\n"));
    console.log(`PASS six-person spoken flow: preparation during playback, ordered transcript, ${gap}ms handoff, and recovery after stalled audio.`);
    await live.page.screenshot({ path: "/tmp/arena-flow-verified.jpg" });
    await live.page.close();

    const muted = await session(browser, { voice: false, hungOpening: true });
    await until(() => muted.requests.length >= 3, 40000);
    assert.equal(muted.audioRequests.length, 0);
    assert.equal(muted.errors.length, 0, muted.errors.join("\n"));
    console.log("PASS hung opening recovers and muted text keeps advancing without TTS.");
    await muted.page.close();

    const locked = await session(browser, { voice: false, forbidden: true });
    await sleep(2500);
    assert.equal(locked.requests.length, 1, "403 is authoritative and must not be retried as an AI failure");
    assert.equal(locked.errors.length, 0, locked.errors.join("\n"));
    console.log("PASS 403 stops the loop without bypassing session authorization.");
    await locked.page.close();
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });