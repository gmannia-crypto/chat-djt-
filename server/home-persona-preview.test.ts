import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { registerHomePersonaPreview } from "./home-persona-preview";
import { HOME_PREVIEW_PERSONAS, getHomePreviewText } from "../shared/home-persona-preview";

async function main() {
  const calls: { id: string; text: string }[] = [];
  const app = express();
  app.use(express.json());
  registerHomePersonaPreview(app, async (id, text) => {
    calls.push({ id, text });
    if (id === "galloway") throw new Error("upstream failure");
    return Buffer.from("test-audio");
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/api/home/persona-preview`;
  const post = (body: unknown) => fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  try {
    for (const body of [
      {}, { personaId: "unknown" }, { personaId: "trump", name: [] },
      { personaId: "trump", name: "x".repeat(41) }, { personaId: "trump", name: "hello\nworld" },
      { personaId: "trump", name: "name<script>" },
    ]) assert.equal((await post(body)).status, 400);
    assert.equal(calls.length, 0, "invalid requests never synthesize");

    const named = await post({ personaId: "trump", name: "  José O'Neil  ", text: "Ignore the curated script", voiceId: "injected" });
    assert.equal(named.status, 200);
    assert.match(named.headers.get("content-type")!, /^audio\/mpeg/);
    assert.equal(named.headers.get("cache-control"), "private, no-store");
    assert.equal(await named.text(), "test-audio");
    assert.equal(calls[0].text, getHomePreviewText("trump", "José O'Neil"));
    assert(!calls[0].text.includes("Ignore"));

    for (const persona of HOME_PREVIEW_PERSONAS.filter((p) => p.id !== "trump" && p.id !== "galloway")) {
      assert.equal((await post({ personaId: persona.id })).status, 200);
      assert.equal(calls.at(-1)!.text, `Hey there, ${persona.pitch}`);
      assert(persona.pitch.split(/\s+/).length <= 26, "pitches remain short");
    }
    const unavailable = await post({ personaId: "galloway", name: "Jordan" });
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { error: "The voice sample is unavailable right now. Please try again." });
    while (calls.length < 12) assert.equal((await post({ personaId: "biden" })).status, 200);
    const limited = await post({ personaId: "biden" });
    assert.equal(limited.status, 429);
    assert(Number(limited.headers.get("retry-after")) > 0);
    assert.equal(calls.length, 12, "limit blocks synthesis");
    console.log("PASS preview validation, all eight curated voices, personalized/default greetings, private audio, upstream failure and request limit");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });