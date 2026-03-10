import AsyncStorage from "@react-native-async-storage/async-storage";

const TALLY_KEY = "sports_bet_tally";
const PICKS_KEY = "sports_user_picks";
const USERNAME_KEY = "sports_username";

export interface UserPick {
  gameId: number;
  team: string;
  personaId: string;
  personaPick?: string;
  date: string;
  resolved: boolean;
  won?: boolean;
}

export interface PersonaTally {
  personaId: string;
  wins: number;
  losses: number;
  ties: number;
  streak: number;
  lastResult?: "win" | "loss" | "tie";
}

export async function getTallies(): Promise<Record<string, PersonaTally>> {
  try {
    const raw = await AsyncStorage.getItem(TALLY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveTallies(tallies: Record<string, PersonaTally>) {
  await AsyncStorage.setItem(TALLY_KEY, JSON.stringify(tallies));
}

export async function getUserPicks(): Promise<UserPick[]> {
  try {
    const raw = await AsyncStorage.getItem(PICKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveUserPicks(picks: UserPick[]) {
  await AsyncStorage.setItem(PICKS_KEY, JSON.stringify(picks));
}

export async function makeUniversalPick(gameId: number, team: string, allPersonaIds: string[], personaPicks: Record<string, string>): Promise<UserPick[]> {
  const picks = await getUserPicks();
  const newPicks: UserPick[] = [];

  for (const personaId of allPersonaIds) {
    const existing = picks.findIndex((p) => p.gameId === gameId && p.personaId === personaId);
    const pick: UserPick = {
      gameId,
      team,
      personaId,
      personaPick: personaPicks[personaId] || undefined,
      date: new Date().toISOString(),
      resolved: false,
    };
    if (existing >= 0) {
      picks[existing] = pick;
    } else {
      picks.push(pick);
    }
    newPicks.push(pick);
  }

  await saveUserPicks(picks);
  return newPicks;
}

export async function makeUserPick(gameId: number, team: string, personaId: string, personaPick?: string): Promise<UserPick> {
  const picks = await getUserPicks();
  const existing = picks.findIndex((p) => p.gameId === gameId && p.personaId === personaId);
  const pick: UserPick = {
    gameId,
    team,
    personaId,
    personaPick,
    date: new Date().toISOString(),
    resolved: false,
  };
  if (existing >= 0) {
    picks[existing] = pick;
  } else {
    picks.push(pick);
  }
  await saveUserPicks(picks);
  return pick;
}

export async function resolvePick(gameId: number, personaId: string, winningTeam: string): Promise<PersonaTally | null> {
  const picks = await getUserPicks();
  const pick = picks.find((p) => p.gameId === gameId && p.personaId === personaId && !p.resolved);
  if (!pick) return null;

  pick.resolved = true;
  const userWon = winningTeam.toLowerCase().includes(pick.team.toLowerCase()) ||
    pick.team.toLowerCase().includes(winningTeam.toLowerCase());
  pick.won = userWon;
  await saveUserPicks(picks);

  const tallies = await getTallies();
  if (!tallies[personaId]) {
    tallies[personaId] = { personaId, wins: 0, losses: 0, ties: 0, streak: 0 };
  }
  const t = tallies[personaId];
  if (userWon) {
    t.wins++;
    t.streak = t.streak >= 0 ? t.streak + 1 : 1;
    t.lastResult = "win";
  } else {
    t.losses++;
    t.streak = t.streak <= 0 ? t.streak - 1 : -1;
    t.lastResult = "loss";
  }
  await saveTallies(tallies);
  return t;
}

export function getTallyText(tally: PersonaTally): string {
  return `${tally.wins}W-${tally.losses}L`;
}

export function getStreakText(tally: PersonaTally): string {
  if (tally.streak === 0) return "";
  if (tally.streak > 0) return `${tally.streak}W STREAK`;
  return `${Math.abs(tally.streak)}L STREAK`;
}

export async function getUserName(): Promise<string> {
  try {
    const name = await AsyncStorage.getItem(USERNAME_KEY);
    return name || "";
  } catch {
    return "";
  }
}

export async function saveUserName(name: string): Promise<void> {
  await AsyncStorage.setItem(USERNAME_KEY, name);
}
