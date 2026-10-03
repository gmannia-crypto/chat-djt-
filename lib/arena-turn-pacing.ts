export function arenaResponseTimeoutMs(samples: number[], consecutiveAborts = 0): number {
  const valid = samples.filter((ms) => Number.isFinite(ms) && ms > 0);
  const average = valid.length ? valid.reduce((sum, ms) => sum + ms, 0) / valid.length : 18000;
  const maximum = valid.length ? Math.max(...valid) : 18000;
  return Math.min(30000, Math.max(18000, maximum * 1.25, average * 1.6) + consecutiveAborts * 5000);
}

export function canPrepareArenaReply(state: {
  voiceEnabled: boolean;
  preparingOrPlaying: boolean;
  isCurrentLine: boolean;
  queueLength: number;
  hasPreparedReply: boolean;
  busy: boolean;
}): boolean {
  // The full current text is already known during voice synthesis. Waiting for
  // confirmed playback throws away that entire preparation window.
  return state.voiceEnabled && state.preparingOrPlaying && state.isCurrentLine &&
    state.queueLength === 0 && !state.hasPreparedReply && !state.busy;
}

export function prepareArenaAudio<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing) return existing;
  const promise = load();
  cache.set(key, promise);
  return promise;
}

/** The deadline lives around the awaited request, not in a scheduler blocked by it. */
export async function withArenaResponseDeadline<T>(
  operation: () => Promise<T>,
  controller: AbortController,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      onTimeout();
      const error = new Error("Arena response timed out");
      error.name = "AbortError";
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/** Side replies need the same independent deadline, including body reading. */
export async function requestArenaJSON(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  return withArenaResponseDeadline(async () => {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = (res.headers.get("content-type") || "").includes("application/json") ? await res.json() : null;
    return { res, data };
  }, controller, timeoutMs, () => { console.warn("Arena side reply timed out; releasing the turn"); });
}

export function arenaPlaybackStalled(now: number, lastProgressAt: number, started: boolean): boolean {
  return now - lastProgressAt >= (started ? 8000 : 12000);
}

export async function waitForArenaHandoff(
  isCurrent: () => boolean,
  audioPending: () => boolean,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<boolean> {
  while (isCurrent() && audioPending()) await sleep(50);
  return isCurrent();
}