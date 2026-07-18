import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

export const ARENA_BET_KEY = "chatdjt_arena_iq_bet_v1";
export const INTERVIEW_BET_KEY = "chatdjt_interview_bet_v1";

export interface ArenaBet {
  targetPersonaId: string;
  wager: number;
  placedAt: number;
  sessionKey: string;
}

export interface InterviewBet {
  pick: "interviewer" | "interviewee";
  interviewerId: string;
  intervieweeId: string;
  wager: number;
  placedAt: number;
}

export async function placeArenaBet(bet: ArenaBet): Promise<void> {
  await AsyncStorage.setItem(ARENA_BET_KEY, JSON.stringify(bet));
}

export async function getArenaBet(): Promise<ArenaBet | null> {
  try {
    const raw = await AsyncStorage.getItem(ARENA_BET_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearArenaBet(): Promise<void> {
  await AsyncStorage.removeItem(ARENA_BET_KEY);
}

export async function placeInterviewBet(bet: InterviewBet): Promise<void> {
  await AsyncStorage.setItem(INTERVIEW_BET_KEY, JSON.stringify(bet));
}

export async function getInterviewBet(): Promise<InterviewBet | null> {
  try {
    const raw = await AsyncStorage.getItem(INTERVIEW_BET_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearInterviewBet(): Promise<void> {
  await AsyncStorage.removeItem(INTERVIEW_BET_KEY);
}

export async function awardBetWin(
  deviceId: string,
  amount: number,
  description: string,
): Promise<boolean> {
  try {
    const res = await fetch(new URL("/api/tokens/bet-award", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify({ amount, description }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function makeArenaSessionKey(personaIds: string[]): string {
  return [...personaIds].sort().join(",");
}

export function resolveIQRaceBet(
  targetPersonaId: string,
  personaSessionIQ: Record<string, number>,
): { won: boolean; lowestId: string; lowestIQ: number } {
  const entries = Object.entries(personaSessionIQ).filter(([, iq]) => iq !== undefined);
  if (entries.length === 0) return { won: false, lowestId: "", lowestIQ: 100 };
  entries.sort((a, b) => a[1] - b[1]);
  const [lowestId, lowestIQ] = entries[0];
  return { won: lowestId === targetPersonaId, lowestId, lowestIQ };
}

export function resolveInterviewWinnerBet(
  pick: "interviewer" | "interviewee",
  messages: Array<{ speakerId: string; text?: string }>,
  interviewerId: string,
  intervieweeId: string,
): { won: boolean; winner: "interviewer" | "interviewee" } {
  let interviewerWords = 0;
  let intervieweeWords = 0;
  for (const msg of messages) {
    const words = (msg.text || "").split(/\s+/).filter(Boolean).length;
    if (msg.speakerId === interviewerId) interviewerWords += words;
    else if (msg.speakerId === intervieweeId) intervieweeWords += words;
  }
  const winner: "interviewer" | "interviewee" = interviewerWords >= intervieweeWords ? "interviewer" : "interviewee";
  return { won: pick === winner, winner };
}
