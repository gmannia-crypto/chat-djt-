import { Platform } from "react-native";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { getApiUrl } from "@/lib/query-client";

export async function playAudioFromUrl(
  url: string,
  options?: { method?: string; body?: any; headers?: Record<string, string>; volume?: number; rate?: number }
): Promise<Audio.Sound> {
  const vol = options?.volume ?? 1.0;
  const rate = options?.rate ?? 1.0;

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });

  if (Platform.OS === "web") {
    if (!options?.method || options.method === "GET") {
      try {
        const res = await globalThis.fetch(url, options?.headers ? { headers: options.headers } : undefined);
        if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/html")) throw new Error("Server returned HTML instead of audio");
        const blob = await res.blob();
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: dataUri },
          { shouldPlay: false, volume: vol }
        );
        await sound.setRateAsync(rate, true).catch(() => {});
        await sound.playAsync();
        return sound;
      } catch (e) {
        console.warn("Audio.Sound fallback failed, trying window.Audio:", e);
        const audio = new window.Audio(url);
        audio.volume = vol;
        audio.playbackRate = rate;
        await audio.play();
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: false, volume: vol }
        );
        return sound;
      }
    }
    const res = await globalThis.fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) throw new Error("Server returned HTML instead of audio");
    const blob = await res.blob();
    const reader = new FileReader();
    const dataUri = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: dataUri },
      { shouldPlay: false, volume: vol }
    );
    await sound.setRateAsync(rate, true).catch(() => {});
    await sound.playAsync();
    return sound;
  }

  const fetchOpts: RequestInit = {};
  if (options?.headers) fetchOpts.headers = options.headers;
  const res = await fetch(url, Object.keys(fetchOpts).length > 0 ? fetchOpts : undefined);
  if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) throw new Error("Server returned HTML instead of audio");

  const { sound } = await Audio.Sound.createAsync(
    { uri: url, headers: options?.headers },
    { shouldPlay: false, volume: vol, rate, shouldCorrectPitch: true }
  );
  await sound.setRateAsync(rate, true).catch(() => {});
  await sound.playAsync();

  return sound;
}

function buildTTSUrl(endpoint: string, body: Record<string, any>): string {
  const baseUrl = getApiUrl().replace(/\/$/, "");
  const params = new URLSearchParams();
  Object.entries(body).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.append(k, String(v));
  });
  return `${baseUrl}${endpoint}?${params.toString()}`;
}

export async function prefetchTTSAudio(
  endpoint: string,
  body: Record<string, any>
): Promise<string> {
  const url = buildTTSUrl(endpoint, body);

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });

  if (Platform.OS === "web") {
    const res = await globalThis.fetch(url);
    if (!res.ok) throw new Error(`TTS prefetch failed: ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) throw new Error("Server returned HTML instead of audio");
    const blob = await res.blob();
    const reader = new FileReader();
    const dataUri = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return dataUri;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TTS prefetch failed: ${res.status}`);
  return url;
}

export async function playPrefetchedAudio(
  audioUri: string,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const vol = options?.volume ?? 1.0;

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri: audioUri },
    { shouldPlay: false, volume: vol }
  );
  await sound.playAsync();
  return sound;
}

export async function playTTS(
  endpoint: string,
  body: Record<string, any>,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const url = buildTTSUrl(endpoint, body);
  return playAudioFromUrl(url, { volume: options?.volume });
}

let _trumpSpeakingCount = 0;
let _trumpQueue: Promise<void> = Promise.resolve();

export function isTrumpCurrentlySpeaking(): boolean {
  return _trumpSpeakingCount > 0;
}

export async function playTrumpTTS(
  endpoint: string,
  body: Record<string, any>,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const previous = _trumpQueue;
  let completionResolve: () => void;
  let completed = false;

  const finish = () => {
    if (!completed) {
      completed = true;
      _trumpSpeakingCount = Math.max(0, _trumpSpeakingCount - 1);
      completionResolve!();
    }
  };

  const completionPromise = new Promise<void>((resolve) => {
    completionResolve = resolve;
  });

  _trumpQueue = completionPromise;
  _trumpSpeakingCount++;

  try {
    await previous;
  } catch {}

  let sound: Audio.Sound;
  try {
    sound = await playTTS(endpoint, body, options);
  } catch (err) {
    finish();
    throw err;
  }

  const origSetHandler = sound.setOnPlaybackStatusUpdate.bind(sound);
  let externalHandler: ((status: any) => void) | null = null;

  origSetHandler((status: any) => {
    if (externalHandler) externalHandler(status);
    if (!status.isLoaded || status.didJustFinish) {
      finish();
    }
  });

  const origUnload = sound.unloadAsync.bind(sound);
  sound.unloadAsync = async () => {
    finish();
    return origUnload();
  };

  sound.setOnPlaybackStatusUpdate = (handler: (status: any) => void) => {
    externalHandler = handler;
  };

  return sound;
}

export async function playTrumpAudioFromUrl(
  url: string,
  options?: { method?: string; body?: any; headers?: Record<string, string>; volume?: number; rate?: number }
): Promise<Audio.Sound> {
  const previous = _trumpQueue;
  let completionResolve: () => void;
  let completed = false;

  const finish = () => {
    if (!completed) {
      completed = true;
      _trumpSpeakingCount = Math.max(0, _trumpSpeakingCount - 1);
      completionResolve!();
    }
  };

  const completionPromise = new Promise<void>((resolve) => {
    completionResolve = resolve;
  });

  _trumpQueue = completionPromise;
  _trumpSpeakingCount++;

  try {
    await previous;
  } catch {}

  let sound: Audio.Sound;
  try {
    sound = await playAudioFromUrl(url, options);
  } catch (err) {
    finish();
    throw err;
  }

  const origSetHandler = sound.setOnPlaybackStatusUpdate.bind(sound);
  let externalHandler: ((status: any) => void) | null = null;

  origSetHandler((status: any) => {
    if (externalHandler) externalHandler(status);
    if (!status.isLoaded || status.didJustFinish) {
      finish();
    }
  });

  const origUnload = sound.unloadAsync.bind(sound);
  sound.unloadAsync = async () => {
    finish();
    return origUnload();
  };

  sound.setOnPlaybackStatusUpdate = (handler: (status: any) => void) => {
    externalHandler = handler;
  };

  return sound;
}
