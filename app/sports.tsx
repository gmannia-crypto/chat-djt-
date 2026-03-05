import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Image,
  Linking,
  ActivityIndicator,
  type ImageSourcePropType,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { playTTS } from "@/lib/audio-helper";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import {
  recordInteraction,
  getHeadToHead,
  generateTrashTalk,
  generateReference,
} from "@/lib/persona-memory";

interface Game {
  id: number;
  league: string;
  game: string;
  time: string;
  odds: string;
  status?: string;
  score?: string;
}

interface PersonaPick {
  pick: string;
  reasoning: string;
  confidence: number;
}

const PERSONA_IMAGES: Record<string, ImageSourcePropType> = {
  trump: require("@/assets/images/persona-trump.png"),
  buffett: require("@/assets/images/persona-buffett.png"),
  musk: require("@/assets/images/persona-musk.png"),
  suze: require("@/assets/images/persona-suze.png"),
  dave: require("@/assets/images/persona-dave.png"),
  grandma: require("@/assets/images/persona-grandma.png"),
  genie: require("@/assets/images/persona-genie.png"),
  mansa: require("@/assets/images/persona-mansa.png"),
  jordan: require("@/assets/images/persona-jordan.png"),
  bernie: require("@/assets/images/persona-bernie.png"),
  ruckus: require("@/assets/images/persona-ruckus.png"),
};

interface PersonaInfo {
  id: string;
  name: string;
  fullName: string;
  color: string;
  image: ImageSourcePropType;
}

const PERSONAS: PersonaInfo[] = [
  { id: "trump", name: "Trump", fullName: "Donald J. Trump", color: "#ff4d4d", image: PERSONA_IMAGES.trump },
  { id: "buffett", name: "Buffett", fullName: "Warren Buffett", color: "#4d4dff", image: PERSONA_IMAGES.buffett },
  { id: "musk", name: "Elon", fullName: "Elon Musk", color: "#00ccff", image: PERSONA_IMAGES.musk },
  { id: "suze", name: "Suze", fullName: "Suze Orman", color: "#ff99cc", image: PERSONA_IMAGES.suze },
  { id: "dave", name: "Dave", fullName: "Dave Ramsey", color: "#ffaa00", image: PERSONA_IMAGES.dave },
  { id: "grandma", name: "Grandma", fullName: "Your Grandma", color: "#ffffff", image: PERSONA_IMAGES.grandma },
  { id: "genie", name: "Genie", fullName: "The Financial Genie", color: "#9B59B6", image: PERSONA_IMAGES.genie },
  { id: "mansa", name: "Mansa Musa", fullName: "Mansa Musa I", color: "#D4AF37", image: PERSONA_IMAGES.mansa },
  { id: "jordan", name: "MJ", fullName: "Michael Jordan", color: "#CE1141", image: PERSONA_IMAGES.jordan },
  { id: "bernie", name: "Bernie Mac", fullName: "Bernie Mac", color: "#9B59B6", image: PERSONA_IMAGES.bernie },
  { id: "ruckus", name: "Ruckus", fullName: "Uncle Ruckus", color: "#8B4513", image: PERSONA_IMAGES.ruckus },
];

const LEAGUE_COLORS: Record<string, string> = {
  NFL: "#ff4d4d",
  NBA: "#FF6B00",
  UFC: "#D4A420",
  MLB: "#2E7D32",
  SOCCER: "#1976D2",
  BOXING: "#9C27B0",
};

const TAG = "trumpbot-20";
const amzUrl = (keywords: string) =>
  `https://www.amazon.com/s?k=${encodeURIComponent(keywords)}&tag=${TAG}`;

