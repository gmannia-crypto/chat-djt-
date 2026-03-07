import { Platform } from "react-native";
import { Audio } from "expo-av";
import { getApiUrl } from "@/lib/query-client";

export async function playAudioFromUrl(
  url: string,
  options?: { method?: string; body?: any; headers?: Record<string, string>; volume?: number }
): Promise<Audio.Sound> {
  const vol = options?.volume ?? 1.0;

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });

  if (Platform.OS === "web") {
    if (!options?.method || options.method === "GET") {
      try {
        const res = await globalThis.fetch(url);
        if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
        const blob = await res.blob();
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: dataUri },
          { shouldPlay: true, volume: vol }
        );
        return sound;
      } catch (e) {
        console.warn("Audio.Sound fallback failed, trying window.Audio:", e);
        const audio = new window.Audio(url);
        audio.volume = vol;
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
    const blob = await res.blob();
    const reader = new FileReader();
    const dataUri = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: dataUri },
      { shouldPlay: true, volume: vol }
    );
    return sound;
  }

  const { sound } = await Audio.Sound.createAsync(
    { uri: url },
    { shouldPlay: true, volume: vol }
  );

  return sound;
}

export async function playTTS(
  endpoint: string,
  body: Record<string, any>,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const baseUrl = getApiUrl().replace(/\/$/, "");

  const params = new URLSearchParams();
  Object.entries(body).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.append(k, String(v));
  });
  const url = `${baseUrl}${endpoint}?${params.toString()}`;

  return playAudioFromUrl(url, { volume: options?.volume });
}
