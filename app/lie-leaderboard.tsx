import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, Image, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import { ShareAppButton } from "@/components/ShareAppButton";

type LeaderRow = {
  intervieweeId: string;
  intervieweeName: string;
  lieCount: number;
  agree: number;
  disagree: number;
  lieScore: number;
  recentScore: number;
  priorScore: number;
  recentVotes: number;
  priorVotes: number;
  trend: number;
};

const PERSONA_PORTRAITS: Record<string, any> = {
  trump: require("@/assets/images/persona-trump.png"),
  netanyahu: require("@/assets/images/persona-netanyahu.png"),
  ruckus: require("@/assets/images/persona-ruckus.png"),
  galloway: require("@/assets/images/persona-galloway.png"),
  mcconnell: require("@/assets/images/persona-mcconnell.png"),
  carville: require("@/assets/images/persona-carville.png"),
  maddow: require("@/assets/images/persona-maddow.png"),
  omar: require("@/assets/images/persona-omar.png"),
  biden: require("@/assets/images/persona-biden.png"),
  rosie: require("@/assets/images/persona-rosie.png"),
  berniemc: require("@/assets/images/persona-bernie.png"),
  elon: require("@/assets/images/persona-musk.png"),
  graham: require("@/assets/images/persona-graham.png"),
  megynkelly: require("@/assets/images/persona-megynkelly.png"),
  pambondi: require("@/assets/images/persona-pambondi.png"),
  candace: require("@/assets/images/persona-candace.png"),
  joyreid: require("@/assets/images/persona-joyreid.png"),
  miller: require("@/assets/images/persona-miller.png"),
  jimjordan: require("@/assets/images/persona-jimjordan.png"),
  schumer: require("@/assets/images/persona-schumer.png"),
  alexjones: require("@/assets/images/persona-alexjones.png"),
  obama: require("@/assets/images/persona-obama.png"),
  melania: require("@/assets/images/persona-melania.png"),
  odonnell: require("@/assets/images/persona-odonnell.png"),
  kamala: require("@/assets/images/persona-kamala.png"),
  mtg: require("@/assets/images/persona-mtg.png"),
  rfk: require("@/assets/images/persona-rfk.png"),
};

const webTop = Platform.OS === "web" ? 67 : 0;
const webBottom = Platform.OS === "web" ? 34 : 0;

function rankColor(rank: number): string {
  if (rank === 0) return "#FFD700";
  if (rank === 1) return "#C0C0C0";
  if (rank === 2) return "#CD7F32";
  return "#7a7a7a";
}

type LeaderboardMode = "worst" | "honest";

