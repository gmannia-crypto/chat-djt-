import { Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { getApiUrl } from "@/lib/query-client";

let audioCounter = 0;

function getFileUri(): string {
  audioCounter++;
  return `${FileSystem.cacheDirectory}tts_audio_${Date.now()}_${audioCounter}.mp3`;
}

function xhrFetchBase64(
  url: string,
  method: string,
  headers?: Record<string, string>,
  body?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (headers) {
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    }
    xhr.responseType = "blob";
    xhr.timeout = 30000;
    xhr.onload = () => {
      console.log("[AudioHelper] XHR onload, status:", xhr.status);
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = xhr.response;
        console.log("[AudioHelper] Blob size:", blob?.size);
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1] || "";
          console.log("[AudioHelper] Base64 length:", base64.length);
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("FileReader failed"));
        reader.readAsDataURL(blob);
      } else {
        reject(new Error(`Audio HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => {
      console.log("[AudioHelper] XHR onerror");
      reject(new Error("XHR network error"));
    };
    xhr.ontimeout = () => {
      console.log("[AudioHelper] XHR timeout");
      reject(new Error("XHR timeout"));
    };
    xhr.send(body || null);
  });
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
  const method = options?.method || "GET";
  console.log("[AudioHelper] Native playback:", method, url);

  if (method === "GET") {
    console.log("[AudioHelper] Using downloadAsync");
    const result = await FileSystem.downloadAsync(url, fileUri, {
      headers: options?.headers,
    });
    console.log("[AudioHelper] Download status:", result.status);
    if (result.status !== 200) {
      throw new Error(`Download failed: ${result.status}`);
    }
  } else {
    const bodyStr = options?.body ? JSON.stringify(options.body) : undefined;
    console.log("[AudioHelper] Using XHR for POST");
    const base64 = await xhrFetchBase64(
      url,
      method,
      options?.headers || { "Content-Type": "application/json" },
      bodyStr
    );

    if (!base64 || base64.length < 100) {
      throw new Error(`Audio data too small: ${base64?.length || 0} chars`);
    }

    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log("[AudioHelper] File written");
  }

  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  console.log("[AudioHelper] File exists:", fileInfo.exists, "size:", (fileInfo as any).size);

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri: fileUri },
    { shouldPlay: true, volume: vol }
  );
  console.log("[AudioHelper] Sound created and playing");

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
  console.log("[AudioHelper] playTTS:", url);
  return playAudioFromUrl(url, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    volume: options?.volume,
  });
}
