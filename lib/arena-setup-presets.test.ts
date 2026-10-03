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
assert.equal(ARENA_SETUP_PRESETS.length, 6);
assert.equal(new Set(ARENA_SETUP_PRESETS.map((preset) => preset.id)).size, 6);
for (const preset of ARENA_SETUP_PRESETS) {
  assert.equal(preset.personas.length, 6, `${preset.title} has six debaters`);
  assert.equal(new Set(preset.personas).size, 6, `${preset.title} has no duplicate voices`);
  assert(preset.personas.every((id) => roster.has(id)), `${preset.title} uses registered Arena personas`);
  assert(preset.topic && preset.category, `${preset.title} keeps a real topic`);
}
console.log("PASS six optional presets, six unique registered debaters per preset, and topic/category preservation");