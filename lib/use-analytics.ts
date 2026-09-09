import { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";

const baseUrl = getApiUrl();

type UmamiData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: UmamiData): void;
    };
  }
}

/**
 * Fires a custom analytics event to Replit-hosted (Umami) analytics.
 * Safe no-op on native platforms, in dev, or before the injected tracker loads.
 * Use snake_case names under 50 chars; keep data values to string/number/boolean.
 */
export function trackAnalyticsEvent(name: string, data?: UmamiData): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never break the app.
  }
}

function sendBeacon(path: string, body: any) {
  fetch(new URL(path, baseUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/** Extract utm_source from the current URL's query string (web only). */
function getWebUtmSource(): string | undefined {
  if (Platform.OS !== "web") return undefined;
  try {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    return params.get("utm_source") || undefined;
  } catch {
    return undefined;
  }
}

export function useScreenTracker(screenName: string) {
  const { deviceId } = useTokens();
  const startTimeRef = useRef(Date.now());
  const screenRef = useRef(screenName);
  // Capture utm_source once on mount; it won't change during the session
  const utmSourceRef = useRef<string | undefined>(getWebUtmSource());

  useEffect(() => {
    screenRef.current = screenName;
    startTimeRef.current = Date.now();

    if (deviceId) {
      sendBeacon("/api/analytics/pageview", {
        deviceId,
        screen: screenName,
        durationSeconds: 0,
        ...(utmSourceRef.current ? { utmSource: utmSourceRef.current } : {}),
      });
    }

    const handleAppState = (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        if (deviceId && duration > 0) {
          sendBeacon("/api/analytics/pageview", {
            deviceId,
            screen: screenRef.current,
            durationSeconds: duration,
          });
        }
      }
      if (state === "active") {
        startTimeRef.current = Date.now();
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => {
      sub.remove();
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (deviceId && duration > 2) {
        sendBeacon("/api/analytics/pageview", {
          deviceId,
          screen: screenRef.current,
          durationSeconds: duration,
        });
      }
    };
  }, [screenName, deviceId]);
}

export function useTrackEvent() {
  const { deviceId } = useTokens();

  return useCallback(
    (feature: string, action: string, metadata?: any) => {
      if (!deviceId) return;
      sendBeacon("/api/analytics/event", {
        deviceId,
        feature,
        action,
        metadata: metadata || {},
      });
    },
    [deviceId]
  );
}

/**
 * Shared convention for tracking bonus mini-games / bonus offers (e.g. app/game.tsx's
 * putting and three-point offers) so every game shows up together in the admin
 * "Bonus Mini-Games" report (server/analytics.ts's getBonusGameStats) without any
 * server-side registration of game ids.
 *
 * Any new mini-game should call this with the SAME `game` id across all three of its
 * lifecycle events:
 *   - trackBonusGame(trackEvent, gameId, "started")                       — offer opened/tapped
 *   - trackBonusGame(trackEvent, gameId, "completed", { outcome: "..." }) — attempt resolved
 *   - trackBonusGame(trackEvent, gameId, "forfeited")                     — closed early, no result
 *
 * `gameId` should be a short stable slug (e.g. "putting", "threePoint") unique to that
 * game. Add a friendly label for it in app/admin.tsx's BONUS_GAME_LABELS if you want
 * something nicer than the raw id shown in the dashboard.
 */
export type BonusGameAction = "started" | "completed" | "forfeited";

export function trackBonusGame(
  trackEvent: ReturnType<typeof useTrackEvent>,
  gameId: string,
  action: BonusGameAction,
  extra?: Record<string, string | number | boolean>
) {
  trackEvent("bonus_game", action, { game: gameId, ...(extra || {}) });
}
