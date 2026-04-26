import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const PERSONA_VOICE_STORAGE = "persona-voice-settings";

export interface PersonaVoiceSetting {
  muted: boolean;
  volume: number;
}
export type PersonaVoiceSettings = Record<string, PersonaVoiceSetting>;

export const DEFAULT_PERSONA_VOICE_SETTING: PersonaVoiceSetting = {
  muted: false,
  volume: 1.0,
};

type VoiceStoreListener = (settings: PersonaVoiceSettings) => void;

const voiceStore: {
  settings: PersonaVoiceSettings;
  hydrated: boolean;
  hydrating: Promise<void> | null;
  listeners: Set<VoiceStoreListener>;
} = {
  settings: {},
  hydrated: false,
  hydrating: null,
  listeners: new Set(),
};

export function hydratePersonaVoiceStore(): Promise<void> {
  if (voiceStore.hydrated) return Promise.resolve();
  if (voiceStore.hydrating) return voiceStore.hydrating;
  voiceStore.hydrating = AsyncStorage.getItem(PERSONA_VOICE_STORAGE)
    .then((saved) => {
      if (saved) {
        try {
          voiceStore.settings = JSON.parse(saved) as PersonaVoiceSettings;
        } catch {}
      }
      voiceStore.hydrated = true;
      voiceStore.listeners.forEach((l) => l(voiceStore.settings));
    })
    .catch(() => {
      voiceStore.hydrated = true;
    });
  return voiceStore.hydrating;
}

// Kick off hydration as soon as this module is imported so synchronous
// readers like getPersonaVoiceSetting() pick up persisted values quickly.
hydratePersonaVoiceStore().catch(() => {});

export function getVoiceSetting(
  settings: PersonaVoiceSettings,
  personaId: string
): PersonaVoiceSetting {
  return settings[personaId] ?? DEFAULT_PERSONA_VOICE_SETTING;
}

/**
 * Synchronously read the current voice setting for a persona. Falls back to
 * the unmuted/full-volume default when the store hasn't been hydrated yet
 * or when no override exists for the persona.
 */
export function getPersonaVoiceSetting(personaId: string): PersonaVoiceSetting {
  return voiceStore.settings[personaId] ?? DEFAULT_PERSONA_VOICE_SETTING;
}

/**
 * Returns true when the persona's voice should be skipped entirely
 * (muted or zero volume).
 */
export function shouldSkipPersonaVoice(personaId: string): boolean {
  const s = getPersonaVoiceSetting(personaId);
  return s.muted || s.volume <= 0;
}

/**
 * Returns the volume (0..1) to pass to playback helpers, clamped to a valid
 * range. Returns 0 if muted.
 */
export function getPersonaVoiceVolume(personaId: string): number {
  const s = getPersonaVoiceSetting(personaId);
  if (s.muted) return 0;
  return Math.max(0, Math.min(1, s.volume));
}

export function setPersonaVoiceSetting(
  personaId: string,
  update: Partial<PersonaVoiceSetting>
): PersonaVoiceSettings {
  const current =
    voiceStore.settings[personaId] ?? DEFAULT_PERSONA_VOICE_SETTING;
  const next: PersonaVoiceSettings = {
    ...voiceStore.settings,
    [personaId]: { ...current, ...update },
  };
  voiceStore.settings = next;
  AsyncStorage.setItem(PERSONA_VOICE_STORAGE, JSON.stringify(next)).catch(
    () => {}
  );
  voiceStore.listeners.forEach((l) => l(next));
  return next;
}

export function usePersonaVoiceSettings() {
  const [settings, setSettings] = useState<PersonaVoiceSettings>(
    voiceStore.settings
  );
  const settingsRef = useRef<PersonaVoiceSettings>(voiceStore.settings);

  useEffect(() => {
    const listener: VoiceStoreListener = (next) => {
      settingsRef.current = next;
      setSettings(next);
    };
    voiceStore.listeners.add(listener);
    hydratePersonaVoiceStore().then(() => listener(voiceStore.settings));
    return () => {
      voiceStore.listeners.delete(listener);
    };
  }, []);

  const updateSetting = useCallback(
    (personaId: string, update: Partial<PersonaVoiceSetting>) => {
      setPersonaVoiceSetting(personaId, update);
    },
    []
  );

  return { settings, settingsRef, updateSetting };
}
