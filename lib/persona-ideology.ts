/**
 * IDEOLOGY-AWARE INTERRUPTION RULES
 * ──────────────────────────────────────────────────────────────────────────
 * Classifies personas into broad ideological "camps" so the debate/interview
 * interruption engines (fireback chains, sarcastic asides, squabbles) can
 * tell allies apart from opponents:
 *
 *   • Allies (same camp)      → may only interrupt each other POLITELY, for
 *                                clarity ("Excuse me, Dr. Anderson, but—" →
 *                                "Yes, ___?"). Never a rude/aggressive cut-in.
 *   • Opponents (different    → may interrupt either rudely or respectfully;
 *     camp, or explicit         this is where real firebacks/squabbles live.
 *     hard-rival pair)
 *   • Trump                  → exempt from the ally restriction entirely. He
 *                                can talk over anyone, ally or foe, and how
 *                                often/harshly scales with his own heat level.
 *
 * Coverage is best-effort: only personas with a clear real-world ideological
 * lane are classified. Anyone left unmapped falls back to "neutral", which
 * behaves exactly like today (no ally restriction applied) — this keeps the
 * rollout additive and never silently weakens an existing dynamic.
 */

export type IdeologyCamp =
  | "maga-right"
  | "progressive-left"
  | "black-empowerment"
  | "media-centrist"
  | "populist-independent"
  | "sports-neutral"
  | "neutral";

export const PERSONA_CAMP: Record<string, IdeologyCamp> = {
  // ── MAGA / American right ──────────────────────────────────────────────
  trump: "maga-right",
  bannon: "maga-right",
  desantis: "maga-right",
  jdvance: "maga-right",
  gaetz: "maga-right",
  mtg: "maga-right",
  tedcruz: "maga-right",
  marcorubio: "maga-right",
  ivanka: "maga-right",
  leavitt: "maga-right",
  loomer: "maga-right",
  erikakirk: "maga-right",
  stephena: "maga-right",
  jimjordan: "maga-right",
  jesseleepetersen: "maga-right",
  hannity: "maga-right",
  tuckercarlson: "maga-right",
  candace: "maga-right",
  mcconnell: "maga-right",
  graham: "maga-right",
  pambondi: "maga-right",
  miller: "maga-right",
  netanyahu: "maga-right",
  ronaldreagan: "maga-right",
  georgewbush: "maga-right",
  timscott: "maga-right",
  melania: "maga-right",

  // ── Progressive / Democratic left ──────────────────────────────────────
  obama: "progressive-left",
  biden: "progressive-left",
  kamala: "progressive-left",
  aoc: "progressive-left",
  omar: "progressive-left",
  tlaib: "progressive-left",
  pressley: "progressive-left",
  berniemc: "progressive-left",
  rfk: "progressive-left",
  joyreid: "progressive-left",
  maddow: "progressive-left",
  schumer: "progressive-left",
  hillaryclinton: "progressive-left",
  billclinton: "progressive-left",
  mikabrzezinski: "progressive-left",
  joescarborough: "progressive-left",
  trevornoah: "progressive-left",
  wandasykes: "progressive-left",
  cenk: "progressive-left",
  rosie: "progressive-left",
  odonnell: "progressive-left",

  // ── Black-empowerment / pan-African lane ───────────────────────────────
  claudeanderson: "black-empowerment",
  malcolmx: "black-empowerment",
  mlk: "black-empowerment",
  louisfarrakhan: "black-empowerment",
  francescresswelsing: "black-empowerment",
  arikana: "black-empowerment",
  malema: "black-empowerment",
  janeelliott: "black-empowerment",

  // ── Media / academic centrists ──────────────────────────────────────────
  megynkelly: "media-centrist",
  kaitlyncollins: "media-centrist",
  neiltyson: "media-centrist",
  carlsagan: "media-centrist",
  professorjiang: "media-centrist",

  // ── Populist / independent / contrarian ────────────────────────────────
  rfkjr: "populist-independent",
  jessventura: "populist-independent",
  joerogan: "populist-independent",
  alexjones: "populist-independent",
  gallowaygj: "populist-independent",
  galloway: "populist-independent",

  // ── Sports / entertainment (non-political, treated as a shared lane) ───
  floydmayweather: "sports-neutral",
  georgeforeman: "sports-neutral",
  michaelbuffer: "sports-neutral",
  howardcosell: "sports-neutral",
  jimlampley: "sports-neutral",
  skipbayless: "sports-neutral",
  shannon: "sports-neutral",
};

/**
 * Explicit rival overrides — pairs that must ALWAYS be treated as opponents
 * even if a future camp change would otherwise group them together (e.g.
 * they share a broad lane but have a personal/ideological feud carved out
 * in their persona prompts). Order doesn't matter; checked both directions.
 */
const HARD_RIVAL_PAIRS: [string, string][] = [
  ["claudeanderson", "ruckus"],
  ["claudeanderson", "pastormanning"],
];

