import { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

// Reuses the same royalty-cleared loop tracks used elsewhere in the app
// (Sports Book, 1-on-1 debate sportsbook music) so the vibe stays consistent.
const SETUP_MUSIC_TRACKS = ["prowling-dragon.mp3", "zdragon.mp3"];
const SETUP_MUSIC_ENABLED_KEY = "persona_setup_music_enabled_v1";
const SETUP_MUSIC_VOLUME = 0.35;

/**
 * Background music for persona-selection / setup screens (Arena, Interview,
 * 1-on-1 Debate). Plays only while `active` is true and the user hasn't
 * muted it; stops the moment `active` flips to false (e.g. the live session
 * begins) or the screen unmounts. Toggle state persists across sessions.
 */
export function useSetupMusic(active: boolean) {
  const [enabled, setEnabled] = useState(true);
  const soundRef = useRef<Audio.Sound | null>(null);
  const playingRef = useRef(false);
  const trackIndexRef = useRef(0);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SETUP_MUSIC_ENABLED_KEY).then((raw) => {
      if (raw === "0") setEnabled(false);
    }).catch(() => {});
  }, []);

  const stop = useCallback(async () => {
    playingRef.current = false;
    generationRef.current += 1;
    const snd = soundRef.current;
    soundRef.current = null;
    if (snd) {
      try { await snd.stopAsync(); } catch {}
      try { await snd.unloadAsync(); } catch {}
    }
  }, []);

  const playNextTrack = useCallback(async () => {
    if (!playingRef.current || !mountedRef.current) return;
    const myGeneration = generationRef.current;
    try {
      const idx = trackIndexRef.current;
      const trackUrl = new URL(`/public/${SETUP_MUSIC_TRACKS[idx]}`, getApiUrl()).toString();
      const { sound } = await Audio.Sound.createAsync(
        { uri: trackUrl },
        { shouldPlay: true, isLooping: false, volume: SETUP_MUSIC_VOLUME }
      );
      if (myGeneration !== generationRef.current || !playingRef.current || !mountedRef.current) {
        sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {});
        return;
      }
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          trackIndexRef.current = (trackIndexRef.current + 1) % SETUP_MUSIC_TRACKS.length;
          if (mountedRef.current && playingRef.current) playNextTrack();
        }
      });
    } catch {
      playingRef.current = false;
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      AsyncStorage.setItem(SETUP_MUSIC_ENABLED_KEY, next ? "1" : "0").catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    const shouldPlay = active && enabled;
    if (shouldPlay && !playingRef.current) {
      trackIndexRef.current = 0;
      playingRef.current = true;
      playNextTrack();
    } else if (!shouldPlay && playingRef.current) {
      stop();
    }
  }, [active, enabled, playNextTrack, stop]);

  useEffect(() => () => { stop(); }, [stop]);

  return { enabled, toggle };
}
