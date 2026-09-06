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

export type ModeratorStyle = "cenk" | "galloway" | "hannity" | "maddow" | "megynkelly" | "odonnell" | "joyreid" | "maxkellerman" | "stephena" | "kaitlyncollins" | "gilbertgottfried" | "carlin" | "tuckercarlson" | "wandasykes" | "trevornoah" | "janeelliott" | "francescresswelsing" | "shannonsharp" | "dc" | "donlemon" | "piersmorgan" | "mikabrzezinski" | "joescarborough" | "jimlampley" | "georgeforeman" | "michaelbuffer" | "howardcosell" | "samjackson" | "khalidmuhammad" | "kylekulinski" | "mehdihasan";

export const MODERATORS: Record<ModeratorStyle, { name: string; personaId: string; bias: string }> = {
  cenk:             { name: "Cenk Uygur",          personaId: "cenk",             bias: "progressive" },
  galloway:         { name: "George Galloway",      personaId: "galloway",         bias: "anti-imperialist" },
  hannity:          { name: "Sean Hannity",         personaId: "hannity",          bias: "right" },
  maddow:           { name: "Rachel Maddow",        personaId: "maddow",           bias: "left" },
  megynkelly:       { name: "Megyn Kelly",          personaId: "megynkelly",       bias: "right" },
  odonnell:         { name: "Lawrence O'Donnell",   personaId: "odonnell",         bias: "left" },
  joyreid:          { name: "Joy Reid",             personaId: "joyreid",          bias: "left" },
  maxkellerman:     { name: "Max Kellerman",        personaId: "maxkellerman",     bias: "sports" },
  stephena:         { name: "Stephen A. Smith",     personaId: "stephena",         bias: "sports" },
  kaitlyncollins:   { name: "Kaitlan Collins",      personaId: "kaitlyncollins",   bias: "neutral" },
  gilbertgottfried: { name: "Gilbert Gottfried",    personaId: "gilbertgottfried", bias: "chaos" },
  carlin:           { name: "George Carlin",        personaId: "carlin",           bias: "anti-establishment" },
  tuckercarlson:    { name: "Tucker Carlson",        personaId: "tuckercarlson",    bias: "right-populist" },
  wandasykes:       { name: "Wanda Sykes",            personaId: "wandasykes",       bias: "progressive-comedy" },
  trevornoah:       { name: "Trevor Noah",            personaId: "trevornoah",       bias: "outsider-progressive" },
  janeelliott:      { name: "Jane Elliott",           personaId: "janeelliott",      bias: "anti-racist" },
  francescresswelsing: { name: "Dr. Frances Cress Welsing", personaId: "francescresswelsing", bias: "Black-liberation" },
  shannonsharp:        { name: "Shannon Sharpe",            personaId: "shannon",              bias: "Black-progressive-sports" },
  dc:                  { name: "DC",                         personaId: "dc",                   bias: "truth-seeking" },
  donlemon:            { name: "Don Lemon",                  personaId: "donlemon",             bias: "left-center" },
  piersmorgan:         { name: "Piers Morgan",               personaId: "piersmorgan",          bias: "provocateur" },
  mikabrzezinski:      { name: "Mika Brzezinski",            personaId: "mikabrzezinski",       bias: "left-center" },
  joescarborough:      { name: "Joe Scarborough",            personaId: "joescarborough",       bias: "anti-Trump-center" },
  jimlampley:          { name: "Jim Lampley",                personaId: "jimlampley",           bias: "boxing-sports" },
  georgeforeman:       { name: "George Foreman",             personaId: "georgeforeman",        bias: "humble-sports" },
  michaelbuffer:       { name: "Michael Buffer",             personaId: "michaelbuffer",        bias: "boxing-announcer" },
  howardcosell:        { name: "Howard Cosell",              personaId: "howardcosell",         bias: "boxing-sports" },
  samjackson:          { name: "Samuel L. Jackson",          personaId: "samjackson",           bias: "biblical-menace" },
  khalidmuhammad:      { name: "Brother Khalid Muhammad",    personaId: "khalidmuhammad",       bias: "militant-Black-liberation" },
  kylekulinski:        { name: "Kyle Kulinski",              personaId: "kylekulinski",         bias: "democratic-socialist" },
  mehdihasan:          { name: "Mehdi Hasan",                personaId: "mehdihasan",           bias: "adversarial-journalist" },
};

