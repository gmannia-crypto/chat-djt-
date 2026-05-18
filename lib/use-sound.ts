import { useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { useSound } from '@/lib/sound-context';
import { PERSONA_UNLOCKS } from '@/lib/persona-unlocks';

const clickSource = require('@/assets/sfx-click.mp4');
const transitionSource = require('@/assets/sfx-transition.mp4');

const STING_FILE_SOURCES: Record<string, number> = {
  rfk: require('@/assets/sounds/stings/rfk.mp3'),
  alexjones: require('@/assets/sounds/stings/alexjones.mp3'),
  obama: require('@/assets/sounds/stings/obama.mp3'),
  melania: require('@/assets/sounds/stings/melania.mp3'),
  schumer: require('@/assets/sounds/stings/schumer.mp3'),
  odonnell: require('@/assets/sounds/stings/odonnell.mp3'),
  kamala: require('@/assets/sounds/stings/kamala.mp3'),
  mtg: require('@/assets/sounds/stings/mtg.mp3'),
};

export function useSoundEffects() {
  const { soundEnabled } = useSound();
  const clickSound = useRef<Audio.Sound | null>(null);
  const transitionSound = useRef<Audio.Sound | null>(null);
  const stingSounds = useRef<Record<string, Audio.Sound | null>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const load = async () => {
      try {
        const { sound: click } = await Audio.Sound.createAsync(clickSource, {
          shouldPlay: false,
          volume: 0.4,
        });
        if (mounted.current) clickSound.current = click;
        else click.unloadAsync();

        const { sound: transition } = await Audio.Sound.createAsync(transitionSource, {
          shouldPlay: false,
          volume: 0.35,
        });
        if (mounted.current) transitionSound.current = transition;
        else transition.unloadAsync();
      } catch {}
    };

    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    }).catch(() => {});

    load();

    return () => {
      mounted.current = false;
      clickSound.current?.unloadAsync().catch(() => {});
      transitionSound.current?.unloadAsync().catch(() => {});
      clickSound.current = null;
      transitionSound.current = null;
      for (const [personaId, sound] of Object.entries(stingSounds.current)) {
        sound?.unloadAsync().catch(() => {});
        stingSounds.current[personaId] = null;
      }
    };
  }, []);

  const playClick = useCallback(async () => {
    if (!soundEnabled) return;
    try {
      if (clickSound.current) {
        await clickSound.current.setPositionAsync(0);
        await clickSound.current.playAsync();
      }
    } catch {}
  }, [soundEnabled]);

  const playTransition = useCallback(async () => {
    if (!soundEnabled) return;
    try {
      if (transitionSound.current) {
        await transitionSound.current.setPositionAsync(0);
        try {
          await transitionSound.current.setRateAsync(1, true);
        } catch {}
        await transitionSound.current.setVolumeAsync(0.35).catch(() => {});
        await transitionSound.current.playAsync();
      }
    } catch {}
  }, [soundEnabled]);

  const playWhoosh = useCallback(async () => {
    if (!soundEnabled) return;
    try {
      if (transitionSound.current) {
        await transitionSound.current.setPositionAsync(0);
        try {
          await transitionSound.current.setRateAsync(1.6, true);
        } catch {}
        await transitionSound.current.setVolumeAsync(0.3).catch(() => {});
        await transitionSound.current.playAsync();
      }
    } catch {}
  }, [soundEnabled]);

  const playPersonaSting = useCallback(
    async (personaId: string) => {
      if (!soundEnabled) return;
      const cfg = PERSONA_UNLOCKS[personaId];
      const fileKey = cfg?.sting?.file;
      if (!fileKey) return;

      const source = STING_FILE_SOURCES[fileKey];
      if (!source) return;

      try {
        let sound = stingSounds.current[personaId] ?? null;

        if (!sound) {
          const volume = Math.min(1, Math.max(0, cfg.sting?.volume ?? 0.8));
          const { sound: loaded } = await Audio.Sound.createAsync(source, {
            shouldPlay: false,
            volume,
          });
          if (!mounted.current) {
            loaded.unloadAsync().catch(() => {});
            return;
          }
          stingSounds.current[personaId] = loaded;
          sound = loaded;
        }

        const volume = Math.min(1, Math.max(0, cfg.sting?.volume ?? 0.8));
        await sound.setPositionAsync(0);
        await sound.setVolumeAsync(volume).catch(() => {});
        await sound.playAsync();
      } catch {}
    },
    [soundEnabled],
  );

  return { playClick, playTransition, playWhoosh, playPersonaSting };
}
