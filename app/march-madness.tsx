import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Image,
  ActivityIndicator,
  type ImageSourcePropType,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  ZoomIn,
  SlideInLeft,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { playDingSound, playBellSound, playCrowdCheer } from "@/lib/arena-sfx";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getBracketData,
  makeBracketPick,
  getPrizes,
  awardPrize,
  calculateBracketScore,
  type BracketData,
  type BracketPick,
  type DigitalPrize,
} from "@/lib/bracket-storage";

const PERSONA_IMAGES: Record<string, ImageSourcePropType> = {
  trump: require("@/assets/images/persona-trump.png"),
  barkley: require("@/assets/images/persona-barkley.png"),
  loudmouth: require("@/assets/images/persona-loudmouth.png"),
  shannon: require("@/assets/images/persona-shannon.png"),
  jordan: require("@/assets/images/persona-jordan.png"),
  dickyV: require("@/assets/images/persona-dickyV.png"),
};

interface AnalystInfo {
  id: string;
  name: string;
  color: string;
  image: ImageSourcePropType;
}

const ANALYSTS: AnalystInfo[] = [
  { id: "barkley", name: "Chuck", color: "#FF6F00", image: PERSONA_IMAGES.barkley },
  { id: "trump", name: "Trump", color: "#ff4d4d", image: PERSONA_IMAGES.trump },
  { id: "dickyV", name: "Dicky V", color: "#FF6F00", image: PERSONA_IMAGES.dickyV },
  { id: "loudmouth", name: "Loudmouth", color: "#E53935", image: PERSONA_IMAGES.loudmouth },
  { id: "shannon", name: "Shannon", color: "#1E88E5", image: PERSONA_IMAGES.shannon },
  { id: "jordan", name: "MJ", color: "#CE1141", image: PERSONA_IMAGES.jordan },
];

interface Matchup {
  id: string;
  round: number;
  region: string;
  team1: string;
  seed1: number;
  team2: string;
  seed2: number;
  winner?: string;
  status: string;
  gameTime?: string;
  score?: string;
}

interface TournamentData {
  matchups: Matchup[];
  regions: string[];
  currentRound: number;
  lastUpdated: string;
}

interface ScheduleGame {
  id: string;
  team1: string;
  seed1: number;
  team2: string;
  seed2: number;
  time: string;
  network: string;
  region: string;
  round: number;
  status: string;
  score?: string;
  winner?: string;
}

const TABS = ["BRACKET", "SCHEDULE", "PRIZES", "LEADERBOARD"];
const ROUND_NAMES: Record<number, string> = {
  1: "Round of 64",
  2: "Round of 32",
  3: "Sweet 16",
  4: "Elite 8",
  5: "Final Four",
  6: "Championship",
};

