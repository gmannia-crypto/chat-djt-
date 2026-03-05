import { Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { getApiUrl } from "@/lib/query-client";

let audioCounter = 0;

function uint8ToBase64(bytes: Uint8Array): string {
  const lookup = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    base64 += lookup[b0 >> 2];
    base64 += lookup[((b0 & 3) << 4) | (b1 >> 4)];
    base64 += i + 1 < len ? lookup[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    base64 += i + 2 < len ? lookup[b2 & 63] : "=";
  }
  return base64;
}

async function fetchAndSaveToFile(
  url: string,
  fileUri: string,
  fetchOptions?: RequestInit
): Promise<void> {
  const response = await fetch(url, fetchOptions);
  if (!response.ok) throw new Error(`Audio fetch failed: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const base64 = uint8ToBase64(bytes);
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

function getFileUri(): string {
  audioCounter++;
  return `${FileSystem.cacheDirectory}tts_audio_${Date.now()}_${audioCounter}.mp3`;
}

export async function playAudioFromUrl(
  url: string,
  options?: { method?: string; body?: any; headers?: Record<string, string>; volume?: number }
): Promise<Audio.Sound> {
  const vol = options?.volume ?? 1.0;

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

  const fileUri = getFileUri();

  await fetchAndSaveToFile(url, fileUri, {
    method: options?.method || "GET",
    headers: options?.headers
      ? { ...options.headers }
      : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri: fileUri },
    { shouldPlay: true, volume: vol }
  );

  sound.setOnPlaybackStatusUpdate((status: any) => {
    if (status.didJustFinish) {
      FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
    }
  });

  return sound;
}

export async function playTTS(
  endpoint: string,
  body: Record<string, any>,
  options?: { volume?: number }
): Promise<Audio.Sound> {
  const baseUrl = getApiUrl().replace(/\/$/, "");
  const url = `${baseUrl}${endpoint}`;
  return playAudioFromUrl(url, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    volume: options?.volume,
  });
}