// Which personas each moderator is friendly to ("favor" — softball questions, quick to defend
// against fact-check hits) vs. adversarial to ("target" — hard questions, quick to chastise).
// Anyone not listed is treated as neutral (balanced questions, fact-based reactions only).
export const MODERATOR_LEANINGS: Record<ModeratorStyle, { favor: string[]; target: string[] }> = {
  cenk: {
    favor: ["berniemc", "aoc", "jascrockett", "omar", "maddow", "joyreid", "carville", "obama", "kamala"],
    target: ["trump", "bannon", "miller", "leavitt", "alexjones", "mtg", "loomer", "jimjordan", "netanyahu", "candace"],
  },
  galloway: {
    favor: ["berniemc", "aoc", "omar", "malema", "shahidbolson", "jascrockett", "claudeanderson", "mlk", "malcolmx"],
    target: ["trump", "netanyahu", "biden", "obama", "kamala", "graham", "leavitt", "miller", "erikakirk"],
  },
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
  joyreid: {
    favor: ["obama", "biden", "kamala", "schumer", "aoc", "omar", "maddow", "carville", "berniemc", "jascrockett", "mlk", "malcolmx", "claudeanderson"],
    target: ["trump", "melania", "ivanka", "bannon", "miller", "leavitt", "erikakirk", "pambondi", "jimjordan", "mtg", "loomer", "alexjones", "candace", "timscott"],
  },
  // Sports moderators are not politically aligned — no favor/target lists, always neutral/fact-based.
  maxkellerman: { favor: [], target: [] },
  stephena: { favor: [], target: [] },
  // Collins: CNN journalist — presses MAGA harder but also holds Democrats accountable.
  kaitlyncollins: {
    favor: ["obama", "biden", "kamala", "maddow", "joyreid", "carville", "berniemc"],
    target: ["trump", "bannon", "miller", "leavitt", "alexjones", "mtg", "loomer", "jimjordan"],
  },
  // Gilbert: pure chaos — no favorites, no targets, just comedy carnage.
  gilbertgottfried: { favor: [], target: [] },
  // Carlin: equal-opportunity savage — no favorites anywhere on the political spectrum.
  carlin: { favor: [], target: [] },
  // Tucker: right-populist — openly favors MAGA/anti-establishment, openly hostile to corporate Dems and neocons.
  tuckercarlson: {
    favor: ["galloway", "rfk", "omar", "berniemc", "bannon"],
    target: ["trump", "netanyahu", "graham", "obama", "biden", "kamala", "schumer", "maddow", "joyreid", "aoc", "carville"],
  },
  // Wanda: progressive comedy — tough on MAGA/racists, still roasts Democrats when they're being fools.
  wandasykes: {
    favor: ["obama", "kamala", "aoc", "omar", "jascrockett", "berniemc", "joyreid", "maddow", "carville"],
    target: ["trump", "bannon", "miller", "leavitt", "mtg", "loomer", "alexjones", "candace", "timscott"],
  },
  // Trevor: outsider-progressive — presses everyone from his South African "why is America like this" lens.
  trevornoah: {
    favor: ["obama", "aoc", "berniemc", "omar", "kamala", "jascrockett", "malema"],
    target: ["trump", "bannon", "miller", "leavitt", "alexjones", "mtg", "loomer"],
  },
  // Jane Elliott: zero patience for racism from any direction — targets anyone defending white privilege.
  janeelliott: {
    favor: ["mlk", "malcolmx", "claudeanderson", "arikana", "alishahrazad", "jascrockett", "omar", "aoc"],
    target: ["trump", "bannon", "miller", "candace", "timscott", "alexjones", "mtg", "loomer", "leavitt"],
  },
  // Dr. Welsing: Black liberation lens — challenges ALL participants on white supremacy systemic analysis.
  francescresswelsing: {
    favor: ["malcolmx", "claudeanderson", "mlk", "louisfarrakhan", "arikana", "alishahrazad"],
    target: ["trump", "bannon", "miller", "leavitt", "candace", "timscott", "alexjones"],
  },
  // Shannon: fiercely pro-Black excellence, pro-athlete, anti-Trump; tough on "tokens" and MAGA.
  shannonsharp: {
    favor: ["obama", "kamala", "jascrockett", "omar", "aoc", "mlk", "malcolmx", "claudeanderson", "malema", "joyreid"],
    target: ["trump", "bannon", "miller", "leavitt", "alexjones", "candace", "jesseleepetersen", "ruckus"],
  },
  // DC: pure truth-seeker — fiercely independent, no political alignment.
  dc: { favor: [], target: [] },
  // Don Lemon: left-center CNN — favors progressive/Democratic voices, presses MAGA hard.
  donlemon: {
    favor: ["obama", "kamala", "biden", "aoc", "omar", "jascrockett", "berniemc", "joyreid", "maddow", "carville", "schumer"],
    target: ["trump", "bannon", "miller", "leavitt", "mtg", "loomer", "alexjones", "candace", "jimjordan", "hannity"],
  },
  // Piers: British provocateur — anti-woke, challenges everyone; softer on right/center, hardest on progressive-left.
  piersmorgan: {
    favor: ["trump", "candace", "tuckercarlson", "megynkelly", "hannity", "desantis"],
    target: ["aoc", "omar", "tlaib", "pressley", "jascrockett", "berniemc", "cornellwest"],
  },
  // Mika: MSNBC/left-center — Morning Joe co-host; tough on MAGA, holds Democrats to accountability too.
  mikabrzezinski: {
    favor: ["obama", "kamala", "biden", "aoc", "omar", "jascrockett", "berniemc", "joyreid", "maddow", "schumer", "carville"],
    target: ["trump", "bannon", "miller", "leavitt", "mtg", "loomer", "alexjones", "candace", "jimjordan"],
  },
  // Joe: Anti-Trump Republican turned MSNBC anchor — hardest on MAGA but also presses Dems on weakness.
  joescarborough: {
    favor: ["obama", "kamala", "biden", "maddow", "joyreid", "carville", "berniemc", "rfk"],
    target: ["trump", "bannon", "miller", "leavitt", "mtg", "loomer", "alexjones", "jimjordan", "hannity"],
  },
  // Jim Lampley: Sports-only, no political bias — calls it straight on boxing and sports debates.
  jimlampley: { favor: [], target: [] },
  // George Foreman: Humble, faith-based, sports-focused — genuinely neutral, gentle on everyone.
  georgeforeman: { favor: [], target: [] },
  // Michael Buffer: Pure announcer — no bias, no targets; the ring is neutral ground.
  michaelbuffer: { favor: [], target: [] },
  // Howard Cosell: Straight-shooting sports journalist — no political favor, calls it exactly as he sees it.
  howardcosell: { favor: [], target: [] },
  // Samuel L. Jackson: no political favorites — he runs this stage on principle and profanity alone.
  samjackson: { favor: [], target: [] },
  // Brother Khalid Muhammad: militant Black-liberation lens — favors self-determination voices, hard on establishment figures of any party.
  khalidmuhammad: {
    favor: ["malcolmx", "claudeanderson", "mlk", "louisfarrakhan", "arikana", "alishahrazad", "jascrockett", "omar", "cornellwest", "malema"],
    target: ["trump", "bannon", "miller", "leavitt", "candace", "timscott", "alexjones", "mtg", "loomer", "netanyahu"],
  },
  // Kyle Kulinski: democratic-socialist — favors the progressive/Justice Democrats wing, hard on both MAGA and corporate-establishment Democrats.
  kylekulinski: {
    favor: ["berniemc", "berniesanders", "aoc", "omar", "tlaib", "jascrockett", "richardwolff"],
    target: ["trump", "bannon", "miller", "leavitt", "erikakirk", "mtg", "loomer", "netanyahu", "elon", "graham"],
  },
  // Mehdi Hasan: adversarial-journalist — no political home base, but especially relentless on hypocrisy, Gaza/civil-liberties questions, and power of any stripe.
  mehdihasan: {
    favor: ["omar", "tlaib", "berniemc", "berniesanders"],
    target: ["trump", "netanyahu", "miller", "bannon", "leavitt", "erikakirk", "mtg", "loomer", "piersmorgan"],
  },
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
  // Fires when a maxed-out chain tips into physical-threat territory — moderator forcibly intervenes.
  squabble: [
    "ALRIGHT — ENOUGH. Both of you step back. This is a debate, not a brawl.",
    "HEY. I said ENOUGH. Sit down, cool off, or I will clear this stage. I am not playing.",
    "STOP. Right now. We are done with the theatrics. The next person who escalates gets their mic cut — permanently.",
    "That is IT. I will not have physical threats on this stage. Everyone take a breath or we are done here.",
    "HOLD IT. I don't care who started it — if anyone takes one step forward this debate is OVER. Back off.",
  ],
};

