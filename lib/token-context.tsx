import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
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

export function TokenProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      const res = await fetch(url.toString(), {
        headers: { "x-device-id": deviceId },
      });
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
