import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { trackAnalyticsEvent } from "@/lib/use-analytics";

export interface PremiumPersonaConfig {
  name: string;
  tier: "legend" | "scholar" | "rising";
  tokenPrice: number;
  timeMinutes: number;
  challengeWins: number;
  hidden: boolean;
  badge: string;
  badgeColor: string;
  description: string;
}

export const PREMIUM_PERSONA_CONFIGS: Record<string, PremiumPersonaConfig> = {
  drbenj: {
    name: "Dr. Ben Jochannan",
    tier: "scholar",
    tokenPrice: 20,
    timeMinutes: 120,
    challengeWins: 3,
    hidden: true,
    badge: "PAN-AFRICAN SCHOLAR",
    badgeColor: "#C0A020",
    description: "Dr. Ben brings millennia of stolen history back to the floor.",
  },
  pressley: {
    name: "Ayanna Pressley",
    tier: "rising",
    tokenPrice: 15,
    timeMinutes: 60,
    challengeWins: 1,
    hidden: false,
    badge: "THE SQUAD",
    badgeColor: "#4ADE80",
    description: "The people closest to the pain are closest to the solution.",
  },
};

export const PREMIUM_UNLOCKED_KEY = "premium_personas_unlocked_v2";
export const SESSION_MINUTES_KEY = "chatdjt_total_session_minutes_v1";
export const ARENA_WINS_KEY = "chatdjt_arena_challenge_wins_v1";
// Consumable: IDs written here when any code path auto-unlocks a premium persona.
// The picker reads + clears this key on focus to show the "Just unlocked!" badge.
export const RECENTLY_UNLOCKED_BADGE_KEY = "persona_recently_unlocked_badge_v1";

interface PersonaLocksContextValue {
  unlockedPremium: string[];
  sessionMinutes: number;
  arenaWins: number;
  isUnlocking: string | null;
  unlockWithTokens: (personaId: string, deviceId: string, refreshBalance: () => Promise<void>) => Promise<boolean>;
  checkAutoUnlocks: () => Promise<string[]>;
  addSessionMinutes: (minutes: number) => Promise<void>;
  addArenaWin: () => Promise<string[]>;
  isLocked: (personaId: string) => boolean;
  isHidden: (personaId: string) => boolean;
}

const PersonaLocksContext = createContext<PersonaLocksContextValue | null>(null);

export function PersonaLocksProvider({ children }: { children: ReactNode }) {
  const [unlockedPremium, setUnlockedPremium] = useState<string[]>([]);
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [arenaWins, setArenaWins] = useState(0);
  const [isUnlocking, setIsUnlocking] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [uRaw, mRaw, wRaw] = await Promise.all([
          AsyncStorage.getItem(PREMIUM_UNLOCKED_KEY),
          AsyncStorage.getItem(SESSION_MINUTES_KEY),
          AsyncStorage.getItem(ARENA_WINS_KEY),
        ]);
        if (uRaw) setUnlockedPremium(JSON.parse(uRaw));
        if (mRaw) setSessionMinutes(parseInt(mRaw, 10) || 0);
        if (wRaw) setArenaWins(parseInt(wRaw, 10) || 0);
      } catch {}
    })();
  }, []);

  const checkAutoUnlocks = useCallback(async (): Promise<string[]> => {
    try {
      const [mRaw, wRaw, uRaw] = await Promise.all([
        AsyncStorage.getItem(SESSION_MINUTES_KEY),
        AsyncStorage.getItem(ARENA_WINS_KEY),
        AsyncStorage.getItem(PREMIUM_UNLOCKED_KEY),
      ]);
      const minutes = parseInt(mRaw || "0", 10);
      const wins = parseInt(wRaw || "0", 10);
      const unlocked: string[] = uRaw ? JSON.parse(uRaw) : [];
      const newlyUnlocked: string[] = [];
      for (const [id, cfg] of Object.entries(PREMIUM_PERSONA_CONFIGS)) {
        if (unlocked.includes(id)) continue;
        if (minutes >= cfg.timeMinutes || wins >= cfg.challengeWins) {
          unlocked.push(id);
          newlyUnlocked.push(id);
        }
      }
      if (newlyUnlocked.length > 0) {
        // Persist the newly unlocked list
        await AsyncStorage.setItem(PREMIUM_UNLOCKED_KEY, JSON.stringify(unlocked));
        setUnlockedPremium([...unlocked]);
        // Append to the consumable badge key so any picker can show the badge even
        // when it wasn't the code path that triggered the unlock (e.g. Arena win).
        const prevRaw = await AsyncStorage.getItem(RECENTLY_UNLOCKED_BADGE_KEY);
        const prev: string[] = prevRaw ? JSON.parse(prevRaw) : [];
        const merged = Array.from(new Set([...prev, ...newlyUnlocked]));
        await AsyncStorage.setItem(RECENTLY_UNLOCKED_BADGE_KEY, JSON.stringify(merged));
      }
      return newlyUnlocked;
    } catch {
      return [];
    }
  }, []);

  const addSessionMinutes = useCallback(async (minutes: number) => {
    try {
      const raw = await AsyncStorage.getItem(SESSION_MINUTES_KEY);
      const updated = (parseInt(raw || "0", 10)) + minutes;
      await AsyncStorage.setItem(SESSION_MINUTES_KEY, String(updated));
      setSessionMinutes(updated);
      await checkAutoUnlocks();
    } catch {}
  }, [checkAutoUnlocks]);

  const addArenaWin = useCallback(async (): Promise<string[]> => {
    try {
      const raw = await AsyncStorage.getItem(ARENA_WINS_KEY);
      const updated = (parseInt(raw || "0", 10)) + 1;
      await AsyncStorage.setItem(ARENA_WINS_KEY, String(updated));
      setArenaWins(updated);
      return await checkAutoUnlocks();
    } catch {
      return [];
    }
  }, [checkAutoUnlocks]);

  const unlockWithTokens = useCallback(async (
    personaId: string,
    deviceId: string,
    refreshBalance: () => Promise<void>,
  ): Promise<boolean> => {
    const cfg = PREMIUM_PERSONA_CONFIGS[personaId];
    if (!cfg || isUnlocking) return false;
    setIsUnlocking(personaId);
    try {
      const res = await fetch(new URL("/api/use-token", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ amount: cfg.tokenPrice, reason: `Unlock ${cfg.name}` }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert(
          "Not Enough Tokens",
          data.error || `You need ${cfg.tokenPrice} tokens to unlock ${cfg.name}.`,
        );
        return false;
      }
      const raw = await AsyncStorage.getItem(PREMIUM_UNLOCKED_KEY);
      const current: string[] = raw ? JSON.parse(raw) : [];
      if (!current.includes(personaId)) {
        const updated = [...current, personaId];
        await AsyncStorage.setItem(PREMIUM_UNLOCKED_KEY, JSON.stringify(updated));
        setUnlockedPremium(updated);
      }
      await refreshBalance();
      trackAnalyticsEvent("persona_unlocked", {
        persona_id: personaId,
        token_price: cfg.tokenPrice,
      });
      return true;
    } catch {
      Alert.alert("Error", "Unlock failed. Please try again.");
      return false;
    } finally {
      setIsUnlocking(null);
    }
  }, [isUnlocking]);

  const isLocked = useCallback((personaId: string): boolean => {
    if (!PREMIUM_PERSONA_CONFIGS[personaId]) return false;
    return !unlockedPremium.includes(personaId);
  }, [unlockedPremium]);

  const isHidden = useCallback((personaId: string): boolean => {
    const cfg = PREMIUM_PERSONA_CONFIGS[personaId];
    if (!cfg || !cfg.hidden) return false;
    return !unlockedPremium.includes(personaId);
  }, [unlockedPremium]);

  return (
    <PersonaLocksContext.Provider value={{
      unlockedPremium, sessionMinutes, arenaWins, isUnlocking,
      unlockWithTokens, checkAutoUnlocks, addSessionMinutes, addArenaWin,
      isLocked, isHidden,
    }}>
      {children}
    </PersonaLocksContext.Provider>
  );
}

export function usePersonaLocks() {
  const ctx = useContext(PersonaLocksContext);
  if (!ctx) throw new Error("usePersonaLocks must be used within PersonaLocksProvider");
  return ctx;
}