// Per-moderator signature overrides — when a moderator has a distinct enough voice
// (catchphrases, lingo) that generic jabs would feel wrong, override specific kinds here.
// Falls back to JAB_LIBRARY for any kind not listed.
const MODERATOR_JAB_OVERRIDES: Partial<Record<ModeratorStyle, Partial<Record<keyof typeof JAB_LIBRARY, string[]>>>> = {
  samjackson: {
    warn: [
      "Alright, that's enough — say 'one more word' again, I dare you, I DOUBLE dare you.",
      "English, gentlemen — do either of you speak it? One at a time, or Ezekiel's coming for both of you.",
    ],
    chastise: [
      "That was the weakest, most miserable excuse for an answer I have ever had the displeasure of hearing.",
      "You didn't answer a damn thing — you just performed for the cameras. Try that again, for real this time.",
    ],
    cutMic: [
      "And that's the end of that. Mic's off. Sit there and think about the path of the righteous.",
      "Nah. We're done with you for a minute. Go on and meditate on that.",
    ],
    interrupt: [
      "Hold up — HOLD UP. You do not get to just say that and roll on. Break it down for me.",
      "Say that again. I dare you. Say. That. Again.",
    ],
    chastiseLie: [
      "And the tyranny of evil men just got caught lying, right there on the record.",
      "That was a straight-up LIE, and the path of the righteous does not run through dishonesty. Noted.",
    ],
    defendLie: [
      "Now hold on — that's a stretch, not a lie. Let's not strike him down for exaggerating.",
      "I'll extend a little mercy there — that's shading the truth, not full-blown blasphemy.",
    ],
    squabble: [
      "ENGLISH, MOTHERF— gentlemen, do either of you speak it?! SIT. DOWN. Both of you!",
      "That's IT. I have had it with these two squabbling on this stage. Somebody's about to get struck down.",
      "HOLD IT — I will bring the wrath down on BOTH of you if this doesn't stop right now. Back off.",
    ],
  },
  khalidmuhammad: {
    warn: [
      "Hold on now — hold ON. This is a debate, not a shouting match. Discipline, brothers and sisters, discipline!",
      "Order! I said ORDER! You will get your turn to speak your truth — but not like this.",
    ],
    chastise: [
      "That was a weak, watered-down, tap-dancing answer, and you know it! Say something with some BACKBONE!",
      "You did not answer the question — you performed for the cameras like a good little house servant! Try again, and tell the TRUTH this time!",
    ],
    cutMic: [
      "That's it. Mic is OFF. Sit down and reflect on what you just said to these people.",
      "No, no, NO — we are done hearing from you for a minute. Go on and think about that.",
    ],
    interrupt: [
      "Hold it right there! You do not get to say something like that and just keep on rolling! Explain yourself!",
      "Wait a minute, wait a MINUTE — say that again, because I want everybody in here to hear it clearly!",
    ],
    chastiseLie: [
      "And there it is — caught in a bold-faced LIE, right here in front of everybody! Let the record show it!",
      "That was not a mistake, that was a LIE, and I will not let it stand uncorrected on this stage!",
    ],
    defendLie: [
      "Now hold on, hold on — that's an exaggeration, not a lie. Let's not crucify the man for stretching a point.",
      "I'll give a little grace there — that's spin, not a straight-up falsehood.",
    ],
    squabble: [
      "ENOUGH! I said ENOUGH! We are not going to turn this stage into a street brawl — sit DOWN, both of you!",
      "HOLD IT RIGHT THERE! This is supposed to be a battle of IDEAS, not fists! Compose yourselves or I will end this right now!",
      "STOP! I did not come here to referee a schoolyard fight! One more step from either of you and this debate is OVER!",
    ],
  },
};

/** Returns the moderator's signature line for this jab kind if one exists, else the generic pool. */
function pickJabForModerator(kind: keyof typeof JAB_LIBRARY, moderatorStyle?: ModeratorStyle): string {
  const override = moderatorStyle ? MODERATOR_JAB_OVERRIDES[moderatorStyle]?.[kind] : undefined;
  return pick(override && override.length > 0 ? override : JAB_LIBRARY[kind]);
}

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
      if (data?.text) return truncateAtSentence(String(data.text), 420);
    }
  } catch { /* fall through to local */ }
  return pickJabForModerator(opts.kind, opts.moderatorStyle);
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
      if (armed) return; // already armed — prevent self-overlap / double-fire
      const trimmed = truncateAtSentence(text, 75); // ~5 s of TTS — caps overlap window
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

/**
 * Simple immediate moderator line (non-overlap) — for the opening + warnings.
 * Pass { wait: true } to await full audio completion before the promise resolves.
 * Default (no wait) resolves immediately after playback starts so callers can
 * fire-and-forget when they don't need to gate the next step on audio.
 */