function isHardRivalPair(a: string, b: string): boolean {
  return HARD_RIVAL_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export function getCamp(personaId: string): IdeologyCamp {
  return PERSONA_CAMP[personaId] ?? "neutral";
}

export function isTrump(personaId: string): boolean {
  return personaId === "trump";
}

/**
 * True when two personas should be treated as ideological ALLIES for
 * interruption purposes — same known camp, not a carved-out hard rivalry,
 * and neither is Trump (he is never bound by the ally restriction).
 */
export function areAllied(a: string, b: string): boolean {
  if (a === b) return false;
  if (isTrump(a) || isTrump(b)) return false;
  if (isHardRivalPair(a, b)) return false;
  const campA = getCamp(a);
  const campB = getCamp(b);
  if (campA === "neutral" || campB === "neutral") return false;
  return campA === campB;
}

/** Short, in-character "excuse me" openers used when an ALLY interrupts only for clarity. */
const ALLY_CLARITY_OPENERS = [
  "Excuse me, {name}, but—",
  "Sorry to jump in, {name}, but—",
  "Real quick, {name}, before you go on—",
  "If I can just add to that, {name}—",
];

/** The interrupted persona's warm, welcoming reply to a polite ally interruption. */
const ALLY_CLARITY_REPLIES = [
  "Yes, {name}?",
  "Go ahead, {name}.",
  "Of course — what is it, {name}?",
];

function fillName(template: string, name: string): string {
  return template.replace(/\{name\}/g, name);
}

export function getAllyClarityOpener(interrupterName: string): string {
  const t = ALLY_CLARITY_OPENERS[Math.floor(Math.random() * ALLY_CLARITY_OPENERS.length)];
  return fillName(t, interrupterName);
}

export function getAllyClarityReply(interrupterName: string): string {
  const t = ALLY_CLARITY_REPLIES[Math.floor(Math.random() * ALLY_CLARITY_REPLIES.length)];
  return fillName(t, interrupterName);
}

/**
 * Signature "you interrupted me" reactions for named personas, spoken the
 * instant they get cut off before they resume their point. Each entry pairs
 * a short address (aimed at the interrupter) with the resume phrase that
 * bridges back into their continuation. Personas without an entry fall back
 * to GENERIC_INTERRUPT_STYLE, and the AI-generated continuation (already
 * fed `wasInterrupted`/`interruptionText`) handles the rest in-character.
 */
/**
 * `address` is the mild/respectful pool (used for a respectful pushback,
 * severity < 2). `rudeAddress`, when present, is swapped in for a genuinely
 * rude cut-in (severity >= 2) so the interrupted persona "responds in kind" —
 * matching the energy of how they were interrupted instead of always
 * reaching for the same line regardless of tone. Personas without a
 * `rudeAddress` just reuse `address` for both cases.
 */
export type InterruptStyle = { address: string[]; rudeAddress?: string[]; resume: string[] };

export const PERSONA_INTERRUPT_STYLE: Record<string, InterruptStyle> = {
  arikana: {
    address: ["Are you finished?", "Excuse me — are you quite finished?"],
    rudeAddress: ["Do NOT cut me off like that!", "You will not talk over me — are you finished?"],
    resume: ["As I was saying, before I was so rudely interrupted—", "Now, as I was saying—"],
  },
  claudeanderson: {
    address: ["You'll get your chance!", "Hold on now — you'll get your chance!"],
    rudeAddress: ["Shut them the hell up! You see me talking!", "Don't you EVER cut me off again!"],
    resume: ["Anyway—", "As I was saying, anyway—"],
  },
};

const GENERIC_INTERRUPT_STYLE: InterruptStyle = {
  address: ["Let me finish.", "Hold on — let me finish my point.", "I wasn't done."],
  rudeAddress: ["Hey! I wasn't finished!", "Don't cut me off like that!", "Excuse you — I was talking!"],
  resume: ["As I was saying—", "Anyway, as I was saying—"],
};

/**
 * Every persona is "aware" of being interrupted, not just the two named
 * above — anyone without a bespoke entry falls back to a fully generic but
 * still tone-matched style so the reaction is never silently dropped.
 */
export function getInterruptStyle(personaId: string): InterruptStyle {
  return PERSONA_INTERRUPT_STYLE[personaId] ?? GENERIC_INTERRUPT_STYLE;
}

/**
 * Picks the right "address the interrupter" line for a persona who was just
 * cut off, tuned to how rude the interruption was — a rude cut-in (severity
 * >= 2) gets the sharper `rudeAddress` pool when the style has one, a
 * respectful pushback gets the milder `address` pool. This is how a persona
 * "responds in kind": their pushback matches the energy they were hit with.
 */
export function getInterruptAddressLine(personaId: string, wasRude: boolean): string {
  const style = getInterruptStyle(personaId);
  const pool = wasRude && style.rudeAddress?.length ? style.rudeAddress : style.address;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getInterruptResumeLine(personaId: string): string {
  const style = getInterruptStyle(personaId);
  return style.resume[Math.floor(Math.random() * style.resume.length)];
}
