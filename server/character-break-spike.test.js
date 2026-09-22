#!/usr/bin/env node
/**
 * character-break-spike.test.js
 *
 * Unit test: detectCharacterBreakSpikes() (server/character-break-alerts.ts) — the pure
 * threshold logic behind the proactive "Character Break Watch" spike alert. No database
 * required; this exercises the pure function directly with synthetic inputs.
 *
 * Run:
 *   npx tsx server/character-break-spike.test.js
 *   npm run test:character-break-spike
 */

import { detectCharacterBreakSpikes } from "./character-break-alerts.ts";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.error(`  \u2717 FAIL: ${message}`);
    failed++;
  }
}

function findSpike(spikes, persona) {
  return spikes.find((s) => s.persona === persona);
}

console.log("\nClear spike — well above both multiplier and absolute-increase thresholds:");
{
  const spikes = detectCharacterBreakSpikes([
    { persona: "carlin", todayCount: 30, baselineDailyAvg: 5 },
  ]);
  assert(!!findSpike(spikes, "carlin"), "carlin is flagged (6x baseline, +25 absolute)");
  assert(findSpike(spikes, "carlin").multiplier === 6, "multiplier is computed as today/baseline");
}

console.log("\nSteady persona — proportionally higher but still low absolute volume:");
{
  // 3x baseline, but only +2 absolute events — must NOT alert (noise on a quiet persona).
  const spikes = detectCharacterBreakSpikes([
    { persona: "quiet-persona", todayCount: 3, baselineDailyAvg: 1 },
  ]);
  assert(!findSpike(spikes, "quiet-persona"), "low absolute-volume persona is not flagged despite a high multiplier");
}

console.log("\nMild bump — multiplier below threshold:");
{
  const spikes = detectCharacterBreakSpikes([
    { persona: "obama", todayCount: 10, baselineDailyAvg: 5 },
  ]);
  assert(!findSpike(spikes, "obama"), "a 2x bump under the 3x threshold is not flagged");
}

console.log("\nNo baseline history — requires a higher absolute bar:");
{
  const spikesLow = detectCharacterBreakSpikes([
    { persona: "brand-new-persona", todayCount: 6, baselineDailyAvg: 0 },
  ]);
  assert(!findSpike(spikesLow, "brand-new-persona"), "a modest count with zero baseline history is not flagged");

  const spikesHigh = detectCharacterBreakSpikes([
    { persona: "brand-new-persona", todayCount: 15, baselineDailyAvg: 0 },
  ]);
  const spike = findSpike(spikesHigh, "brand-new-persona");
  assert(!!spike, "a clearly high count with zero baseline history is still flagged");
  assert(spike.multiplier === null, "multiplier is null when there is no baseline to divide by");
}

console.log("\nBelow the absolute floor — never flagged regardless of multiplier:");
{
  const spikes = detectCharacterBreakSpikes([
    { persona: "tiny-persona", todayCount: 4, baselineDailyAvg: 0.1 },
  ]);
  assert(!findSpike(spikes, "tiny-persona"), "todayCount under SPIKE_MIN_TODAY_COUNT is never flagged");
}

console.log("\nMultiple personas — only the spiking one is returned:");
{
  const spikes = detectCharacterBreakSpikes([
    { persona: "steady", todayCount: 6, baselineDailyAvg: 5 },
    { persona: "spiking", todayCount: 40, baselineDailyAvg: 4 },
  ]);
  assert(spikes.length === 1, "exactly one spike is detected across the batch");
  assert(!!findSpike(spikes, "spiking"), "the spiking persona is the one flagged");
  assert(!findSpike(spikes, "steady"), "the steady persona is not flagged");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