export async function speakModeratorNow(
  text: string,
  moderatorId: string,
  opts?: { onDone?: () => void; wait?: boolean },
): Promise<void> {
  const s = await playTTS("/api/persona-speak", { text: truncateAtSentence(text, 420), personaId: moderatorId });
  return new Promise<void>((resolve) => {
    // Safety timeout: if audio never fires didJustFinish (network/codec issue) resolve after 30s
    const timeout = setTimeout(() => { try { s.unloadAsync(); } catch {} opts?.onDone?.(); resolve(); }, 30000);
    s.setOnPlaybackStatusUpdate((st: any) => {
      if (st?.isLoaded && st.didJustFinish) {
        clearTimeout(timeout);
        try { s.unloadAsync(); } catch {}
        opts?.onDone?.();
        resolve();
      }
      if (st?.error) { clearTimeout(timeout); opts?.onDone?.(); resolve(); }
    });
    // Non-blocking mode: resolve as soon as playback is set up
    if (!opts?.wait) { clearTimeout(timeout); resolve(); }
  });
}

export function localJab(kind: keyof typeof JAB_LIBRARY, moderatorStyle?: ModeratorStyle) { return pickJabForModerator(kind, moderatorStyle); }

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
  onAccessDenied?: () => void;
  /**
   * The debate's selected format (combative/comedic/civil_discourse/roast/
   * softball/educational/informative) — drives the MODERATOR's overall tone
   * server-side. Falls back to a leaning-derived style if omitted so older
   * callers keep working.
   */
  debateStyle?: string;
}): Promise<string> {
  const mod = MODERATORS[opts.moderatorStyle];
  const leaning = getModeratorLeaning(opts.moderatorStyle, opts.targetId);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(new URL("/api/arena/interview-question", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": opts.deviceId },
      signal: controller.signal,
      body: JSON.stringify({
        interviewerId: mod.personaId,
        intervieweeId: opts.targetId,
        topic: opts.topic,
        conversationHistory: opts.conversationHistory || [],
        isTransition: !!opts.isTransition,
        previousTopicTitle: opts.previousTopicTitle,
        interviewStyle: opts.debateStyle || (leaning === "favor" ? "civil_discourse" : leaning === "target" ? "combative" : "informative"),
        moderatorLeaning: leaning,
        isModerator: true,
      }),
    });
    if (res.status === 403) {
      opts.onAccessDenied?.();
      return "";
    }
    if (res.ok) {
      const data = await res.json();
      if (data?.text) return truncateAtSentence(String(data.text), 420);
    }
  } catch { /* fall through */ }
  finally {
    clearTimeout(timeoutId);
  }
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

