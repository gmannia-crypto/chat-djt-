import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";

export type ChatMood = "CALM" | "FIRED_UP";

export interface StreamResult {
  mood: ChatMood;
}

export async function streamChat(
  messages: { role: string; content: string; imageBase64?: string }[],
  onChunk: (text: string) => void,
  trumpVoice: boolean = true
): Promise<StreamResult> {
  const baseUrl = getApiUrl();

  const response = await fetch(`${baseUrl}api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ messages, trumpVoice }),
  });

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
    if (streamError?.name === "AbortError" || streamError?.message?.includes("abort")) {
      // silently handle aborted streams (app backgrounded, etc.)
    } else {
      throw streamError;
    }
  }

  return { mood: detectedMood };
}
