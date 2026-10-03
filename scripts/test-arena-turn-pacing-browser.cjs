// Runs the real Expo queue with local AI/audio fixtures, never paid AI/TTS calls.
// CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/test-arena-turn-pacing-browser.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
const { execFileSync } = require("node:child_process");
const mp3 = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=22050:duration=20", "-c:a", "libmp3lame", "-b:a", "32k", "-f", "mp3", "pipe:1"]).toString("base64");
const shortMp3 = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=22050:duration=4", "-c:a", "libmp3lame", "-b:a", "32k", "-f", "mp3", "pipe:1"]).toString("base64");

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

async function closePage(page) {
  await page.unrouteAll({ behavior: "ignoreErrors" }); // Lookahead can still be in flight at test teardown.
  await page.close();
}

async function session(browser, { voice = true, hungOpening = false, forbidden = false, real = false, rapid = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  const requests = [], errors = [], audioRequests = [], rapidRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(({ voice, mp3, shortMp3, real, rapid }) => {
    localStorage.setItem("chatdjt_onboarding_done", "true");
    localStorage.setItem("chatdjt_disclaimer_accepted", "true");
    localStorage.setItem("arena_setup_design", "classic");
    localStorage.setItem("interview_voice_enabled_v1", voice ? "1" : "0");
    Math.random = () => rapid ? 0.01 : 0.99;
    window.flowAudio = [];
    window.flowMedia = [];
    window.flowTTS = [];
    const actualFetch = window.fetch;
    window.fetch = async function (input, init) {
      const url = typeof input === "string" ? input : input.url;
      if (url?.includes("/api/persona-speak")) {
        const entry = { at: Date.now(), finishedAt: null, text: new URL(url).searchParams.get("text") };
        window.flowTTS.push(entry);
        if (real) {
          const response = await actualFetch.call(this, input, init);
          if (!response.ok || !response.body) return response;
          const reader = response.body.getReader();
          return new Response(new ReadableStream({
            async pull(controller) {
              try {
                const part = await reader.read();
                if (part.done) { entry.finishedAt = Date.now(); controller.close(); }
                else controller.enqueue(part.value);
              } catch (error) { controller.error(error); }
            },
            cancel() { return reader.cancel(); },
          }), { status: response.status, headers: response.headers });
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const short = entry.text?.startsWith("Rapid fixture");
        const bytes = Uint8Array.from(atob(short ? shortMp3 : mp3), (c) => c.charCodeAt(0));
        const size = Math.ceil(bytes.length / 4);
        const stream = new ReadableStream({
          async start(controller) {
            try {
              if (short) {
                controller.enqueue(bytes);
                entry.finishedAt = Date.now(); controller.close(); return;
              }
              for (let i = 0; i < bytes.length; i += size) {
                if (i) await new Promise((resolve) => setTimeout(resolve, 4000));
                controller.enqueue(bytes.slice(i, i + size));
              }
              entry.finishedAt = Date.now();
              controller.close();
            } catch {} // Cancellation is expected on stop/recovery.
          },
        });
        return new Response(stream, { headers: { "content-type": "audio/mpeg" } });
      }
      return actualFetch.call(this, input, init);
    };
    const play = HTMLMediaElement.prototype.play;
    const observed = new WeakSet();
    HTMLMediaElement.prototype.play = function () {
      if (!observed.has(this) && (this.src.startsWith("blob:") || this.src.includes("audio/wav") || this.src.includes("persona-speak"))) {
        observed.add(this); // Expo may call play() repeatedly on the same sound.
        const clip = { startedAt: null, endedAt: null, lastTime: 0, duration: this.duration, pauses: [] };
        this.addEventListener("playing", () => {
          if (clip.startedAt) return;
          clip.startedAt = Date.now();
          window.flowAudio.push(clip);
          window.flowMedia.push(this); // Expo's audio elements are detached from the DOM.
        }, true);
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
  }, { voice, mp3, shortMp3, real, rapid });
  const json = (route, data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
  await page.route("**/api/arena/status", (route) => json(route, {
    hasSession: true, freeRemaining: 15, sessionExpiresAt: Date.now() + 1800000,
  }));
  await page.route("**/api/persona-speak**", async (route) => {
    audioRequests.push(route.request().url());
    if (real) return route.continue();
    await sleep(voice ? 1500 : 0);
    await route.fulfill({ status: 200, contentType: "audio/wav", body: wav() });
  });
  await page.route("**/api/arena/respond", async (route) => {
    const body = route.request().postDataJSON();
    const index = requests.length + 1;
    requests.push({ at: Date.now(), body });
    if (real) {
      try {
        const response = await route.fetch();
        const data = await response.json();
        requests[index - 1].response = data.response;
        return await route.fulfill({ response });
      } catch (error) { if (!page.isClosed()) throw error; }
      return;
    }
    if (hungOpening && index === 1) return; // Browser's own request deadline must recover.
    if (forbidden) return json(route, { error: "arena_locked", freeRemaining: 0 }, 403);
    await sleep(voice ? 4000 : 300);
    await json(route, {
      response: `Timing fixture turn ${index}. Public infrastructure can be compared using measurable outcomes. The evidence includes investment, maintenance and accessibility.`,
      freeRemaining: 15, hasSession: true, sessionExpiresAt: Date.now() + 1800000,
    });
  });
  if (!real) await page.route("**/api/arena/rapid-exchange", async (route) => {
    const body = route.request().postDataJSON();
    rapidRequests.push({ at: Date.now(), body });
    await sleep(4000);
    await json(route, { lines: [
      { personaId: body.personaBId, text: "Rapid fixture one. Show the evidence." },
      { personaId: body.personaAId, text: "Rapid fixture two. Compare the outcomes." },
      { personaId: body.personaBId, text: "Rapid fixture three. Explain your conclusion." },
    ] });
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
  return { page, requests, errors, audioRequests, rapidRequests };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || "chromium",
    headless: true, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const real = process.env.ARENA_REAL_PROVIDER === "1";
    const live = await session(browser, { real });
    await until(() => live.page.evaluate(() => window.flowAudio.length >= 1));
    await until(() => live.requests.length >= 2);
    const first = (await live.page.evaluate(() => window.flowAudio))[0];
    assert(live.requests[1].at < first.startedAt, "prepare next reply during current TTS synthesis, before playback");
    const tts = await live.page.evaluate(() => window.flowTTS);
    assert(!tts[0].finishedAt || first.startedAt < tts[0].finishedAt, "actual audio starts before synthesis response is complete");
    assert.notEqual(live.requests[0].body.responderId, live.requests[1].body.responderId);
    assert.equal(live.requests[1].body.toSpeakerId, live.requests[0].body.responderId);
    assert.equal(live.requests[0].body.activePersonas.length, 6);
    await sleep(6000);
    const nextText = real ? live.requests[1].response : "Timing fixture turn 2";
    if (nextText) assert(!(await live.page.locator("body").innerText()).includes(nextText), "transcript cannot run ahead");
    await until(() => live.page.evaluate(() => window.flowAudio.length >= 2));
    const clips = await live.page.evaluate(() => window.flowAudio);
    assert(clips[0].endedAt, "first clip completes instead of being interrupted");
    const gap = clips[1].startedAt - clips[0].endedAt;
    assert(gap >= 0 && gap < 1500, `prepared handoff gap ${gap}ms`);
    if (real) {
      await until(() => live.page.evaluate(() => window.flowAudio.length >= 3), 120000);
      const played = await live.page.evaluate(() => window.flowAudio);
      const secondGap = played[2].startedAt - played[1].endedAt;
      assert(played[1].endedAt && secondGap >= 0 && secondGap < 1500, `real second handoff gap ${secondGap}ms`);
      assert.equal(live.errors.length, 0, live.errors.join("\n"));
      await live.page.screenshot({ path: "/tmp/arena-real-flow-verified.jpg" });
      console.log(`PASS REAL providers: three audible turns, ${gap}ms / ${secondGap}ms handoffs; first voice starts before synthesis response ends.`);
      await closePage(live.page);
      return;
    }
    // Simulate stalled playback: the recovery check must release this turn.
    await until(() => live.requests.length >= 3 && live.page.evaluate(() => window.flowMedia[1].currentTime > 5));
    await live.page.evaluate(() => window.flowMedia[1].pause());
    await until(() => live.page.evaluate(() => window.flowAudio.length >= 3), 20000);
    assert.equal(live.errors.length, 0, live.errors.join("\n"));
    console.log(`PASS six-person spoken flow: preparation during playback, ordered transcript, ${gap}ms handoff, and recovery after stalled audio.`);
    await live.page.screenshot({ path: "/tmp/arena-flow-verified.jpg" });
    await closePage(live.page);

    const rapid = await session(browser, { rapid: true });
    await until(() => rapid.rapidRequests.length > 0);
    await until(() => rapid.page.evaluate(() => window.flowAudio.length >= 4), 120000);
    const burst = await rapid.page.evaluate(() => window.flowAudio);
    assert(rapid.rapidRequests[0].at < burst[0].endedAt, "rapid API starts before the previous speech ends");
    for (let i = 1; i < 4; i++) {
      assert(burst[i - 1].endedAt, "rapid speech cannot be cut off at an estimated streaming duration");
      assert(burst[i].startedAt - burst[i - 1].endedAt < 1500, "no cold-fetch gap between rapid voices");
    }
    assert.equal(rapid.errors.length, 0, rapid.errors.join("\n"));
    console.log("PASS rapid exchange prepares during prior speech and all voices finish before the next starts.");
    await closePage(rapid.page);

    const muted = await session(browser, { voice: false, hungOpening: true });
    await until(() => muted.requests.length >= 3, 40000);
    assert.equal(muted.audioRequests.length, 0);
    assert.equal(await muted.page.evaluate(() => window.flowTTS.length), 0);
    assert.equal(muted.errors.length, 0, muted.errors.join("\n"));
    console.log("PASS hung opening recovers and muted text keeps advancing without TTS.");
    await closePage(muted.page);

    const locked = await session(browser, { voice: false, forbidden: true });
    await sleep(2500);
    assert.equal(locked.requests.length, 1, "403 is authoritative and must not be retried as an AI failure");
    assert.equal(locked.errors.length, 0, locked.errors.join("\n"));
    console.log("PASS 403 stops the loop without bypassing session authorization.");
    await closePage(locked.page);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });