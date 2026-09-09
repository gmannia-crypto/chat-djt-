import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Player preference for which mini-game (putting green vs. 3-point shot) the
 * bonus-round banner offers between scenarios in app/game.tsx.
 *
 * - "random": pick a fresh coin flip each time (legacy/default behavior).
 * - "alternate": strictly alternate putting/threePoint so a repeat player
 *   sees both without needing to remember a choice.
 * - "putting" / "threePoint": always offer that one game — for players who
 *   strongly prefer one over the other.
 */
export type BonusGamePreference = "random" | "alternate" | "putting" | "threePoint";

export const BONUS_GAME_PREFERENCE_KEY = "bonus_game_preference_v1";

const DEFAULT_PREFERENCE: BonusGamePreference = "random";

type PreferenceListener = (pref: BonusGamePreference) => void;

const preferenceStore: {
  preference: BonusGamePreference;
  hydrated: boolean;
  hydrating: Promise<void> | null;
  listeners: Set<PreferenceListener>;
} = {
  preference: DEFAULT_PREFERENCE,
  hydrated: false,
  hydrating: null,
  listeners: new Set(),
};

function isValidPreference(value: string | null): value is BonusGamePreference {
  return value === "random" || value === "alternate" || value === "putting" || value === "threePoint";
}

export function hydrateBonusGamePreferenceStore(): Promise<void> {
  if (preferenceStore.hydrated) return Promise.resolve();
  if (preferenceStore.hydrating) return preferenceStore.hydrating;
  preferenceStore.hydrating = AsyncStorage.getItem(BONUS_GAME_PREFERENCE_KEY)
    .then((saved) => {
      if (isValidPreference(saved)) preferenceStore.preference = saved;
      preferenceStore.hydrated = true;
      preferenceStore.listeners.forEach((l) => l(preferenceStore.preference));
    })
    .catch(() => {
      preferenceStore.hydrated = true;
    });
  return preferenceStore.hydrating;
}

// Kick off hydration on import so synchronous readers pick up the persisted
// value as soon as possible (mirrors lib/reaction-overlap-settings.ts).
hydrateBonusGamePreferenceStore().catch(() => {});

/** Synchronously read the current preference (defaults to "random"). */
export function getBonusGamePreference(): BonusGamePreference {
  return preferenceStore.preference;
}

export function setBonusGamePreference(next: BonusGamePreference): void {
  preferenceStore.preference = next;
  AsyncStorage.setItem(BONUS_GAME_PREFERENCE_KEY, next).catch(() => {});
  preferenceStore.listeners.forEach((l) => l(next));
}

/**
 * Decide which mini-game to offer for this bonus round, given the player's
 * preference and the kind of game that was offered last time (for
 * "alternate"). Kept as a pure function so app/game.tsx's offer trigger and
 * any tests can share the exact same decision logic.
 */
export function pickBonusGameKind(
  preference: BonusGamePreference,
  lastOffered: "putting" | "threePoint" | null,
): "putting" | "threePoint" {
  if (preference === "putting") return "putting";
  if (preference === "threePoint") return "threePoint";
  if (preference === "alternate") {
    if (lastOffered === "putting") return "threePoint";
    if (lastOffered === "threePoint") return "putting";
    return Math.random() < 0.5 ? "putting" : "threePoint";
  }
  return Math.random() < 0.5 ? "putting" : "threePoint";
}

/**
 * Shared hook so any screen (game screen, future settings screen) reads and
 * writes the same preference and stays in sync if it changes elsewhere.
 */
export function useBonusGamePreference() {
  const [preference, setPreference] = useState<BonusGamePreference>(preferenceStore.preference);
  const preferenceRef = useRef<BonusGamePreference>(preferenceStore.preference);

  useEffect(() => {
    const listener: PreferenceListener = (next) => {
      preferenceRef.current = next;
      setPreference(next);
    };
    preferenceStore.listeners.add(listener);
    hydrateBonusGamePreferenceStore().then(() => listener(preferenceStore.preference));
    return () => {
      preferenceStore.listeners.delete(listener);
    };
  }, []);

  const updatePreference = useCallback((next: BonusGamePreference) => {
    preferenceRef.current = next;
    setPreference(next);
    setBonusGamePreference(next);
  }, []);

  return { bonusGamePreference: preference, bonusGamePreferenceRef: preferenceRef, setBonusGamePreference: updatePreference };
}
