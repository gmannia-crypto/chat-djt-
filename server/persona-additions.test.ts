import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";
import { MAPONGA_PROMPT, TRUMP_GOLF_AND_IQ_STYLE } from "./persona-additions";

async function main() {
  const routes = readFileSync("server/routes.ts", "utf8");
  const arena = readFileSync("app/arena.tsx", "utf8");
  assert.match(routes, /maponga: "00a50bc21a9e43d0bb252aa3d44e5f9f"/);
  assert.match(routes, /maponga: MAPONGA_PROMPT/);
  for (const role of ["INTERVIEWER", "INTERVIEWEE"]) {
    assert(routes.includes(`${role}_IDS.push("maponga")`));
  }
  for (const screen of ["arena", "interview", "debate-stage"]) {
    assert(readFileSync(`app/${screen}.tsx`, "utf8").includes("persona-maponga.png"));
  }
  assert(arena.includes('PERSONA_IDS.push("maponga")'));
  assert.match(MAPONGA_PROMPT, /AS INTERVIEWER/);
  assert.match(MAPONGA_PROMPT, /AS INTERVIEWEE/);
  assert.match(MAPONGA_PROMPT, /African identity/);
  for (const course of ["Doral", "Turnberry", "Aberdeen", "Doonbeg", "West Palm Beach", "Jupiter", "Los Angeles", "Bedminster"]) {
    assert(TRUMP_GOLF_AND_IQ_STYLE.includes(course));
  }
  assert.equal(routes.split("${TRUMP_GOLF_AND_IQ_STYLE}").length - 1, 2);
  assert.match(TRUMP_GOLF_AND_IQ_STYLE, /high IQ/);
  assert.match(TRUMP_GOLF_AND_IQ_STYLE, /ex-wife Ivana/);
  assert.match(TRUMP_GOLF_AND_IQ_STYLE, /does not establish that the entire golf course is tax-exempt/);

  // Execute the actual scheduler with controlled refs/timers: not a copy of its
  // condition. Audio must block ordinary turns without starting a fetch watchdog.
  const start = arena.indexOf("  const scheduleNext = useCallback(");
  const end = arena.indexOf("  useEffect(() => { scheduleNextRef.current = scheduleNext;", start);
  assert(start > 0 && end > start);
  const scheduler = arena.slice(start, end);
  for (const blockedBy of ["playing", "queued", "rapid", "muted"] as const) {
    const timers: Array<{ callback: () => unknown; delay: number }> = [];
    let turns = 0;
    const context: any = {
      useCallback: (fn: unknown) => fn,
      sessionEndedRef: { current: false },
      conversationTimerRef: { current: null },
      arenaResponseLatenciesRef: { current: [] },
      consecutiveWatchdogAbortsRef: { current: 0 },
      voiceEnabledRef: { current: blockedBy !== "muted" },
      isProcessingTTSRef: { current: blockedBy === "playing" || blockedBy === "muted" },
      ttsQueueRef: { current: blockedBy === "queued" ? [{}] : [] },
      isRapidExchangeRef: { current: blockedBy === "rapid" },
      isInterruptingRef: { current: false },
      currentSpeakerRef: { current: null },
      mountedRef: { current: true },
      isRunningRef: { current: true },
      clearTimeout: () => {},
      setTimeout: (callback: () => unknown, delay: number) => {
        timers.push({ callback, delay }); return timers.length;
      },
      decideNextSpeaker: async () => { turns++; context.isRunningRef.current = false; },
    };
    const executable = transformSync(`${scheduler}\nscheduleNext();`, { loader: "ts" }).code;
    runInNewContext(executable, context);
    if (blockedBy !== "muted") {
      assert.equal(timers.length, 1);
      assert.equal(timers[0].delay, 100);
      assert.equal(turns, 0);
      context.isProcessingTTSRef.current = false;
      context.ttsQueueRef.current = [];
      context.isRapidExchangeRef.current = false;
      timers.shift()!.callback();
    }
    const next = timers.shift()!;
    assert(next.delay >= 20 && next.delay <= 50);
    await next.callback();
    assert.equal(turns, 1, "the next turn resumes after audio drains; mute never blocks text");
  }
  console.log("PASS Maponga voice/roles/portraits, Trump golf/IQ/boast prompts, and actual Arena scheduler audio handoffs");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });