const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || "chromium",
    headless: true, args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    const errors = [], requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem("chatdjt_onboarding_done", "true");
      localStorage.setItem("chatdjt_disclaimer_accepted", "true");
      localStorage.setItem("arena_setup_design", "classic");
      localStorage.setItem("interview_voice_enabled_v1", "0");
    });
    await page.route("**/api/arena/status", (route) => route.fulfill({ json: {
      hasSession: true, freeRemaining: 15, sessionExpiresAt: Date.now() + 1800000,
    } }));
    await page.route("**/api/arena/topics**", (route) => route.fulfill({ json: {
      topics: [
        { id: "topic-one", title: "Infrastructure spending", description: "Compare investments." },
        { id: "topic-two", title: "Clean energy policy", description: "Compare energy policies." },
      ],
    } }));
    await page.route("**/api/arena/respond", (route) => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: {
        response: "Fixture debate reply.", freeRemaining: 15, hasSession: true,
        sessionExpiresAt: Date.now() + 1800000,
      } });
    });
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/arena`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const toggle = page.getByTestId("arena-full-roster-toggle");
    await toggle.waitFor({ timeout: 60000 });
    const done = page.getByRole("button", { name: "Done", exact: true });
    if (await done.count()) await done.click();
    await toggle.click();
    const panel = page.getByTestId("arena-full-roster-panel");
    const picker = panel.getByTestId("arena-roster-topic-picker");
    const start = panel.getByTestId("arena-roster-start-debate");
    await panel.getByText("Trump Only", { exact: true }).click();
    await panel.getByText("Maddow", { exact: true }).click();
    await picker.getByText("Clean energy policy", { exact: true }).waitFor();
    await picker.getByText("Create your own topic", { exact: true }).click();
    assert.equal(await start.getAttribute("aria-disabled"), "true");
    await picker.getByLabel("Custom debate topic").fill("School funding");
    await page.waitForFunction(() => document.querySelector('[data-testid="arena-roster-start-debate"]').getAttribute("aria-disabled") !== "true");
    assert((await page.getByTestId("arena-start-topic-picker-selection").innerText()).includes("School funding"));
    await picker.getByText("Random topic", { exact: true }).click();
    assert((await picker.getByTestId("arena-roster-topic-picker-selection").innerText()).includes("Random topic"));
    await picker.getByText("Clean energy policy", { exact: true }).click();
    assert((await page.getByTestId("arena-start-topic-picker-selection").innerText()).includes("Clean energy policy"));
    // The topic choices must precede the roster Start control, inside its panel.
    assert(await picker.evaluate((element) => !!(element.compareDocumentPosition(document.querySelector('[data-testid="arena-roster-start-debate"]')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    await start.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/arena-topics-start-verified.jpg" });
    await start.click();
    await panel.waitFor({ state: "hidden" });
    const skip = page.getByText("TAP TO SKIP", { exact: true });
    if (await skip.count()) await skip.click();
    for (let i = 0; i < 100 && !requests.length; i++) await page.waitForTimeout(100);
    assert(requests.length > 0, "debate starts");
    assert.equal(requests[0].topic, "Clean energy policy");
    assert.equal(requests[0].activePersonas.length, 2);
    assert.deepEqual(errors, []);
    console.log("PASS: visible topics above Start; custom/blank/random selection; synchronized pickers; selected topic reaches the two-person debate.");
    await page.unrouteAll({ behavior: "ignoreErrors" });
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });