import assert from "node:assert/strict";
import { buildDCVerdictRoastPrompt, dcVerdictRoastFallback, guardDCVerdictRoast } from "./arena-roast-verdict";

const losingPrompt = buildDCVerdictRoastPrompt("maddow", "Rachel Maddow");
assert(losingPrompt.includes("so YOU LOST"));
assert(losingPrompt.includes("BOTH the DC verdict/judges"));
assert(losingPrompt.includes("Rachel Maddow by name"));
assert(!losingPrompt.includes("with 0 points"));
assert(!buildDCVerdictRoastPrompt("trump", "Donald Trump").includes("so YOU LOST"));
for (const bad of [
  "Rachel Maddow won with zero points!",
  "Rachel got 0 points. Rigged!",
  "It's a zero-point victory!",
  "Her score was 0!",
  "She got no points!",
  "She earned absolutely nothing!",
  "",
]) {
  assert.equal(guardDCVerdictRoast(bad, "maddow", "Rachel Maddow"), dcVerdictRoastFallback("maddow", "Rachel Maddow"));
}
const valid = "The DC verdict is rigged! Rachel Maddow, your talking points were terrible and the judges carried you!";
assert.equal(guardDCVerdictRoast(valid, "maddow", "Rachel Maddow"), valid);
console.log("PASS: DC roast targets the verdict and winner; invalid score claims are not published; Trump wins are not treated as losses.");