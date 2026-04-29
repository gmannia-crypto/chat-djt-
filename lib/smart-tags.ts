// Lightweight client-side smart tag suggestions for interviews.
// Pulls signals already returned by the interview endpoints (personas,
// lie/message counts, duration, topics) and turns them into 3-5
// contextual suggestion chips. Suggestions are de-duped against any
// tags the interview already has so we never propose what's already
// applied.

const ARENA_NAME_MAP: Record<string, string> = {
  trump: "trump",
  netanyahu: "netanyahu",
  ruckus: "ruckus",
  galloway: "galloway",
  mcconnell: "mcconnell",
  carville: "carville",
  maddow: "maddow",
  omar: "omar",
  biden: "biden",
  rosie: "rosie",
  berniemc: "bernie",
  elon: "elon",
  graham: "graham",
  megynkelly: "megyn",
  pambondi: "bondi",
  candace: "candace",
  joyreid: "joyreid",
  miller: "miller",
  jimjordan: "jordan",
  schumer: "schumer",
  alexjones: "jones",
  obama: "obama",
  melania: "melania",
  odonnell: "odonnell",
  kamala: "kamala",
  mtg: "mtg",
  rfk: "rfk",
};

export type SmartTagInput = {
  interviewerId?: string | null;
  intervieweeId?: string | null;
  interviewerName?: string | null;
  intervieweeName?: string | null;
  lieCount?: number | null;
  userLieCount?: number | null;
  messageCount?: number | null;
  durationMinutes?: number | null;
  topics?: Array<{ title?: string; description?: string; era?: string } | string> | null;
};

const MAX_TAG_LENGTH = 24;

function clean(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
}

function shortName(id?: string | null, name?: string | null): string {
  if (id && ARENA_NAME_MAP[id]) return ARENA_NAME_MAP[id];
  if (id) return id;
  if (name) return name.split(/\s+/)[0]?.toLowerCase() || "";
  return "";
}

const TOPIC_RULES: Array<[RegExp, string]> = [
  [/\b(election|vote|voter|voting|ballot|campaign|primary|swing state)\b/, "election"],
  [/\b(econom|inflation|jobs|wall street|tariff|recession|interest rate|stock|gdp)\b/, "economy"],
  [/\b(immigr|border|deport|asylum|migrant)\b/, "immigration"],
  [/\b(israel|gaza|palestin|hamas|iran|ukraine|russia|china|nato|war|military|missile)\b/, "foreign policy"],
  [/\b(ai|artificial intelligence|chatbot|deepfake|silicon|big tech)\b/, "tech"],
  [/\b(climate|environment|carbon|fossil|emission|wildfire)\b/, "climate"],
  [/\b(abortion|roe|reproductive)\b/, "abortion"],
  [/\b(gun|second amendment|2a|shooting|nra)\b/, "guns"],
  [/\b(media|press|fox news|msnbc|cnn|disinformation|propaganda|tiktok)\b/, "media"],
  [/\b(scandal|corrupt|indict|criminal|trial|prison|conviction)\b/, "scandal"],
  [/\b(crypto|bitcoin|nft|blockchain|coin)\b/, "crypto"],
  [/\b(health|covid|vaccine|pandemic|fluoride|measles|autism)\b/, "health"],
  [/\b(supreme court|scotus|judge|judiciary|justice department)\b/, "courts"],
  [/\b(woke|trans|lgbt|dei|culture war|critical race)\b/, "culture war"],
  [/\b(jan(uary)? 6|insurrect|capitol riot)\b/, "jan 6"],
  [/\b(doge|musk|elon|spacex|tesla|x platform)\b/, "musk"],
];

/**
 * Build 3-5 smart tag suggestions from the data we already know about an
 * interview. `exclude` lets the caller filter out anything already applied
 * (saved tags + in-progress draft tags).
 */
export function buildSmartTagSuggestions(
  input: SmartTagInput,
  exclude: string[] = [],
  max = 5,
): string[] {
  const out: string[] = [];
  const used = new Set<string>();
  for (const t of exclude) {
    if (typeof t === "string") used.add(t.trim().toLowerCase());
  }

  const push = (raw: string): void => {
    if (out.length >= max) return;
    const cleaned = clean(raw);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (used.has(key)) return;
    used.add(key);
    out.push(cleaned);
  };

  const interviewerSlug = shortName(input.interviewerId, input.interviewerName);
  const intervieweeSlug = shortName(input.intervieweeId, input.intervieweeName);
  if (interviewerSlug && intervieweeSlug && interviewerSlug !== intervieweeSlug) {
    push(`${interviewerSlug}×${intervieweeSlug}`);
  }

  const lies = Math.max(0, Number(input.lieCount) || 0);
  const userLies = Math.max(0, Number(input.userLieCount) || 0);
  const minutes = Math.max(0, Number(input.durationMinutes) || 0);
  const messages = Math.max(0, Number(input.messageCount) || 0);

  if (lies >= 10) push("fact-check fest");
  else if (lies >= 5) push("spicy");
  else if (lies === 0 && messages > 0) push("clean");

  if (userLies > 0) push("viewer flagged");

  if (minutes >= 25) push("marathon");
  else if (minutes > 0 && minutes <= 5) push("quickie");

  if (messages >= 60) push("chatty");

  if (Array.isArray(input.topics) && input.topics.length > 0) {
    const text = input.topics
      .map((t) => {
        if (!t) return "";
        if (typeof t === "string") return t;
        return [t.title, t.description, t.era].filter(Boolean).join(" ");
      })
      .join(" ")
      .toLowerCase();
    if (text) {
      for (const [re, tag] of TOPIC_RULES) {
        if (out.length >= max) break;
        if (re.test(text)) push(tag);
      }
    }
  }

  if (out.length < max && messages >= 40 && lies < 3) push("for the show");
  if (out.length < max && lies === 0 && messages === 0) push("for the show");

  return out.slice(0, max);
}