export default function LieLeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<LeaderboardMode>("worst");
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async (currentMode: LeaderboardMode) => {
    try {
      setErrorMsg(null);
      const res = await fetch(
        new URL(
          `/api/arena/lie-leaderboard?limit=20&order=${currentMode}`,
          getApiUrl(),
        ).toString(),
      );
      if (res.ok) {
        const data = await res.json();
        setRows(Array.isArray(data.leaderboard) ? data.leaderboard : []);
      } else {
        setErrorMsg("Couldn't load leaderboard");
      }
    } catch {
      setErrorMsg("Couldn't load leaderboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(mode);
  }, [load, mode]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(mode);
  }, [load, mode]);

  const switchMode = useCallback((next: LeaderboardMode) => {
    setMode((prev) => (prev === next ? prev : next));
  }, []);

  const isHonest = mode === "honest";
  const accentColor = isHonest ? "#4ADE80" : "#FFD700";
  const headerTitle = isHonest ? "MOST HONEST" : "CAUGHT LYING";
  const headerSub = isHonest
    ? "Lie flags the community shot down"
    : "Community fact-check leaderboard";
  const legendText = isHonest
    ? "Ranked by lowest lie score — guests viewers most often dismiss as not actually lying. Arrows show this week's lie score vs the prior 7 days."
    : "Lie score = agree votes minus disagree votes on lies flagged during interviews. Arrows show this week's lie score vs the prior 7 days.";
  const emptyTitle = isHonest ? "No honest crowd yet" : "No votes yet";
  const emptyText = isHonest
    ? "Once viewers start dismissing AI lie flags as wrong, the most-honest list fills up."
    : "Run an interview, vote on the lies the AI catches, and the leaderboard fills up.";

  const renderRow = ({ item, index }: { item: LeaderRow; index: number }) => {
    const portrait = PERSONA_PORTRAITS[item.intervieweeId];
    const totalVotes = item.agree + item.disagree;
    const ratePct = totalVotes > 0
      ? Math.round(((isHonest ? item.disagree : item.agree) / totalVotes) * 100)
      : 0;
    const rateLabel = isHonest ? "disagree" : "agree";

    const recentVotes = item.recentVotes ?? 0;
    const priorVotes = item.priorVotes ?? 0;
    const trend = item.trend ?? 0;
    const hasTrendData = recentVotes + priorVotes > 0;
    let trendIcon: "arrow-up" | "arrow-down" | "remove" = "remove";
    let trendColor = "#7a7a7a";
    let trendA11y = "no recent change";
    if (!hasTrendData) {
      trendIcon = "remove";
      trendColor = "#555";
      trendA11y = "no votes in the last two weeks";
    } else if (trend > 0) {
      trendIcon = "arrow-up";
      trendColor = "#ff6b6b";
      trendA11y = `lie score up ${trend} this week`;
    } else if (trend < 0) {
      trendIcon = "arrow-down";
      trendColor = "#4ADE80";
      trendA11y = `lie score down ${Math.abs(trend)} this week`;
    } else {
      trendIcon = "remove";
      trendColor = "#9aa0a6";
      trendA11y = "lie score unchanged this week";
    }
    const trendLabel = hasTrendData
      ? trend > 0
        ? `+${trend}`
        : trend < 0
          ? `${trend}`
          : "0"
      : "—";

    return (
      <Pressable
        onPress={() => {
          const qs = `?name=${encodeURIComponent(item.intervieweeName)}&mode=${encodeURIComponent(mode)}`;
          router.push(`/lie-leaderboard/${encodeURIComponent(item.intervieweeId)}${qs}`);
        }}
        style={({ pressed }) => [
          s.row,
          index < 3 && (isHonest ? s.rowTopHonest : s.rowTop),
          pressed && { opacity: 0.7 },
        ]}
        testID={`leader-row-${item.intervieweeId}`}
        accessibilityRole="button"
        accessibilityLabel={`See flagged lies for ${item.intervieweeName}`}
      >
        <View style={[s.rankBadge, { backgroundColor: rankColor(index) }]}>
          <Text style={s.rankText}>{index + 1}</Text>
        </View>
        {portrait ? (
          <Image source={portrait} style={s.avatar} resizeMode="cover" />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Ionicons name="person" size={22} color={accentColor} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={1}>{item.intervieweeName}</Text>
          <Text style={s.metaSub} numberOfLines={1}>
            {item.lieCount} flagged · {ratePct}% {rateLabel}
          </Text>
        </View>
        <View style={s.scoreCol}>
          <View style={s.scoreLine}>
            <Text style={[s.scoreNum, { color: accentColor }]}>
              {item.lieScore > 0 ? `+${item.lieScore}` : item.lieScore}
            </Text>
            <View
              style={[s.trendPill, { borderColor: trendColor }]}
              accessibilityLabel={trendA11y}
              testID={`leader-trend-${item.intervieweeId}`}
            >
              <Ionicons name={trendIcon} size={10} color={trendColor} />
              <Text style={[s.trendText, { color: trendColor }]}>{trendLabel}</Text>
            </View>
          </View>
          <View style={s.voteRow}>
            <Ionicons name="thumbs-up" size={11} color="#4ADE80" />
            <Text style={[s.voteNum, { color: "#4ADE80" }]}>{item.agree}</Text>
            <Ionicons name="thumbs-down" size={11} color="#ff6b6b" style={{ marginLeft: 6 }} />
            <Text style={[s.voteNum, { color: "#ff6b6b" }]}>{item.disagree}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#666" style={{ marginLeft: 4 }} />
      </Pressable>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top + webTop, paddingBottom: webBottom }]}>
      <LinearGradient
        colors={
          isHonest
            ? ["rgba(74,222,128,0.12)", "rgba(0,0,0,0)", "#0a0a0a"]
            : ["rgba(255,215,0,0.12)", "rgba(0,0,0,0)", "#0a0a0a"]
        }
        style={StyleSheet.absoluteFill}
      />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.iconBtn} testID="leaderboard-back">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: accentColor }]}>{headerTitle}</Text>
          <Text style={s.headerSub}>{headerSub}</Text>
        </View>
        <ShareAppButton variant="icon" area="arena" />
      </View>

      <View style={s.tabRow}>
        <Pressable
          onPress={() => switchMode("worst")}
          style={[s.tabBtn, !isHonest && s.tabBtnActiveWorst]}
          testID="leaderboard-tab-worst"
        >
          <Ionicons
            name="flame"
            size={14}
            color={!isHonest ? "#000" : "#FFD700"}
          />
          <Text style={[s.tabText, !isHonest && s.tabTextActiveWorst]}>
            Caught Lying
          </Text>
        </Pressable>
        <Pressable
          onPress={() => switchMode("honest")}
          style={[s.tabBtn, isHonest && s.tabBtnActiveHonest]}
          testID="leaderboard-tab-honest"
        >
          <Ionicons
            name="shield-checkmark"
            size={14}
            color={isHonest ? "#000" : "#4ADE80"}
          />
          <Text style={[s.tabText, isHonest && s.tabTextActiveHonest]}>
            Most Honest
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          s.legendCard,
          isHonest && {
            backgroundColor: "rgba(74,222,128,0.08)",
            borderColor: "rgba(74,222,128,0.25)",
          },
        ]}
      >
        <Ionicons name="information-circle-outline" size={16} color={accentColor} />
        <Text style={s.legendText}>{legendText}</Text>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      ) : rows.length === 0 ? (
        <View style={s.centered}>
          <Ionicons
            name={isHonest ? "shield-checkmark-outline" : "trophy-outline"}
            size={48}
            color="#555"
          />
          <Text style={[s.emptyTitle, { color: accentColor }]}>{emptyTitle}</Text>
          <Text style={s.emptyText}>{emptyText}</Text>
          <Pressable
            onPress={() => router.replace("/interview")}
            style={[s.startBtn, { backgroundColor: accentColor }]}
            testID="leaderboard-start"
          >
            <Text style={s.startBtnText}>Start an Interview</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => it.intervieweeId}
          renderItem={renderRow}
          contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={accentColor}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {errorMsg && (
        <View style={s.errorToast}>
          <Text style={s.errorToastText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 10, gap: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#FFD700", fontSize: 16, fontWeight: "800", letterSpacing: 1.5 },
  headerSub: { color: "#aaa", fontSize: 11, marginTop: 2 },
  tabRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 12, marginTop: 4,
    padding: 4, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 8, borderRadius: 18,
  },
  tabBtnActiveWorst: { backgroundColor: "#FFD700" },
  tabBtnActiveHonest: { backgroundColor: "#4ADE80" },
  tabText: { color: "#ccc", fontWeight: "700", fontSize: 12 },
  tabTextActiveWorst: { color: "#000" },
  tabTextActiveHonest: { color: "#000" },
  legendCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 12, marginTop: 8, marginBottom: 6,
    padding: 10, borderRadius: 10,
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: 1, borderColor: "rgba(255,215,0,0.25)",
  },
  legendText: { color: "#ddd", fontSize: 12, flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  emptyTitle: { color: "#FFD700", fontSize: 18, fontWeight: "700", marginTop: 6 },
  emptyText: { color: "#aaa", fontSize: 13, textAlign: "center", maxWidth: 320 },
  startBtn: {
    marginTop: 12, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 22, backgroundColor: "#FFD700",
  },
  startBtnText: { color: "#000", fontWeight: "700" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  rowTop: {
    backgroundColor: "rgba(255,215,0,0.08)",
    borderColor: "rgba(255,215,0,0.3)",
  },
  rowTopHonest: {
    backgroundColor: "rgba(74,222,128,0.08)",
    borderColor: "rgba(74,222,128,0.3)",
  },
  rankBadge: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
  },
  rankText: { color: "#000", fontWeight: "800", fontSize: 13 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#222" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  name: { color: "#fff", fontSize: 15, fontWeight: "700" },
  metaSub: { color: "#999", fontSize: 11, marginTop: 2 },
  scoreCol: { alignItems: "flex-end", minWidth: 78 },
  scoreLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  scoreNum: { color: "#FFD700", fontSize: 18, fontWeight: "800" },
  trendPill: {
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  trendText: { fontSize: 10, fontWeight: "700" },
  voteRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  voteNum: { fontSize: 11, fontWeight: "700", marginLeft: 3 },
  errorToast: {
    position: "absolute", left: 16, right: 16, bottom: 24 + webBottom,
    padding: 12, borderRadius: 10,
    backgroundColor: "rgba(255,80,80,0.95)",
    alignItems: "center",
  },
  errorToastText: { color: "#fff", fontWeight: "700" },
});
