import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { Platform, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

const DEVICE_ID_KEY = "chatdjt_device_id";

interface TokenBalance {
  tokens: number;
  freeRemaining: number;
  isSubscribed: boolean;
  totalAvailable: number;
  subscriptionExpiresAt: string | null;
  subscriptionTier: string | null;
}

interface TokenContextValue {
  deviceId: string | null;
  balance: TokenBalance | null;
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
  hasTokens: boolean;
}

const TokenContext = createContext<TokenContextValue | null>(null);

async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `device-${Date.now()}-${Math.random().toString(36).substr(2, 12)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function generateBrowserFingerprint(): string {
  if (Platform.OS !== "web") return "";
  try {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (!nav) return "";
    const parts = [
      nav.userAgent || "",
      nav.language || "",
      (typeof screen !== "undefined" ? `${screen.width}x${screen.height}x${screen.colorDepth}` : ""),
      Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      nav.hardwareConcurrency || 0,
      (nav as any).deviceMemory || 0,
      nav.platform || "",
    ];
    const str = parts.join("|");
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return `fp-${Math.abs(hash).toString(36)}`;
  } catch {
    return "";
  }
}

export function TokenProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fingerprint = useRef(generateBrowserFingerprint());
  const timeTrackerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTrackRef = useRef(Date.now());

  useEffect(() => {
    getOrCreateDeviceId().then((id) => {
      setDeviceId(id);
    });
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!deviceId) return;
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/tokens/balance", baseUrl);
      const headers: Record<string, string> = { "x-device-id": deviceId };
      if (fingerprint.current) {
        headers["x-browser-fp"] = fingerprint.current;
      }
      const res = await fetch(url.toString(), { headers });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          return;
        }
        const data = await res.json();
        setBalance(data);
      }
    } catch (err) {
      console.warn("Token balance fetch skipped:", err?.toString?.()?.substring(0, 80));
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (deviceId) {
      refreshBalance();
    }
  }, [deviceId, refreshBalance]);

  useEffect(() => {
    if (!deviceId) return;
    lastTrackRef.current = Date.now();

    const sendTimeUpdate = async () => {
      const now = Date.now();
      const elapsed = Math.round((now - lastTrackRef.current) / 1000);
      lastTrackRef.current = now;
      if (elapsed <= 0 || elapsed > 300) return;
      try {
        const baseUrl = getApiUrl();
        const url = new URL("/api/track-time", baseUrl);
        await fetch(url.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-device-id": deviceId,
          },
          body: JSON.stringify({ seconds: elapsed }),
        });
      } catch {}
    };

    timeTrackerRef.current = setInterval(sendTimeUpdate, 60000);

    const handleAppState = (nextState: string) => {
      if (nextState === "background" || nextState === "inactive") {
        sendTimeUpdate();
      } else if (nextState === "active") {
        lastTrackRef.current = Date.now();
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("beforeunload", sendTimeUpdate);
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") sendTimeUpdate();
        else lastTrackRef.current = Date.now();
      });
    }

    return () => {
      if (timeTrackerRef.current) clearInterval(timeTrackerRef.current);
      sub.remove();
    };
  }, [deviceId]);

  const hasTokens = useMemo(() => {
    if (!balance) return true;
    return balance.totalAvailable > 0;
  }, [balance]);

  const value = useMemo(() => ({
    deviceId,
    balance,
    isLoading,
    refreshBalance,
    hasTokens,
  }), [deviceId, balance, isLoading, refreshBalance, hasTokens]);

  return (
    <TokenContext.Provider value={value}>
      {children}
    </TokenContext.Provider>
  );
}

export function useTokens() {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error("useTokens must be used within a TokenProvider");
  }
  return context;
}

export { getOrCreateDeviceId, DEVICE_ID_KEY };
