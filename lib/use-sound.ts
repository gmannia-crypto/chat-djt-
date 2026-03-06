import { useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';

const clickSource = require('@/assets/sfx-click.mp4');
const transitionSource = require('@/assets/sfx-transition.mp4');

export function useSoundEffects() {
  const clickSound = useRef<Audio.Sound | null>(null);
  const transitionSound = useRef<Audio.Sound | null>(null);
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
    };
  }, []);

  const playClick = useCallback(async () => {
    try {
      if (clickSound.current) {
        await clickSound.current.setPositionAsync(0);
        await clickSound.current.playAsync();
      }
    } catch {}
  }, []);

  const playTransition = useCallback(async () => {
    try {
      if (transitionSound.current) {
        await transitionSound.current.setPositionAsync(0);
        await transitionSound.current.playAsync();
      }
    } catch {}
  }, []);

  return { playClick, playTransition };
}
