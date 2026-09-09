import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useScreenTracker, trackAnalyticsEvent } from "@/lib/use-analytics";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Image,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { shareContent } from "@/lib/track-share";
import { getApiUrl } from "@/lib/query-client";
import { StatsPanel } from "@/components/StatsPanel";
import { ViralShareCard } from "@/components/ViralShareCard";
import { ShareAppButton } from "@/components/ShareAppButton";
import { getGameStats, recordGameResult as recordGameResultStats, type GameStats as ViralGameStats } from "@/lib/viral-stats";
import { getOrCreateDeviceId, useTokens } from "@/lib/token-context";
import { FlatList } from "react-native";
import { CashAppDonate } from "@/components/CashAppDonate";
import { PuttingMiniGame, type PuttingResult } from "@/components/PuttingMiniGame";
import { ThreePointMiniGame, type ThreePointResult } from "@/components/ThreePointMiniGame";

// Bonus rounds are offered every N completed turns, purely as an optional break from the
// scenario loop — they never block "NEXT DEAL" and disappear once the player moves on. Which
// mini-game is offered (putting or 3-point shooting) is picked at random each time, so the
// break doesn't feel repetitive on long playthroughs.
const PUTTING_BONUS_INTERVAL = 3;
type BonusGameKind = "putting" | "threePoint";
// Mirrors server/billionaire-game-validation.ts (BILLIONAIRE_WIN_THRESHOLD / MIN_TURNS_FOR_WIN).
// Kept as a client-side safety clamp only: a mini-game bonus must never itself be able to push
// net worth across the win line or shrink the number of scenario turns a claimed win required,
// since that's exactly what the server-side anti-cheat check guards against.
const BILLIONAIRE_WIN_THRESHOLD = 1_000_000_000;

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  finalNetWorth: number;
  turns: number;
  durationSeconds: number;
  milestonesHit: number;
  bestStreak: number;
  karma: number;
  darkDeals: number;
  completedAt: string;
  efficiencyScore: number;
  speedScore: number;
  performanceScore: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  stats: { totalWins: number; totalGames: number; fastestTurns: number | null; fastestDuration: number | null };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Industry = "pharma" | "prisons" | "politics" | "healthcare" | "military" | "lobbying" | "welfare" | "tech" | "media" | "energy";

interface Choice {
  text: string;
  profit: number;
  karma: number;
  karmaLabel: string;
  consequence: string;
  industry: Industry;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  icon: string;
  industry: Industry;
  tier: number;
  choices: Choice[];
}

interface GameState {
  netWorth: number;
  karma: number;
  turn: number;
  empire: string[];
  headlines: string[];
  darkDeals: number;
  politiciansBought: number;
  livesAffected: number;
  streak: number;
  bestStreak: number;
  milestonesHit: number[];
}

const MILESTONES = [
  { threshold: 5_000_000, label: "MILLIONAIRE STATUS", emoji: "📈", message: "You just crossed $5M! The hustle is real!" },
  { threshold: 10_000_000, label: "MOGUL MODE", emoji: "💰", message: "Double digits! $10M and climbing!" },
  { threshold: 25_000_000, label: "POWER PLAYER", emoji: "⚡", message: "$25M! You're making moves that matter!" },
  { threshold: 50_000_000, label: "MEGA MOGUL", emoji: "🏗️", message: "$50M! Half way to centimillionaire!" },
  { threshold: 100_000_000, label: "CENTIMILLIONAIRE", emoji: "🏰", message: "$100M! The big leagues! Forbes is watching!" },
  { threshold: 250_000_000, label: "QUARTER BILLIONAIRE", emoji: "💎", message: "$250M! A quarter of the way to the top!" },
  { threshold: 500_000_000, label: "HALF BILLIONAIRE", emoji: "🔥", message: "$500M! The billion-dollar club is in sight!" },
  { threshold: 750_000_000, label: "THREE-QUARTER BILLION", emoji: "🚀", message: "$750M! So close you can taste it!" },
];

const BREAKING_NEWS = [
  "WALL STREET JOURNAL: \"{player}\" disrupts {industry} sector with controversial new deal",
  "FORBES BREAKING: {player} net worth surges to {worth} — experts stunned",
  "CNN: Is {player} the next business titan? Sources say yes",
  "FOX BUSINESS: {player}'s {industry} empire grows — \"Tremendous!\" says Trump",
  "BLOOMBERG: {player} closes massive {industry} deal worth {deal}",
  "THE ECONOMIST: The {player} effect — how one tycoon is reshaping {industry}",
  "FINANCIAL TIMES: {player} makes bold {industry} play — rivals scramble to respond",
  "REUTERS: {player} reaches {worth} net worth milestone in record time",
  "CNBC: \"{player} is either a genius or insane\" — market analysts react",
  "AP NEWS: {player}'s controversial {industry} strategy pays off big",
];

const RANDOM_EVENTS = [
  { type: "boom", emoji: "📈", title: "MARKET BOOM!", message: "A bull market surge boosts your portfolio!", multiplier: 1.15 },
  { type: "crash", emoji: "📉", title: "MARKET CRASH!", message: "A sudden downturn hits your investments!", multiplier: 0.88 },
  { type: "audit", emoji: "🔍", title: "SEC INVESTIGATION!", message: "Federal regulators are asking questions about your deals...", multiplier: 0.92 },
  { type: "windfall", emoji: "🎰", title: "WINDFALL!", message: "An old investment just paid off massively!", multiplier: 1.20 },
  { type: "scandal", emoji: "📰", title: "MEDIA SCANDAL!", message: "A leaked email costs you PR damage and legal fees!", multiplier: 0.90 },
  { type: "lobby", emoji: "🏛️", title: "POLITICAL FAVOR!", message: "A senator you backed just passed a favorable bill!", multiplier: 1.12 },
  { type: "lawsuit", emoji: "⚖️", title: "CLASS ACTION LAWSUIT!", message: "Former employees are suing. Lawyers aren't cheap!", multiplier: 0.85 },
  { type: "ipo", emoji: "🔔", title: "SURPRISE IPO!", message: "One of your companies just went public!", multiplier: 1.25 },
];

const INDUSTRY_COLORS: Record<Industry, string> = {
  pharma: "#9333EA",
  prisons: "#DC2626",
  politics: "#2563EB",
  healthcare: "#059669",
  military: "#D97706",
  lobbying: "#7C3AED",
  welfare: "#0891B2",
  tech: "#6366F1",
  media: "#EC4899",
  energy: "#84CC16",
};