function MatchupCard({
  matchup,
  userPick,
  onPick,
  onBreakdown,
  breakdownLoading,
  analyst,
}: {
  matchup: Matchup;
  userPick?: string;
  onPick: (matchupId: string, team: string, seed: number) => void;
  onBreakdown: (matchup: Matchup) => void;
  breakdownLoading: boolean;
  analyst: AnalystInfo;
}) {
  const isComplete = matchup.status === "post" || !!matchup.winner;
  const isLive = matchup.status === "in";
  const pickScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pickScale.value }],
  }));

  const handlePick = (team: string, seed: number) => {
    if (isComplete) return;
    pickScale.value = withSequence(
      withSpring(1.15, { damping: 4 }),
      withSpring(1, { damping: 8 })
    );
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPick(matchup.id, team, seed);
  };

  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={[mmStyles.matchupCard, animatedStyle]}>
      <View style={mmStyles.matchupHeader}>
        <View style={mmStyles.regionBadge}>
          <Text style={mmStyles.regionText}>{matchup.region}</Text>
        </View>
        {isLive && (
          <View style={mmStyles.liveBadge}>
            <View style={mmStyles.liveDot} />
            <Text style={mmStyles.liveText}>LIVE</Text>
          </View>
        )}
        {isComplete && (
          <View style={mmStyles.finalBadge}>
            <Text style={mmStyles.finalText}>FINAL</Text>
          </View>
        )}
        {matchup.gameTime && !isComplete && !isLive && (
          <Text style={mmStyles.gameTimeText}>{matchup.gameTime}</Text>
        )}
      </View>

      <Pressable
        onPress={() => handlePick(matchup.team1, matchup.seed1)}
        style={({ pressed }) => [
          mmStyles.teamRow,
          userPick === matchup.team1 && { backgroundColor: "rgba(212,164,32,0.15)", borderColor: Colors.gold },
          matchup.winner === matchup.team1 && { backgroundColor: "rgba(76,175,80,0.15)", borderColor: "#4CAF50" },
          pressed && !isComplete && { opacity: 0.7 },
        ]}
      >
        <View style={mmStyles.seedBadge}>
          <Text style={mmStyles.seedText}>{matchup.seed1}</Text>
        </View>
        <Text style={[mmStyles.teamName, matchup.winner === matchup.team1 && { color: "#4CAF50", fontWeight: "900" as const }]} numberOfLines={1}>
          {matchup.team1}
        </Text>
        {userPick === matchup.team1 && (
          <Ionicons name="checkmark-circle" size={16} color={Colors.gold} />
        )}
        {matchup.winner === matchup.team1 && (
          <Ionicons name="trophy" size={14} color="#FFD700" />
        )}
      </Pressable>

      <View style={mmStyles.vsDivider}>
        <View style={mmStyles.vsLine} />
        <Text style={mmStyles.vsText}>VS</Text>
        <View style={mmStyles.vsLine} />
      </View>

      <Pressable
        onPress={() => handlePick(matchup.team2, matchup.seed2)}
        style={({ pressed }) => [
          mmStyles.teamRow,
          userPick === matchup.team2 && { backgroundColor: "rgba(212,164,32,0.15)", borderColor: Colors.gold },
          matchup.winner === matchup.team2 && { backgroundColor: "rgba(76,175,80,0.15)", borderColor: "#4CAF50" },
          pressed && !isComplete && { opacity: 0.7 },
        ]}
      >
        <View style={mmStyles.seedBadge}>
          <Text style={mmStyles.seedText}>{matchup.seed2}</Text>
        </View>
        <Text style={[mmStyles.teamName, matchup.winner === matchup.team2 && { color: "#4CAF50", fontWeight: "900" as const }]} numberOfLines={1}>
          {matchup.team2}
        </Text>
        {userPick === matchup.team2 && (
          <Ionicons name="checkmark-circle" size={16} color={Colors.gold} />
        )}
        {matchup.winner === matchup.team2 && (
          <Ionicons name="trophy" size={14} color="#FFD700" />
        )}
      </Pressable>

      {matchup.score && (
        <Text style={mmStyles.scoreText}>{matchup.score}</Text>
      )}

      <Pressable
        onPress={() => onBreakdown(matchup)}
        disabled={breakdownLoading}
        style={({ pressed }) => [
          mmStyles.breakdownBtn,
          { borderColor: analyst.color, backgroundColor: `${analyst.color}10` },
          pressed && { opacity: 0.7 },
        ]}
      >
        {breakdownLoading ? (
          <ActivityIndicator size="small" color={analyst.color} />
        ) : (
          <Image source={analyst.image} style={[mmStyles.breakdownAvatar, { borderColor: analyst.color }]} />
        )}
        <Text style={[mmStyles.breakdownText, { color: analyst.color }]}>
          {breakdownLoading ? "Analyzing..." : `${analyst.name}'s Breakdown`}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function PrizeCard({ prize, index }: { prize: DigitalPrize; index: number }) {
  const iconMap: Record<string, string> = {
    basketball: "basketball",
    ribbon: "ribbon",
    flash: "flash",
    trophy: "trophy",
    medal: "medal",
    star: "star",
    diamond: "diamond",
    "crown-outline": "crown-outline",
  };

  return (
    <Animated.View
      entering={ZoomIn.delay(index * 100).duration(400)}
      style={[mmStyles.prizeCard, prize.earned && { borderColor: prize.color, backgroundColor: `${prize.color}10` }]}
    >
      <View style={[mmStyles.prizeIconWrap, { backgroundColor: prize.earned ? `${prize.color}25` : "rgba(255,255,255,0.05)" }]}>
        <Ionicons
          name={(iconMap[prize.icon] || "star") as any}
          size={28}
          color={prize.earned ? prize.color : "rgba(255,255,255,0.2)"}
        />
      </View>
      <Text style={[mmStyles.prizeTitle, prize.earned && { color: prize.color }]}>{prize.title}</Text>
      <Text style={mmStyles.prizeDesc}>{prize.description}</Text>
      {prize.earned && prize.earnedDate && (
        <Text style={[mmStyles.prizeDate, { color: prize.color }]}>
          {new Date(prize.earnedDate).toLocaleDateString()}
        </Text>
      )}
      {!prize.earned && (
        <View style={mmStyles.lockedOverlay}>
          <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.3)" />
        </View>
      )}
    </Animated.View>
  );
}