const AMAZON_PICKS: Record<string, { quote: string; mainUrl: string; items: { label: string; sub: string; icon: string; url: string }[] }> = {
  jordan: {
    quote: '"You want to be a champion? Look the part. And I took that personally." — MJ',
    mainUrl: amzUrl("Air Jordan shoes apparel"),
    items: [
      { label: "Air Jordans", sub: "Iconic kicks", icon: "shoe-sneaker", url: amzUrl("Air Jordan retro shoes") },
      { label: "Jordan Apparel", sub: "Fly like Mike", icon: "tshirt-crew", url: amzUrl("Jordan brand apparel men") },
      { label: "Jordan Accessories", sub: "Game day gear", icon: "bag-suitcase", url: amzUrl("Jordan brand accessories bag") },
    ],
  },
  trump: {
    quote: '"Only the best gear for the best fans. TREMENDOUS quality. Believe me!" — Trump',
    mainUrl: amzUrl("MAGA sports gear hat"),
    items: [
      { label: "MAGA Hats", sub: "The classic", icon: "hat-fedora", url: amzUrl("MAGA hat red") },
      { label: "Golf Gear", sub: "Play like Trump", icon: "golf", url: amzUrl("golf accessories men premium") },
      { label: "Gold Merch", sub: "Stay golden", icon: "gold", url: amzUrl("gold sports accessories men") },
    ],
  },
  buffett: {
    quote: '"The best investment? A good book. And maybe some Omaha Steaks." — Buffett',
    mainUrl: amzUrl("Warren Buffett investing books"),
    items: [
      { label: "Investing Books", sub: "Read & profit", icon: "book-open-variant", url: amzUrl("Warren Buffett investing books") },
      { label: "Business Gear", sub: "Dress for success", icon: "briefcase", url: amzUrl("men business casual sports") },
      { label: "Omaha Gear", sub: "Nebraska pride", icon: "map-marker", url: amzUrl("Nebraska Omaha sports apparel") },
    ],
  },
  musk: {
    quote: '"Sports analytics needs more AI. Also, buy Tesla stock. Literally." — Elon',
    mainUrl: amzUrl("tech gadgets sports fitness"),
    items: [
      { label: "Smart Watch", sub: "Track everything", icon: "watch", url: amzUrl("smart watch sports fitness tracker") },
      { label: "Space Gear", sub: "To the moon", icon: "rocket-launch", url: amzUrl("SpaceX NASA space apparel") },
      { label: "Tech Gadgets", sub: "Future of sports", icon: "cellphone", url: amzUrl("sports tech gadgets bluetooth") },
    ],
  },
  suze: {
    quote: '"Before you buy gear, do you have 8 months of emergency funds?! DENIED or APPROVED!" — Suze',
    mainUrl: amzUrl("personal finance budget planner"),
    items: [
      { label: "Budget Planner", sub: "Plan first!", icon: "notebook", url: amzUrl("budget planner financial notebook") },
      { label: "Money Books", sub: "Get educated", icon: "book-open-variant", url: amzUrl("Suze Orman personal finance books") },
      { label: "Fitness Gear", sub: "Affordable wins", icon: "dumbbell", url: amzUrl("affordable home fitness equipment") },
    ],
  },
  dave: {
    quote: '"Don\'t buy this until you\'re DEBT FREE! Baby steps, people!" — Dave',
    mainUrl: amzUrl("Dave Ramsey financial peace"),
    items: [
      { label: "Financial Peace", sub: "Baby Step 1", icon: "book-open-variant", url: amzUrl("Dave Ramsey Total Money Makeover") },
      { label: "Budget Tools", sub: "Every dollar", icon: "calculator", url: amzUrl("budget envelopes cash system") },
      { label: "Cheap Gear", sub: "Save money!", icon: "tag", url: amzUrl("budget sports gear clearance") },
    ],
  },
  grandma: {
    quote: '"Oh sweetie, get yourself a nice warm blanket for the game. And eat something!" — Grandma',
    mainUrl: amzUrl("cozy game day blanket snacks"),
    items: [
      { label: "Cozy Blankets", sub: "Stay warm, honey", icon: "bed", url: amzUrl("stadium blanket warm sports") },
      { label: "Snack Trays", sub: "Game day bites", icon: "food", url: amzUrl("game day snack tray serving") },
      { label: "Team Mugs", sub: "Hot cocoa time", icon: "coffee", url: amzUrl("sports team coffee mug NFL NBA") },
    ],
  },
  genie: {
    quote: '"Your third wish... the perfect gear to channel victory, mortal!" — Genie',
    mainUrl: amzUrl("mystical sports accessories gold"),
    items: [
      { label: "Gold Chains", sub: "Champion style", icon: "necklace", url: amzUrl("gold chain necklace sports hip hop") },
      { label: "Lucky Charms", sub: "Magical vibes", icon: "star-four-points", url: amzUrl("lucky charm bracelet sports") },
      { label: "Premium Gear", sub: "Wish granted", icon: "diamond-stone", url: amzUrl("premium sports apparel men luxury") },
    ],
  },
  mansa: {
    quote: '"In my empire, warriors wore gold into battle. Dress like royalty." — Mansa Musa',
    mainUrl: amzUrl("gold luxury sports accessories"),
    items: [
      { label: "Gold Watches", sub: "Time is wealth", icon: "watch", url: amzUrl("gold sports watch men luxury") },
      { label: "Royal Apparel", sub: "Fit for a king", icon: "crown", url: amzUrl("luxury men activewear gold") },
      { label: "African Art", sub: "Empire legacy", icon: "palette", url: amzUrl("African art wall decor Mansa Musa") },
    ],
  },
  bernie: {
    quote: '"I ain\'t scared of no price tag! Get yourself somethin\' fly, America!" — Bernie Mac',
    mainUrl: amzUrl("funny sports shirts comedy"),
    items: [
      { label: "Funny Tees", sub: "Comedy vibes", icon: "tshirt-crew", url: amzUrl("funny sports t shirts men comedy") },
      { label: "Chi-Town Gear", sub: "South Side rep", icon: "city", url: amzUrl("Chicago sports apparel Bulls Bears") },
      { label: "Party Gear", sub: "Game day lit", icon: "party-popper", url: amzUrl("game day party supplies sports") },
    ],
  },
  ruckus: {
    quote: '"Don\'t waste your dadgum money! But if you must... get somethin\' practical." — Ruckus',
    mainUrl: amzUrl("no nonsense sports gear men"),
    items: [
      { label: "Work Boots", sub: "Real man gear", icon: "shoe-formal", url: amzUrl("men work boots comfortable sports") },
      { label: "Camo Gear", sub: "Stay hidden", icon: "pine-tree", url: amzUrl("camo sports gear hunting outdoor") },
      { label: "BBQ Set", sub: "Tailgate right", icon: "grill", url: amzUrl("BBQ grill set tailgate sports") },
    ],
  },
};

