import { Share, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";

export async function trackShare(params: {
  deviceId?: string;
  feature: string;
  contentPreview?: string;
  platform?: string;
}) {
  try {
    await fetch(`${getApiUrl()}/api/track-share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: params.deviceId,
        feature: params.feature,
        contentPreview: params.contentPreview,
        platform: params.platform || Platform.OS,
      }),
    });
  } catch {}
}

export async function shareContent(params: {
  text: string;
  feature: string;
  deviceId?: string;
}): Promise<boolean> {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  trackShare({
    deviceId: params.deviceId,
    feature: params.feature,
    contentPreview: params.text.slice(0, 200),
    platform: Platform.OS,
  });

  if (Platform.OS === "web") {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: params.text });
        return true;
      } else {
        await Clipboard.setStringAsync(params.text);
        return true;
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        await Clipboard.setStringAsync(params.text);
        return true;
      }
      return false;
    }
  } else {
    try {
      await Share.share({ message: params.text });
      return true;
    } catch {
      return false;
    }
  }
}
