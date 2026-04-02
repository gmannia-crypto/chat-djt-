import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SportsStats {
  picks: { game: string; pick: string; date: string }[];
  totalPicks: number;
}

export interface RealEstateStats {
  watchedProperties: { name: string; score: number; price: number; addedAt: string }[];
  dealsShared: number;
}

export interface GameStats {
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  highestScore: number;
  gamesPlayed: number;
}

export interface FaceoffStats {
  wins: number;
  debates: number;
  favPersona: string | null;
  winsByPersona: Record<string, number>;
}

const KEYS = {
  sports: "viral_sports_stats",
  realestate: "viral_realestate_stats",
  game: "viral_game_stats",
  faceoff: "viral_faceoff_stats",
};

export async function getSportsStats(): Promise<SportsStats> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.sports);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { picks: [], totalPicks: 0 };
}

export async function recordSportsPick(game: string, pick: string): Promise<SportsStats> {
  const stats = await getSportsStats();
  stats.picks.push({ game, pick, date: new Date().toISOString() });
  stats.totalPicks++;
  if (stats.picks.length > 50) stats.picks = stats.picks.slice(-50);
  await AsyncStorage.setItem(KEYS.sports, JSON.stringify(stats));
  return stats;
}

export async function getRealEstateStats(): Promise<RealEstateStats> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.realestate);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { watchedProperties: [], dealsShared: 0 };
}

export async function addToWatchlist(name: string, score: number, price: number): Promise<RealEstateStats> {
  const stats = await getRealEstateStats();
  if (!stats.watchedProperties.find(w => w.name === name)) {
    stats.watchedProperties.push({ name, score, price, addedAt: new Date().toISOString() });
    if (stats.watchedProperties.length > 20) stats.watchedProperties = stats.watchedProperties.slice(-20);
    await AsyncStorage.setItem(KEYS.realestate, JSON.stringify(stats));
  }
  return stats;
}

export async function removeFromWatchlist(name: string): Promise<RealEstateStats> {
  const stats = await getRealEstateStats();
  stats.watchedProperties = stats.watchedProperties.filter(w => w.name !== name);
  await AsyncStorage.setItem(KEYS.realestate, JSON.stringify(stats));
  return stats;
}

export async function recordDealShare(): Promise<RealEstateStats> {
  const stats = await getRealEstateStats();
  stats.dealsShared++;
  await AsyncStorage.setItem(KEYS.realestate, JSON.stringify(stats));
  return stats;
}

export async function getGameStats(): Promise<GameStats> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.game);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { wins: 0, losses: 0, streak: 0, bestStreak: 0, highestScore: 0, gamesPlayed: 0 };
}

export async function recordGameResult(won: boolean, score: number): Promise<GameStats> {
  const stats = await getGameStats();
  stats.gamesPlayed++;
  if (won) {
    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    stats.highestScore = Math.max(stats.highestScore, score);
  } else {
    stats.losses++;
    stats.streak = 0;
  }
  await AsyncStorage.setItem(KEYS.game, JSON.stringify(stats));
  return stats;
}

export async function getFaceoffStats(): Promise<FaceoffStats> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.faceoff);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { wins: 0, debates: 0, favPersona: null, winsByPersona: {} };
}

export async function recordDebateResult(won: boolean, personaId: string): Promise<FaceoffStats> {
  const stats = await getFaceoffStats();
  stats.debates++;
  if (won) {
    stats.wins++;
    stats.winsByPersona[personaId] = (stats.winsByPersona[personaId] || 0) + 1;
    if (!stats.favPersona) stats.favPersona = personaId;
    else {
      const currentFav = stats.winsByPersona[stats.favPersona] || 0;
      if ((stats.winsByPersona[personaId] || 0) > currentFav) {
        stats.favPersona = personaId;
      }
    }
  }
  await AsyncStorage.setItem(KEYS.faceoff, JSON.stringify(stats));
  return stats;
}
