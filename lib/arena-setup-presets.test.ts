import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ARENA_SETUP_PRESETS } from "./arena-setup-presets";

const arena = readFileSync(new URL("../app/arena.tsx", import.meta.url), "utf8");
const rosterSource = arena.match(/const PERSONA_IDS = \[([\s\S]*?)\];/)?.[1];
assert(rosterSource, "Arena roster is available");
const roster = new Set([...rosterSource.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
for (const addition of arena.matchAll(/PERSONA_IDS\.push\(([^)]*)\)/g)) {
  for (const id of addition[1].matchAll(/"([^"]+)"/g)) roster.add(id[1]);
}
assert.equal(ARENA_SETUP_PRESETS.length, 9);
assert.equal(new Set(ARENA_SETUP_PRESETS.map((preset) => preset.id)).size, 9);
assert.deepEqual(ARENA_SETUP_PRESETS.slice(0, 6).map((preset) => preset.id), [
  "crossfire", "climate", "borders", "ai", "press-room", "power-players",
], "existing lineup choices are preserved");
assert.deepEqual(ARENA_SETUP_PRESETS.slice(6).map((preset) => preset.id), [
  "geopolitics", "academic", "civil-rights",
], "all three requested lineups are included");
for (const preset of ARENA_SETUP_PRESETS) {
  assert.equal(preset.personas.length, 6, `${preset.title} has six debaters`);
  assert.equal(new Set(preset.personas).size, 6, `${preset.title} has no duplicate voices`);
  assert(preset.personas.every((id) => roster.has(id)), `${preset.title} uses registered Arena personas`);
  assert(preset.topic && preset.category, `${preset.title} keeps a real topic`);
}
console.log("PASS nine optional presets, six unique registered debaters per preset, existing choices preserved, and three new themed lineups");