// ── DODGE DETECTION ────────────────────────────────────────────────────────
// Lightweight text-based signals that an answer is evasive rather than direct.
const DODGE_SIGNALS: RegExp[] = [
  /\bwhat('s| is) (really |truly )?(important|the issue|at stake|we need|we should)\b/i,
  /\blet me be (very |crystal )?(clear|honest|direct)\b/i,
  /\b(the real|the actual|the true) (question|issue|problem|story)\b/i,
  /\b(look|listen|hear me out),?\s+(what|the)/i,
  /\b(my|our) (record|history|track record) (shows|speaks|demonstrates)\b/i,
  /\b(I've|I have) (always|consistently|repeatedly) (said|believed|stood)\b/i,
  /\b(instead|rather),? (let's|we should|we need to) (focus|talk|discuss)\b/i,
  /\bwhat (the American people|people|voters|everyone) (really |truly )?(want|need|care about)\b/i,
  /\b(that's a) (great|fair|interesting|loaded) question\b/i,
  /\bI (think|believe|feel) (the bigger|the larger|what's more important)\b/i,
];

/**
 * Returns true if the answer text shows evasion signals — pivot-heavy
 * non-answers, deflection openers, or answers that ignore the actual question.
 * Intentionally conservative: false negatives are fine; false positives should
 * be avoided so the moderator doesn't badger debaters who gave real answers.
 */
export function detectDodge(text: string): boolean {
  if (!text) return false;
  // Very short answers (< 25 words) that open with a pivot signal are likely dodges
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount < 25 && DODGE_SIGNALS.some((p) => p.test(text))) return true;
  // Longer answers that are packed with multiple dodge signals
  const signalCount = DODGE_SIGNALS.filter((p) => p.test(text)).length;
  return signalCount >= 2;
}

// ── BIAS-AWARE DODGE FOLLOW-UP PRESS ──────────────────────────────────────
// Fired only when: (1) the primary debater dodged the question AND
// (2) the moderator's leaning toward that debater is "target".
// Kept short (~1 sentence) so they land as a sharp cut-in, not a monologue.
const DODGE_PRESS_LINES: string[] = [
  "That didn't answer the question. Try again — and this time actually address what was asked.",
  "You heard the question. I'd like an answer, not a speech.",
  "That's a non-answer and we all know it. One more shot — what's your actual position?",
  "I'm going to need you to be more direct. What is your answer?",
  "You pivoted. I noticed. The question was specific — please respond to it.",
  "That was impressive evasion, but I'm still waiting for the answer.",
  "One more time, because I don't think you heard it: answer the question.",
  "You didn't answer that. The audience deserves a real response.",
];

/** Returns a random dodge-press line for a targeted debater who just dodged. */
export function getDodgePressLine(): string {
  return DODGE_PRESS_LINES[Math.floor(Math.random() * DODGE_PRESS_LINES.length)];
}

/**
 * Per-moderator squabble bridge lines — spoken when the moderator forces a
 * topic switch after a fireback chain hits its limit. Each style has 3 lines
 * so repeat-listeners hear variety; lines are written in the moderator's voice.
 */
const SQUABBLE_BRIDGE_LINES: Record<string, string[]> = {
  cenk: [
    "Okay, BOTH of you — we are moving on! That exchange proved nothing and I'm not letting it continue.",
    "I'm shutting this down right now. New topic. The progressive case demands better than what you just showed.",
    "That's it! Topic closed. The people deserve a real debate, not a street fight — let's go.",
  ],
  galloway: [
    "Enough of this pantomime. We are moving to the next topic — whether you like it or not.",
    "This exchange is finished. History will not remember your bickering — let us discuss something that matters.",
    "I'm invoking my authority as moderator. New subject. Compose yourselves, gentlemen.",
  ],
  hannity: [
    "Alright, I'm calling it — we're moving on. Americans want answers, not a circus.",
    "New topic, right now. The folks at home deserve substance, not this back-and-forth nonsense.",
    "Topic switch. I've seen enough. Let's get back to the real issues facing this country.",
  ],
  maddow: [
    "I need to stop you both — we're moving to the next topic. The record will reflect what just happened here.",
    "Let me be clear: this exchange is over. We have more ground to cover and the facts demand it.",
    "Stepping in here. New topic — because what just happened needs no further commentary from me.",
  ],
  megynkelly: [
    "That is over. Moving on — and I'll remind both of you that this is a debate, not a sparring match.",
    "New topic, right now. I have a lot of questions left and zero patience for more of that.",
    "We're done with that subject. I'm taking us to the next topic whether you're ready or not.",
  ],
  odonnell: [
    "I have to step in here — that exchange is finished. New topic, immediately.",
    "Let me be very clear: we are moving on. That kind of discourse serves no one in this room.",
    "Topic closed. I won't allow this debate to descend any further — next subject, now.",
  ],
  joyreid: [
    "Okay! We are DONE with that. Moving on — because I refuse to let this become a spectacle.",
    "New topic. Right now. I have been in rooms like this before and I know when it's time to cut bait.",
    "That exchange is over. I'm not letting this go any further — next topic, let's go.",
  ],
  maxkellerman: [
    "Clock's stopped. New topic — same rules apply, let's keep it clean.",
    "Moving on. We've got more ground to cover and I'm not letting one bad round define this whole debate.",
    "Topic switch. Shake it off and come out ready to debate — not brawl.",
  ],
  stephena: [
    "HOLD ON! We are MOVING ON! I have seen better composure in a locker room at halftime — let's GO!",
    "New topic — RIGHT NOW. I will NOT sit here and let this debate fall apart on my watch!",
    "That is ENOUGH! Topic switch, and I expect BOTH of you to bring something better to the table!",
  ],
  kaitlyncollins: [
    "I'm going to move us to the next topic — both of you had the chance to make your case and chose this instead.",
    "New topic. My job is to get answers, not referee a fight, so let's try this again.",
    "We're moving on. I'll note that neither of you exactly covered yourself in glory just now.",
  ],
  gilbertgottfried: [
    "OH MY GOD, ENOUGH! NEW TOPIC! My EARS are BLEEDING! MOVE IT!",
    "I AM SWITCHING TOPICS WHETHER YOU LIKE IT OR NOT! THIS IS MY SHOW NOW!",
    "NEXT TOPIC! IMMEDIATELY! You're BOTH giving me a headache and I have a VERY sensitive head!",
  ],
  carlin: [
    "Beautiful. Two more cogs proving the machine eats itself. Moving on — not that it'll be any different.",
    "And there it is, folks — democracy in action. New topic. Try not to embarrass the species further.",
    "Topic switch. Because apparently this is what passes for political discourse in the land of the free.",
  ],
  tuckercarlson: [
    "Let me stop you both there — whoever controls the topic controls the debate, and I'm controlling it. Moving on.",
    "New topic. And I'd encourage both of you to think about why that exchange happened the way it did.",
    "That's enough. Nobody watching at home learned anything from that. Next subject.",
  ],
  wandasykes: [
    "Oh no — no, no, no. We are NOT doing this. New topic, and I suggest y'all both take a breath.",
    "Moving on! Because what I just witnessed was not a debate, it was a cry for help — from both of you.",
    "Topic switch. And I say that with love — but also with very little patience left.",
  ],
  trevornoah: [
    "Okay — and THIS is why the rest of the world watches American politics for entertainment. New topic.",
    "Moving on! Because as an outsider I can tell you that what just happened makes no sense to anyone.",
    "New topic. And maybe — just maybe — try to sound slightly more reasonable this time? For me?",
  ],
  janeelliott: [
    "We are DONE with that exchange. New topic — and I expect both of you to do better.",
    "Moving on. What you just displayed was not debate, it was ego. We can do better than that.",
    "Topic switch. Right now. This room deserves more than what you two just gave it.",
  ],
  francescresswelsing: [
    "That exchange is finished. We are moving to the next topic — the analysis demands it.",
    "New topic. Because what just occurred reflects a pattern I have documented extensively, and it changes nothing.",
    "Moving on. The system benefits when we fight each other instead of examining the structure. Next subject.",
  ],
  shannonsharp: [
    "HOLD ON! We are MOVING ON! My granddaddy used to say — 'When two fools fight, the house burns down.' NEW TOPIC. Let's GO!",
    "UNDISPUTED — that exchange is OVER! I'm calling a timeout right now. New topic, and I expect BETTER from both of you!",
    "That is ENOUGH! Topic switch, IMMEDIATELY! Uncle Shay Shay is NOT having this on his stage — bring some RESPECK to this debate!",
  ],
  dc: [
    "That exchange is over. We came here for truth — not theatre. New topic.",
    "I'm bringing this to a close. What you just witnessed was heat without light. Moving on.",
    "Enough. The room deserves better than what you two just gave it. New subject — right now.",
  ],
  donlemon: [
    "Okay — we are DONE with that. New topic. And I say that as someone who has watched this kind of nonsense on live television for twenty years.",
    "I'm calling it right now. New topic. Because what just happened there was not debate — it was a mess.",
    "Topic switch. Immediately. I did not get fired from CNN to come here and watch you two do THIS. Let's move.",
  ],
  piersmorgan: [
    "Right — that's quite enough of that. We're moving on, and frankly, you should both be embarrassed.",
    "I've seen better conduct in a tabloid newsroom on deadline. New topic. Try to be at least marginally coherent this time.",
    "That is OVER. I'm taking control of this debate right now. New subject — and I suggest you both bring something worth watching.",
  ],
  _default: [
    "We're moving on — this topic is closed. Let's keep it professional.",
    "That's enough on that. We are switching topics right now.",
    "I'm calling a formal time-out. New topic — starting now.",
  ],
};

/**
 * Per-moderator biased squabble-bridge lines — spoken when one debater is
 * clearly "the enemy" of this moderator. Use `{target}` as the placeholder
 * for the blamed debater's display name; it is replaced at call time.
 * Only defined for opinionated moderators; neutral/sports mods fall back to
 * the regular SQUABBLE_BRIDGE_LINES pool.
 */
const SQUABBLE_BRIDGE_BIASED_LINES: Record<string, string[]> = {
  cenk: [
    "ENOUGH. {target} — you came here looking for a fight, and this is what that looks like. Moving on.",
    "That's done. {target}, you have been the aggressor in this exchange and the audience can see it. New topic.",
    "I'm shutting this down. {target}, if you can't debate ideas without threatening people, you have no business on this stage. We're moving on.",
  ],
  hannity: [
    "That's enough — and {target}, this is exactly what the radical left does when they can't win on ideas. New topic.",
    "Moving on. {target}, you just showed everyone watching exactly who you are. Americans deserve better. Next subject.",
    "We are DONE. {target}, that kind of behavior is why people don't trust your side. Let's get back to real issues.",
  ],
  maddow: [
    "We're moving on — and I want the record to show that {target} just demonstrated, live on this stage, exactly what we've been documenting. New topic.",
    "That exchange is over. {target}, you came here to bully, not to debate, and I think everyone watching saw that. Moving on.",
    "New topic. The facts will stand. {target}, that kind of behavior belongs in the past — and so do the ideas behind it.",
  ],
  megynkelly: [
    "New topic — and {target}, I'll say this plainly: that outburst told us everything we need to know. Moving on.",
    "That's done. {target}, I've covered a lot of debates and that was embarrassing. The audience deserves substance. Next subject.",
    "Moving on. {target}, you can't bully your way through a debate. That's noted, and we're going to a new topic.",
  ],
  joyreid: [
    "Oh, we are DONE with this. {target} — I have seen this playbook before and it doesn't work here. New topic, right now.",
    "Moving on. {target}, let me be clear: coming in here with threats instead of arguments is not debate — it's intimidation. We're past it.",
    "New topic. {target}, the people in this room can see exactly what you just tried to do. It didn't work. Let's move.",
  ],
  odonnell: [
    "I'm stepping in — we are done here. {target}, that kind of escalation is exactly what I will not permit on this stage. New topic.",
    "Moving on. {target}, this is not how civilized debate works. The record reflects what just happened. New subject.",
    "Topic closed. {target}, the audience should note that you chose threats over argument. We're moving forward.",
  ],
  galloway: [
    "Enough of this. {target} — you have behaved tonight exactly as I expected from your ideological tradition. We move on.",
    "That exchange is finished. {target}, history has seen this kind of aggression before and it always loses. New topic.",
    "I am invoking my authority. {target}, your conduct has been noted and will be remembered. Moving on.",
  ],
  tuckercarlson: [
    "That's enough. {target} — the audience should ask themselves why you always resort to this when you're losing an argument. New topic.",
    "Moving on. {target}, the establishment always reaches for intimidation when the facts don't cooperate. We all just saw it. Next subject.",
    "New topic. And {target} — that reaction tells you more about their agenda than anything they could have said.",
  ],
  wandasykes: [
    "Oh HELL no — we are NOT doing this. {target}, you need to sit all the way down right now. Moving on.",
    "New topic. {target}, what you just pulled is not debate — it's exactly what I've been talking about. I have ZERO patience for it.",
    "Moving on! {target}, what you just did was inexcusable. New subject.",
  ],
  trevornoah: [
    "And THAT is why the rest of the world thinks American politics is broken. {target}, you just made my point for me. New topic.",
    "Moving on. {target}, as an outsider looking in, I have to say — that was not a good look. At all. New subject.",
    "New topic. {target}, I came here hoping to be proven wrong about how these debates go. You did not help. Moving on.",
  ],
  janeelliott: [
    "We are DONE. {target} — I have spent fifty years watching this behavior and I will not sit here and validate it. New topic.",
    "Moving on. {target}, what you just displayed is a textbook example of exactly what I teach people to recognize. We're past it.",
    "Topic switch. {target}, this room expects better than what you just showed. New subject.",
  ],
  francescresswelsing: [
    "That exchange is finished. {target} — your behavior tonight is consistent with a pattern I have documented for decades. We move on.",
    "Moving on. {target}, the system benefits when we tear each other apart instead of examining the structure. New topic.",
    "New topic. {target}, I want the audience to analyze what they just saw and ask: who benefits from that kind of disruption?",
  ],
  shannonsharp: [
    "HOLD ON — we are MOVING ON. {target}, Uncle Shay Shay sees EXACTLY what you're doing and it is NOT it. New topic, immediately!",
    "UNDISPUTED — {target} just showed out in the WRONG way on this stage. New topic. Let's GO!",
    "That is ENOUGH from {target}! My granddaddy didn't raise me to sit here and watch that. MOVING ON — bring some RESPECK!",
  ],
  kaitlyncollins: [
    "Moving on — and {target}, you just made this about yourself instead of the topic. New subject.",
    "New topic. {target}, I ask hard questions because I expect real answers. What you just gave us was neither. Moving on.",
    "That exchange is over. {target}, you chose to escalate rather than debate. The audience saw it. New topic.",
  ],
  mikabrzezinski: [
    "Moving on. {target}, that kind of response is exactly why this conversation needed a moderator. New topic.",
    "We're moving forward. {target}, let's stay focused on what actually matters to the people watching. New subject.",
    "Topic closed. {target}, I'd like a real answer next time — not a performance. New topic.",
  ],
  joescarborough: [
    "OKAY — look — I've been in Congress, I've been in television, and I have NEVER seen anything like {target} just did. New topic. Moving on!",
    "Let me tell you something — {target}, that kind of behavior is EXACTLY what's wrong with this whole thing. New subject!",
    "We are MOVING ON. {target}, my friends at the Reagan Library would be appalled. New topic. Let's go.",
  ],
  jimlampley: [
    "And the referee steps in. {target}, that last exchange stepped outside the rules of the fight. New topic — come out clean.",
    "Round closed. {target}, what happened there wasn't boxing — it was brawling. Back to the center of the ring. New topic.",
    "New subject. {target}, in thirty years of calling fights I've seen cleaner exits from a cornered fighter. Let's go.",
  ],
  georgeforeman: [
    "Alright now, let's take a breath. {target}, the Lord taught me — grace under pressure. New topic, bless you.",
    "Moving on. {target}, I know it gets heated but we're better than this. New subject.",
    "New topic. {target}, I believe in second chances. This is yours. Let's go.",
  ],
  michaelbuffer: [
    "Ladies and gentlemen — in the interest of the contest, we move to the next subject. {target}, the judges have noted what occurred. New topic.",
    "The action is stopped. {target}, consider this a warning from the referee. New topic — let's keep it clean.",
    "New round. {target}, this contest is decided on skill, not intimidation. The debate continues.",
  ],
  howardcosell: [
    "I am going to tell it exactly as it is — {target}, what you just did was beneath this stage and everyone watching knows it. New topic.",
    "Moving on — and {target}, I have called Ali-Frazier, I have called the Rumble in the Jungle, and I have never seen behavior like that from anyone who calls themselves a champion. New topic.",
    "New subject. {target}, I report what I see, and what I see is a person who just lost the room. Moving on.",
  ],
};

/**
 * Returns a squabble-bridge line for the given moderator style.
 * When `debaterIds` and `debaterNames` are provided, checks whether one
 * debater is clearly "the enemy" of this moderator and, if so, picks a line
 * that implicitly assigns blame toward that debater. Falls back to the neutral
 * per-moderator pool when both sides are neutral/equally disliked, or when
 * no debater context is passed.
 */
export function getSquabbleBridge(
  style: ModeratorStyle,
  debaterIds?: [string, string],
  debaterNames?: [string, string],
): string {
  if (debaterIds && debaterNames) {
    const [idA, idB] = debaterIds;
    const [nameA, nameB] = debaterNames;
    const leaningA = getModeratorLeaning(style, idA);
    const leaningB = getModeratorLeaning(style, idB);

    // Only assign blame when exactly ONE side is the moderator's "target" — if
    // both are targets (or both are neutral/favored) we stay neutral.
    let targetName: string | null = null;
    if (leaningA === "target" && leaningB !== "target") {
      targetName = nameA;
    } else if (leaningB === "target" && leaningA !== "target") {
      targetName = nameB;
    }

    if (targetName) {
      const biasedLines = SQUABBLE_BRIDGE_BIASED_LINES[style];
      if (biasedLines?.length) {
        const raw = biasedLines[Math.floor(Math.random() * biasedLines.length)];
        return raw.replace("{target}", targetName);
      }
    }
  }

  // Neutral fallback — existing per-moderator lines
  const lines = SQUABBLE_BRIDGE_LINES[style] ?? SQUABBLE_BRIDGE_LINES["_default"];
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * Per-moderator squabble closer lines — spoken when the debate ends because a
 * fireback chain exhausts the final topic. Each style has 2–3 in-character lines.
 */
const SQUABBLE_CLOSER_LINES: Record<string, string[]> = {
  cenk: [
    "That's it — debate's over. You both proved tonight that the progressive case needs better messengers. Good night.",
    "We're done here. The people watching deserved better than what you gave them. Good night.",
    "And that is where we leave it. The fight continues — just not on this stage, not tonight.",
  ],
  galloway: [
    "And so it ends — not with enlightenment, but with noise. History will judge what happened here tonight. Good night.",
    "This debate is finished. The empire of ideas collapses when its defenders resort to this. Good night.",
    "We conclude. Whether anything was learned tonight is a question I leave to the viewers. Good night.",
  ],
  hannity: [
    "And that's a wrap, folks. Americans saw everything they needed to see tonight. Good night.",
    "We're done. The real winners tonight are the people at home who watched the truth emerge. Good night.",
    "That's all she wrote. Thanks for watching — this has been one for the books. Good night.",
  ],
  maddow: [
    "And with that, this debate is over. The record speaks for itself. Good night, everyone.",
    "We're closing the books on tonight's debate. The facts, as always, will outlast the noise. Good night.",
    "That is our final note. Thank you to everyone who watched — the truth is in the transcript. Good night.",
  ],
  megynkelly: [
    "And we're done. I've hosted a lot of debates — this one will be remembered. Good night.",
    "That's a close. Whatever you thought going in tonight, you saw something real. Good night.",
    "This debate is over. I'll let the audience decide who won. Good night.",
  ],
  odonnell: [
    "And that brings this debate to a close. I think the record is perfectly clear. Good night.",
    "We're finished here tonight. The discourse may have broken down, but the facts did not. Good night.",
    "This debate is adjourned. Thank you for watching — and for caring enough to stay. Good night.",
  ],
  joyreid: [
    "Okay — we are DONE. This debate is over, and I have seen enough. Good night, everybody.",
    "That's a close. I've been in this business a long time and tonight was something else. Good night.",
    "And that is IT. Debate's over. You know what you saw. Good night.",
  ],
  maxkellerman: [
    "Final bell. Debate's over — scorecards will vary but the tape doesn't lie. Good night.",
    "And that's the final round. Thank you both — however it went, you left it all on the stage. Good night.",
    "Clock hits zero. This debate is done. Good night, everyone.",
  ],
  stephena: [
    "THAT IS IT! This debate is OVER! And I want BOTH of you to think about what happened here tonight! Good night!",
    "FINAL WORD — this debate is FINISHED! The people at home saw EVERYTHING! Good night!",
    "We are DONE HERE! Debate's closed! I have seen a LOT of debates and THIS was something else! Good night!",
  ],
  kaitlyncollins: [
    "And that's where we end tonight's debate. Thank you both — and thank you for watching. Good night.",
    "This debate is over. The questions were asked; the answers are for you to judge. Good night.",
    "We're closing out tonight's debate. I'll let the record speak for itself. Good night.",
  ],
  gilbertgottfried: [
    "IT'S OVER! THANK GOD IT'S OVER! MY NERVES CANNOT TAKE ANOTHER SECOND OF THIS! GOOD NIGHT!",
    "THE DEBATE IS DONE! I AM GOING HOME! THIS WAS THE WORST AND BEST NIGHT OF MY LIFE! GOOD NIGHT!",
    "FINISHED! DONE! KAPUT! YOU'RE ALL DISMISSED! GOOD NIGHT AND DON'T COME BACK!",
  ],
  carlin: [
    "And there we have it — democracy's finest hour. Go home, folks. Nothing was solved. Good night.",
    "The debate is over. The problems remain. Sleep tight. Good night.",
    "That's all. Two people argued, nobody changed their mind, and the machine rolls on. Good night.",
  ],
  tuckercarlson: [
    "That's our show. Ask yourself why this debate ended the way it did — and who benefits. Good night.",
    "Debate's over. The establishment got what it wanted tonight — noise instead of answers. Good night.",
    "And we're done. Make of that what you will. I know what I think. Good night.",
  ],
  wandasykes: [
    "And that is a WRAP, baby. I cannot. I literally cannot with either of you. Good night, everybody.",
    "Debate's over — and I need a drink. You all saw what happened. Good night.",
    "Done! Finished! Closed! And I say that with a whole lot of love and zero patience. Good night.",
  ],
  trevornoah: [
    "And that's it — the debate is over. As an outsider, I can confirm: this was very American. Good night.",
    "We're done here. I moved thousands of miles away from chaos and somehow found more of it. Good night.",
    "Debate's closed. Thank you both — and thank you all for watching the world's greatest reality show. Good night.",
  ],
  janeelliott: [
    "This debate is over. And I hope every person watching tonight learned something about themselves. Good night.",
    "We're done. The work of dismantling ignorance continues tomorrow — but tonight's session is closed. Good night.",
    "Finished. This room saw what it needed to see. Now go do something with it. Good night.",
  ],
  francescresswelsing: [
    "This debate is concluded. The analysis does not end here — it never ends. Good night.",
    "We are finished for tonight. The system we discussed will still be operating when you wake up. Good night.",
    "The debate closes. The struggle for understanding continues. Good night to all who were paying attention.",
  ],
  shannonsharp: [
    "UNDISPUTED — this debate is OVER! Uncle Shay Shay has seen enough tonight! Good night, everybody!",
    "That's a CLOSE! My granddaddy used to say — 'When it's done, it's DONE.' Good night!",
    "We are FINISHED! And I want BOTH of y'all to think long and hard about tonight! GOOD NIGHT!",
  ],
  mikabrzezinski: [
    "And with that, this debate is over. I hope both of you take something useful from tonight. Good night.",
    "We're done. The facts are still what they are. Good night, everyone.",
    "This debate is closed. Thank you for watching — and thank you for caring enough to want the truth. Good night.",
  ],
  joescarborough: [
    "And THAT IS IT — let me tell you, folks, I've been in Congress, I've been in cable news, and this was SOMETHING. Good night, everybody!",
    "We're done! And I want to say — and I've said it before — what you just witnessed is exactly what's at stake in this country. Good night!",
    "Debate's over. Mika would tell me to wrap it up. She's right. Good night, everyone.",
  ],
  jimlampley: [
    "Final bell. A great contest deserves a proper close — and this was one for the record books. Good night.",
    "The fight is over. Both contestants left everything in the ring. Whatever the scorecard says, the effort was real. Good night.",
    "And that is the end. Thirty years of calling fights, and this one will stay with me. Good night, everybody.",
  ],
  georgeforeman: [
    "Well — I've been in the big fights and I've been in the little ones and this was something special. God bless you all. Good night.",
    "That's it! Both of these fine people came in here and gave it everything. I'm proud of them. Good night, everybody!",
    "We're done here. Thank the Lord for good debates and good people. Good night!",
  ],
  michaelbuffer: [
    "Ladies and gentlemen — the contest is concluded. Your applause for both competitors. Good night!",
    "And THAT... is the final bell. Tonight's debate is officially in the books. GOOD NIGHT, EVERYBODY!",
    "The judges have their scorecards. This debate — for the ages — is OVER. Ladies and gentlemen, GOOD NIGHT!",
  ],
  howardcosell: [
    "And so it concludes — as I always say, telling it like it is means telling it to the end. Good night.",
    "That is the final word on tonight's contest. I have given you my honest assessment throughout, as I always do, as I always will. Good night.",
    "This debate is over. Whatever the outcome, the truth was told here tonight — at least by one of us. Good night, everybody.",
  ],
  _default: [
    "That's all the time we have. This debate is over — thank you both. Good night.",
    "With that, we're done. This has been… quite a debate. Good night.",
    "I'm calling this debate to a close. Thank you, and good night.",
  ],
};

/**
 * Returns a random squabble-closer line for the given moderator style.
 * Falls back to the generic default if the style isn't found.
 */
export function getSquabbleCloser(style: ModeratorStyle): string {
  const lines = SQUABBLE_CLOSER_LINES[style] ?? SQUABBLE_CLOSER_LINES["_default"];
  return lines[Math.floor(Math.random() * lines.length)];
}

export { playDingSound };
