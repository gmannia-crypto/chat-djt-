/**
 * debate-moderator.ts  —  drop-in moderator layer for the debate stage
 * --------------------------------------------------------------------
 * interview.tsx already has a full 2-person interrupting turn engine
 * (fetchAnswer with wasInterrupted / isInterruption, detectOffense, the
 * parallel-prefetch pipeline). This module adds the THIRD participant — the
 * MODERATOR — on top of it, plus the user-controllable actions, WITHOUT
 * touching the working loop.
 *
 * It reuses the existing endpoint the same way fetchAnswer does.
 */
import { getApiUrl } from "@/lib/query-client";
import { prefetchTTSAudio, playPrefetchedAudio, playTTS } from "@/lib/audio-helper";
import { playCrowdCheer, playDingSound } from "@/lib/arena-sfx";

export type ModeratorStyle = "hannity" | "maddow" | "megynkelly" | "odonnell" | "maxkellerman" | "stephena";

export const MODERATORS: Record<ModeratorStyle, { name: string; personaId: string; bias: string }> = {
  hannity:    { name: "Sean Hannity",     personaId: "hannity",    bias: "right" },
  maddow:     { name: "Rachel Maddow",    personaId: "maddow",     bias: "left" },
  megynkelly: { name: "Megyn Kelly",      personaId: "megynkelly", bias: "right" },
  odonnell:   { name: "Lawrence O'Donnell", personaId: "odonnell", bias: "left" },
  maxkellerman: { name: "Max Kellerman",  personaId: "maxkellerman", bias: "sports" },
  stephena:     { name: "Stephen A. Smith", personaId: "stephena",    bias: "sports" },
};

// Which personas each moderator is friendly to ("favor" — softball questions, quick to defend
// against fact-check hits) vs. adversarial to ("target" — hard questions, quick to chastise).
// Anyone not listed is treated as neutral (balanced questions, fact-based reactions only).
export const MODERATOR_LEANINGS: Record<ModeratorStyle, { favor: string[]; target: string[] }> = {
  hannity: {
    favor: ["trump", "melania", "ivanka", "bannon", "miller", "leavitt", "erikakirk", "pambondi", "jimjordan", "graham", "candace", "mtg", "loomer", "netanyahu", "timscott"],
    target: ["obama", "biden", "kamala", "schumer", "aoc", "omar", "maddow", "joyreid", "carville", "berniemc", "jascrockett"],
  },
  megynkelly: {
    favor: ["trump", "melania", "ivanka", "bannon", "miller", "leavitt", "graham", "candace", "mtg", "netanyahu", "timscott"],
    target: ["obama", "biden", "kamala", "schumer", "aoc", "omar", "joyreid", "carville", "berniemc"],
  },
  maddow: {
    favor: ["obama", "biden", "kamala", "schumer", "aoc", "omar", "joyreid", "carville", "berniemc", "jascrockett"],
    target: ["trump", "melania", "ivanka", "bannon", "miller", "leavitt", "erikakirk", "pambondi", "jimjordan", "mtg", "loomer", "alexjones"],
  },
  odonnell: {
    favor: ["obama", "biden", "kamala", "schumer", "aoc", "omar", "joyreid", "carville", "berniemc", "jascrockett"],
    target: ["trump", "melania", "ivanka", "bannon", "miller", "leavitt", "erikakirk", "pambondi", "jimjordan", "mtg", "loomer", "alexjones"],
  },
  // Sports moderators are not politically aligned — no favor/target lists, always neutral/fact-based.
  maxkellerman: { favor: [], target: [] },
  stephena: { favor: [], target: [] },
};

export type ModeratorLeaning = "favor" | "target" | "neutral";

/** How this moderator personally feels about a given debater persona. */
export function getModeratorLeaning(moderatorStyle: ModeratorStyle, personaId: string): ModeratorLeaning {
  const cfg = MODERATOR_LEANINGS[moderatorStyle];
  if (!cfg) return "neutral";
  if (cfg.favor.includes(personaId)) return "favor";
  if (cfg.target.includes(personaId)) return "target";
  return "neutral";
}

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
  // Fires when the fact-checker flags a lie from someone this moderator is BIASED AGAINST.
  chastiseLie: [
    "And there it is — the lie detector just caught you red-handed. That's on the record now.",
    "That's not spin, that's a flat-out lie, and everyone watching just heard it.",
  ],
  // Fires when the fact-checker flags a lie from someone this moderator FAVORS.
  defendLie: [
    "Okay, okay — that's more of an exaggeration than a lie. Let's not pile on.",
    "I'll give a little grace there, that's a stretch, not a straight-up lie.",
  ],
};

function pick(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * Truncate to at most `max` characters WITHOUT cutting a sentence in half —
 * hard slice(0, N) was chopping moderator lines mid-word/mid-sentence, which
 * sounded like the moderator "not finishing his sentences" when spoken via
 * TTS. Prefers the last sentence-ending punctuation before the limit; falls
 * back to the last word boundary if no punctuation is found.
 */
function truncateAtSentence(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastEnd = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
  if (lastEnd > max * 0.4) return slice.slice(0, lastEnd + 1);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd() + "…";
}

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
      if (data?.text) return truncateAtSentence(String(data.text), 240);
    }
  } catch { /* fall through to local */ }
  return pick(JAB_LIBRARY[opts.kind]);
}

