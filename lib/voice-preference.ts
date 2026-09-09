import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Global, cross-screen "voice enabled" preference. This is the master
 * on/off for persona narration/TTS playback (separate from the reaction
 * overlap toggle in lib/reaction-overlap-settings.ts and the admin-only
 * per-persona volume mixer in lib/persona-voice.ts).
 *
 * Reuses the AsyncStorage key that app/interview.tsx and app/debate-stage.tsx
 * already persisted their local voice toggle under, so this module is a
 * drop-in shared source of truth: those two screens keep working exactly as
 * before (they already read/write the same key), while other screens
 * (app/game.tsx, app/arena.tsx) and the new settings screen can now read and
 * change the same persisted value.
 */
export const VOICE_ENABLED_KEY = "interview_voice_enabled_v1";

type VoiceListener = (enabled: boolean) => void;

const voiceStore: {
  enabled: boolean;
  hydrated: boolean;
  hydrating: Promise<void> | null;
  listeners: Set<VoiceListener>;
  // Bumped on every explicit user write so a slow-resolving hydration read
  // (kicked off at import time, before any AsyncStorage read has settled)
  // can never clobber a change the user already made while it was in flight.
  writeVersion: number;
} = {
  enabled: true,
  hydrated: false,
  hydrating: null,
  listeners: new Set(),
  writeVersion: 0,
};

export function hydrateVoicePreferenceStore(): Promise<void> {
  if (voiceStore.hydrated) return Promise.resolve();
  if (voiceStore.hydrating) return voiceStore.hydrating;
  const versionAtStart = voiceStore.writeVersion;
  voiceStore.hydrating = AsyncStorage.getItem(VOICE_ENABLED_KEY)
    .then((saved) => {
      if (saved !== null && voiceStore.writeVersion === versionAtStart) {
        voiceStore.enabled = saved === "1";
        voiceStore.listeners.forEach((l) => l(voiceStore.enabled));
      }
      voiceStore.hydrated = true;
    })
    .catch(() => {
      voiceStore.hydrated = true;
    });
  return voiceStore.hydrating;
}

// Kick off hydration on import so synchronous readers pick up the
// persisted value as soon as possible (mirrors lib/reaction-overlap-settings.ts).
hydrateVoicePreferenceStore().catch(() => {});

/** Synchronously read the current setting (defaults to enabled). */
export function isVoicePreferenceEnabled(): boolean {
  return voiceStore.enabled;
}

/**
 * Monotonically increasing version, bumped on every explicit write (mute or
 * unmute). Non-hook async playback code (e.g. app/game.tsx's playBase64Audio)
 * captures this before an await and compares it afterward so a mute that is
 * quickly followed by an unmute is still detected as "something changed since
 * I started" — checking isVoicePreferenceEnabled() alone would miss that,
 * since it would read `true` again by the time the await resolves.
 */
export function getVoicePreferenceVersion(): number {
  return voiceStore.writeVersion;
}

export function setVoicePreferenceEnabled(next: boolean): void {
  voiceStore.writeVersion += 1;
  voiceStore.enabled = next;
  voiceStore.hydrated = true;
  AsyncStorage.setItem(VOICE_ENABLED_KEY, next ? "1" : "0").catch(() => {});
  voiceStore.listeners.forEach((l) => l(next));
}

/**
 * Shared hook so any screen (settings screen, game screen, arena) reads and
 * writes the same preference and stays in sync if it changes elsewhere.
 */
export function useVoicePreference() {
  const [enabled, setEnabled] = useState<boolean>(voiceStore.enabled);
  const enabledRef = useRef<boolean>(voiceStore.enabled);

  useEffect(() => {
    const listener: VoiceListener = (next) => {
      enabledRef.current = next;
      setEnabled(next);
    };
    voiceStore.listeners.add(listener);
    hydrateVoicePreferenceStore().then(() => listener(voiceStore.enabled));
    return () => {
      voiceStore.listeners.delete(listener);
    };
  }, []);

  const toggleVoicePreference = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    setVoicePreferenceEnabled(next);
  }, []);

  return { voicePreferenceEnabled: enabled, voicePreferenceEnabledRef: enabledRef, toggleVoicePreference, setVoicePreferenceEnabled: (next: boolean) => {
    enabledRef.current = next;
    setEnabled(next);
    setVoicePreferenceEnabled(next);
  } };
}
