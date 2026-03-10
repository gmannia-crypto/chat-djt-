import AsyncStorage from "@react-native-async-storage/async-storage";

const BRACKET_KEY = "march_madness_bracket";
const BRACKET_PRIZE_KEY = "march_madness_prizes";

export interface BracketPick {
  matchupId: string;
  round: number;
  selectedTeam: string;
  seed: number;
  timestamp: string;
  correct?: boolean;
}

export interface BracketData {
  picks: BracketPick[];
  score: number;
  possiblePoints: number;
  lastUpdated: string;
}

export interface DigitalPrize {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
  color: string;
}

const DEFAULT_PRIZES: DigitalPrize[] = [
  { id: "first_pick", title: "First Pick", description: "Made your first bracket pick", icon: "basketball", earned: false, color: "#FF6B00" },
  { id: "round_complete", title: "Round Master", description: "Completed an entire round", icon: "ribbon", earned: false, color: "#4CAF50" },
  { id: "upset_caller", title: "Upset Caller", description: "Correctly picked an upset (lower seed wins)", icon: "flash", earned: false, color: "#FBBF24" },
  { id: "perfect_round", title: "Perfect Round", description: "Got every pick right in a round", icon: "trophy", earned: false, color: "#E040FB" },
  { id: "bracket_complete", title: "Bracket Buster", description: "Filled out entire bracket", icon: "medal", earned: false, color: "#00BCD4" },
  { id: "beat_barkley", title: "Better Than Chuck", description: "Scored higher than Barkley's bracket", icon: "star", earned: false, color: "#FF3D00" },
  { id: "final_four", title: "Final Four Prophet", description: "Correctly picked all Final Four teams", icon: "diamond", earned: false, color: "#9C27B0" },
  { id: "champion", title: "Champion Caller", description: "Correctly picked the tournament winner", icon: "crown-outline", earned: false, color: "#D4A420" },
];

export async function getBracketData(): Promise<BracketData> {
  try {
    const raw = await AsyncStorage.getItem(BRACKET_KEY);
    return raw ? JSON.parse(raw) : { picks: [], score: 0, possiblePoints: 192, lastUpdated: new Date().toISOString() };
  } catch {
    return { picks: [], score: 0, possiblePoints: 192, lastUpdated: new Date().toISOString() };
  }
}

export async function saveBracketData(data: BracketData) {
  await AsyncStorage.setItem(BRACKET_KEY, JSON.stringify(data));
}

export async function makeBracketPick(matchupId: string, round: number, team: string, seed: number): Promise<BracketData> {
  const data = await getBracketData();
  const existing = data.picks.findIndex((p) => p.matchupId === matchupId);
  const pick: BracketPick = { matchupId, round, selectedTeam: team, seed, timestamp: new Date().toISOString() };
  if (existing >= 0) {
    data.picks[existing] = pick;
  } else {
    data.picks.push(pick);
  }
  data.lastUpdated = new Date().toISOString();
  await saveBracketData(data);
  return data;
}

export async function getPrizes(): Promise<DigitalPrize[]> {
  try {
    const raw = await AsyncStorage.getItem(BRACKET_PRIZE_KEY);
    return raw ? JSON.parse(raw) : [...DEFAULT_PRIZES];
  } catch {
    return [...DEFAULT_PRIZES];
  }
}

export async function awardPrize(prizeId: string): Promise<DigitalPrize[]> {
  const prizes = await getPrizes();
  const prize = prizes.find((p) => p.id === prizeId);
  if (prize && !prize.earned) {
    prize.earned = true;
    prize.earnedDate = new Date().toISOString();
    await AsyncStorage.setItem(BRACKET_PRIZE_KEY, JSON.stringify(prizes));
  }
  return prizes;
}

export function calculateBracketScore(picks: BracketPick[]): number {
  const pointsByRound: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 };
  return picks.filter((p) => p.correct).reduce((sum, p) => sum + (pointsByRound[p.round] || 1), 0);
}
