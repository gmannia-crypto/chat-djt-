/**
 * debate-moderator.ts  —  drop-in moderator layer for the debate stage
 * --------------------------------------------------------------------
 * Your interview.tsx already has a full 2-person interrupting turn engine
 * (fetchAnswer with wasInterrupted / isInterruption, detectOffense, the
 * parallel-prefetch pipeline). This module adds the THIRD participant — the
 * MODERATOR — on top of it, plus the user-controllable actions, WITHOUT
 * touching your working loop.
 *
 * It reuses your existing endpoint the same way fetchAnswer does.
 */
import { getApiUrl } from "@/lib/query-client";
import { prefetchTTSAudio, playPrefetchedAudio, playTTS } from "@/lib/audio-helper";
import { playCrowdCheer, playDingSound } from "@/lib/arena-sfx";

export type ModeratorStyle = "hannity" | "maddow" | "rogan" | "judy";

export const MODERATORS: Record<ModeratorStyle, { name: string; personaId: string; bias: string }> = {
  hannity: { name: "Sean Hannity", personaId: "hannity", bias: "right" },
  maddow:  { name: "Rachel Maddow", personaId: "maddow", bias: "left" },
  rogan:   { name: "Joe Rogan",     personaId: "rogan",  bias: "neutral" },
  judy:    { name: "Judge Judy",    personaId: "judy",   bias: "chaos" },
};

// Short, in-character moderator jabs (~5-6s of speech). Keep them punchy.
const JAB_LIBRARY: Record<string, string[]> = {
  warn: [
    "Alright, alright — let's keep it civil. You'll both get your turn.",
    "Gentlemen. GENTLEMEN. One at a time or nobody talks.",
  ],
  chastise: [
    "That is the weakest answer I've heard all night, and I've heard some weak ones.",
    "You didn't answer the question. You performed. Try again — the real answer this time.",
  ],
  cutMic: [
    "Nope. Mic's off. You had your chance and you blew it.",
    "We're done hearing from you for a second. Sit there and think about that.",
  ],
  interrupt: [
    "Hold on — hold on. You cannot just say that and move on. Explain it.",
    "Stop right there. That's not what you said last week and you know it.",
  ],
};

function pick(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * Ask the AI to generate a moderator line in-character for the current context.
 * Falls back to the local jab library if the API is unavailable so the debate
 * never stalls.
 */
export async function generateModeratorLine(opts: {
  deviceId: string;
  moderatorId: string;
  kind: keyof typeof JAB_LIBRARY;
  topic?: string;
  lastSpeakerText?: string;
  moderatorStyle: ModeratorStyle;
}): Promise<string> {
  try {
    const res = await fetch(new URL("/api/arena/interview-answer", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": opts.deviceId },
      body: JSON.stringify({
        // Reuse the interview-answer endpoint: the moderator is just a "speaker"
        // reacting to the last line. isInterruption keeps it short + punchy.
        interviewerId: opts.moderatorId,
        intervieweeId: opts.moderatorId,
        topic: opts.topic || "",
        conversationHistory: opts.lastSpeakerText ? [{ text: opts.lastSpeakerText }] : [],
        lastQuestion: opts.lastSpeakerText || "",
        isInterruption: true,
        interviewStyle: "combative",
        moderatorKind: opts.kind,           // server may ignore; harmless extra field
        moderatorBias: MODERATORS[opts.moderatorStyle]?.bias,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.text) return String(data.text).slice(0, 240);
    }
  } catch { /* fall through to local */ }
  return pick(JAB_LIBRARY[opts.kind]);
}

/**
 * The OVERLAP INTERRUPTION (your 0.5s model):
 * Call armModeratorInterrupt() to prefetch a jab, then the interview loop's
 * setOnPlaybackStatusUpdate calls maybeFireInterrupt() every tick — when the
 * current line is within OVERLAP_MS of ending, the jab fires over the top and
 * the outgoing voice is ducked.
 */
export const OVERLAP_MS = 500;

export function makeInterruptController() {
  let armed = false;
  let pendingText: string | null = null;

  return {
    isArmed: () => armed,
    async arm(text: string, moderatorId: string) {
      pendingText = text.slice(0, 240);
      await prefetchTTSAudio("/api/persona-speak", { text: pendingText, personaId: moderatorId });
      armed = true;
    },
    /** call from the speaking sound's status update */
    async maybeFire(status: any, outgoingSound: any, onModeratorSpeaking: () => void, onDone: () => void) {
      if (!armed || !status?.isLoaded || !status.durationMillis) return;
      if (status.positionMillis >= status.durationMillis - OVERLAP_MS) {
        armed = false;
        try { outgoingSound?.setVolumeAsync?.(0.3); } catch {}   // duck
        const s = await playPrefetchedAudio("/api/persona-speak", { text: pendingText! }, { volume: 1.0 });
        onModeratorSpeaking();
        playCrowdCheer(); // the "ooooh"
        s.setOnPlaybackStatusUpdate((st: any) => {
          if (st?.isLoaded && st.didJustFinish) { try { s.unloadAsync(); } catch {} onDone(); }
        });
      }
    },
    reset() { armed = false; pendingText = null; },
  };
}

/** Simple immediate moderator line (non-overlap) — for the opening + warnings. */
export async function speakModeratorNow(text: string, moderatorId: string, onDone?: () => void) {
  const s = await playTTS("/api/persona-speak", { text: text.slice(0, 240), personaId: moderatorId });
  s.setOnPlaybackStatusUpdate((st: any) => {
    if (st?.isLoaded && st.didJustFinish) { try { s.unloadAsync(); } catch {} onDone?.(); }
  });
  return s;
}

export function localJab(kind: keyof typeof JAB_LIBRARY) { return pick(JAB_LIBRARY[kind]); }
export { playDingSound };
