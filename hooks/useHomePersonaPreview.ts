import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { getApiUrl } from "@/lib/query-client";
import { useSound } from "@/lib/sound-context";
import { useVoicePreference } from "@/lib/voice-preference";
import { getPersonaVoiceVolume, usePersonaVoiceSettings } from "@/lib/persona-voice";
import { HOME_PREVIEW_LIMIT, getHomePreviewText, normalizePreviewName, type HomePreviewPersonaId } from "@shared/home-persona-preview";

function encodeBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer), alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    result += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b >> 4)] +
      (i + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >> 6)] : "=") +
      (i + 2 < bytes.length ? alphabet[c & 63] : "=");
  }
  return result;
}

export function useHomePersonaPreview() {
  const { soundEnabled } = useSound();
  const { voicePreferenceEnabled } = useVoicePreference();
  const { settings } = usePersonaVoiceSettings();
  const [busy, setBusy] = useState(false);
  const [playingPersonaId, setPlayingPersonaId] = useState<HomePreviewPersonaId | null>(null);
  const [samplesUsed, setSamplesUsed] = useState(0);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const generation = useRef(0);
  const budget = useRef(0);
  const pending = useRef(false);
  const focused = useRef(false);
  const enabled = useRef(soundEnabled && voicePreferenceEnabled);
  enabled.current = soundEnabled && voicePreferenceEnabled;
  const activeId = useRef<HomePreviewPersonaId | null>(null);
  const clips = useRef(new Map<string, string>());
  const abort = useRef<AbortController | null>(null);
  const webAudio = useRef<HTMLAudioElement | null>(null);
  const nativeAudio = useRef<Audio.Sound | null>(null);

  const stop = useCallback(() => {
    generation.current++;
    abort.current?.abort();
    abort.current = null;
    if (webAudio.current) {
      webAudio.current.pause();
      webAudio.current.removeAttribute("src");
      webAudio.current.load();
      webAudio.current = null;
    }
    const sound = nativeAudio.current;
    nativeAudio.current = null;
    if (sound) {
      sound.setOnPlaybackStatusUpdate(null);
      void sound.stopAsync().catch(() => {}).finally(() => sound.unloadAsync().catch(() => {}));
    }
    pending.current = false;
    activeId.current = null;
    setBusy(false);
    setPlayingPersonaId(null);
  }, []);

  const releaseClips = useCallback(() => {
    for (const uri of clips.current.values()) {
      if (Platform.OS === "web") URL.revokeObjectURL(uri);
      else void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
    clips.current.clear();
  }, []);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    budget.current = 0;
    setSamplesUsed(0);
    setError("");
    setTranscript("");
    return () => {
      focused.current = false;
      stop();
      releaseClips();
    };
  }, [releaseClips, stop]));

  useEffect(() => {
    if (!enabled.current || (activeId.current && getPersonaVoiceVolume(activeId.current) === 0)) stop();
    else if (activeId.current) {
      const volume = getPersonaVoiceVolume(activeId.current);
      if (webAudio.current) webAudio.current.volume = volume;
      if (nativeAudio.current) void nativeAudio.current.setVolumeAsync(volume).catch(() => {});
    }
  }, [soundEnabled, voicePreferenceEnabled, settings, stop]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") stop(); });
    const visibility = () => { if (document.hidden) stop(); };
    if (Platform.OS === "web") document.addEventListener("visibilitychange", visibility);
    return () => {
      subscription.remove();
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", visibility);
      stop();
      releaseClips();
    };
  }, [stop, releaseClips]);

  const play = useCallback(async (personaId: HomePreviewPersonaId, rawName: string) => {
    if (pending.current) return;
    if (activeId.current === personaId && (webAudio.current || nativeAudio.current)) { stop(); return; }
    stop();
    setError("");
    const name = normalizePreviewName(rawName);
    if (name.length > 40 || (name && !/^[\p{L}\p{M} .'-]+$/u.test(name))) {
      setError("Use a name of 40 characters or fewer, with letters, spaces, apostrophes or hyphens.");
      return;
    }
    if (!enabled.current || getPersonaVoiceVolume(personaId) === 0) {
      setError("Turn on sound and persona voices to hear this sample.");
      return;
    }
    const key = `${personaId}:${name}`;
    let uri = clips.current.get(key);
    if (!uri && budget.current >= HOME_PREVIEW_LIMIT) {
      setError("You've used your four new samples for this visit. Replay a saved sample or set up your debate.");
      return;
    }
    const token = generation.current;
    const isCurrent = () => token === generation.current && focused.current && enabled.current && getPersonaVoiceVolume(personaId) > 0;
    pending.current = true;
    activeId.current = personaId;
    setBusy(true);
    setTranscript(getHomePreviewText(personaId, name) ?? "");
    const controller = new AbortController();
    abort.current = controller;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!uri) {
        timeout = setTimeout(() => controller.abort(), 25_000);
        const response = await fetch(new URL("/api/home/persona-preview", getApiUrl()).toString(), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personaId, name }), signal: controller.signal,
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "This voice sample is unavailable. Please try again.");
        }
        if (!(response.headers.get("content-type") ?? "").startsWith("audio/")) throw new Error("The preview did not return audio.");
        const buffer = await response.arrayBuffer();
        if (!buffer.byteLength || buffer.byteLength > 1_048_576) throw new Error("The voice sample could not be loaded.");
        if (!isCurrent()) return;
        if (Platform.OS === "web") uri = URL.createObjectURL(new Blob([buffer], { type: "audio/mpeg" }));
        else {
          if (!FileSystem.cacheDirectory) throw new Error("Audio storage is unavailable.");
          uri = `${FileSystem.cacheDirectory}home-preview-${Date.now()}-${budget.current}.mp3`;
          await FileSystem.writeAsStringAsync(uri, encodeBase64(buffer), { encoding: FileSystem.EncodingType.Base64 });
        }
        if (!isCurrent()) {
          if (Platform.OS === "web") URL.revokeObjectURL(uri);
          else await FileSystem.deleteAsync(uri, { idempotent: true });
          return;
        }
        clips.current.set(key, uri);
        budget.current++;
        setSamplesUsed(budget.current);
      }
      if (timeout) clearTimeout(timeout);
      if (!isCurrent()) return;
      if (Platform.OS === "web") {
        const audio = new window.Audio(uri);
        webAudio.current = audio;
        audio.volume = getPersonaVoiceVolume(personaId);
        audio.onended = () => { if (isCurrent()) stop(); };
        audio.onerror = () => { if (isCurrent()) { stop(); setError("Audio playback failed. Tap Listen to retry the saved sample."); } };
        await audio.play();
      } else {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        if (!isCurrent()) return;
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false, volume: getPersonaVoiceVolume(personaId) });
        if (!isCurrent()) { await sound.unloadAsync(); return; }
        nativeAudio.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!isCurrent()) return;
          if (status.isLoaded && status.didJustFinish) stop();
          else if (!status.isLoaded && status.error) { stop(); setError("Audio playback failed. Try the saved sample again."); }
        });
        await sound.playAsync();
      }
      if (isCurrent()) setPlayingPersonaId(personaId);
    } catch (err) {
      if (token === generation.current && focused.current) {
        stop();
        setError(err instanceof Error && err.name !== "AbortError" ? err.message : "The sample took too long. Please try again.");
      }
    } finally {
      if (timeout) clearTimeout(timeout);
      if (token === generation.current) {
        pending.current = false;
        abort.current = null;
        setBusy(false);
      }
    }
  }, [stop]);

  const hasSample = (personaId: HomePreviewPersonaId, name: string) => clips.current.has(`${personaId}:${normalizePreviewName(name)}`);
  return { play, stop, busy, playingPersonaId, samplesUsed, error, transcript, hasSample, audioEnabled: soundEnabled && voicePreferenceEnabled };
}