const WORLD_CUP_DATE = new Date("2026-06-11T00:00:00-04:00").getTime();

function getCountdown() {
  const now = Date.now();
  const diff = Math.max(0, WORLD_CUP_DATE - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds };
}

function PersonaSelectorItem({
  persona,
  selected,
  onPress,
}: {
  persona: PersonaInfo;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.personaItem, selected && { borderColor: persona.color }]}>
      <Image
        source={persona.image}
        style={[styles.personaThumb, { borderColor: selected ? persona.color : "transparent" }]}
      />
      <Text style={[styles.personaLabel, selected && { color: persona.color }]} numberOfLines={1}>
        {persona.name}
      </Text>
    </Pressable>
  );
}

function GameCard({
  game,
  persona,
  pick,
  pickLoading,
  onSpeak,
  speakingGameId,
  onRefresh,
}: {
  game: Game;
  persona: PersonaInfo;
  pick: PersonaPick | null;
  pickLoading: boolean;
  onSpeak: (text: string, personaId: string, gameId: number) => void;
  speakingGameId: number | null;
  onRefresh: (gameId: number) => void;
}) {
  const leagueColor = LEAGUE_COLORS[game.league] || "#D4A420";
  const isSpeaking = speakingGameId === game.id;

  return (
    <View style={styles.gameCard}>
      <View style={styles.gameHeader}>
        <View style={[styles.leagueBadge, { backgroundColor: leagueColor }]}>
          <Text style={styles.leagueText}>{game.league}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.gameTime}>{game.time}</Text>
          <Pressable onPress={() => onRefresh(game.id)} style={({ pressed }) => [pressed && { opacity: 0.5 }]}>
            <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>
      </View>
      <Text style={styles.gameTitle}>{game.game}</Text>
      {game.score ? (
        <Text style={styles.gameScore}>{game.score}</Text>
      ) : null}
      <Text style={styles.gameOdds}>{game.odds}</Text>

      {pickLoading ? (
        <View style={styles.pickLoadingBox}>
          <ActivityIndicator size="small" color={persona.color} />
          <Text style={[styles.pickLoadingText, { color: persona.color }]}>
            {persona.name} is analyzing...
          </Text>
        </View>
      ) : pick ? (
        <>
          <View style={[styles.pickSection, { borderLeftColor: persona.color }]}>
            <View style={styles.pickHeader}>
              <Image source={persona.image} style={[styles.pickAvatar, { borderColor: persona.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickName, { color: persona.color }]}>{persona.name}'s Pick</Text>
                <Text style={styles.pickValue}>{pick.pick}</Text>
              </View>
              {pick.confidence > 0 && (
                <View style={[styles.confidenceBadge, { backgroundColor: `${persona.color}30` }]}>
                  <Text style={[styles.confidenceText, { color: persona.color }]}>{pick.confidence}%</Text>
                </View>
              )}
            </View>
            <Text style={styles.pickReasoning}>"{pick.reasoning}"</Text>
          </View>

          <Pressable
            onPress={() => onSpeak(pick.reasoning, persona.id, game.id)}
            style={({ pressed }) => [styles.listenBtn, { borderColor: persona.color }, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={isSpeaking ? "stop" : "volume-high"} size={16} color={persona.color} />
            <Text style={[styles.listenBtnText, { color: persona.color }]}>
              {isSpeaking ? "STOP" : "LISTEN"}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

export default function SportsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState("trump");
  const [speakingGameId, setSpeakingGameId] = useState<number | null>(null);
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const [countdown, setCountdown] = useState(getCountdown());
  const [picks, setPicks] = useState<Record<string, PersonaPick>>({});
  const [loadingPicks, setLoadingPicks] = useState<Record<string, boolean>>({});

  const [debateP1, setDebateP1] = useState("trump");
  const [debateP2, setDebateP2] = useState("buffett");
  const [trashTalk1, setTrashTalk1] = useState("");
  const [trashTalk2, setTrashTalk2] = useState("");
  const [ref1, setRef1] = useState("");
  const [ref2, setRef2] = useState("");
  const [h2h, setH2h] = useState({ wins: 0, losses: 0, total: 0 });
  const [debateVoted, setDebateVoted] = useState(false);
  const [debateWinner, setDebateWinner] = useState<string | null>(null);
  const [debatePick1, setDebatePick1] = useState<PersonaPick | null>(null);
  const [debatePick2, setDebatePick2] = useState<PersonaPick | null>(null);
  const [debatePicksLoading, setDebatePicksLoading] = useState(false);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const activePersona = PERSONAS.find((p) => p.id === selectedPersona) || PERSONAS[0];
  const featuredGame = games.length > 0 ? games[0] : null;

  useEffect(() => {
    mountedRef.current = true;
    fetchGames();
    const timer = setInterval(() => {
      if (mountedRef.current) setCountdown(getCountdown());
    }, 1000);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (games.length > 0) {
      fetchAllPicks(selectedPersona);
    }
  }, [selectedPersona, games]);

  useEffect(() => {
    loadDebateData();
  }, [debateP1, debateP2, games]);

  const fetchAIPick = async (game: Game, personaId: string): Promise<PersonaPick> => {
    const baseUrl = getApiUrl().replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/api/sports/picks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, personaId }),
    });
    if (!res.ok) throw new Error("Failed to fetch pick");
    return res.json();
  };

  const fetchAllPicks = async (personaId: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const newLoadingState: Record<string, boolean> = {};
    const toFetch: Game[] = [];

    for (const game of games) {
      const key = `${game.id}_${personaId}`;
      if (!picks[key]) {
        newLoadingState[key] = true;
        toFetch.push(game);
      }
    }

    if (toFetch.length === 0) return;
    setLoadingPicks((prev) => ({ ...prev, ...newLoadingState }));

    const results = await Promise.allSettled(
      toFetch.map((game) => fetchAIPick(game, personaId))
    );

    if (!mountedRef.current || controller.signal.aborted) return;

    const newPicks: Record<string, PersonaPick> = {};
    const clearLoading: Record<string, boolean> = {};
    results.forEach((result, i) => {
      const key = `${toFetch[i].id}_${personaId}`;
      clearLoading[key] = false;
      if (result.status === "fulfilled") {
        newPicks[key] = result.value;
      }
    });

    setPicks((prev) => ({ ...prev, ...newPicks }));
    setLoadingPicks((prev) => ({ ...prev, ...clearLoading }));
  };

  const refreshPick = async (gameId: number) => {
    const key = `${gameId}_${selectedPersona}`;
    const game = games.find((g) => g.id === gameId);
    if (!game) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPicks((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setLoadingPicks((prev) => ({ ...prev, [key]: true }));

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/sports/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, personaId: selectedPersona, fresh: true }),
      });
      if (!res.ok) throw new Error("Failed");
      const pick = await res.json();
      if (mountedRef.current) {
        setPicks((prev) => ({ ...prev, [key]: pick }));
      }
    } catch {
    } finally {
      if (mountedRef.current) setLoadingPicks((prev) => ({ ...prev, [key]: false }));
    }
  };

  const fetchGames = async () => {
    setLoading(true);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/sports/upcoming`);
      if (!res.ok) throw new Error("Failed to fetch games");
      const data = await res.json();
      if (mountedRef.current) setGames(data.games || []);
    } catch (err) {
      console.error("Sports fetch error:", err);
      if (mountedRef.current) setGames([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const loadDebateData = async () => {
    if (!featuredGame) return;
    try {
      setDebatePicksLoading(true);
      const [tt1, tt2, r1, r2, record, pick1, pick2] = await Promise.all([
        generateTrashTalk(debateP1, debateP2),
        generateTrashTalk(debateP2, debateP1),
        generateReference(debateP1, debateP2, "sports"),
        generateReference(debateP2, debateP1, "sports"),
        getHeadToHead(debateP1, debateP2),
        fetchAIPick(featuredGame, debateP1).catch(() => null),
        fetchAIPick(featuredGame, debateP2).catch(() => null),
      ]);
      if (!mountedRef.current) return;
      setTrashTalk1(tt1);
      setTrashTalk2(tt2);
      setRef1(r1);
      setRef2(r2);
      setH2h(record);
      setDebatePick1(pick1);
      setDebatePick2(pick2);
      setDebateVoted(false);
      setDebateWinner(null);
    } catch (err) {
      console.error("Debate data error:", err);
    } finally {
      if (mountedRef.current) setDebatePicksLoading(false);
    }
  };

  const handleVoteDebate = async (winnerId: string) => {
    if (debateVoted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setDebateVoted(true);
    setDebateWinner(winnerId);

    const loserId = winnerId === debateP1 ? debateP2 : debateP1;
    const gameName = featuredGame?.game || "Sports Debate";
    await recordInteraction(winnerId, loserId, "sports", gameName, "win");
    loadDebateData();
  };

  const handleSpeak = async (text: string, personaId: string, gameId: number) => {
    if (speakingGameId !== null) {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setSpeakingGameId(null);
      if (speakingGameId === gameId) return;
    }

    setSpeakingGameId(gameId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const sound = await playTTS("/api/persona-speak", { text, personaId });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          if (mountedRef.current) setSpeakingGameId(null);
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
    } catch {
      if (mountedRef.current) setSpeakingGameId(null);
    }
  };

  const handleAffiliate = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url).catch(() => {});
  };

  const p1Info = PERSONAS.find((p) => p.id === debateP1) || PERSONAS[0];
  const p2Info = PERSONAS.find((p) => p.id === debateP2) || PERSONAS[1];

  return (
    <View style={[styles.container, Platform.OS === "web" && { maxHeight: "100vh" as any, overflow: "auto" as any }]}>
      <LinearGradient colors={["#0a0a0a", "#1a0f00", "#0a0a0a"]} style={StyleSheet.absoluteFillObject} />

      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="football" size={20} color={Colors.gold} />
          <Text style={styles.headerTitle}>TRUMP'S SPORTS BOOK</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + webBottomInset + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.worldCupCard}>
          <LinearGradient
            colors={["#0d3b0d", "#1a0f00", "#0d3b0d"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.wcHeader}>
            <MaterialCommunityIcons name="soccer" size={24} color="#4CAF50" />
            <Text style={styles.wcTitle}>FIFA WORLD CUP 2026</Text>
            <MaterialCommunityIcons name="soccer" size={24} color="#4CAF50" />
          </View>
          <Text style={styles.wcSubtitle}>USA • MEXICO • CANADA</Text>
          <View style={styles.wcCountdownRow}>
            <View style={styles.wcCountdownUnit}>
              <Text style={styles.wcCountdownNum}>{countdown.days}</Text>
              <Text style={styles.wcCountdownLabel}>DAYS</Text>
            </View>
            <Text style={styles.wcCountdownSep}>:</Text>
            <View style={styles.wcCountdownUnit}>
              <Text style={styles.wcCountdownNum}>{String(countdown.hours).padStart(2, "0")}</Text>
              <Text style={styles.wcCountdownLabel}>HRS</Text>
            </View>
            <Text style={styles.wcCountdownSep}>:</Text>
            <View style={styles.wcCountdownUnit}>
              <Text style={styles.wcCountdownNum}>{String(countdown.minutes).padStart(2, "0")}</Text>
              <Text style={styles.wcCountdownLabel}>MIN</Text>
            </View>
            <Text style={styles.wcCountdownSep}>:</Text>
            <View style={styles.wcCountdownUnit}>
              <Text style={styles.wcCountdownNum}>{String(countdown.seconds).padStart(2, "0")}</Text>
              <Text style={styles.wcCountdownLabel}>SEC</Text>
            </View>
          </View>
          <Text style={styles.wcTrumpQuote}>
            "We're gonna have the GREATEST World Cup in history. Believe me, nobody does soccer like America!"
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.personaSelector}>
          <Text style={styles.sectionLabel}>CHOOSE YOUR ANALYST</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.personaRow}>
            {PERSONAS.map((p) => (
              <PersonaSelectorItem
                key={p.id}
                persona={p}
                selected={selectedPersona === p.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedPersona(p.id);
                }}
              />
            ))}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>TODAY'S GAMES</Text>
            <View style={styles.aiBadge}>
              <View style={styles.aiDot} />
              <Text style={styles.aiBadgeText}>AI LIVE</Text>
            </View>
          </View>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.gold} />
              <Text style={styles.loadingText}>Loading games...</Text>
            </View>
          ) : games.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="emoticon-sad-outline" size={40} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No games available right now</Text>
            </View>
          ) : (
            games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                persona={activePersona}
                pick={picks[`${game.id}_${selectedPersona}`] || null}
                pickLoading={!!loadingPicks[`${game.id}_${selectedPersona}`]}
                onSpeak={handleSpeak}
                speakingGameId={speakingGameId}
                onRefresh={refreshPick}
              />
            ))
          )}
        </Animated.View>

        {featuredGame && (
          <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.section}>
            <Text style={styles.sectionLabel}>TODAY'S DEBATE</Text>
            <View style={styles.debateCard}>
              <LinearGradient
                colors={[`${p1Info.color}20`, "#0a0a0a", `${p2Info.color}20`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.debateGradient}
              />
              <Text style={styles.debateGame}>{featuredGame.game}</Text>

              <View style={styles.h2hRow}>
                <Text style={styles.h2hLabel}>HEAD-TO-HEAD</Text>
                <Text style={styles.h2hRecord}>
                  {h2h.total > 0
                    ? `${p1Info.name} ${h2h.wins} - ${h2h.losses} ${p2Info.name}`
                    : "First matchup!"}
                </Text>
              </View>

              <View style={styles.debateContenders}>
                <View style={[styles.debateContender, debateWinner === debateP1 && { borderColor: p1Info.color, borderWidth: 2 }]}>
                  <Image source={p1Info.image} style={[styles.debateAvatar, { borderColor: p1Info.color }]} />
                  <Text style={[styles.debateName, { color: p1Info.color }]}>{p1Info.name}</Text>
                  {debatePicksLoading ? (
                    <ActivityIndicator size="small" color={p1Info.color} style={{ marginVertical: 8 }} />
                  ) : debatePick1 ? (
                    <Text style={styles.debatePickText} numberOfLines={3}>
                      Picks: {debatePick1.pick} ({debatePick1.confidence}%)
                    </Text>
                  ) : null}
                  {ref1 ? <Text style={styles.debateRef} numberOfLines={3}>"{ref1}"</Text> : null}
                  {trashTalk1 ? <Text style={styles.debateTrash} numberOfLines={2}>{trashTalk1}</Text> : null}
                  {!debateVoted ? (
                    <Pressable
                      onPress={() => handleVoteDebate(debateP1)}
                      style={({ pressed }) => [styles.debateVoteBtn, { backgroundColor: p1Info.color }, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={styles.debateVoteBtnText}>VOTE</Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.debateVoteBtn, { backgroundColor: debateWinner === debateP1 ? p1Info.color : "rgba(255,255,255,0.1)" }]}>
                      <Text style={styles.debateVoteBtnText}>{debateWinner === debateP1 ? "WINNER" : ""}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.vsContainer}>
                  <LinearGradient colors={["#FFD700", "#D4A420"]} style={styles.vsBadge}>
                    <Text style={styles.vsText}>VS</Text>
                  </LinearGradient>
                </View>

                <View style={[styles.debateContender, debateWinner === debateP2 && { borderColor: p2Info.color, borderWidth: 2 }]}>
                  <Image source={p2Info.image} style={[styles.debateAvatar, { borderColor: p2Info.color }]} />
                  <Text style={[styles.debateName, { color: p2Info.color }]}>{p2Info.name}</Text>
                  {debatePicksLoading ? (
                    <ActivityIndicator size="small" color={p2Info.color} style={{ marginVertical: 8 }} />
                  ) : debatePick2 ? (
                    <Text style={styles.debatePickText} numberOfLines={3}>
                      Picks: {debatePick2.pick} ({debatePick2.confidence}%)
                    </Text>
                  ) : null}
                  {ref2 ? <Text style={styles.debateRef} numberOfLines={3}>"{ref2}"</Text> : null}
                  {trashTalk2 ? <Text style={styles.debateTrash} numberOfLines={2}>{trashTalk2}</Text> : null}
                  {!debateVoted ? (
                    <Pressable
                      onPress={() => handleVoteDebate(debateP2)}
                      style={({ pressed }) => [styles.debateVoteBtn, { backgroundColor: p2Info.color }, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={styles.debateVoteBtnText}>VOTE</Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.debateVoteBtn, { backgroundColor: debateWinner === debateP2 ? p2Info.color : "rgba(255,255,255,0.1)" }]}>
                      <Text style={styles.debateVoteBtnText}>{debateWinner === debateP2 ? "WINNER" : ""}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(700).duration(400)} style={styles.section}>
          <Text style={styles.sectionLabel}>PLACE YOUR BETS</Text>
          <Text style={styles.affiliateDisclaimer}>
            Entertainment only. Please gamble responsibly.
          </Text>
          <View style={styles.affiliateRow}>
            <Pressable
              onPress={() => handleAffiliate("https://www.draftkings.com")}
              style={({ pressed }) => [styles.affiliateBtn, { backgroundColor: "#53D337" }, pressed && { opacity: 0.8 }]}
            >
              <MaterialCommunityIcons name="crown" size={20} color="#000" />
              <Text style={styles.affiliateBtnText}>DraftKings</Text>
            </Pressable>
            <Pressable
              onPress={() => handleAffiliate("https://www.fanduel.com")}
              style={({ pressed }) => [styles.affiliateBtn, { backgroundColor: "#1493FF" }, pressed && { opacity: 0.8 }]}
            >
              <MaterialCommunityIcons name="star-four-points" size={20} color="#fff" />
              <Text style={[styles.affiliateBtnText, { color: "#fff" }]}>FanDuel</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(800).duration(400)} style={styles.section}>
          <Text style={styles.sectionLabel}>GEAR UP</Text>
          <Text style={styles.shopQuote}>
            {AMAZON_PICKS[selectedPersona]?.quote || AMAZON_PICKS.trump.quote}
          </Text>
          <View style={styles.amazonGrid}>
            {(AMAZON_PICKS[selectedPersona]?.items || AMAZON_PICKS.trump.items).map((item, idx) => (
              <Pressable
                key={idx}
                onPress={() => handleAffiliate(item.url)}
                style={({ pressed }) => [styles.amazonCard, pressed && { opacity: 0.8 }]}
              >
                <MaterialCommunityIcons name={item.icon as any} size={24} color={activePersona.color} />
                <Text style={styles.amazonCardTitle}>{item.label}</Text>
                <Text style={styles.amazonCardSub}>{item.sub}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => handleAffiliate(AMAZON_PICKS[selectedPersona]?.mainUrl || AMAZON_PICKS.trump.mainUrl)}
            style={({ pressed }) => [styles.amazonMainBtn, pressed && { opacity: 0.8 }]}
          >
            <MaterialCommunityIcons name="shopping" size={18} color="#000" />
            <Text style={styles.amazonMainBtnText}>
              Shop {activePersona.name}'s Picks on Amazon
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,164,32,0.15)",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: "#FFD700",
    letterSpacing: 1.5,
  },
  scrollView: {
    flex: 1,
  },
  worldCupCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(76,175,80,0.3)",
    padding: 16,
    alignItems: "center",
  },
  wcHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  wcTitle: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: "#FFD700",
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  wcSubtitle: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 3,
    marginBottom: 12,
  },
  wcCountdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  wcCountdownUnit: {
    alignItems: "center",
    backgroundColor: "rgba(76,175,80,0.15)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 50,
  },
  wcCountdownNum: {
    fontSize: 22,
    fontWeight: "900" as const,
    color: "#4CAF50",
  },
  wcCountdownLabel: {
    fontSize: 8,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1,
    marginTop: 2,
  },
  wcCountdownSep: {
    fontSize: 20,
    fontWeight: "900" as const,
    color: "rgba(255,255,255,0.3)",
  },
  wcTrumpQuote: {
    fontSize: 11,
    color: "rgba(255,215,0,0.6)",
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 16,
  },
  personaSelector: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#D4A420",
    letterSpacing: 2,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(76,175,80,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4CAF50",
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "#4CAF50",
    letterSpacing: 1,
  },
  personaRow: {
    gap: 10,
    paddingRight: 16,
  },
  personaItem: {
    alignItems: "center",
    width: 64,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  personaThumb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    marginBottom: 4,
  },
  personaLabel: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
  },
  gameCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  gameHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  leagueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  leagueText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 1,
  },
  gameTime: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500" as const,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#fff",
    marginBottom: 4,
  },
  gameScore: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#4CAF50",
    marginBottom: 4,
  },
  gameOdds: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 14,
    fontWeight: "500" as const,
  },
  pickLoadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    justifyContent: "center",
  },
  pickLoadingText: {
    fontSize: 13,
    fontWeight: "600" as const,
    fontStyle: "italic",
  },
  pickSection: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 12,
  },
  pickHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  pickAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  pickName: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  pickValue: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: "#FFD700",
    marginTop: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: "800" as const,
  },
  pickReasoning: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 19,
    fontStyle: "italic",
  },
  listenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  listenBtnText: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 1,
  },
  debateCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.2)",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  debateGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  debateGame: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 10,
  },
  debatePickText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 6,
  },
  h2hRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
    paddingVertical: 6,
    backgroundColor: "rgba(212,164,32,0.1)",
    borderRadius: 8,
  },
  h2hLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#D4A420",
    letterSpacing: 1,
  },
  h2hRecord: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.7)",
  },
  debateContenders: {
    flexDirection: "row",
    gap: 8,
  },
  debateContender: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  debateAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    marginBottom: 8,
  },
  debateName: {
    fontSize: 14,
    fontWeight: "700" as const,
    marginBottom: 6,
  },
  debateRef: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 15,
    marginBottom: 6,
    fontStyle: "italic",
  },
  debateTrash: {
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    lineHeight: 14,
    marginBottom: 8,
  },
  debateVoteBtn: {
    width: "100%",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
  },
  debateVoteBtnText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 1,
  },
  vsContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#000",
  },
  affiliateDisclaimer: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    marginBottom: 12,
  },
  affiliateRow: {
    flexDirection: "row",
    gap: 12,
  },
  affiliateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  affiliateBtnText: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: "#000",
    letterSpacing: 0.5,
  },
  shopQuote: {
    fontSize: 12,
    color: "rgba(255,215,0,0.6)",
    fontStyle: "italic",
    marginBottom: 14,
    lineHeight: 18,
  },
  amazonGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  amazonCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 6,
  },
  amazonCardTitle: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#fff",
    textAlign: "center",
  },
  amazonCardSub: {
    fontSize: 9,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  amazonMainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#FF9900",
  },
  amazonMainBtnText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#000",
    letterSpacing: 0.5,
  },
});