const INDUSTRY_ICONS: Record<Industry, string> = {
  pharma: "medkit",
  prisons: "lock-closed",
  politics: "flag",
  healthcare: "heart",
  military: "shield",
  lobbying: "cash",
  welfare: "business",
  tech: "hardware-chip",
  media: "tv",
  energy: "flash",
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function getKarmaRating(karma: number): { label: string; color: string; icon: string } {
  if (karma >= 50) return { label: "SAINT", color: "#22C55E", icon: "heart" };
  if (karma >= 20) return { label: "DECENT HUMAN", color: "#4ADE80", icon: "happy" };
  if (karma >= 0) return { label: "MORALLY GRAY", color: "#F59E0B", icon: "help-circle" };
  if (karma >= -30) return { label: "ETHICALLY BANKRUPT", color: "#F97316", icon: "warning" };
  if (karma >= -60) return { label: "CORPORATE VILLAIN", color: "#EF4444", icon: "skull" };
  return { label: "BOND VILLAIN", color: "#DC2626", icon: "flame" };
}

function getTitle(netWorth: number): { label: string; emoji: string } {
  if (netWorth >= 1_000_000_000) return { label: "BILLIONAIRE", emoji: "👑" };
  if (netWorth >= 500_000_000) return { label: "HALF-BILLIONAIRE", emoji: "💎" };
  if (netWorth >= 100_000_000) return { label: "CENTIMILLIONAIRE", emoji: "🏰" };
  if (netWorth >= 50_000_000) return { label: "MEGA MOGUL", emoji: "🏗️" };
  if (netWorth >= 10_000_000) return { label: "MOGUL", emoji: "💰" };
  if (netWorth >= 5_000_000) return { label: "MILLIONAIRE", emoji: "📈" };
  return { label: "HUSTLER", emoji: "🎯" };
}

async function playBase64Audio(base64: string): Promise<Audio.Sound | null> {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
    if (Platform.OS === "web") {
      const audio = new window.Audio(`data:audio/mpeg;base64,${base64}`);
      audio.volume = 1.0;
      await audio.play();
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${base64}` },
        { shouldPlay: false }
      );
      return sound;
    }
    const uri = `data:audio/mpeg;base64,${base64}`;
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });
    return sound;
  } catch (e) {
    console.warn("Audio playback failed:", e);
    return null;
  }
}

function HellfireAnimation({ playerName, onComplete }: { playerName: string; onComplete: () => void }) {
  const fallY = useSharedValue(0);
  const iconScale = useSharedValue(1);
  const flameOpacity = useSharedValue(0);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    flameOpacity.value = withTiming(1, { duration: 800 });
    shakeX.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(0, { duration: 50 })
      ),
      6, true
    );
    setTimeout(() => {
      fallY.value = withTiming(600, { duration: 2000, easing: Easing.in(Easing.quad) });
      iconScale.value = withSequence(
        withTiming(1.3, { duration: 300 }),
        withTiming(0.3, { duration: 1700 })
      );
    }, 1500);
    setTimeout(() => onComplete(), 4500);
  }, []);

  const playerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: fallY.value },
      { translateX: shakeX.value },
      { scale: iconScale.value },
    ],
  }));

  const flameStyle = useAnimatedStyle(() => ({
    opacity: flameOpacity.value,
  }));

  return (
    <View style={styles.hellfireOverlay}>
      <LinearGradient colors={["#000", "#1a0000", "#330000", "#ff2200"]} style={StyleSheet.absoluteFillObject} />
      <Animated.View style={[styles.hellfirePlayerIcon, playerStyle]}>
        <View style={styles.hellfireAvatar}>
          <Text style={{ fontSize: 48 }}>🤑</Text>
        </View>
        <Text style={styles.hellfirePlayerName}>{playerName}</Text>
      </Animated.View>
      <Animated.View style={[styles.hellfireFlames, flameStyle]}>
        <Text style={{ fontSize: 60, textAlign: "center" }}>🔥🔥🔥</Text>
        <Text style={{ fontSize: 80, textAlign: "center", marginTop: -10 }}>🔥🔥🔥🔥🔥</Text>
        <Text style={{ fontSize: 60, textAlign: "center", marginTop: -10 }}>🔥🔥🔥</Text>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", bottom: 160 }, flameStyle]}>
        <Text style={styles.hellfireText}>CONDEMNED TO HELLFIRE</Text>
        <Text style={styles.hellfireSubtext}>Too much greed. Even for Trump.</Text>
      </Animated.View>
    </View>
  );
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const scrollRef = useRef<ScrollView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  useScreenTracker("billionaires_game");
  const { authToken, authReady } = useTokens();

  const [playerName, setPlayerName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const [gameState, setGameState] = useState<GameState>({
    netWorth: 1_000_000, karma: 0, turn: 0, empire: [], headlines: [],
    darkDeals: 0, politiciansBought: 0, livesAffected: 0,
    streak: 0, bestStreak: 0, milestonesHit: [],
  });

  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [showConsequence, setShowConsequence] = useState(false);
  const [lastChoice, setLastChoice] = useState<Choice | null>(null);
  const [trumpQuote, setTrumpQuote] = useState("");
  const [gameWon, setGameWon] = useState(false);
  const [usedTitles, setUsedTitles] = useState<string[]>([]);
  const [choiceHistory, setChoiceHistory] = useState<{ scenario: string; choice: string; profit: number; karma: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [trumpSpeaking, setTrumpSpeaking] = useState(false);
  const [showHellfire, setShowHellfire] = useState(false);
  const [hellfireComplete, setHellfireComplete] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [narratorSpeaking, setNarratorSpeaking] = useState(false);
  const [milestone, setMilestone] = useState<typeof MILESTONES[0] | null>(null);
  const [breakingNews, setBreakingNews] = useState("");
  const [randomEvent, setRandomEvent] = useState<typeof RANDOM_EVENTS[0] | null>(null);
  const [streakBonus, setStreakBonus] = useState(0);
  const narratorSoundRef = useRef<Audio.Sound | null>(null);
  const [viralGameStats, setViralGameStats] = useState<ViralGameStats>({ wins: 0, losses: 0, streak: 0, bestStreak: 0, highestScore: 0, gamesPlayed: 0 });
  const [viralShareVisible, setViralShareVisible] = useState(false);
  const [viralShareData, setViralShareData] = useState({ headline: "", quote: "" });
  const [deviceId, setDeviceId] = useState("");
  const gameStartTime = useRef<number>(Date.now());
  const elapsedBeforeResume = useRef<number>(0);
  const [isResolvingChoice, setIsResolvingChoice] = useState(false);
  const [savedProgress, setSavedProgress] = useState<{ playerName: string; gameState: GameState; choiceHistory: any[]; usedTitles: string[] } | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  // Guards the load-progress fetch below against out-of-order responses: only the response for
  // the most recently issued request is allowed to update state.
  const loadProgressRequestId = useRef(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  // bonusGameKind: which mini-game the banner is currently offering (null = no offer up).
  // activeBonusGame: which mini-game overlay is actually open right now.
  const [bonusGameKind, setBonusGameKind] = useState<BonusGameKind | null>(null);
  const [activeBonusGame, setActiveBonusGame] = useState<BonusGameKind | null>(null);
  const lastBonusOfferTurn = useRef(0);

  const karmaRating = getKarmaRating(gameState.karma);
  const titleInfo = getTitle(gameState.netWorth);
  const progress = Math.min(100, (gameState.netWorth / 1_000_000_000) * 100);

  const pulseAnim = useSharedValue(1);
  const glowAnim = useSharedValue(0);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(withTiming(1.03, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1, true
    );
    glowAnim.value = withRepeat(
      withSequence(withTiming(1, { duration: 2000 }), withTiming(0, { duration: 2000 })),
      -1, true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));

  const cleanupSound = useCallback(async () => {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    if (narratorSoundRef.current) {
      try { await narratorSoundRef.current.unloadAsync(); } catch {}
      narratorSoundRef.current = null;
    }
    setNarratorSpeaking(false);
  }, []);

  useEffect(() => {
    getGameStats().then(s => setViralGameStats(s));
    getOrCreateDeviceId().then(id => setDeviceId(id));
    return () => { cleanupSound(); };
  }, []);

  useEffect(() => {
    // Wait for the stored auth session token to finish loading before asking the server for
    // saved progress. Firing this request while authReady is still false would go out as an
    // unauthenticated (device-only) lookup; for a signed-in user that can surface stale guest
    // progress from before they signed in, or race a later authenticated request and clobber its
    // result. authReady guarantees authToken's current value (token or null) is final.
    if (!deviceId || !authReady) return;
    const requestId = ++loadProgressRequestId.current;
    const baseUrl = getApiUrl().replace(/\/$/, "");
    fetch(`${baseUrl}/api/game/load-progress`, {
      headers: authToken ? { "x-device-id": deviceId, "Authorization": `Bearer ${authToken}` } : { "x-device-id": deviceId },
    })
      .then(r => r.json())
      .then(data => {
        // Ignore this response if a newer load-progress request has since been issued (e.g.
        // authToken changed again before this one returned).
        if (requestId !== loadProgressRequestId.current) return;
        if (data.hasProgress && data.gameState && data.gameState.turn > 0) {
          setSavedProgress({
            playerName: data.playerName,
            gameState: data.gameState,
            choiceHistory: data.choiceHistory || [],
            usedTitles: data.usedTitles || [],
          });
          setShowResumePrompt(true);
        } else {
          setSavedProgress(null);
          setShowResumePrompt(false);
        }
      })
      .catch(() => {});
  }, [deviceId, authReady, authToken]);

  const apiCall = useCallback(async (endpoint: string, body: any) => {
    const baseUrl = getApiUrl().replace(/\/$/, "");
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }, [deviceId]);

  const saveProgress = useCallback(async (gs: GameState, ch: any[], ut: string[], pn: string) => {
    if (!deviceId || !pn || gs.turn === 0) return;
    const sessionSeconds = Math.round((Date.now() - gameStartTime.current) / 1000);
    const totalElapsed = sessionSeconds + elapsedBeforeResume.current;
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      await fetch(`${baseUrl}/api/game/save-progress`, {
        method: "POST",
        headers: authToken
          ? { "Content-Type": "application/json", "x-device-id": deviceId, "Authorization": `Bearer ${authToken}` }
          : { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ playerName: pn, gameState: { ...gs, elapsedSeconds: totalElapsed }, choiceHistory: ch, usedTitles: ut }),
      });
    } catch {}
  }, [deviceId, authToken]);

  const submitResult = useCallback(async (won: boolean, gs: GameState, pn: string) => {
    if (!deviceId || !pn) return;
    const sessionSeconds = Math.round((Date.now() - gameStartTime.current) / 1000);
    const durationSeconds = sessionSeconds + elapsedBeforeResume.current;
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      await fetch(`${baseUrl}/api/game/submit-result`, {
        method: "POST",
        headers: authToken
          ? { "Content-Type": "application/json", "x-device-id": deviceId, "Authorization": `Bearer ${authToken}` }
          : { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ playerName: pn, won, gameState: gs, durationSeconds }),
      });
      trackAnalyticsEvent("billionaires_game_result_submitted", {
        won,
        net_worth: gs.netWorth ?? 0,
        turn: gs.turn ?? 0,
        duration_seconds: durationSeconds,
      });
    } catch {}
  }, [deviceId, authToken]);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/game/leaderboard`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.leaderboard)) {
        setLeaderboardData(data);
      } else {
        setLeaderboardData({ leaderboard: [], stats: { totalWins: 0, totalGames: 0, fastestTurns: null, fastestDuration: null } });
      }
    } catch {
      setLeaderboardData({ leaderboard: [], stats: { totalWins: 0, totalGames: 0, fastestTurns: null, fastestDuration: null } });
    }
    setLeaderboardLoading(false);
  }, []);

  const resumeGame = useCallback(() => {
    if (!savedProgress) return;
    setPlayerName(savedProgress.playerName);
    setNameConfirmed(true);
    const gs = savedProgress.gameState;
    setGameState({
      netWorth: gs.netWorth || 1_000_000,
      karma: gs.karma || 0,
      turn: gs.turn || 0,
      empire: gs.empire || [],
      headlines: gs.headlines || [],
      darkDeals: gs.darkDeals || 0,
      politiciansBought: gs.politiciansBought || 0,
      livesAffected: gs.livesAffected || 0,
      streak: gs.streak || 0,
      bestStreak: gs.bestStreak || 0,
      milestonesHit: gs.milestonesHit || [],
    });
    setChoiceHistory(savedProgress.choiceHistory || []);
    setUsedTitles(savedProgress.usedTitles || []);
    setTrumpQuote(`Welcome back, ${savedProgress.playerName}! I knew you'd be back! Nobody quits when they're this close!`);
    setShowResumePrompt(false);
    setSavedProgress(null);
    elapsedBeforeResume.current = gs.elapsedSeconds || 0;
    gameStartTime.current = Date.now();
  }, [savedProgress]);

  const dismissResume = useCallback(async () => {
    setShowResumePrompt(false);
    setSavedProgress(null);
    if (deviceId) {
      try {
        const baseUrl = getApiUrl().replace(/\/$/, "");
        await fetch(`${baseUrl}/api/game/clear-progress`, {
          method: "DELETE",
          headers: authToken
            ? { "x-device-id": deviceId, "Authorization": `Bearer ${authToken}` }
            : { "x-device-id": deviceId },
        });
      } catch {}
    }
  }, [deviceId, authToken]);

  const playTrumpAudio = useCallback(async (audioBase64: string | null) => {
    if (!audioBase64 || !voiceEnabled) {
      setTrumpSpeaking(false);
      return;
    }
    await cleanupSound();
    setTrumpSpeaking(true);
    const sound = await playBase64Audio(audioBase64);
    if (sound) {
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if ("didJustFinish" in status && status.didJustFinish) {
          setTrumpSpeaking(false);
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
      setTimeout(() => setTrumpSpeaking(false), 15000);
    } else {
      setTrumpSpeaking(false);
    }
  }, [cleanupSound, voiceEnabled]);

  const playNarratorAudio = useCallback(async (audioBase64: string | null) => {
    if (!audioBase64 || !voiceEnabled) return;
    if (narratorSoundRef.current) {
      try { await narratorSoundRef.current.unloadAsync(); } catch {}
      narratorSoundRef.current = null;
    }
    setNarratorSpeaking(true);
    const sound = await playBase64Audio(audioBase64);
    if (sound) {
      narratorSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if ("didJustFinish" in status && status.didJustFinish) {
          setNarratorSpeaking(false);
          sound.unloadAsync().catch(() => {});
          narratorSoundRef.current = null;
        }
      });
      setTimeout(() => setNarratorSpeaking(false), 20000);
    } else {
      setNarratorSpeaking(false);
    }
  }, [voiceEnabled]);

  const confirmName = useCallback(async () => {
    if (!nameInput.trim()) return;
    const name = nameInput.trim();
    setPlayerName(name);
    setNameConfirmed(true);
    setLoading(true);
    elapsedBeforeResume.current = 0;
    gameStartTime.current = Date.now();
    try {
      const data = await apiCall("/api/game/trump-welcome", { playerName: name });
      setTrumpQuote(data.text);
      if (data.audio) {
        playTrumpAudio(data.audio);
      }
    } catch {
      setTrumpQuote(`${name}! You think you can make it to a BILLION? We'll see about that! Nobody does it like Trump!`);
    }
    setLoading(false);
  }, [nameInput, apiCall, playTrumpAudio]);

  const getTier = useCallback((netWorth: number) => {
    if (netWorth < 5_000_000) return 1;
    if (netWorth < 20_000_000) return 2;
    if (netWorth < 100_000_000) return 3;
    if (netWorth < 500_000_000) return 4;
    return 5;
  }, []);

  const applyBonusResult = useCallback((game: BonusGameKind, result: PuttingResult | ThreePointResult) => {
    setGameState(prev => {
      // Clamp so a mini-game bonus can never itself cross the win threshold — the actual win
      // must always be produced by a scenario choice, keeping the existing win flow (and the
      // server's turn-count anti-cheat check) single-sourced.
      const netWorth = Math.min(BILLIONAIRE_WIN_THRESHOLD - 1, Math.max(0, prev.netWorth + result.netWorthBonus));
      const updated: GameState = { ...prev, netWorth };
      saveProgress(updated, choiceHistory, usedTitles, playerName);
      return updated;
    });
    trackAnalyticsEvent("billionaires_game_bonus_result", { game, outcome: result.outcome });
    setBonusGameKind(null);
    setActiveBonusGame(null);
  }, [saveProgress, choiceHistory, usedTitles, playerName]);

  const startNextTurn = useCallback(async () => {
    setLoading(true);
    setShowConsequence(false);
    setLastChoice(null);
    setIsResolvingChoice(false);
    setBonusGameKind(null);
    await cleanupSound();

    try {
      const tier = getTier(gameState.netWorth);
      const data = await apiCall("/api/game/generate-scenario", {
        tier,
        netWorth: gameState.netWorth,
        karma: gameState.karma,
        previousTitles: usedTitles.slice(-10),
        playerName,
      });

      const scenario: Scenario = {
        id: data.id || "ai_" + Date.now(),
        title: data.title,
        description: data.description,
        icon: data.icon || "💰",
        industry: data.industry || "tech",
        tier: data.tier || tier,
        choices: data.choices,
      };

      setCurrentScenario(scenario);
      setUsedTitles(prev => [...prev, scenario.title]);
      setGameState(prev => ({ ...prev, turn: prev.turn + 1 }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (voiceEnabled) {
        apiCall("/api/game/narrate-deal", {
          title: scenario.title,
          description: scenario.description,
        }).then((narData) => {
          if (narData.audio) playNarratorAudio(narData.audio);
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Failed to generate scenario:", err);
      setTrumpQuote("The AI had a little hiccup. Even the best have off days! Try again!");
    }
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  }, [gameState, usedTitles, playerName, apiCall, getTier, cleanupSound, voiceEnabled, playNarratorAudio]);

  const makeChoice = useCallback(async (choice: Choice) => {
    if (isResolvingChoice) return;
    setIsResolvingChoice(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLastChoice(choice);
    setShowConsequence(true);
    setTrumpSpeaking(true);
    setMilestone(null);
    setBreakingNews("");
    setRandomEvent(null);
    setStreakBonus(0);

    const newStreak = choice.profit > 0 ? gameState.streak + 1 : 0;
    let bonusMultiplier = 1;
    if (newStreak >= 5) { bonusMultiplier = 1.5; setStreakBonus(50); }
    else if (newStreak >= 3) { bonusMultiplier = 1.25; setStreakBonus(25); }

    const adjustedProfit = Math.round(choice.profit * bonusMultiplier);
    let newNetWorth = Math.max(0, gameState.netWorth + adjustedProfit);
    const newKarma = gameState.karma + choice.karma;

    const shouldTriggerEvent = gameState.turn > 0 && gameState.turn % 4 === 0 && Math.random() > 0.4;
    let eventApplied: typeof RANDOM_EVENTS[0] | null = null;
    if (shouldTriggerEvent) {
      eventApplied = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
      newNetWorth = Math.max(0, Math.round(newNetWorth * eventApplied.multiplier));
      setRandomEvent(eventApplied);
    }

    const newMilestones = MILESTONES.filter(
      m => newNetWorth >= m.threshold && !gameState.milestonesHit.includes(m.threshold)
    );
    const hitMilestone = newMilestones.length > 0 ? newMilestones[newMilestones.length - 1] : null;
    if (hitMilestone) {
      setMilestone(hitMilestone);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const newsTemplate = BREAKING_NEWS[Math.floor(Math.random() * BREAKING_NEWS.length)];
    setBreakingNews(
      newsTemplate
        .replace(/\{player\}/g, playerName)
        .replace(/\{industry\}/g, currentScenario?.industry || "business")
        .replace(/\{worth\}/g, fmtMoney(newNetWorth))
        .replace(/\{deal\}/g, fmtMoney(Math.abs(adjustedProfit)))
    );

    setGameState(prev => ({
      ...prev,
      netWorth: newNetWorth,
      karma: prev.karma + choice.karma,
      empire: choice.profit > 0 ? [...prev.empire, choice.industry] : prev.empire,
      headlines: [...prev.headlines, choice.consequence.substring(0, 60) + "..."],
      darkDeals: choice.karma < -10 ? prev.darkDeals + 1 : prev.darkDeals,
      politiciansBought: choice.industry === "politics" && choice.karma < 0 ? prev.politiciansBought + 1 : prev.politiciansBought,
      livesAffected: prev.livesAffected + Math.abs(choice.karma) * 1000,
      streak: newStreak,
      bestStreak: Math.max(prev.bestStreak, newStreak),
      milestonesHit: newMilestones.length > 0 ? [...prev.milestonesHit, ...newMilestones.map(m => m.threshold)] : prev.milestonesHit,
    }));

    const displayChoice = { ...choice, profit: adjustedProfit };
    setLastChoice(displayChoice);

    setChoiceHistory(prev => [...prev, {
      scenario: currentScenario?.title || "",
      choice: choice.text,
      profit: adjustedProfit,
      karma: choice.karma,
    }]);

    try {
      const data = await apiCall("/api/game/trump-reaction", {
        playerName,
        choiceText: choice.text,
        choiceKarma: choice.karma,
        consequence: choice.consequence,
        netWorth: newNetWorth,
        totalKarma: newKarma,
        turn: gameState.turn,
      });
      setTrumpQuote(data.reaction);
      if (data.audio) {
        playTrumpAudio(data.audio);
      } else {
        setTrumpSpeaking(false);
      }
    } catch {
      const ruthlessLines = [
        `${playerName}, that was RUTHLESS! I love it! Tremendous! You're like a young Trump!`,
        `${playerName}, now THAT'S a killer move! You've got more guts than half of Congress! Believe me!`,
        `${playerName}, beautiful! That's how you build an empire! Nobody does it better — except me!`,
      ];
      const ethicalLines = [
        `Look ${playerName}, you're fermenting up like the old broken down crow Mitch McConnell! Sad!`,
        `${playerName}, you're a loser pretty much to the likes of Biden! Very low energy!`,
        `Sad to say ${playerName}, but your IQ has pretty much reached Maxine Waters levels, and that's bad bad bad folks!`,
        `${playerName}, you're weaker than Sleepy Joe at a press conference! Total lightweight!`,
        `Even Nancy Pelosi would've made that deal ${playerName}, and she's about 900 years old! Pathetic!`,
        `${playerName}, you just pulled a Mitt Romney — spineless! Nobody respects that!`,
      ];
      const grayLines = [
        `${playerName}, not bad, not bad. But I'd do it BETTER! Ask anyone!`,
        `${playerName}, I see what you did there. Smart, but not Trump-level smart. Close though!`,
        `${playerName}, that's the kind of move that gets you to $500M. But to a BILLION? You gotta think BIGGER!`,
      ];
      const pool = choice.karma <= -15 ? ruthlessLines : choice.karma >= 10 ? ethicalLines : grayLines;
      const fallback = pool[Math.floor(Math.random() * pool.length)];
      setTrumpQuote(fallback);
      setTrumpSpeaking(false);
    }

    const updatedState: GameState = {
      ...gameState,
      netWorth: newNetWorth,
      karma: newKarma,
      turn: gameState.turn,
      empire: choice.profit > 0 ? [...gameState.empire, choice.industry] : gameState.empire,
      headlines: [...gameState.headlines, choice.consequence.substring(0, 60) + "..."],
      darkDeals: choice.karma < -10 ? gameState.darkDeals + 1 : gameState.darkDeals,
      politiciansBought: choice.industry === "politics" && choice.karma < 0 ? gameState.politiciansBought + 1 : gameState.politiciansBought,
      livesAffected: gameState.livesAffected + Math.abs(choice.karma) * 1000,
      streak: newStreak,
      bestStreak: Math.max(gameState.bestStreak, newStreak),
      milestonesHit: newMilestones.length > 0 ? [...gameState.milestonesHit, ...newMilestones.map(m => m.threshold)] : gameState.milestonesHit,
    };

    if (newNetWorth >= 1_000_000_000) {
      recordGameResultStats(true, newNetWorth).then(s => setViralGameStats(s));
      submitResult(true, updatedState, playerName);
      setTimeout(() => {
        if (newKarma < -30) {
          setShowHellfire(true);
        } else {
          setGameWon(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }, 3000);
    } else if (newNetWorth <= 0) {
      recordGameResultStats(false, 0).then(s => setViralGameStats(s));
      submitResult(false, updatedState, playerName);
    } else {
      saveProgress(updatedState, [...choiceHistory, { scenario: currentScenario?.title || "", choice: choice.text, profit: adjustedProfit, karma: choice.karma }], usedTitles, playerName);
      if (gameState.turn > 0 && gameState.turn % PUTTING_BONUS_INTERVAL === 0 && lastBonusOfferTurn.current !== gameState.turn) {
        lastBonusOfferTurn.current = gameState.turn;
        setBonusGameKind(Math.random() < 0.5 ? "putting" : "threePoint");
      }
    }
  }, [gameState, currentScenario, playerName, apiCall, playTrumpAudio, saveProgress, submitResult, choiceHistory, usedTitles]);

  const handleHellfireComplete = useCallback(async () => {
    setHellfireComplete(true);
    try {
      const data = await apiCall("/api/game/trump-hellfire", { playerName });
      setTrumpQuote(data.text);
      if (data.audio) {
        playTrumpAudio(data.audio);
      }
    } catch {
      setTrumpQuote(`Sorry to have to tell you ${playerName}... Nobody does it like Trump and gets away with it! And not burn in hell! Nobody!`);
    }
    setTimeout(() => {
      setShowHellfire(false);
      setHellfireComplete(false);
      setGameWon(true);
    }, 6000);
  }, [playerName, apiCall, playTrumpAudio]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    cleanupSound();
    setGameState({ netWorth: 1_000_000, karma: 0, turn: 0, empire: [], headlines: [], darkDeals: 0, politiciansBought: 0, livesAffected: 0, streak: 0, bestStreak: 0, milestonesHit: [] });
    setCurrentScenario(null);
    setShowConsequence(false);
    setLastChoice(null);
    setUsedTitles([]);
    setChoiceHistory([]);
    setTrumpQuote("");
    setGameWon(false);
    setShowHellfire(false);
    setHellfireComplete(false);
    setIsResolvingChoice(false);
    elapsedBeforeResume.current = 0;
    setNameConfirmed(false);
    setPlayerName("");
    setNameInput("");
    setMilestone(null);
    setBreakingNews("");
    setRandomEvent(null);
    setStreakBonus(0);
    setBonusGameKind(null);
    setActiveBonusGame(null);
    lastBonusOfferTurn.current = 0;
  }, [cleanupSound]);

  const handleShare = useCallback(() => {
    const darkPercent = choiceHistory.length > 0 ? Math.round((choiceHistory.filter(c => c.karma < -10).length / choiceHistory.length) * 100) : 0;
    const shareText = `🎮 DYNAMIC BILLIONAIRES\n\n${titleInfo.emoji} ${titleInfo.label}\n💰 Net Worth: ${fmtMoney(gameState.netWorth)}\n⚡ Moral Rating: ${karmaRating.label}\n🎭 Dark Deals: ${gameState.darkDeals}\n📊 ${darkPercent}% ruthless choices\n\n${gameWon ? "I reached $1 BILLION! 👑" : `Turn ${gameState.turn} — still climbing!`}\n\n👉 Play at thearena.rip`;
    shareContent({ text: shareText, feature: "game" });
  }, [gameState, titleInfo, karmaRating, choiceHistory, gameWon]);

  const industryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    gameState.empire.forEach(i => { counts[i] = (counts[i] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [gameState.empire]);

  if (showHellfire) {
    return <HellfireAnimation playerName={playerName} onComplete={handleHellfireComplete} />;
  }

  if (showLeaderboard) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <LinearGradient colors={["#0a0a14", "#000", "#140a0a"]} style={StyleSheet.absoluteFillObject} />
        <View style={styles.header}>
          <Pressable onPress={() => setShowLeaderboard(false)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gold} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>ALL-TIME RANKINGS</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {leaderboardLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={Colors.gold} size="large" />
            <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 12, fontSize: 13 }}>Loading leaderboard...</Text>
          </View>
        ) : leaderboardData && leaderboardData.leaderboard.length > 0 ? (
          <FlatList
            data={leaderboardData.leaderboard}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]}
            ListHeaderComponent={
              <View>
                {leaderboardData.stats && (
                  <View style={[styles.statsCard, { marginBottom: 16 }]}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{leaderboardData.stats.totalWins}</Text>
                      <Text style={styles.statLabel}>TOTAL WINS</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{leaderboardData.stats.totalGames}</Text>
                      <Text style={styles.statLabel}>GAMES</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{leaderboardData.stats.fastestTurns || "—"}</Text>
                      <Text style={styles.statLabel}>FASTEST (TURNS)</Text>
                    </View>
                  </View>
                )}
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginBottom: 10, textAlign: "center" as const }}>
                  Ranked by overall performance — net worth, speed, karma, streaks & milestones combined
                </Text>
                <View style={{ flexDirection: "row", paddingHorizontal: 4, marginBottom: 8 }}>
                  <Text style={{ flex: 0.15, color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "700" as const }}>RANK</Text>
                  <Text style={{ flex: 0.3, color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "700" as const }}>PLAYER</Text>
                  <Text style={{ flex: 0.2, color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "700" as const, textAlign: "center" as const }}>SCORE</Text>
                  <Text style={{ flex: 0.35, color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "700" as const, textAlign: "right" as const }}>TURNS / TIME</Text>
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <Animated.View entering={FadeInDown.duration(300)}>
                <View style={{ backgroundColor: item.rank <= 3 ? "rgba(212,164,32,0.08)" : "rgba(255,255,255,0.03)", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: item.rank <= 3 ? "rgba(212,164,32,0.2)" : "rgba(255,255,255,0.05)" }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 0.15, alignItems: "center" as const }}>
                      <Text style={{ fontSize: item.rank <= 3 ? 20 : 14, fontWeight: "900" as const, color: item.rank === 1 ? "#FFD700" : item.rank === 2 ? "#C0C0C0" : item.rank === 3 ? "#CD7F32" : "rgba(255,255,255,0.5)" }}>
                        {item.rank <= 3 ? ["🥇", "🥈", "🥉"][item.rank - 1] : `#${item.rank}`}
                      </Text>
                    </View>
                    <View style={{ flex: 0.3 }}>
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" as const }} numberOfLines={1}>{item.playerName}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>
                        {fmtMoney(item.finalNetWorth)} • {item.karma >= 0 ? "+" : ""}{item.karma} karma
                      </Text>
                    </View>
                    <View style={{ flex: 0.2, alignItems: "center" as const }}>
                      <Text style={{ color: Colors.gold, fontSize: 16, fontWeight: "900" as const }}>{item.performanceScore.toLocaleString()}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 8 }}>SCORE</Text>
                    </View>
                    <View style={{ flex: 0.35, alignItems: "flex-end" as const }}>
                      <Text style={{ color: "#22C55E", fontSize: 12, fontWeight: "800" as const }}>{item.turns} deals • {formatDuration(item.durationSeconds)}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, marginTop: 2 }}>
                        🔥{item.bestStreak} streak • {item.milestonesHit}/{MILESTONES.length} milestones
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            )}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 }}>
            <Text style={{ fontSize: 48 }}>🏛️</Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center" as const, marginTop: 12 }}>
              No winners yet! Be the first to reach $1 Billion and claim the #1 spot!
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (!nameConfirmed) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <LinearGradient colors={["#0a0a14", "#000", "#140a0a"]} style={StyleSheet.absoluteFillObject} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gold} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>DYNAMIC BILLIONAIRES</Text>
          </View>
          <Pressable onPress={() => { setShowLeaderboard(true); loadLeaderboard(); }} style={styles.backBtn}>
            <Ionicons name="trophy" size={18} color={Colors.gold} />
          </Pressable>
          <ShareAppButton variant="icon" area="billionaires" style={{ marginLeft: 6 }} />
        </View>

        {showResumePrompt && savedProgress ? (
          <View style={styles.nameInputContainer}>
            <Animated.View entering={FadeInDown.duration(600)}>
              <Text style={{ fontSize: 48, textAlign: "center" as const }}>💾</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <Text style={styles.namePromptTitle}>RESUME GAME?</Text>
              <Text style={styles.namePromptSub}>
                {savedProgress.playerName}'s empire at {fmtMoney(savedProgress.gameState.netWorth)} • Turn {savedProgress.gameState.turn}
              </Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={{ width: "100%", maxWidth: 300, gap: 10 }}>
              <Pressable onPress={resumeGame} style={({ pressed }) => [styles.nameConfirmBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}>
                <LinearGradient colors={[Colors.gold, Colors.goldDark || "#B8860B"]} style={styles.startBtnGradient}>
                  <Text style={styles.startBtnText}>RESUME — {fmtMoney(savedProgress.gameState.netWorth)}</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={dismissResume} style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.resetBtnText}>START FRESH</Text>
              </Pressable>
            </Animated.View>
          </View>
        ) : (
          <View style={styles.nameInputContainer}>
            <Animated.View entering={FadeInDown.duration(600)}>
              <Image source={require("@/assets/images/trump-avatar.jpg")} style={styles.nameAvatar} />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <Text style={styles.namePromptTitle}>WHAT'S YOUR NAME?</Text>
              <Text style={styles.namePromptSub}>Trump needs to know who he's dealing with...</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={{ width: "100%", maxWidth: 300 }}>
              <TextInput
                style={styles.nameTextInput}
                placeholder="Enter your name..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={nameInput}
                onChangeText={setNameInput}
                autoCapitalize="words"
                autoFocus
                maxLength={20}
                onSubmitEditing={confirmName}
                returnKeyType="go"
              />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(600).duration(400)}>
              <Pressable
                onPress={confirmName}
                disabled={!nameInput.trim() || loading}
                style={({ pressed }) => [
                  styles.nameConfirmBtn,
                  !nameInput.trim() && { opacity: 0.4 },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
              >
                <LinearGradient colors={[Colors.gold, Colors.goldDark || "#B8860B"]} style={styles.startBtnGradient}>
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.startBtnText}>LET'S GO!</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>
    );
  }

  if (!currentScenario && !gameWon) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <LinearGradient colors={["#0a0a14", "#000", "#140a0a"]} style={StyleSheet.absoluteFillObject} />
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.gold} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>DYNAMIC BILLIONAIRES</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => { setShowLeaderboard(true); loadLeaderboard(); }} style={styles.shareBtn}>
                <Ionicons name="trophy" size={18} color={Colors.gold} />
              </Pressable>
              <Pressable onPress={() => { setVoiceEnabled(v => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={[styles.shareBtn, !voiceEnabled && { opacity: 0.4 }]}>
                <Ionicons name={voiceEnabled ? "volume-high" : "volume-mute"} size={18} color={Colors.gold} />
              </Pressable>
              <Pressable onPress={handleShare} style={styles.shareBtn}>
                <Ionicons name="share-outline" size={20} color={Colors.gold} />
              </Pressable>
            </View>
          </View>

          <Animated.View entering={FadeInDown.duration(600)} style={styles.introCard}>
            <LinearGradient colors={["#1a1408", "#0a0a04"]} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>🏛️</Text>
            <Text style={{ color: Colors.gold, fontSize: 22, fontWeight: "900", textAlign: "center", letterSpacing: 2 }}>
              THE PATH TO $1 BILLION
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 19 }}>
              Every billionaire has secrets. Every fortune has a cost.{"\n"}How far will YOU go, {playerName}?
            </Text>
          </Animated.View>

          {trumpQuote ? (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <View style={styles.trumpQuoteCard}>
                <Image source={require("@/assets/images/trump-avatar.jpg")} style={styles.trumpAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.trumpQuoteText}>"{trumpQuote}"</Text>
                  {trumpSpeaking && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Ionicons name="volume-high" size={12} color={Colors.gold} />
                      <Text style={{ fontSize: 10, color: Colors.gold }}>Speaking...</Text>
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          ) : null}

          {gameState.turn > 0 && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <View style={styles.statsCard}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{fmtMoney(gameState.netWorth)}</Text>
                  <Text style={styles.statLabel}>NET WORTH</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: karmaRating.color }]}>{gameState.karma}</Text>
                  <Text style={styles.statLabel}>KARMA</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{gameState.streak > 0 ? `🔥${gameState.streak}` : String(gameState.turn)}</Text>
                  <Text style={styles.statLabel}>{gameState.streak > 0 ? "STREAK" : "DEALS"}</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {bonusGameKind && !loading && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <Pressable
                onPress={() => {
                  // Consuming the offer here (not on completion) means a single tap grants
                  // exactly one scored attempt — closing early without finishing forfeits it
                  // rather than leaving the offer re-openable for unlimited free retries.
                  setActiveBonusGame(bonusGameKind);
                  setBonusGameKind(null);
                }}
                style={({ pressed }) => [styles.puttingBanner, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={bonusGameKind === "putting" ? ["#16A34A", "#166534"] : ["#EA580C", "#9A3412"]}
                  style={styles.puttingBannerGradient}
                >
                  <Text style={styles.puttingBannerEmoji}>{bonusGameKind === "putting" ? "⛳" : "🏀"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.puttingBannerTitle}>
                      {bonusGameKind === "putting" ? "BONUS PUTT AVAILABLE" : "BONUS 3-POINTER AVAILABLE"}
                    </Text>
                    <Text style={styles.puttingBannerSubtitle}>
                      {bonusGameKind === "putting"
                        ? "Nail it for extra net worth — totally optional"
                        : "Sink the shot for extra net worth — totally optional"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#fff" />
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
            <Pressable
              onPress={startNextTurn}
              disabled={loading}
              style={({ pressed }) => [styles.startBtn, pressed && { transform: [{ scale: 0.97 }], opacity: 0.8 }]}
            >
              <LinearGradient colors={[Colors.gold, Colors.goldDark || "#B8860B"]} style={styles.startBtnGradient}>
                {loading ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color="#000" size="small" />
                    <Text style={styles.startBtnText}>GENERATING DEAL...</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.startBtnText}>{gameState.turn === 0 ? "BEGIN YOUR RISE" : "NEXT DEAL"}</Text>
                    <Text style={{ color: "rgba(0,0,0,0.5)", fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                      {gameState.turn === 0 ? `Start with $1M — reach $1B, ${playerName}` : `Turn ${gameState.turn + 1} — ${fmtMoney(1_000_000_000 - gameState.netWorth)} to go`}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {gameState.turn > 0 && (
            <Pressable onPress={handleReset} style={{ alignSelf: "center", marginTop: 16, padding: 10 }}>
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Reset Game</Text>
            </Pressable>
          )}
        </ScrollView>
        <PuttingMiniGame
          visible={activeBonusGame === "putting"}
          onClose={() => setActiveBonusGame(null)}
          onComplete={(result) => applyBonusResult("putting", result)}
        />
        <ThreePointMiniGame
          visible={activeBonusGame === "threePoint"}
          onClose={() => setActiveBonusGame(null)}
          onComplete={(result) => applyBonusResult("threePoint", result)}
        />
      </View>
    );
  }

  if (gameWon) {
    const darkPercent = choiceHistory.length > 0 ? Math.round((choiceHistory.filter(c => c.karma < -10).length / choiceHistory.length) * 100) : 0;
    const burnedInHell = gameState.karma < -30;
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <LinearGradient colors={burnedInHell ? ["#1a0000", "#000", "#330000"] : ["#1a1408", "#000", "#0a1408"]} style={StyleSheet.absoluteFillObject} />
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(800)}>
            <View style={{ alignItems: "center", paddingTop: 30, paddingBottom: 20 }}>
              <Text style={{ fontSize: 64 }}>{burnedInHell ? "🔥" : "👑"}</Text>
              <Text style={{ color: burnedInHell ? "#EF4444" : Colors.gold, fontSize: 32, fontWeight: "900", letterSpacing: 3, marginTop: 10 }}>
                {burnedInHell ? "BURNED IN HELL" : "BILLIONAIRE"}
              </Text>
              <Animated.Text style={[{ color: "#fff", fontSize: 42, fontWeight: "900", marginTop: 8 }, pulseStyle]}>
                {fmtMoney(gameState.netWorth)}
              </Animated.Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 4 }}>
                {playerName}'s Empire
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(600)}>
            <View style={styles.trumpQuoteCard}>
              <Image source={require("@/assets/images/trump-avatar.jpg")} style={styles.trumpAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.trumpQuoteText}>"{trumpQuote}"</Text>
                {trumpSpeaking && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Ionicons name="volume-high" size={12} color={Colors.gold} />
                    <Text style={{ fontSize: 10, color: Colors.gold }}>Speaking...</Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).duration(600)}>
            <LinearGradient colors={["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]} style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{playerName}'s BILLIONAIRE PROFILE</Text>
              {[
                { label: "Moral Rating", value: karmaRating.label, color: karmaRating.color },
                { label: "Karma Score", value: String(gameState.karma), color: gameState.karma >= 0 ? "#22C55E" : "#EF4444" },
                { label: "Deals Made", value: String(gameState.turn), color: "#fff" },
                { label: "Dark Deals", value: String(gameState.darkDeals), color: "#EF4444" },
                { label: "Politicians Bought", value: String(gameState.politiciansBought), color: "#7C3AED" },
                { label: "Lives Affected", value: gameState.livesAffected.toLocaleString(), color: "#fff" },
                { label: "Best Deal Streak", value: `🔥 ${gameState.bestStreak}`, color: "#EAB308" },
                { label: "Milestones Hit", value: `${gameState.milestonesHit.length}/${MILESTONES.length}`, color: Colors.gold },
                { label: "Ruthless Choices", value: `${darkPercent}%`, color: "#F97316" },
              ].map((row, i) => (
                <View key={i} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{row.label}</Text>
                  <Text style={[styles.summaryValue, { color: row.color }]}>{row.value}</Text>
                </View>
              ))}
              {industryBreakdown.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.summaryTitle, { fontSize: 12, marginBottom: 8 }]}>EMPIRE BREAKDOWN</Text>
                  {industryBreakdown.map(([ind, count]) => (
                    <View key={ind} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 }}>
                      <Ionicons name={(INDUSTRY_ICONS[ind as Industry] || "business") as any} size={14} color={INDUSTRY_COLORS[ind as Industry] || "#888"} />
                      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, flex: 1, textTransform: "capitalize" }}>{ind}</Text>
                      <View style={{ backgroundColor: (INDUSTRY_COLORS[ind as Industry] || "#888") + "30", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ color: INDUSTRY_COLORS[ind as Industry] || "#888", fontSize: 11, fontWeight: "800" }}>{count}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </LinearGradient>
          </Animated.View>

          {viralGameStats.gamesPlayed > 0 && (
            <StatsPanel
              title="ALL-TIME STATS"
              emoji="\uD83C\uDFC6"
              stats={[
                { label: "Games Played", value: viralGameStats.gamesPlayed },
                { label: "Wins", value: viralGameStats.wins },
                { label: "Losses", value: viralGameStats.losses },
                { label: "Current Streak", value: `\uD83D\uDD25 ${viralGameStats.streak}` },
                { label: "Best Streak", value: viralGameStats.bestStreak },
                { label: "Highest Score", value: fmtMoney(viralGameStats.highestScore) },
              ]}
              accentColor="#9333EA"
              onShare={() => {
                setViralShareData({
                  headline: `${viralGameStats.wins} Wins \u2022 ${fmtMoney(viralGameStats.highestScore)}`,
                  quote: `I've played ${viralGameStats.gamesPlayed} games of Dynamic Billionaires!\nBest Streak: ${viralGameStats.bestStreak}\nHighest Score: ${fmtMoney(viralGameStats.highestScore)}\n\nCan you beat my score?`,
                });
                setViralShareVisible(true);
              }}
              onChallenge={() => {
                shareContent({
                  text: `I've won ${viralGameStats.wins} games and scored ${fmtMoney(viralGameStats.highestScore)} in Dynamic Billionaires! Think you can do better? \uD83C\uDFAE\n\nPlay at thearena.rip`,
                  feature: "game_challenge",
                });
              }}
            />
          )}

          <Animated.View entering={FadeInDown.delay(700).duration(400)} style={{ gap: 10 }}>
            <Pressable onPress={() => { setShowLeaderboard(true); loadLeaderboard(); }} style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.8 }]}>
              <LinearGradient colors={["#9333EA", "#7C3AED"]} style={styles.startBtnGradient}>
                <Text style={[styles.startBtnText, { color: "#fff" }]}>🏆 ALL-TIME RANKINGS</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={handleShare} style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.8 }]}>
              <LinearGradient colors={[Colors.gold, Colors.goldDark || "#B8860B"]} style={styles.startBtnGradient}>
                <Text style={styles.startBtnText}>SHARE YOUR EMPIRE</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={handleReset} style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}>
              <Text style={styles.resetBtnText}>PLAY AGAIN — DIFFERENT CHOICES</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
        <ViralShareCard
          visible={viralShareVisible}
          onClose={() => setViralShareVisible(false)}
          category="game"
          headline={viralShareData.headline}
          quote={viralShareData.quote}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient colors={["#0a0a14", "#000"]} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>DEAL #{gameState.turn}</Text>
          <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: "600" as const }}>
            {fmtMoney(gameState.netWorth)} • {karmaRating.label} • {playerName}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => { setVoiceEnabled(v => !v); cleanupSound(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={[styles.shareBtn, !voiceEnabled && { opacity: 0.4 }]}>
            <Ionicons name={voiceEnabled ? "volume-high" : "volume-mute"} size={18} color={Colors.gold} />
          </Pressable>
          <Pressable onPress={handleShare} style={styles.shareBtn}>
            <Ionicons name="share-outline" size={20} color={Colors.gold} />
          </Pressable>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <LinearGradient
            colors={gameState.karma >= 0 ? ["#22C55E", Colors.gold] : ["#EF4444", "#D97706"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${progress}%` as any }]}
          />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{fmtMoney(gameState.netWorth)}</Text>
          <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>$1B GOAL</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        {currentScenario && !showConsequence && (
          <Animated.View entering={SlideInRight.duration(400)}>
            <LinearGradient
              colors={[INDUSTRY_COLORS[currentScenario.industry] + "15", "rgba(0,0,0,0)"]}
              style={styles.scenarioCard}
            >
              <View style={{ position: "absolute", top: -1, left: 20, right: 20, height: 3, borderRadius: 2, backgroundColor: INDUSTRY_COLORS[currentScenario.industry] + "60" }} />
              <View style={styles.scenarioHeader}>
                <Text style={{ fontSize: 36 }}>{currentScenario.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.scenarioTitle, { color: INDUSTRY_COLORS[currentScenario.industry] }]}>{currentScenario.title}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <Ionicons name={(INDUSTRY_ICONS[currentScenario.industry]) as any} size={12} color={INDUSTRY_COLORS[currentScenario.industry]} />
                    <Text style={{ fontSize: 10, color: INDUSTRY_COLORS[currentScenario.industry], fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>{currentScenario.industry}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.scenarioDesc}>{currentScenario.description}</Text>
              {narratorSpeaking && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                  <Ionicons name="mic" size={14} color="#4ADE80" />
                  <Text style={{ fontSize: 11, color: "#4ADE80", fontWeight: "700" }}>Narrator speaking...</Text>
                </View>
              )}

              <View style={{ marginTop: 20, gap: 12 }}>
                {currentScenario.choices.map((choice, i) => {
                  const isDark = choice.karma <= -15;
                  const isGood = choice.karma >= 10;
                  const borderColor = isDark ? "#EF4444" : isGood ? "#22C55E" : "#F59E0B";
                  return (
                    <Animated.View key={i} entering={FadeInDown.delay(200 + i * 150).duration(300)}>
                      <Pressable
                        onPress={() => makeChoice(choice)}
                        disabled={loading}
                        style={({ pressed }) => [
                          styles.choiceBtn,
                          { borderColor: borderColor + "40", backgroundColor: borderColor + "08" },
                          pressed && { transform: [{ scale: 0.98 }], borderColor: borderColor + "80" },
                        ]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <View style={[styles.karmaBadge, { backgroundColor: borderColor + "20", borderColor: borderColor + "40" }]}>
                            <Text style={[styles.karmaBadgeText, { color: borderColor }]}>{choice.karmaLabel}</Text>
                          </View>
                          <Text style={{ fontSize: 11, color: choice.profit >= 0 ? "#22C55E" : "#EF4444", fontWeight: "800" }}>
                            {choice.profit >= 0 ? "+" : ""}{fmtMoney(choice.profit)}
                          </Text>
                        </View>
                        <Text style={styles.choiceText}>{choice.text}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                          <Ionicons name={choice.karma < 0 ? "arrow-down" : "arrow-up"} size={10} color={choice.karma < 0 ? "#EF4444" : "#22C55E"} />
                          <Text style={{ fontSize: 10, color: choice.karma < 0 ? "#EF4444" : "#22C55E", fontWeight: "700" }}>
                            {choice.karma > 0 ? "+" : ""}{choice.karma} karma
                          </Text>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {showConsequence && lastChoice && (
          <Animated.View entering={FadeIn.duration(500)}>
            <LinearGradient
              colors={lastChoice.karma < -10 ? ["rgba(239,68,68,0.12)", "rgba(0,0,0,0)"] : lastChoice.karma > 5 ? ["rgba(34,197,94,0.12)", "rgba(0,0,0,0)"] : ["rgba(245,158,11,0.12)", "rgba(0,0,0,0)"]}
              style={styles.consequenceCard}
            >
              <View style={styles.consequenceHeader}>
                <Text style={{ fontSize: 28 }}>{lastChoice.karma <= -15 ? "😈" : lastChoice.karma >= 10 ? "😇" : "🤔"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.consequenceLabel, { color: lastChoice.karma <= -15 ? "#EF4444" : lastChoice.karma >= 10 ? "#22C55E" : "#F59E0B" }]}>
                    {lastChoice.karmaLabel}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: lastChoice.profit >= 0 ? "#22C55E" : "#EF4444", fontWeight: "800" }}>
                      {lastChoice.profit >= 0 ? "+" : ""}{fmtMoney(lastChoice.profit)}
                    </Text>
                    <Text style={{ fontSize: 12, color: lastChoice.karma >= 0 ? "#22C55E" : "#EF4444", fontWeight: "800" }}>
                      {lastChoice.karma > 0 ? "+" : ""}{lastChoice.karma} karma
                    </Text>
                  </View>
                </View>
              </View>

              {streakBonus > 0 && (
                <Animated.View entering={FadeInDown.delay(100).duration(300)}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(234,179,8,0.15)", borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "rgba(234,179,8,0.3)" }}>
                    <Text style={{ fontSize: 20 }}>🔥</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#EAB308", fontSize: 12, fontWeight: "900" as const, letterSpacing: 1 }}>
                        {gameState.streak}x DEAL STREAK! +{streakBonus}% BONUS
                      </Text>
                      <Text style={{ color: "rgba(234,179,8,0.7)", fontSize: 10, marginTop: 2 }}>
                        Consecutive profitable deals pay more!
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              )}

              {randomEvent && (
                <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: randomEvent.multiplier >= 1 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: randomEvent.multiplier >= 1 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)" }}>
                    <Text style={{ fontSize: 24 }}>{randomEvent.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: randomEvent.multiplier >= 1 ? "#22C55E" : "#EF4444", fontSize: 12, fontWeight: "900" as const, letterSpacing: 0.5 }}>
                        {randomEvent.title}
                      </Text>
                      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>
                        {randomEvent.message} ({randomEvent.multiplier >= 1 ? "+" : ""}{Math.round((randomEvent.multiplier - 1) * 100)}% net worth)
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              )}

              <Text style={styles.consequenceText}>{lastChoice.consequence}</Text>

              {milestone && (
                <Animated.View entering={FadeInDown.delay(300).duration(500)}>
                  <LinearGradient colors={["rgba(212,164,32,0.2)", "rgba(212,164,32,0.05)"]} style={{ borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "rgba(212,164,32,0.4)", alignItems: "center" as const }}>
                    <Text style={{ fontSize: 36 }}>{milestone.emoji}</Text>
                    <Text style={{ color: Colors.gold, fontSize: 16, fontWeight: "900" as const, letterSpacing: 2, marginTop: 6 }}>
                      {milestone.label}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4, textAlign: "center" as const }}>
                      {milestone.message}
                    </Text>
                  </LinearGradient>
                </Animated.View>
              )}

              {breakingNews ? (
                <Animated.View entering={FadeInDown.delay(400).duration(300)}>
                  <View style={{ backgroundColor: "rgba(220,38,38,0.12)", borderRadius: 8, padding: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: "#DC2626" }}>
                    <Text style={{ color: "#DC2626", fontSize: 9, fontWeight: "900" as const, letterSpacing: 1, marginBottom: 3 }}>BREAKING NEWS</Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontStyle: "italic" as const, lineHeight: 16 }}>{breakingNews}</Text>
                  </View>
                </Animated.View>
              ) : null}

              <View style={[styles.trumpQuoteCard, trumpSpeaking && { borderLeftColor: "#22C55E" }]}>
                <Image source={require("@/assets/images/trump-avatar.jpg")} style={[styles.trumpAvatar, { width: 32, height: 32 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.trumpQuoteText, { fontSize: 12 }]}>"{trumpQuote}"</Text>
                  {trumpSpeaking && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Ionicons name="volume-high" size={12} color={Colors.gold} />
                      <Text style={{ fontSize: 10, color: Colors.gold }}>Trump is speaking...</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>{fmtMoney(gameState.netWorth)}</Text>
                  <Text style={styles.miniStatLabel}>NET WORTH</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatValue, { color: karmaRating.color }]}>{gameState.karma}</Text>
                  <Text style={styles.miniStatLabel}>KARMA</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>{gameState.streak > 0 ? `🔥${gameState.streak}` : gameState.darkDeals}</Text>
                  <Text style={styles.miniStatLabel}>{gameState.streak > 0 ? "STREAK" : "DARK DEALS"}</Text>
                </View>
              </View>

              <Pressable
                onPress={startNextTurn}
                disabled={loading}
                style={({ pressed }) => [styles.startBtn, { marginTop: 20 }, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
              >
                <LinearGradient colors={[Colors.gold, Colors.goldDark || "#B8860B"]} style={styles.startBtnGradient}>
                  {loading ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator color="#000" size="small" />
                      <Text style={styles.startBtnText}>GENERATING...</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.startBtnText}>NEXT DEAL</Text>
                      <Text style={{ color: "rgba(0,0,0,0.4)", fontSize: 10, fontWeight: "700" }}>
                        {fmtMoney(1_000_000_000 - gameState.netWorth)} to go
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        )}

        <CashAppDonate />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    ...Platform.select({
      web: { height: "100vh" as any, maxHeight: "100vh" as any, overflow: "hidden" as any },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(212,164,32,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: 18, fontWeight: "900" as const, color: Colors.gold, letterSpacing: 2,
  },
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(212,164,32,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    ...Platform.select({
      web: { maxWidth: 600, alignSelf: "center" as any, width: "100%" as any },
    }),
  },
  nameInputContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    gap: 20,
    marginTop: -40,
  },
  nameAvatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: Colors.gold,
  },
  namePromptTitle: {
    fontSize: 22, fontWeight: "900" as const, color: Colors.gold,
    textAlign: "center", letterSpacing: 2,
  },
  namePromptSub: {
    fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 6,
  },
  nameTextInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5, borderColor: "rgba(212,164,32,0.3)",
    borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14,
    fontSize: 18, color: "#fff", textAlign: "center",
    fontWeight: "700" as const,
  },
  nameConfirmBtn: {
    borderRadius: 14, overflow: "hidden", width: 200,
  },
  progressContainer: { paddingHorizontal: 16, marginBottom: 8 },
  progressBg: {
    height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  introCard: {
    borderRadius: 20, padding: 24, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(212,164,32,0.2)",
    overflow: "hidden",
  },
  trumpQuoteCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    marginBottom: 12, padding: 12,
    backgroundColor: "rgba(212,164,32,0.06)",
    borderRadius: 14, borderLeftWidth: 3, borderLeftColor: Colors.gold,
  },
  trumpAvatar: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: Colors.gold,
  },
  trumpQuoteText: {
    fontSize: 13, color: "#fff", fontStyle: "italic", lineHeight: 19,
  },
  statsCard: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  statItem: { alignItems: "center", flex: 1 },
  statValue: {
    fontSize: 18, fontWeight: "900" as const, color: Colors.gold,
  },
  statLabel: {
    fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: "700" as const,
    letterSpacing: 1, marginTop: 2,
  },
  statDivider: {
    width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.08)",
  },
  puttingBanner: { borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  puttingBannerGradient: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14,
  },
  puttingBannerEmoji: { fontSize: 22 },
  puttingBannerTitle: { color: "#fff", fontSize: 13, fontWeight: "900" as const, letterSpacing: 0.5 },
  puttingBannerSubtitle: { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 },
  startBtn: { borderRadius: 14, overflow: "hidden" },
  startBtnGradient: {
    paddingVertical: 16, alignItems: "center", justifyContent: "center", borderRadius: 14,
  },
  startBtnText: {
    fontSize: 16, fontWeight: "900" as const, color: "#000", letterSpacing: 1,
  },
  resetBtn: {
    paddingVertical: 14, alignItems: "center", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  resetBtnText: {
    fontSize: 13, fontWeight: "800" as const, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5,
  },
  scenarioCard: {
    borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  scenarioHeader: {
    flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14,
  },
  scenarioTitle: {
    fontSize: 16, fontWeight: "900" as const, letterSpacing: 0.5,
  },
  scenarioDesc: {
    fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 21,
  },
  choiceBtn: {
    borderRadius: 14, padding: 14, borderWidth: 1.5,
  },
  choiceText: {
    fontSize: 13, color: "#fff", lineHeight: 19, fontWeight: "600" as const,
  },
  karmaBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  karmaBadgeText: {
    fontSize: 9, fontWeight: "900" as const, letterSpacing: 1,
  },
  consequenceCard: {
    borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  consequenceHeader: {
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14,
  },
  consequenceLabel: {
    fontSize: 14, fontWeight: "900" as const, letterSpacing: 1,
  },
  consequenceText: {
    fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 20, marginBottom: 14,
  },
  miniStat: {
    flex: 1, alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10, padding: 10,
  },
  miniStatValue: {
    fontSize: 14, fontWeight: "900" as const, color: Colors.gold,
  },
  miniStatLabel: {
    fontSize: 8, color: "rgba(255,255,255,0.3)", fontWeight: "700" as const,
    letterSpacing: 0.5, marginTop: 2,
  },
  summaryCard: {
    borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  summaryTitle: {
    fontSize: 14, fontWeight: "900" as const, color: Colors.gold,
    letterSpacing: 1, marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  summaryLabel: {
    fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: "600" as const,
  },
  summaryValue: {
    fontSize: 13, fontWeight: "800" as const, color: "#fff",
  },
  hellfireOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  hellfirePlayerIcon: {
    alignItems: "center",
    zIndex: 10,
  },
  hellfireAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 3, borderColor: Colors.gold,
  },
  hellfirePlayerName: {
    color: "#fff", fontSize: 18, fontWeight: "900" as const,
    marginTop: 8, letterSpacing: 1,
  },
  hellfireFlames: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    justifyContent: "flex-end",
  },
  hellfireText: {
    color: "#EF4444",
    fontSize: 24,
    fontWeight: "900" as const,
    textAlign: "center",
    letterSpacing: 3,
    textShadowColor: "#ff0000",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  hellfireSubtext: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
});
