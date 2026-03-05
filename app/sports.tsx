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
};

function getPersonaPick(personaId: string, game: Game): PersonaPick {
  const teams = game.game.split(" vs ");
  const teamA = teams[0]?.trim() || "Team A";
  const teamB = teams[1]?.trim() || "Team B";
  const seed = (personaId.length * game.id * 7 + personaId.charCodeAt(0)) % 100;

  switch (personaId) {
    case "trump":
      return {
        pick: teamA,
        reasoning: `${teamA} is going to WIN BIGLY! The best team! Tremendous athletes! I know winners, believe me!`,
        confidence: 95,
      };
    case "buffett":
      return {
        pick: seed > 40 ? teamB : teamA,
        reasoning: seed > 40
          ? `${teamB} is the value play here. The market is overvaluing ${teamA}. Be greedy when others are fearful.`
          : `${teamA} has consistent fundamentals. Like a good stock — buy and hold.`,
        confidence: 65,
      };
    case "musk":
      return {
        pick: seed > 50 ? teamA : teamB,
        reasoning: `Literally. ${seed > 50 ? teamA : teamB} to the MOON. My AI models say so. Also Dogecoin.`,
        confidence: 80,
      };
    case "suze":
      return {
        pick: teamA,
        reasoning: `Can you AFFORD to bet on this game?! Do you have an emergency fund FIRST?! If yes... ${teamA}. APPROVED!`,
        confidence: 55,
      };
    case "dave":
      return {
        pick: "SAVE YOUR MONEY",
        reasoning: `GAMBLING IS DUMB! Baby steps, people! Pay off your debt FIRST! If you must watch, ${teamA} looks decent.`,
        confidence: 0,
      };
    case "grandma":
      return {
        pick: teamA,
        reasoning: `Oh honey, I don't know much about sports, but ${teamA} sounds like a nice team. Be careful though, sweetie. Don't bet the rent money!`,
        confidence: 40,
      };
    case "genie":
      return {
        pick: seed > 45 ? teamB : teamA,
        reasoning: `The ancient spirits have spoken! I've watched 10,000 years of competition. ${seed > 45 ? teamB : teamA} is your WISH tonight! Choose wisely, mortal!`,
        confidence: 88,
      };
    case "mansa":
      return {
        pick: teamA,
        reasoning: `In my empire, we wagered gold on warriors. ${teamA} has the heart of champions. I see greatness — and I've SEEN greatness.`,
        confidence: 75,
      };
    case "jordan":
      return {
        pick: teamA,
        reasoning: `I took that personally. ${teamA} has that killer instinct. Champions show up when it matters. The ceiling is the roof!`,
        confidence: 85,
      };
    case "bernie":
      return {
        pick: seed > 50 ? teamB : teamA,
        reasoning: `Look here, I ain't scared of NO pick! ${seed > 50 ? teamB : teamA} is gonna EAT tonight! Don't be out here actin' a fool — ride with me!`,
        confidence: 70,
      };
    case "ruckus":
      return {
        pick: teamB,
        reasoning: `EVERYBODY picking ${teamA}?! Then I'm goin' with ${teamB}! Don't be a FOOL following the crowd! I ain't trustin' the favorites, no sir!`,
        confidence: 60,
      };
    default:
      return { pick: teamA, reasoning: "My analysis says go with the favorites.", confidence: 50 };
  }
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
  onSpeak,
  speakingGameId,
}: {
  game: Game;
  persona: PersonaInfo;
  onSpeak: (text: string, personaId: string, gameId: number) => void;
  speakingGameId: number | null;
}) {
  const pick = getPersonaPick(persona.id, game);
  const leagueColor = LEAGUE_COLORS[game.league] || "#D4A420";
  const isSpeaking = speakingGameId === game.id;

  return (
    <View style={styles.gameCard}>
      <View style={styles.gameHeader}>
        <View style={[styles.leagueBadge, { backgroundColor: leagueColor }]}>
          <Text style={styles.leagueText}>{game.league}</Text>
        </View>
        <Text style={styles.gameTime}>{game.time}</Text>
      </View>
      <Text style={styles.gameTitle}>{game.game}</Text>
      <Text style={styles.gameOdds}>{game.odds}</Text>

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

  const [debateP1, setDebateP1] = useState("trump");
  const [debateP2, setDebateP2] = useState("buffett");
  const [trashTalk1, setTrashTalk1] = useState("");
  const [trashTalk2, setTrashTalk2] = useState("");
  const [ref1, setRef1] = useState("");
  const [ref2, setRef2] = useState("");
  const [h2h, setH2h] = useState({ wins: 0, losses: 0, total: 0 });
  const [debateVoted, setDebateVoted] = useState(false);
  const [debateWinner, setDebateWinner] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const activePersona = PERSONAS.find((p) => p.id === selectedPersona) || PERSONAS[0];
  const featuredGame = games.length > 0 ? games[0] : null;

  useEffect(() => {
    mountedRef.current = true;
    fetchGames();
    return () => {
      mountedRef.current = false;
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    loadDebateData();
  }, [debateP1, debateP2]);

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
    try {
      const [tt1, tt2, r1, r2, record] = await Promise.all([
        generateTrashTalk(debateP1, debateP2),
        generateTrashTalk(debateP2, debateP1),
        generateReference(debateP1, debateP2, "sports"),
        generateReference(debateP2, debateP1, "sports"),
        getHeadToHead(debateP1, debateP2),
      ]);
      if (!mountedRef.current) return;
      setTrashTalk1(tt1);
      setTrashTalk2(tt2);
      setRef1(r1);
      setRef2(r2);
      setH2h(record);
      setDebateVoted(false);
      setDebateWinner(null);
    } catch (err) {
      console.error("Debate data error:", err);
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
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.personaSelector}>
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
          <Text style={styles.sectionLabel}>TODAY'S GAMES</Text>
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
                onSpeak={handleSpeak}
                speakingGameId={speakingGameId}
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
  gameOdds: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 14,
    fontWeight: "500" as const,
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
});
