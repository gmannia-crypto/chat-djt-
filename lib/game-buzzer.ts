import { Audio } from "expo-av";
import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";

const NAV_VOICE_ID = "121b31844d2f451a9838b15e6a329002";
const COUNTDOWN_LEAGUES = ["NBA", "NCAAB", "NHL", "SOCCER"];

const FINAL_PERIOD: Record<string, number> = {
  NBA: 4,
  NCAAB: 2,
  NHL: 3,
  SOCCER: 2,
};

interface GameState {
  id: number;
  league: string;
  status: string;
  displayClock: string;
  period: number;
  game: string;
  score?: string;
}

let countdownPlayed = new Set<number>();
let buzzerPlayed = new Set<number>();
let soundRef: Audio.Sound | null = null;

function parseClockSeconds(clock: string): number {
  if (!clock) return 999;
  const parts = clock.split(":").map((p) => parseFloat(p));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60;
  return 999;
}

function isSoccerEndGame(clock: string, period: number): boolean {
  if (period < 2) return false;
  const minutes = parseInt(clock, 10);
  if (isNaN(minutes)) return false;
  return minutes >= 88;
}

function isNearEnd(game: GameState): boolean {
  if (!COUNTDOWN_LEAGUES.includes(game.league)) return false;
  if (game.status !== "in") return false;

  const finalPeriod = FINAL_PERIOD[game.league] || 4;
  if (game.period < finalPeriod) return false;

  if (game.league === "SOCCER") {
    return isSoccerEndGame(game.displayClock, game.period);
  }

  const seconds = parseClockSeconds(game.displayClock);
  return seconds <= 60;
}

async function stopCurrentSound() {
  if (soundRef) {
    try {
      await soundRef.stopAsync();
      await soundRef.unloadAsync();
    } catch {}
    soundRef = null;
  }
}

async function playCountdownVoice(gameName: string): Promise<void> {
  try {
    await stopCurrentSound();
    const baseUrl = getApiUrl().replace(/\/$/, "");
    const text = "Five! Four! Three! Two! One!";
    const url = `${baseUrl}/api/persona-speak?text=${encodeURIComponent(text)}&personaId=nav&voiceId=${NAV_VOICE_ID}`;

    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, volume: 1.0 }
    );
    soundRef = sound;

    return new Promise((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if ("didJustFinish" in status && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          soundRef = null;
          resolve();
        }
      });
      setTimeout(resolve, 8000);
    });
  } catch (e) {
    console.error("Countdown voice error:", e);
  }
}

async function playBuzzerSound(): Promise<void> {
  try {
    await stopCurrentSound();
    const { sound } = await Audio.Sound.createAsync(
      require("@/assets/sounds/buzzer.mp3"),
      { shouldPlay: true, volume: 1.0 }
    );
    soundRef = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if ("didJustFinish" in status && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        soundRef = null;
      }
    });
  } catch (e) {
    console.error("Buzzer error:", e);
  }
}

export async function checkGameEndEvents(
  currentGames: GameState[],
  previousGames: GameState[]
): Promise<{ countdownTriggered: number | null; buzzerTriggered: number | null }> {
  let countdownTriggered: number | null = null;
  let buzzerTriggered: number | null = null;

  for (const game of currentGames) {
    if (!COUNTDOWN_LEAGUES.includes(game.league)) continue;

    const prev = previousGames.find((g) => g.id === game.id);

    if (prev && prev.status === "in" && (game.status === "post" || game.status === "final") && !buzzerPlayed.has(game.id)) {
      buzzerPlayed.add(game.id);
      buzzerTriggered = game.id;
      await playCountdownVoice(game.game);
      await playBuzzerSound();
      break;
    }

    if (isNearEnd(game) && !countdownPlayed.has(game.id)) {
      countdownPlayed.add(game.id);
      countdownTriggered = game.id;
    }
  }

  return { countdownTriggered, buzzerTriggered };
}

export function resetBuzzerTracking() {
  countdownPlayed.clear();
  buzzerPlayed.clear();
}

export function cleanupBuzzer() {
  stopCurrentSound();
}
