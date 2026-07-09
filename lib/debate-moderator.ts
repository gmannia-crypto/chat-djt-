import { Audio } from "expo-av";
import { playTTS } from "@/lib/audio-helper";
import { getPersonaVoiceVolume, shouldSkipPersonaVoice } from "@/lib/persona-voice";
import { playDingSound } from "@/lib/arena-sfx";

export type ModeratorStyle = "rogan" | "formal" | "chaotic";

export interface ModeratorConfig {
  personaId: string;
  name: string;
  style: ModeratorStyle;
}

export const MODERATORS: Record<ModeratorStyle, ModeratorConfig> = {
  rogan: { personaId: "moderator-rogan", name: "The Moderator", style: "rogan" },
  formal: { personaId: "moderator-formal", name: "The Moderator", style: "formal" },
  chaotic: { personaId: "moderator-chaotic", name: "The Ringmaster", style: "chaotic" },
};

const JAB_LINES: Record<ModeratorStyle, string[]> = {
  rogan: [
    "Whoa, whoa — hold on, hold on. Let's slow down for a second.",
    "That's — okay, interesting take. Interesting.",
    "Alright, alright, let the other guy talk for a second.",
    "Hold up, I gotta jump in here real quick.",
  ],
  formal: [
    "Let's pause there for a moment, please.",
    "I'll need you to allow your opponent to respond.",
    "One moment — let's keep this civil and on topic.",
    "Please hold that thought — we'll circle back.",
  ],
  chaotic: [
    "OH HO HO — did you HEAR that?! Folks, did you hear that?!",
    "STOP. STOP EVERYTHING. We need to talk about what just happened.",
    "Ladies and gentlemen, THIS is why you tuned in tonight!",
    "Hold the phone — hold the ENTIRE phone.",
  ],
};

export function localJab(style: ModeratorStyle): string {
  const lines = JAB_LINES[style] || JAB_LINES.rogan;
  return lines[Math.floor(Math.random() * lines.length)];
}

export async function generateModeratorLine(opts: {
  deviceId: string;
  moderatorId: string;
  kind: "interrupt" | "opening" | "closing";
  topic?: string;
  lastSpeakerText?: string;
  moderatorStyle: ModeratorStyle;
}): Promise<string> {
  // Keep this lightweight/local — no token spend for moderator flavor lines.
  // If a lastSpeakerText is available, reference it loosely for variety.
  if (opts.kind === "opening" && opts.topic) {
    return `Welcome to tonight's ${opts.topic} debate. Two enter. One leaves with their dignity — maybe. Begin.`;
  }
  return localJab(opts.moderatorStyle);
}

export async function speakModeratorNow(text: string, personaId: string): Promise<void> {
  if (shouldSkipPersonaVoice(personaId)) return;
  try {
    const sound = await playTTS(
      "/api/persona-speak",
      { text, personaId },
      { volume: getPersonaVoiceVolume(personaId) }
    );
    await new Promise<void>((resolve) => {
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        sound.setOnPlaybackStatusUpdate(null);
        sound.unloadAsync().catch(() => {});
        resolve();
      };
      const safety = setTimeout(finish, 12000);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status?.didJustFinish || status?.error) {
          clearTimeout(safety);
          finish();
        }
      });
    });
  } catch {
    // ignore TTS failures for moderator flavor lines
  }
}

interface InterruptController {
  arm: (line: string, moderatorId: string) => Promise<void>;
  maybeFire: (
    status: any,
    sound: Audio.Sound,
    onInterrupt: () => void,
    onResume: () => void
  ) => void;
  cancel: () => void;
}

export function makeInterruptController(): InterruptController {
  let pending: { line: string; moderatorId: string } | null = null;
  let fired = false;

  return {
    arm(line: string, moderatorId: string) {
      pending = { line, moderatorId };
      fired = false;
      return Promise.resolve();
    },
    maybeFire(status: any, sound: Audio.Sound, onInterrupt: () => void, onResume: () => void) {
      if (!pending || fired) return;
      if (status?.isPlaying && status?.durationMillis && status?.positionMillis) {
        const remaining = status.durationMillis - status.positionMillis;
        // Fire on the ~0.5s overlap window before the current line finishes.
        if (remaining <= 500 && remaining > 0) {
          fired = true;
          const { line, moderatorId } = pending;
          pending = null;
          playDingSound().catch(() => {});
          onInterrupt();
          speakModeratorNow(line, moderatorId).finally(() => {
            onResume();
          });
        }
      }
    },
    cancel() {
      pending = null;
      fired = false;
    },
  };
}
