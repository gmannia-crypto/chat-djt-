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

/** Shared option list for any UI (game screen modal, settings screen) that lets the player pick a preference. */
export const BONUS_PREFERENCE_OPTIONS: { value: BonusGamePreference; label: string; emoji: string }[] = [
  { value: "random", label: "Random", emoji: "🎲" },
  { value: "alternate", label: "Alternate", emoji: "🔁" },
  { value: "putting", label: "Putting Only", emoji: "⛳" },
  { value: "threePoint", label: "3-Point Only", emoji: "🏀" },
];

const DEFAULT_PREFERENCE: BonusGamePreference = "random";

type PreferenceListener = (pref: BonusGamePreference) => void;

const preferenceStore: {
  preference: BonusGamePreference;
  hydrated: boolean;
  hydrating: Promise<void> | null;
  listeners: Set<PreferenceListener>;
  // Bumped on every explicit user write so a slow-resolving hydration read
  // can never clobber a change the user already made while it was in flight.
  writeVersion: number;
} = {
  preference: DEFAULT_PREFERENCE,
  hydrated: false,
  hydrating: null,
  listeners: new Set(),
  writeVersion: 0,
};

function isValidPreference(value: string | null): value is BonusGamePreference {
  return value === "random" || value === "alternate" || value === "putting" || value === "threePoint";
}

export function hydrateBonusGamePreferenceStore(): Promise<void> {
  if (preferenceStore.hydrated) return Promise.resolve();
  if (preferenceStore.hydrating) return preferenceStore.hydrating;
  const versionAtStart = preferenceStore.writeVersion;
  preferenceStore.hydrating = AsyncStorage.getItem(BONUS_GAME_PREFERENCE_KEY)
    .then((saved) => {
      if (isValidPreference(saved) && preferenceStore.writeVersion === versionAtStart) {
        preferenceStore.preference = saved;
        preferenceStore.listeners.forEach((l) => l(preferenceStore.preference));
      }
      preferenceStore.hydrated = true;
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
  preferenceStore.writeVersion += 1;
  preferenceStore.preference = next;
  preferenceStore.hydrated = true;
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
