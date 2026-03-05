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
    const res = await globalThis.fetch(url, {
      method: options?.method || "GET",
      headers: options?.headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
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

  console.log("[AudioHelper] Native: loading audio from URL:", url);
  const { sound } = await Audio.Sound.createAsync(
    { uri: url },
    { shouldPlay: true, volume: vol }
  );
  console.log("[AudioHelper] Native: sound created and playing");
  return sound;
}

export async function playTTS(
  endpoint: string,
  body: Record<string, any>,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const baseUrl = getApiUrl().replace(/\/$/, "");

  if (Platform.OS !== "web") {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.append(k, String(v));
    });
    const url = `${baseUrl}${endpoint}?${params.toString()}`;
    console.log("[AudioHelper] playTTS native GET:", url);
    return playAudioFromUrl(url, { volume: options?.volume });
  }

  const url = `${baseUrl}${endpoint}`;
  return playAudioFromUrl(url, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    volume: options?.volume,
  });
}
