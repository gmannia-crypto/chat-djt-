import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";

export type ChatMood = "CALM" | "FIRED_UP";

export interface StreamResult {
  mood: ChatMood;
}

export async function streamChat(
  messages: { role: string; content: string; imageBase64?: string }[],
  onChunk: (text: string) => void,
  trumpVoice: boolean = true,
  deviceId?: string | null
): Promise<StreamResult> {
  const baseUrl = getApiUrl();

  const hasAttachment = messages.some((m) => m.imageBase64);
  const controller = new AbortController();
  const timeoutMs = hasAttachment ? 120000 : 60000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (deviceId) {
    headers["x-device-id"] = deviceId;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages, trumpVoice }),
      signal: controller.signal,
    });
  } catch (fetchErr: any) {
    clearTimeout(timeout);
    if (fetchErr?.name === "AbortError") {
      throw new Error("Request timed out. Try sending a smaller file or a shorter message.");
    }
    throw fetchErr;
  }

  if (response.status === 403) {
    clearTimeout(timeout);
    const errorData = await response.json().catch(() => ({}));
    if (errorData.error === "no_tokens") {
      throw new Error("NO_TOKENS");
    }
    throw new Error("Access denied");
  }

  if (!response.ok) throw new Error("Failed to get response");

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let detectedMood: ChatMood = "CALM";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.mood) {
            detectedMood = parsed.mood as ChatMood;
          }
          if (parsed.done) continue;
          if (parsed.content) onChunk(parsed.content);
        } catch {}
      }
    }
  } catch (streamError: any) {
    clearTimeout(timeout);
    if (streamError?.name === "AbortError" || streamError?.message?.includes("abort")) {
      // silently handle aborted streams (app backgrounded, etc.)
    } else {
      throw streamError;
    }
  }

  clearTimeout(timeout);
  return { mood: detectedMood };
}
