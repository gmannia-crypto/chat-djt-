import { useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { useSound } from '@/lib/sound-context';
import { PERSONA_UNLOCKS, type PersonaSting } from '@/lib/persona-unlocks';

const clickSource = require('@/assets/sfx-click.mp4');
const transitionSource = require('@/assets/sfx-transition.mp4');
const buzzerSource = require('@/assets/sounds/buzzer.mp3');

type StingSourceKey = PersonaSting['source'];

export function useSoundEffects() {
  const { soundEnabled } = useSound();
  const clickSound = useRef<Audio.Sound | null>(null);
  const transitionSound = useRef<Audio.Sound | null>(null);
  const stingSounds = useRef<Record<StingSourceKey, Audio.Sound | null>>({
    click: null,
    transition: null,
    buzzer: null,
  });
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

        const { sound: stingClick } = await Audio.Sound.createAsync(clickSource, {
          shouldPlay: false,
          volume: 0.6,
        });
        if (mounted.current) stingSounds.current.click = stingClick;
        else stingClick.unloadAsync();

        const { sound: stingTransition } = await Audio.Sound.createAsync(transitionSource, {
          shouldPlay: false,
          volume: 0.6,
        });
        if (mounted.current) stingSounds.current.transition = stingTransition;
        else stingTransition.unloadAsync();

        const { sound: stingBuzzer } = await Audio.Sound.createAsync(buzzerSource, {
          shouldPlay: false,
          volume: 0.6,
        });
        if (mounted.current) stingSounds.current.buzzer = stingBuzzer;
        else stingBuzzer.unloadAsync();
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
      stingSounds.current.click?.unloadAsync().catch(() => {});
      stingSounds.current.transition?.unloadAsync().catch(() => {});
      stingSounds.current.buzzer?.unloadAsync().catch(() => {});
      clickSound.current = null;
      transitionSound.current = null;
      stingSounds.current = { click: null, transition: null, buzzer: null };
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
      const sting: PersonaSting = cfg?.sting ?? { source: 'transition', rate: 1, volume: 0.5 };
      const sound = stingSounds.current[sting.source];
      if (!sound) return;
      try {
        await sound.setPositionAsync(0);
        try {
          await sound.setRateAsync(sting.rate ?? 1, true);
        } catch {}
        await sound.setVolumeAsync(Math.min(1, Math.max(0, sting.volume ?? 0.6))).catch(() => {});
        await sound.playAsync();
      } catch {}
    },
    [soundEnabled],
  );

  return { playClick, playTransition, playWhoosh, playPersonaSting };
}
