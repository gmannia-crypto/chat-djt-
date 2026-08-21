import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Global, cross-screen setting for the overlapping laugh/scoff "reaction"
 * clips (interview, debate-stage, arena). This is intentionally separate
 * from the main voice/TTS toggle: a viewer can keep normal persona voices
 * on while turning off the extra overlap/ducking effect if they find it
 * distracting.
 */
export const REACTION_OVERLAP_KEY = "reaction_overlap_enabled_v1";

type ReactionOverlapListener = (enabled: boolean) => void;

const reactionOverlapStore: {
  enabled: boolean;
  hydrated: boolean;
  hydrating: Promise<void> | null;
  listeners: Set<ReactionOverlapListener>;
} = {
  enabled: true,
  hydrated: false,
  hydrating: null,
  listeners: new Set(),
};

export function hydrateReactionOverlapStore(): Promise<void> {
  if (reactionOverlapStore.hydrated) return Promise.resolve();
  if (reactionOverlapStore.hydrating) return reactionOverlapStore.hydrating;
  reactionOverlapStore.hydrating = AsyncStorage.getItem(REACTION_OVERLAP_KEY)
    .then((saved) => {
      if (saved !== null) reactionOverlapStore.enabled = saved === "1";
      reactionOverlapStore.hydrated = true;
      reactionOverlapStore.listeners.forEach((l) => l(reactionOverlapStore.enabled));
    })
    .catch(() => {
      reactionOverlapStore.hydrated = true;
    });
  return reactionOverlapStore.hydrating;
}

// Kick off hydration on import so synchronous readers pick up the
// persisted value as soon as possible.
hydrateReactionOverlapStore().catch(() => {});

/** Synchronously read the current setting (defaults to enabled). */
export function isReactionOverlapEnabled(): boolean {
  return reactionOverlapStore.enabled;
}

export function setReactionOverlapEnabled(next: boolean): void {
  reactionOverlapStore.enabled = next;
  AsyncStorage.setItem(REACTION_OVERLAP_KEY, next ? "1" : "0").catch(() => {});
  reactionOverlapStore.listeners.forEach((l) => l(next));
}

/**
 * Shared hook used by interview/debate-stage/arena screens so the toggle
 * stays in sync everywhere and each screen's playReactionOverlap can check
 * a ref synchronously (same pattern as the existing voice/FX toggles).
 */
export function useReactionOverlapEnabled() {
  const [enabled, setEnabled] = useState<boolean>(reactionOverlapStore.enabled);
  const enabledRef = useRef<boolean>(reactionOverlapStore.enabled);

  useEffect(() => {
    const listener: ReactionOverlapListener = (next) => {
      enabledRef.current = next;
      setEnabled(next);
    };
    reactionOverlapStore.listeners.add(listener);
    hydrateReactionOverlapStore().then(() => listener(reactionOverlapStore.enabled));
    return () => {
      reactionOverlapStore.listeners.delete(listener);
    };
  }, []);

  const toggleReactionOverlap = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    setReactionOverlapEnabled(next);
  }, []);

  return { reactionOverlapEnabled: enabled, reactionOverlapEnabledRef: enabledRef, toggleReactionOverlap };
}