/**
 * The OVERLAP INTERRUPTION (0.5s model):
 * Call arm() to prefetch a jab, then the interview loop's
 * setOnPlaybackStatusUpdate calls maybeFire() every tick — when the
 * current line is within OVERLAP_MS of ending, the jab fires over the top and
 * the outgoing voice is ducked.
 */
export const OVERLAP_MS = 500;

export function makeInterruptController() {
  let armed = false;
  let pendingUri: string | null = null;
  let pendingModeratorId: string | null = null;

  return {
    isArmed: () => armed,
    async arm(text: string, moderatorId: string) {
      const trimmed = truncateAtSentence(text, 240);
      pendingUri = await prefetchTTSAudio("/api/persona-speak", { text: trimmed, personaId: moderatorId });
      pendingModeratorId = moderatorId;
      armed = true;
    },
    /**
     * call from the speaking sound's status update. `currentSpeakerId` is whoever
     * is ACTUALLY speaking right now (may differ from who was speaking when arm()
     * was called) — if it's the same moderator as the pending jab, skip firing so
     * the moderator never overlaps/cuts in over himself.
     */
    async maybeFire(status: any, outgoingSound: any, onModeratorSpeaking: () => void, onDone: () => void, currentSpeakerId?: string | null) {
      if (!armed || !status?.isLoaded || !status.durationMillis) return;
      if (currentSpeakerId && pendingModeratorId && currentSpeakerId === pendingModeratorId) {
        // The moderator is already the one talking — drop the queued jab instead
        // of letting him cut in over his own voice.
        armed = false;
        pendingUri = null;
        pendingModeratorId = null;
        return;
      }
      if (status.positionMillis >= status.durationMillis - OVERLAP_MS) {
        armed = false;
        pendingModeratorId = null;
        try { outgoingSound?.setVolumeAsync?.(0.3); } catch {}   // duck
        const s = await playPrefetchedAudio(pendingUri!, { volume: 1.0 });
        onModeratorSpeaking();
        playCrowdCheer(); // the "ooooh"
        s.setOnPlaybackStatusUpdate((st: any) => {
          if (st?.isLoaded && st.didJustFinish) { try { s.unloadAsync(); } catch {} onDone(); }
        });
      }
    },
    reset() { armed = false; pendingUri = null; pendingModeratorId = null; },
  };
}

/** Simple immediate moderator line (non-overlap) — for the opening + warnings. */
export async function speakModeratorNow(text: string, moderatorId: string, onDone?: () => void) {
  const s = await playTTS("/api/persona-speak", { text: truncateAtSentence(text, 240), personaId: moderatorId });
  s.setOnPlaybackStatusUpdate((st: any) => {
    if (st?.isLoaded && st.didJustFinish) { try { s.unloadAsync(); } catch {} onDone?.(); }
  });
  return s;
}

export function localJab(kind: keyof typeof JAB_LIBRARY) { return pick(JAB_LIBRARY[kind]); }

/**
 * The moderator opens a new topic by putting a question to ONE of the two debaters
 * (alternated by the caller so both sides get equal airtime). If the moderator is
 * biased toward/against the target persona, the question is skewed accordingly —
 * softballs for a favored persona, prosecutorial questions for a targeted one.
 */
export async function generateModeratorQuestion(opts: {
  deviceId: string;
  moderatorStyle: ModeratorStyle;
  targetId: string;
  topic: { title: string; description: string };
  isTransition?: boolean;
  previousTopicTitle?: string;
  conversationHistory?: Array<{ speakerName: string; text: string }>;
}): Promise<string> {
  const mod = MODERATORS[opts.moderatorStyle];
  const leaning = getModeratorLeaning(opts.moderatorStyle, opts.targetId);
  try {
    const res = await fetch(new URL("/api/arena/interview-question", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": opts.deviceId },
      body: JSON.stringify({
        interviewerId: mod.personaId,
        intervieweeId: opts.targetId,
        topic: opts.topic,
        conversationHistory: opts.conversationHistory || [],
        isTransition: !!opts.isTransition,
        previousTopicTitle: opts.previousTopicTitle,
        interviewStyle: leaning === "favor" ? "civil_discourse" : leaning === "target" ? "combative" : "informative",
        moderatorLeaning: leaning,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.text) return truncateAtSentence(String(data.text), 260);
    }
  } catch { /* fall through */ }
  return leaning === "favor"
    ? `So tell us in your own words — what's the real story on ${opts.topic.title}?`
    : `Let's not dance around it — explain yourself on ${opts.topic.title}.`;
}

/**
 * Reacts to a fact-check result for a debater's statement, factoring in the
 * moderator's bias toward that persona. Returns null if the moderator has no
 * strong reaction (neutral persona, or the statement checked out as true).
 */
export function moderatorLieReaction(moderatorStyle: ModeratorStyle, speakerId: string, isLie: boolean): keyof typeof JAB_LIBRARY | null {
  if (!isLie) return null;
  const leaning = getModeratorLeaning(moderatorStyle, speakerId);
  if (leaning === "favor") return "defendLie";
  if (leaning === "target") return "chastiseLie";
  return "chastise";
}

export { playDingSound };