export default function MarchMadnessScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const mountedRef = useRef(true);

  const [activeTab, setActiveTab] = useState("BRACKET");
  const [selectedRound, setSelectedRound] = useState(1);
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [selectedAnalyst, setSelectedAnalyst] = useState(0);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [schedule, setSchedule] = useState<ScheduleGame[]>([]);
  const [bracketData, setBracketData] = useState<BracketData | null>(null);
  const [prizes, setPrizes] = useState<DigitalPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdownLoading, setBreakdownLoading] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<{ matchupId: string; text: string; personaId: string } | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number; correct: number; total: number }[]>([]);
  const deviceIdRef = useRef<string>("");

  const analyst = ANALYSTS[selectedAnalyst];

  useEffect(() => {
    mountedRef.current = true;
    AsyncStorage.getItem("mm_device_id").then((id) => {
      if (id) {
        deviceIdRef.current = id;
      } else {
        const newId = `user_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
        deviceIdRef.current = newId;
        AsyncStorage.setItem("mm_device_id", newId);
      }
    });
    loadData();
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const [tournamentRes, scheduleRes, bracketLocal, prizesLocal, lbRes] = await Promise.all([
        fetch(`${baseUrl}/api/sports/march-madness`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`${baseUrl}/api/sports/march-madness/schedule`).then((r) => r.ok ? r.json() : null).catch(() => null),
        getBracketData(),
        getPrizes(),
        fetch(`${baseUrl}/api/sports/march-madness/leaderboard`).then((r) => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (mountedRef.current) {
        if (tournamentRes) {
          const rawMatchups = tournamentRes.matchups || [];
          const mappedMatchups: Matchup[] = rawMatchups.map((m: any) => ({
            id: m.matchupId || m.id,
            round: m.roundNumber || 1,
            region: m.round || m.region || "TBD",
            team1: m.awayTeam || m.team1 || "TBD",
            seed1: m.awaySeed || m.seed1 || 0,
            team2: m.homeTeam || m.team2 || "TBD",
            seed2: m.homeSeed || m.seed2 || 0,
            winner: m.winner || undefined,
            status: m.status || "pre",
            gameTime: m.startDate ? new Date(m.startDate).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : m.statusDetail,
            score: m.homeScore && m.awayScore ? `${m.awayScore} - ${m.homeScore}` : undefined,
          }));
          const regionKeys = tournamentRes.regions ? Object.keys(tournamentRes.regions) : [];
          setTournament({
            matchups: mappedMatchups,
            regions: regionKeys.length > 0 ? regionKeys : ["East", "West", "South", "Midwest"],
            currentRound: 1,
            lastUpdated: tournamentRes.lastUpdated || new Date().toISOString(),
          });
        }
        if (scheduleRes) {
          const allGames = [
            ...(scheduleRes.todayGames || []),
            ...(scheduleRes.upcoming || []),
            ...(scheduleRes.live || []),
          ];
          const mappedSchedule: ScheduleGame[] = allGames.map((g: any) => ({
            id: g.id,
            team1: g.awayTeam || "TBD",
            seed1: g.awaySeed || 0,
            team2: g.homeTeam || "TBD",
            seed2: g.homeSeed || 0,
            time: g.startDate ? new Date(g.startDate).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : g.statusDetail || "TBD",
            network: g.broadcast || "TBD",
            region: g.round || "TBD",
            round: g.roundNumber || 1,
            status: g.status || "pre",
            score: g.homeScore && g.awayScore ? `${g.awayScore} - ${g.homeScore}` : undefined,
            winner: g.winner || undefined,
          }));
          setSchedule(mappedSchedule);
        }
        setBracketData(bracketLocal);
        setPrizes(prizesLocal);
        if (lbRes?.leaderboard) {
          setLeaderboard(lbRes.leaderboard.map((e: any) => ({
            name: e.name || e.deviceId || "Player",
            score: e.score || 0,
            correct: e.correctPicks || 0,
            total: e.totalPicks || 0,
          })));
        }
      }
    } catch (e) {
      console.error("March Madness load error:", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handlePick = async (matchupId: string, team: string, seed: number) => {
    const matchup = matchups.find((m) => m.id === matchupId);
    if (matchup && (matchup.status === "in" || matchup.status === "post" || matchup.winner)) return;

    try {
      playDingSound();
      const updated = await makeBracketPick(matchupId, selectedRound, team, seed);
      setBracketData(updated);

      const baseUrl = getApiUrl().replace(/\/$/, "");
      fetch(`${baseUrl}/api/sports/march-madness/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceIdRef.current || `user_${Date.now().toString(36)}`,
          matchupId,
          round: selectedRound,
          selectedTeam: team,
          seed,
        }),
      }).catch(() => {});

      if (updated.picks.length === 1) {
        const newPrizes = await awardPrize("first_pick");
        setPrizes(newPrizes);
      }

      const roundPicks = updated.picks.filter((p) => p.round === selectedRound);
      const roundMatchups = filteredMatchups.length;
      if (roundPicks.length >= roundMatchups && roundMatchups > 0) {
        const newPrizes = await awardPrize("round_complete");
        setPrizes(newPrizes);
      }

      if (updated.picks.length >= 63) {
        const newPrizes = await awardPrize("bracket_complete");
        setPrizes(newPrizes);
        playCrowdCheer();
      }

      if (matchup && seed > matchup.seed1 && seed > matchup.seed2) {
        const upsetPrizes = await awardPrize("upset_caller");
        setPrizes(upsetPrizes);
      }
    } catch (e) {
      console.error("Pick error:", e);
    }
  };

  const handleBreakdown = async (matchup: Matchup) => {
    setBreakdownLoading(matchup.id);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/sports/march-madness/breakdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team1: matchup.team1,
          team2: matchup.team2,
          seed1: matchup.seed1,
          seed2: matchup.seed2,
          round: ROUND_NAMES[matchup.round] || `Round ${matchup.round}`,
          personaId: analyst.id,
        }),
      });
      if (!res.ok) throw new Error("Breakdown failed");
      const data = await res.json();
      setBreakdown({ matchupId: matchup.id, text: data.breakdown, personaId: analyst.id });
    } catch (e) {
      console.error("Breakdown error:", e);
    } finally {
      setBreakdownLoading(null);
    }
  };

  const matchups = tournament?.matchups || [];
  const regions = tournament?.regions || ["East", "West", "South", "Midwest"];
  const filteredMatchups = matchups.filter((m) => {
    if (m.round !== selectedRound) return false;
    if (selectedRegion !== "ALL" && m.region !== selectedRegion) return false;
    return true;
  });

  const bracketScore = bracketData ? calculateBracketScore(bracketData.picks) : 0;
  const totalPicks = bracketData?.picks.length || 0;
  const earnedPrizes = prizes.filter((p) => p.earned).length;

  const renderBracketTab = () => (
    <View>
      <View style={mmStyles.scoreBar}>
        <View style={mmStyles.scoreItem}>
          <Text style={mmStyles.scoreValue}>{bracketScore}</Text>
          <Text style={mmStyles.scoreLabel}>POINTS</Text>
        </View>
        <View style={mmStyles.scoreDivider} />
        <View style={mmStyles.scoreItem}>
          <Text style={mmStyles.scoreValue}>{totalPicks}</Text>
          <Text style={mmStyles.scoreLabel}>PICKS</Text>
        </View>
        <View style={mmStyles.scoreDivider} />
        <View style={mmStyles.scoreItem}>
          <Text style={mmStyles.scoreValue}>{earnedPrizes}/{prizes.length}</Text>
          <Text style={mmStyles.scoreLabel}>PRIZES</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={mmStyles.roundSelector}>
        {Object.entries(ROUND_NAMES).map(([round, name]) => {
          const r = parseInt(round);
          return (
            <Pressable
              key={round}
              onPress={() => { setSelectedRound(r); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
              style={[mmStyles.roundChip, selectedRound === r && { backgroundColor: Colors.gold, borderColor: Colors.gold }]}
            >
              <Text style={[mmStyles.roundChipText, selectedRound === r && { color: "#000" }]}>{name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={mmStyles.regionSelector}>
        <Pressable
          onPress={() => setSelectedRegion("ALL")}
          style={[mmStyles.regionChip, selectedRegion === "ALL" && { backgroundColor: "rgba(212,164,32,0.2)", borderColor: Colors.gold }]}
        >
          <Text style={[mmStyles.regionChipText, selectedRegion === "ALL" && { color: Colors.gold }]}>ALL</Text>
        </Pressable>
        {regions.map((region) => (
          <Pressable
            key={region}
            onPress={() => setSelectedRegion(region)}
            style={[mmStyles.regionChip, selectedRegion === region && { backgroundColor: "rgba(212,164,32,0.2)", borderColor: Colors.gold }]}
          >
            <Text style={[mmStyles.regionChipText, selectedRegion === region && { color: Colors.gold }]}>{region.toUpperCase()}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={mmStyles.analystSelector}>
        {ANALYSTS.map((a, i) => (
          <Pressable
            key={a.id}
            onPress={() => { setSelectedAnalyst(i); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
            style={[mmStyles.analystChip, selectedAnalyst === i && { borderColor: a.color, backgroundColor: `${a.color}20` }]}
          >
            <Image source={a.image} style={[mmStyles.analystImg, selectedAnalyst === i && { borderColor: a.color }]} />
            <Text style={[mmStyles.analystName, selectedAnalyst === i && { color: a.color }]}>{a.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filteredMatchups.length === 0 ? (
        <Animated.View entering={FadeIn.duration(400)} style={mmStyles.emptyState}>
          <Ionicons name="basketball-outline" size={48} color="rgba(255,255,255,0.2)" />
          <Text style={mmStyles.emptyText}>No matchups for this round yet</Text>
          <Text style={mmStyles.emptySubtext}>Games will populate as the tournament progresses</Text>
        </Animated.View>
      ) : (
        filteredMatchups.map((matchup) => {
          const userPick = bracketData?.picks.find((p) => p.matchupId === matchup.id)?.selectedTeam;
          return (
            <View key={matchup.id}>
              <MatchupCard
                matchup={matchup}
                userPick={userPick}
                onPick={handlePick}
                onBreakdown={handleBreakdown}
                breakdownLoading={breakdownLoading === matchup.id}
                analyst={analyst}
              />
              {breakdown && breakdown.matchupId === matchup.id && (
                <Animated.View entering={FadeInDown.duration(300)} style={[mmStyles.breakdownBox, { borderLeftColor: analyst.color }]}>
                  <View style={mmStyles.breakdownHeader}>
                    <Image source={analyst.image} style={[mmStyles.breakdownAvatarLg, { borderColor: analyst.color }]} />
                    <Text style={[mmStyles.breakdownLabel, { color: analyst.color }]}>{analyst.name}'s Analysis</Text>
                  </View>
                  <Text style={mmStyles.breakdownContent}>"{breakdown.text}"</Text>
                </Animated.View>
              )}
            </View>
          );
        })
      )}
    </View>
  );

  const renderScheduleTab = () => (
    <View>
      <Text style={mmStyles.scheduleTitle}>Today's Games</Text>
      {schedule.length === 0 ? (
        <View style={mmStyles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color="rgba(255,255,255,0.2)" />
          <Text style={mmStyles.emptyText}>No games scheduled today</Text>
          <Text style={mmStyles.emptySubtext}>Check back during tournament time</Text>
        </View>
      ) : (
        schedule.map((game, i) => (
          <Animated.View key={game.id} entering={FadeInDown.delay(i * 80).duration(300)} style={mmStyles.scheduleCard}>
            <View style={mmStyles.scheduleHeader}>
              <View style={mmStyles.regionBadge}>
                <Text style={mmStyles.regionText}>{game.region}</Text>
              </View>
              <Text style={mmStyles.scheduleRound}>{ROUND_NAMES[game.round] || `Round ${game.round}`}</Text>
              {game.status === "in" && (
                <View style={mmStyles.liveBadge}>
                  <View style={mmStyles.liveDot} />
                  <Text style={mmStyles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
            <View style={mmStyles.scheduleMatchup}>
              <View style={mmStyles.scheduleTeam}>
                <View style={mmStyles.seedBadge}>
                  <Text style={mmStyles.seedText}>{game.seed1}</Text>
                </View>
                <Text style={[mmStyles.scheduleTeamName, game.winner === game.team1 && { color: "#4CAF50" }]} numberOfLines={1}>
                  {game.team1}
                </Text>
              </View>
              <Text style={mmStyles.scheduleVs}>vs</Text>
              <View style={mmStyles.scheduleTeam}>
                <View style={mmStyles.seedBadge}>
                  <Text style={mmStyles.seedText}>{game.seed2}</Text>
                </View>
                <Text style={[mmStyles.scheduleTeamName, game.winner === game.team2 && { color: "#4CAF50" }]} numberOfLines={1}>
                  {game.team2}
                </Text>
              </View>
            </View>
            <View style={mmStyles.scheduleFooter}>
              <Text style={mmStyles.scheduleTime}>{game.time}</Text>
              <Text style={mmStyles.scheduleNetwork}>{game.network}</Text>
              {game.score && <Text style={mmStyles.scheduleScore}>{game.score}</Text>}
            </View>
          </Animated.View>
        ))
      )}
    </View>
  );

  const renderPrizesTab = () => (
    <View>
      <Text style={mmStyles.prizesHeader}>
        {earnedPrizes} of {prizes.length} Earned
      </Text>
      <View style={mmStyles.prizesGrid}>
        {prizes.map((prize, i) => (
          <PrizeCard key={prize.id} prize={prize} index={i} />
        ))}
      </View>
    </View>
  );

  const renderLeaderboardTab = () => (
    <View>
      <Text style={mmStyles.lbTitle}>Bracket Leaderboard</Text>
      <View style={mmStyles.lbYourScore}>
        <Ionicons name="person" size={18} color={Colors.gold} />
        <Text style={mmStyles.lbYourLabel}>Your Score</Text>
        <Text style={mmStyles.lbYourValue}>{bracketScore} pts</Text>
      </View>
      {leaderboard.length === 0 ? (
        <View style={mmStyles.emptyState}>
          <Ionicons name="podium-outline" size={48} color="rgba(255,255,255,0.2)" />
          <Text style={mmStyles.emptyText}>Leaderboard coming soon</Text>
          <Text style={mmStyles.emptySubtext}>Make picks to start scoring</Text>
        </View>
      ) : (
        leaderboard.map((entry, i) => (
          <Animated.View key={i} entering={SlideInLeft.delay(i * 60).duration(300)} style={mmStyles.lbRow}>
            <View style={[mmStyles.lbRank, i < 3 && { backgroundColor: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : "#CD7F32" }]}>
              <Text style={[mmStyles.lbRankText, i < 3 && { color: "#000" }]}>{i + 1}</Text>
            </View>
            <Text style={mmStyles.lbName}>{entry.name}</Text>
            <View style={mmStyles.lbStats}>
              <Text style={mmStyles.lbCorrect}>{entry.correct}/{entry.total}</Text>
              <Text style={mmStyles.lbScore}>{entry.score} pts</Text>
            </View>
          </Animated.View>
        ))
      )}
    </View>
  );

  return (
    <View style={[mmStyles.container, { paddingTop: insets.top || webTopInset }]}>
      <LinearGradient colors={["#1a0a00", "#0A0A0A", "#0A0A0A"]} style={StyleSheet.absoluteFill} />

      <View style={mmStyles.header}>
        <Pressable onPress={() => router.back()} style={mmStyles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={mmStyles.headerCenter}>
          <MaterialCommunityIcons name="basketball" size={22} color="#FF6B00" />
          <Text style={mmStyles.headerTitle}>MARCH MADNESS</Text>
        </View>
        <Pressable onPress={loadData} style={mmStyles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={mmStyles.tabBar}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => { setActiveTab(tab); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
            style={[mmStyles.tab, activeTab === tab && mmStyles.tabActive]}
          >
            <Text style={[mmStyles.tabText, activeTab === tab && mmStyles.tabTextActive]}>{tab}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={mmStyles.parodyBanner}>
        <Ionicons name="information-circle" size={14} color="rgba(255,255,255,0.5)" />
        <Text style={mmStyles.parodyText}>PARODY &amp; ENTERTAINMENT ONLY — All personas are fictional parodies. Not real advice.</Text>
      </View>

      <ScrollView
        style={mmStyles.content}
        contentContainerStyle={{ paddingBottom: 100 + (insets.bottom || webBottomInset) }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={mmStyles.loadingWrap}>
            <ActivityIndicator size="large" color="#FF6B00" />
            <Text style={mmStyles.loadingText}>Loading bracket data...</Text>
          </View>
        ) : activeTab === "BRACKET" ? (
          renderBracketTab()
        ) : activeTab === "SCHEDULE" ? (
          renderScheduleTab()
        ) : activeTab === "PRIZES" ? (
          renderPrizesTab()
        ) : (
          renderLeaderboardTab()
        )}
      </ScrollView>
    </View>
  );
}

const mmStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FF6B00",
    letterSpacing: 2,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexGrow: 0,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabActive: {
    backgroundColor: "rgba(255,107,0,0.15)",
    borderColor: "#FF6B00",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1,
  },
  tabTextActive: {
    color: "#FF6B00",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scoreBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,107,0,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,107,0,0.2)",
    padding: 14,
    marginBottom: 12,
    gap: 20,
  },
  scoreItem: {
    alignItems: "center",
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FF6B00",
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1,
    marginTop: 2,
  },
  scoreDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  roundSelector: {
    flexGrow: 0,
    marginBottom: 8,
  },
  roundChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  roundChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.5,
  },
  regionSelector: {
    flexGrow: 0,
    marginBottom: 8,
  },
  regionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginRight: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  regionChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.5,
  },
  analystSelector: {
    flexGrow: 0,
    marginBottom: 14,
  },
  analystChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 6,
  },
  analystImg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  analystName: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
  },
  matchupCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    marginBottom: 10,
  },
  matchupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  regionBadge: {
    backgroundColor: "rgba(255,107,0,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  regionText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FF6B00",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,0,0,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF0000",
  },
  liveText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#FF0000",
    letterSpacing: 1,
  },
  finalBadge: {
    backgroundColor: "rgba(76,175,80,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  finalText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#4CAF50",
    letterSpacing: 1,
  },
  gameTimeText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "600",
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  seedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,107,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  seedText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FF6B00",
  },
  teamName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  vsDivider: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: 8,
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  vsText: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 2,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FF4444",
    textAlign: "center",
    marginTop: 6,
  },
  breakdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
  },
  breakdownAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
  },
  breakdownText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  breakdownBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 10,
  },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  breakdownAvatarLg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  breakdownContent: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
  },
  emptySubtext: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: 80,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FF6B00",
    letterSpacing: 1,
    marginBottom: 12,
  },
  scheduleCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    marginBottom: 8,
  },
  scheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  scheduleRound: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    flex: 1,
  },
  scheduleMatchup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scheduleTeam: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  scheduleTeamName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  scheduleVs: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
  },
  scheduleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 8,
  },
  scheduleTime: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  scheduleNetwork: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FF6B00",
    letterSpacing: 0.5,
  },
  scheduleScore: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FF4444",
  },
  prizesHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1,
    marginBottom: 14,
    textAlign: "center",
  },
  prizesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  prizeCard: {
    width: "47%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  prizeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  prizeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 4,
  },
  prizeDesc: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    lineHeight: 14,
  },
  prizeDate: {
    fontSize: 9,
    fontWeight: "600",
    marginTop: 6,
  },
  lockedOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  lbTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FF6B00",
    letterSpacing: 1,
    marginBottom: 14,
  },
  lbYourScore: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(212,164,32,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.2)",
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  lbYourLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    flex: 1,
  },
  lbYourValue: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.gold,
  },
  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  lbRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  lbRankText: {
    fontSize: 12,
    fontWeight: "900",
    color: "rgba(255,255,255,0.7)",
  },
  lbName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  lbStats: {
    alignItems: "flex-end",
  },
  lbCorrect: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
  },
  lbScore: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FF6B00",
  },
  parodyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  parodyText: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    flex: 1,
    letterSpacing: 0.3,
  },
});
