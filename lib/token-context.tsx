import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { Platform, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

const DEVICE_ID_KEY = "chatdjt_device_id";
const SAVE_MODAL_DISMISSED_KEY = "chatdjt_save_modal_dismissed";
const REFERRAL_CACHE_OWNER_KEY = "referral_cache_owner";
export const AUTH_SESSION_KEY = "dynamic_auth_session";

interface TokenBalance {
  tokens: number;
  freeRemaining: number;
  isSubscribed: boolean;
  totalAvailable: number;
  subscriptionExpiresAt: string | null;
  subscriptionTier: string | null;
}

export interface LinkedUser {
  id: string;
  email: string;
  name: string | null;
}

interface TokenContextValue {
  deviceId: string | null;
  balance: TokenBalance | null;
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
  hasTokens: boolean;
  linkedUser: LinkedUser | null;
  requestVerificationCode: (name: string, email: string) => Promise<void>;
  verifyAccount: (email: string, code: string) => Promise<{ bonusGranted: boolean }>;
  authToken: string | null;
  showSaveModal: boolean;
  openSaveModal: () => void;
  dismissSaveModal: () => void;
}

const TokenContext = createContext<TokenContextValue | null>(null);

async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    // New ID being generated — evict any stale referral cache entries that may
    // belong to a previous device ID (e.g. after a device reset or account unlink
    // where DEVICE_ID_KEY was cleared but referral_cache_<oldId> entries remain).
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const staleReferralKeys = allKeys.filter(
        (k) => k.startsWith("referral_cache_") && k !== REFERRAL_CACHE_OWNER_KEY,
      );
      if (staleReferralKeys.length > 0) {
        await AsyncStorage.multiRemove(staleReferralKeys);
      }
      await AsyncStorage.removeItem(REFERRAL_CACHE_OWNER_KEY);
    } catch {}
    id = `device-${Date.now()}-${Math.random().toString(36).substr(2, 12)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  } else {
    // Device ID exists — check that the referral-cache owner sentinel still
    // matches this device.  If not (e.g. only the device ID key was deleted and
    // then recreated while old cache entries lingered), evict orphaned entries.
    try {
      const owner = await AsyncStorage.getItem(REFERRAL_CACHE_OWNER_KEY);
      if (owner && owner !== id) {
        const allKeys = await AsyncStorage.getAllKeys();
        const staleReferralKeys = allKeys.filter(
          (k) => k.startsWith("referral_cache_") && k !== REFERRAL_CACHE_OWNER_KEY,
        );
        if (staleReferralKeys.length > 0) {
          await AsyncStorage.multiRemove(staleReferralKeys);
        }
        await AsyncStorage.removeItem(REFERRAL_CACHE_OWNER_KEY);
      }
    } catch {}
  }
  return id;
}

export function generateBrowserFingerprint(): string {
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
  const [linkedUser, setLinkedUser] = useState<LinkedUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const fingerprint = useRef(generateBrowserFingerprint());
  const timeTrackerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTrackRef = useRef(Date.now());
  const modalShownRef = useRef(false);

  useEffect(() => {
    getOrCreateDeviceId().then((id) => {
      setDeviceId(id);
    });
    AsyncStorage.getItem(AUTH_SESSION_KEY).then(setAuthToken);
  }, []);

  // Fetch linked user on init
  useEffect(() => {
    if (!deviceId || !authToken) return;
    (async () => {
      try {
        const res = await fetch(new URL("/api/auth/me", getApiUrl()).toString(), {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) setLinkedUser(data.user);
        }
      } catch {}
    })();
  }, [deviceId, authToken]);

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
        if (!contentType.includes("application/json")) return;
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

  // Show "Save Your Chats" modal when tokens first hit zero and no account linked
  useEffect(() => {
    if (!balance || isLoading || linkedUser || modalShownRef.current) return;
    if (balance.totalAvailable === 0) {
      AsyncStorage.getItem(SAVE_MODAL_DISMISSED_KEY).then((dismissed) => {
        if (!dismissed) {
          modalShownRef.current = true;
          setShowSaveModal(true);
        }
      });
    }
  }, [balance, isLoading, linkedUser]);

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
          headers: { "Content-Type": "application/json", "x-device-id": deviceId },
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

  const requestVerificationCode = useCallback(async (name: string, email: string): Promise<void> => {
    if (!deviceId) throw new Error("No device ID");
    const res = await fetch(new URL("/api/auth/request-code", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify({ name, email }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Registration failed");
    }
  }, [deviceId]);

  const verifyAccount = useCallback(async (email: string, code: string): Promise<{ bonusGranted: boolean }> => {
    if (!deviceId) throw new Error("No device ID");
    const res = await fetch(new URL("/api/auth/verify-code", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Verification failed");
    }
    const data = await res.json();
    await AsyncStorage.setItem(AUTH_SESSION_KEY, data.sessionToken);
    setAuthToken(data.sessionToken);
    setLinkedUser(data.user);
    setShowSaveModal(false);
    await refreshBalance();
    return { bonusGranted: data.bonusGranted };
  }, [deviceId, refreshBalance]);

  const openSaveModal = useCallback(() => setShowSaveModal(true), []);

  const dismissSaveModal = useCallback(() => {
    setShowSaveModal(false);
    AsyncStorage.setItem(SAVE_MODAL_DISMISSED_KEY, "1");
  }, []);

  const value = useMemo(() => ({
    deviceId,
    balance,
    isLoading,
    refreshBalance,
    hasTokens,
    linkedUser,
    requestVerificationCode,
    verifyAccount,
    authToken,
    showSaveModal,
    openSaveModal,
    dismissSaveModal,
  }), [deviceId, balance, isLoading, refreshBalance, hasTokens, linkedUser, requestVerificationCode, verifyAccount, authToken, showSaveModal, openSaveModal, dismissSaveModal]);

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

export { getOrCreateDeviceId, DEVICE_ID_KEY, REFERRAL_CACHE_OWNER_KEY };
