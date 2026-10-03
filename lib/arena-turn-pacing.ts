export function arenaResponseTimeoutMs(samples: number[], consecutiveAborts = 0): number {
  const valid = samples.filter((ms) => Number.isFinite(ms) && ms > 0);
  const average = valid.length ? valid.reduce((sum, ms) => sum + ms, 0) / valid.length : 18000;
  const maximum = valid.length ? Math.max(...valid) : 18000;
  return Math.min(30000, Math.max(18000, maximum * 1.25, average * 1.6) + consecutiveAborts * 5000);
}

export function arenaPreparationLeadMs(samples: number[]): number {
  // Cover response generation and voice synthesis, but only prepare ONE reply.
  const valid = samples.filter((ms) => Number.isFinite(ms) && ms > 0);
  return Math.min(25000, Math.max(10000, (valid.length ? Math.max(...valid) : 16000) + 4000));
}

export function canPrepareArenaReply(state: {
  voiceEnabled: boolean;
  confirmedPlaying: boolean;
  isCurrentLine: boolean;
  remainingMs: number;
  leadMs: number;
  queueLength: number;
  hasPreparedReply: boolean;
  busy: boolean;
}): boolean {
  return state.voiceEnabled && state.confirmedPlaying && state.isCurrentLine &&
    state.remainingMs > 0 && state.remainingMs <= state.leadMs &&
    state.queueLength === 0 && !state.hasPreparedReply && !state.busy;
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