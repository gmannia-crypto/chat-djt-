import { Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

let audioCounter = 0;

export async function playAudioFromResponse(
  response: Response,
  options?: { volume?: number; shouldPlay?: boolean }
): Promise<Audio.Sound> {
  const vol = options?.volume ?? 1.0;

  if (Platform.OS === "web") {
    const blob = await response.blob();
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

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);

  audioCounter++;
  const fileUri = `${FileSystem.cacheDirectory}tts_audio_${Date.now()}_${audioCounter}.mp3`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
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
