import { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";

const baseUrl = getApiUrl();

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
