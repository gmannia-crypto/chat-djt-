import assert from "node:assert/strict";
import {
  HOME_PREVIEW_LIMIT, HOME_PREVIEW_PERSONAS, HOME_PREVIEW_MATCHUPS,
  HOME_PREVIEW_IDEOLOGY, getHomePreviewMatchupOptions,
  getHomePreviewOpponents, getHomePreviewText,
} from "./home-persona-preview";

const ids = new Set<string>(HOME_PREVIEW_PERSONAS.map((persona) => persona.id));
const right = new Set(["trump", "candace", "tuckercarlson", "musk"]);
const left = new Set(["berniesanders", "cornellwest", "galloway", "maponga"]);
assert(!ids.has("malcolmx"));
assert.equal(getHomePreviewText("malcolmx", "Jordan"), null);
assert.equal(HOME_PREVIEW_LIMIT, 4);
const keys = new Set<string>();
for (const [a, b] of HOME_PREVIEW_MATCHUPS) {
  assert(ids.has(a) && ids.has(b));
  assert.notEqual(a, b);
  assert(right.has(a) && left.has(b), "shuffle has opposing perspectives");
  const key = [a, b].sort().join(":");
  assert(!keys.has(key), "no duplicate matchups");
  keys.add(key);
}
const options = getHomePreviewMatchupOptions();
assert.equal(options.length, HOME_PREVIEW_MATCHUPS.length * 2);
for (const [a, b] of HOME_PREVIEW_MATCHUPS) {
  assert(options.some((p) => p.left === a && p.right === b));
  assert(options.some((p) => p.left === b && p.right === a));
}
for (const persona of HOME_PREVIEW_PERSONAS) {
  const opponents = getHomePreviewOpponents(persona.id);
  assert(opponents.length >= 2, "rotation always has an alternative");
  assert(opponents.every((id) => ids.has(id) && id !== persona.id));
  assert(HOME_PREVIEW_IDEOLOGY[persona.id]);
}
assert(keys.has(["trump", "berniesanders"].sort().join(":")));
assert(keys.has(["candace", "cornellwest"].sort().join(":")));
assert(keys.has(["candace", "maponga"].sort().join(":")));
console.log(`PASS ${HOME_PREVIEW_MATCHUPS.length} opposing matchups, reversible sides, rotation coverage, Malcolm X exclusion, and unchanged audio budget`);