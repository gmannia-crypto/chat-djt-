export type AiTurnResponse = {
  status: number;
  json: () => Promise<unknown>;
};

type AiTurnRetryOptions = {
  onRetrying: (retrying: boolean) => void;
  onUnavailable: () => void;
  onNetworkError: () => void;
  retryDelayMs?: number;
};

/**
 * Give a bounded AI turn one retry when the provider reports it is unavailable.
 * Network-level failures are terminal because there is no response to retry
 * safely. The caller owns the visible retry indicator and terminal session state.
 */
export async function fetchAiTurnWithRetry<T extends AiTurnResponse>(
  makeRequest: () => Promise<T>,
  { onRetrying, onUnavailable, onNetworkError, retryDelayMs = 900 }: AiTurnRetryOptions,
): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await makeRequest();
      if (response.status !== 503) {
        if (attempt > 0) onRetrying(false);
        return response;
      }

      await response.json().catch(() => ({}));
      if (attempt === 0) {
        onRetrying(true);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      onRetrying(false);
      onUnavailable();
      return null;
    } catch {
      onRetrying(false);
      onNetworkError();
      return null;
    }
  }

  return null;
}