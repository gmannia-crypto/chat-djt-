#!/usr/bin/env node
/**
 * Regression checks for the bounded AI-turn retry used by interview.tsx and
 * debate-stage.tsx.
 *
 * Run:
 *   npx tsx lib/ai-turn-retry.test.ts
 */

import { fetchAiTurnWithRetry, type AiTurnResponse } from "./ai-turn-retry.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed += 1;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed += 1;
  }
}

function response(status: number, body: unknown = {}): AiTurnResponse {
  return {
    status,
    json: async () => body,
  };
}

async function runScenario(
  endpoint: string,
  responses: AiTurnResponse[],
): Promise<{
  result: AiTurnResponse | null;
  calls: string[];
  retryStates: boolean[];
  unavailable: number;
}> {
  const calls: string[] = [];
  const retryStates: boolean[] = [];
  let unavailable = 0;

  const result = await fetchAiTurnWithRetry(
    async () => {
      calls.push(endpoint);
      const next = responses.shift();
      if (!next) throw new Error("mock response queue exhausted");
      return next;
    },
    {
      retryDelayMs: 0,
      onRetrying: (retrying) => retryStates.push(retrying),
      onUnavailable: () => { unavailable += 1; },
    },
  );

  return { result, calls, retryStates, unavailable };
}

async function main(): Promise<void> {
  for (const endpoint of ["/api/arena/interview-question", "/api/arena/interview-answer"]) {
    console.log(`\n${endpoint}: two consecutive provider failures`);
    const failure = await runScenario(endpoint, [
      response(503, { error: "ai_unavailable" }),
      response(503, { error: "ai_unavailable" }),
    ]);
    assert(failure.calls.length === 2, "the failed request is attempted once and retried once");
    assert(failure.retryStates.join(",") === "true,false", "retry status appears, then clears on termination");
    assert(failure.result === null, "the second failure ends the turn");
    assert(failure.unavailable === 1, "the unavailable callback runs exactly once");

    console.log(`${endpoint}: provider recovers on retry`);
    const recovery = await runScenario(endpoint, [
      response(503, { error: "ai_unavailable" }),
      response(200, { question: "Recovered turn" }),
    ]);
    assert(recovery.calls.length === 2, "the successful retry is attempted");
    assert(recovery.result?.status === 200, "the successful retry continues the session");
    assert(recovery.retryStates.join(",") === "true,false", "retry status clears after recovery");
    assert(recovery.unavailable === 0, "recovery does not end the session");
  }

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log(`\n${passed} assertions passed.`);
  }
}

void main();