import AsyncStorage from "@react-native-async-storage/async-storage";

const RECORDINGS_KEY = "arenaRecordings";
const MAX_RECORDINGS = 20;

export interface OddsShift {
  personaId: string;
  personaName: string;
  fromLabel: string;
  toLabel: string;
  atTime: number; // ms from session start
}

export interface RecordedMessage {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
  relativeTime: number;
  isSystem?: boolean;
  isInterruption?: boolean;
  audioUri?: string;
}

export interface ArenaRecording {
  id: string;
  topic: string;
  startTime: number;
  duration: number;
  personas: string[];
  messages: RecordedMessage[];
  messageCount: number;
  highlightQuote?: string;
  oddsHistory?: OddsShift[];
}

export async function saveRecording(recording: ArenaRecording): Promise<void> {
  try {
    const existing = await getRecordings();
    const updated = [recording, ...existing].slice(0, MAX_RECORDINGS);
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(updated));
  } catch {}
}

export async function getRecordings(): Promise<ArenaRecording[]> {
  try {
    const raw = await AsyncStorage.getItem(RECORDINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function deleteRecording(id: string): Promise<void> {
  try {
    const existing = await getRecordings();
    const filtered = existing.filter((r) => r.id !== id);
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(filtered));
  } catch {}
}

export function pickHighlightQuote(messages: RecordedMessage[]): string {
  const nonSystem = messages.filter((m) => !m.isSystem && m.text.length > 20);
  if (nonSystem.length === 0) return "";
  const trumpMsgs = nonSystem.filter((m) => m.speakerId === "trump");
  const pool = trumpMsgs.length > 0 ? trumpMsgs : nonSystem;
  const sorted = [...pool].sort((a, b) => b.text.length - a.text.length);
  return sorted[0]?.text.slice(0, 120) || "";
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Labels match what recalculateOdds in arena.tsx emits, ordered from most-favoured (0) to least (3).
const ODDS_LABEL_RANK: Record<string, number> = {
  FAVORITE: 0,
  "CO-FAVORITE": 1,
  CONTENDER: 2,
  UNDERDOG: 3,
};

export function pickBiggestOddsFlip(
  oddsHistory: OddsShift[] | undefined
): OddsShift | null {
  if (!oddsHistory || oddsHistory.length === 0) return null;
  let biggest: OddsShift | null = null;
  let biggestDelta = 0;
  for (const shift of oddsHistory) {
    const fromRank = ODDS_LABEL_RANK[shift.fromLabel] ?? -1;
    const toRank = ODDS_LABEL_RANK[shift.toLabel] ?? -1;
    if (fromRank === -1 || toRank === -1) continue;
    const delta = Math.abs(toRank - fromRank);
    if (delta > biggestDelta) {
      biggestDelta = delta;
      biggest = shift;
    }
  }
  return biggest;
}

export function generateShareText(recording: ArenaRecording): string {
  const personaNames = recording.personas.slice(0, 4).join(", ");
  const highlight = recording.highlightQuote || pickHighlightQuote(recording.messages);
  const interruptions = recording.messages.filter((m) => m.isInterruption).length;
  let text = `🔥 THE ARENA: "${recording.topic}"\n`;
  text += `🎙️ ${personaNames}\n`;
  if (highlight) text += `\n💬 "${highlight}"\n`;
  if (interruptions > 0) text += `⚡ ${interruptions} interruptions!\n`;
  const bigFlip = pickBiggestOddsFlip(recording.oddsHistory);
  if (bigFlip) {
    const flipTime = formatDuration(Math.round(bigFlip.atTime / 1000));
    text += `📈 ${bigFlip.personaName} flipped ${bigFlip.fromLabel} → ${bigFlip.toLabel} at ${flipTime}\n`;
  }
  text += `\n${recording.messageCount} exchanges in ${formatDuration(recording.duration)}\n`;
  text += `\n🏛️ Watch the debate on The Arena\nhttps://thearena.rip`;
  return text;
}
