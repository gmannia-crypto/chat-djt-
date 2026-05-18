import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, Image, Platform, Share,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";

type LieRow = {
  lieId: string;
  lieText: string;
  agree: number;
  disagree: number;
  netScore: number;
  lastVotedAt: number | null;
  recentNet: number;
  priorNet: number;
  recentVotes: number;
  lieTrend: number;
};

type ApiLieRow = {
  lieId: string;
  lieText: string;
  agree: number;
  disagree: number;
  netScore: number;
  lastVotedAt: number | null;
  recentNet: number;
  priorNet: number;
  recentVotes: number;
  lieTrend: number;
};

type Detail = {
  intervieweeId: string;
  intervieweeName: string;
  lieCount: number;
  totalAgree: number;
  totalDisagree: number;
  lieScore: number;
  recentScore: number;
  priorScore: number;
  trend: number;
  recentVotes: number;
  lies: LieRow[];
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

type TrendIcon = "trending-up" | "trending-down" | "remove";

const CHART_MAX_H = 34;
const CHART_BAR_W = 18;

function MiniTrendChart({
  recentScore,
  priorScore,
  trend,
  recentVotes,
}: {
  recentScore: number;
  priorScore: number;
  trend: number;
  recentVotes: number;
}) {
  const maxVal = Math.max(Math.abs(recentScore), Math.abs(priorScore));

  if (maxVal === 0) {
    return (
      <View style={chartSt.wrapper}>
        <TrendPill trend={trend} recentVotes={recentVotes} />
        {recentVotes > 0 && (
          <Text style={chartSt.votesLabel}>
            {recentVotes} vote{recentVotes === 1 ? "" : "s"} this week
          </Text>
        )}
      </View>
    );
  }

  const recentH = Math.max(4, Math.round((Math.abs(recentScore) / maxVal) * CHART_MAX_H));
  const priorH = Math.max(4, Math.round((Math.abs(priorScore) / maxVal) * CHART_MAX_H));

  const isUp = recentScore > priorScore;
  const isDown = recentScore < priorScore;
  const recentColor = isUp ? "#FFD700" : isDown ? "#4ADE80" : "#888";
  const recentBg = isUp
    ? "rgba(255,215,0,0.18)"
    : isDown
    ? "rgba(74,222,128,0.14)"
    : "rgba(255,255,255,0.08)";
  const recentBorder = isUp
    ? "rgba(255,215,0,0.5)"
    : isDown
    ? "rgba(74,222,128,0.35)"
    : "rgba(255,255,255,0.18)";

  return (
    <View style={chartSt.wrapper} testID="mini-trend-chart">
      <View style={chartSt.barsRow}>
        <View style={chartSt.barCol}>
          <View
            style={[
              chartSt.bar,
              {
                height: priorH,
                width: CHART_BAR_W,
                backgroundColor: "rgba(255,255,255,0.13)",
                borderColor: "rgba(255,255,255,0.22)",
              },
            ]}
          />
          <Text style={chartSt.barLabel}>prior</Text>
        </View>
        <View style={chartSt.barCol}>
          <View
            style={[
              chartSt.bar,
              {
                height: recentH,
                width: CHART_BAR_W,
                backgroundColor: recentBg,
                borderColor: recentBorder,
              },
            ]}
          />
          <Text style={[chartSt.barLabel, { color: recentColor }]}>now</Text>
        </View>
      </View>
      {recentVotes > 0 && (
        <Text style={chartSt.votesLabel}>
          {recentVotes} vote{recentVotes === 1 ? "" : "s"} this week
        </Text>
      )}
    </View>
  );
}

const chartSt = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: CHART_MAX_H + 16,
    paddingBottom: 16,
  },
  barCol: {
    alignItems: "center",
    gap: 3,
    justifyContent: "flex-end",
  },
  bar: {
    borderRadius: 4,
    borderWidth: 1,
  },
  barLabel: {
    color: "#666",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  votesLabel: {
    color: "#666",
    fontSize: 10,
    fontWeight: "600",
  },
});

function TrendPill({ trend, recentVotes }: { trend: number; recentVotes: number }) {
  if (recentVotes === 0 && trend === 0) return null;
  const isUp = trend > 0;
  const isDown = trend < 0;
  const isFlat = trend === 0;
  const bg = isUp
    ? "rgba(255,215,0,0.15)"
    : isDown
    ? "rgba(74,222,128,0.12)"
    : "rgba(255,255,255,0.07)";
  const borderColor = isUp
    ? "rgba(255,215,0,0.4)"
    : isDown
    ? "rgba(74,222,128,0.3)"
    : "rgba(255,255,255,0.14)";
  const textColor = isUp ? "#FFD700" : isDown ? "#4ADE80" : "#888";
  const icon: TrendIcon = isUp ? "trending-up" : isDown ? "trending-down" : "remove";
  const label = isFlat
    ? "flat"
    : `${isUp ? "+" : ""}${trend} 7d`;

  return (
    <View style={[trendStyle.pill, { backgroundColor: bg, borderColor }]} testID="trend-pill">
      <Ionicons name={icon} size={13} color={textColor} />
      <Text style={[trendStyle.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const trendStyle = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
});

type LieTrendIcon = "flame" | "trending-down" | "pulse";

function LieTrendBadge({ lieTrend, recentVotes }: { lieTrend: number; recentVotes: number }) {
  if (recentVotes === 0) return null;
  const isUp = lieTrend > 0;
  const isDown = lieTrend < 0;
  const icon: LieTrendIcon = isUp ? "flame" : isDown ? "trending-down" : "pulse";
  const color = isUp ? "#FFD700" : isDown ? "#4ADE80" : "#888";
  const bg = isUp
    ? "rgba(255,215,0,0.13)"
    : isDown
    ? "rgba(74,222,128,0.10)"
    : "rgba(255,255,255,0.06)";
  const borderColor = isUp
    ? "rgba(255,215,0,0.35)"
    : isDown
    ? "rgba(74,222,128,0.25)"
    : "rgba(255,255,255,0.10)";
  const label = lieTrend === 0
    ? "active"
    : `${isUp ? "+" : ""}${lieTrend}`;

  return (
    <View style={[lieStyle.badge, { backgroundColor: bg, borderColor }]} testID="lie-trend-badge">
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[lieStyle.label, { color }]}>{label}</Text>
    </View>
  );
}

const lieStyle = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
});

const TRENDING_MIN_VOTES = 2;

function TrendingBanner({
  lie,
  personaName,
  copiedLieId,
  onShare,
}: {
  lie: LieRow;
  personaName: string;
  copiedLieId: string | null;
  onShare: (lie: LieRow) => void;
}) {
  const totalVotes = lie.agree + lie.disagree;
  const agreePct = totalVotes > 0 ? Math.round((lie.agree / totalVotes) * 100) : 0;
  const netLabel = lie.netScore > 0 ? `+${lie.netScore}` : `${lie.netScore}`;
  const netColor = lie.netScore > 0 ? "#FFD700" : lie.netScore < 0 ? "#4ADE80" : "#aaa";

  return (
    <View style={tb.wrapper} testID="trending-lie-banner">
      <LinearGradient
        colors={["rgba(255,140,0,0.22)", "rgba(255,80,0,0.10)", "rgba(0,0,0,0)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={tb.labelRow}>
        <Ionicons name="flame" size={14} color="#FF6B00" />
        <Text style={tb.labelText}>TRENDING THIS WEEK</Text>
        <Text style={tb.votesText}>{lie.recentVotes} vote{lie.recentVotes === 1 ? "" : "s"} in 7 days</Text>
      </View>
      <View style={tb.lieHeader}>
        <View style={tb.rankBadge}>
          <Text style={tb.rankText}>🔥</Text>
        </View>
        <View style={tb.netPill}>
          <Text style={[tb.netNum, { color: netColor }]}>{netLabel}</Text>
          <Text style={tb.netLabel}>net</Text>
        </View>
        <LieTrendBadge lieTrend={lie.lieTrend} recentVotes={lie.recentVotes} />
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => onShare(lie)}
          style={({ pressed }) => [tb.shareBtn, pressed && { opacity: 0.6 }]}
          testID={`trending-lie-share-${lie.lieId}`}
          accessibilityLabel="Share trending flagged lie"
        >
          <Ionicons
            name={copiedLieId === lie.lieId ? "checkmark" : (Platform.OS === "web" ? "copy-outline" : "share-outline")}
            size={16}
            color={copiedLieId === lie.lieId ? "#4ADE80" : "#ddd"}
          />
        </Pressable>
      </View>
      <Text style={tb.lieText}>"{lie.lieText}"</Text>
      <View style={tb.barTrack}>
        <View style={[tb.barAgree, { width: `${agreePct}%` }]} />
      </View>
      <View style={tb.voteRow}>
        <View style={tb.voteChip}>
          <Ionicons name="thumbs-up" size={13} color="#4ADE80" />
          <Text style={[tb.voteNum, { color: "#4ADE80" }]}>{lie.agree}</Text>
          <Text style={tb.voteWord}>agree</Text>
        </View>
        <View style={tb.voteChip}>
          <Ionicons name="thumbs-down" size={13} color="#ff6b6b" />
          <Text style={[tb.voteNum, { color: "#ff6b6b" }]}>{lie.disagree}</Text>
          <Text style={tb.voteWord}>disagree</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={tb.totalVotes}>{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</Text>
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  wrapper: {
    marginHorizontal: 0,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,140,0,0.45)",
    backgroundColor: "rgba(255,100,0,0.06)",
    overflow: "hidden",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  labelText: {
    color: "#FF6B00",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    flex: 1,
  },
  votesText: {
    color: "rgba(255,140,0,0.7)",
    fontSize: 10,
    fontWeight: "600",
  },
  lieHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,140,0,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,140,0,0.4)",
  },
  rankText: { fontSize: 13 },
  netPill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  netNum: { fontSize: 14, fontWeight: "800" },
  netLabel: { color: "#888", fontSize: 10, fontWeight: "600", textTransform: "uppercase" },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  lieText: {
    color: "#f3f3f3",
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
    marginBottom: 10,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,107,107,0.35)",
    overflow: "hidden",
    marginBottom: 8,
  },
  barAgree: { height: "100%", backgroundColor: "#4ADE80", borderRadius: 2 },
  voteRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  voteChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  voteNum: { fontSize: 12, fontWeight: "800" },
  voteWord: { color: "#aaa", fontSize: 11, fontWeight: "600" },
  totalVotes: { color: "#777", fontSize: 11, fontWeight: "600" },
});

export default function LieLeaderboardDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name?: string; mode?: string }>();
  const intervieweeId = String(params.id || "");
  const fallbackName = typeof params.name === "string" ? params.name : intervieweeId;
  const isHonest = String(params.mode || "") === "honest";
  const accentColor = isHonest ? "#4ADE80" : "#FFD700";

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedLieId, setCopiedLieId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!intervieweeId) {
      setLoading(false);
      setErrorMsg("Missing persona");
      return;
    }
    try {
      setErrorMsg(null);
      const res = await fetch(
        new URL(
          `/api/arena/lie-leaderboard/${encodeURIComponent(intervieweeId)}?limit=100`,
          getApiUrl(),
        ).toString(),
      );
      if (res.ok) {
        const data = (await res.json()) as Detail;
        setDetail({
          intervieweeId: data.intervieweeId,
          intervieweeName: data.intervieweeName || fallbackName,
          lieCount: Number(data.lieCount) || 0,
          totalAgree: Number(data.totalAgree) || 0,
          totalDisagree: Number(data.totalDisagree) || 0,
          lieScore: Number(data.lieScore) || 0,
          recentScore: Number(data.recentScore) || 0,
          priorScore: Number(data.priorScore) || 0,
          trend: Number(data.trend) || 0,
          recentVotes: Number(data.recentVotes) || 0,
          lies: Array.isArray(data.lies) ? (data.lies as ApiLieRow[]).map((l) => ({
            lieId: l.lieId,
            lieText: l.lieText || "",
            agree: Number(l.agree) || 0,
            disagree: Number(l.disagree) || 0,
            netScore: Number(l.netScore) || 0,
            lastVotedAt: l.lastVotedAt ?? null,
            recentNet: Number(l.recentNet) || 0,
            priorNet: Number(l.priorNet) || 0,
            recentVotes: Number(l.recentVotes) || 0,
            lieTrend: Number(l.lieTrend) || 0,
          })) : [],
        });
      } else {
        setErrorMsg("Couldn't load flagged lies");
      }
    } catch {
      setErrorMsg("Couldn't load flagged lies");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [intervieweeId, fallbackName]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const personaName = detail?.intervieweeName || fallbackName;
  const portrait = PERSONA_PORTRAITS[intervieweeId];

  const handleShare = useCallback(async (lie: LieRow) => {
    try {
      if (Platform.OS !== "web") {
        try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      }
      const message = `"${lie.lieText}"\n\n${personaName} on TrumpBot — ${lie.agree} agree, ${lie.disagree} disagree (net ${lie.netScore > 0 ? "+" : ""}${lie.netScore}).\nhttps://trumpbot.rip`;
      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(message);
        setCopiedLieId(lie.lieId);
        setTimeout(() => setCopiedLieId((cur) => (cur === lie.lieId ? null : cur)), 1600);
      } else {
        await Share.share({ message });
      }
    } catch {
      try {
        await Clipboard.setStringAsync(lie.lieText);
        setCopiedLieId(lie.lieId);
        setTimeout(() => setCopiedLieId((cur) => (cur === lie.lieId ? null : cur)), 1600);
      } catch {}
    }
  }, [personaName]);

  const renderItem = ({ item, index }: { item: LieRow; index: number }) => {
    const totalVotes = item.agree + item.disagree;
    const agreePct = totalVotes > 0 ? Math.round((item.agree / totalVotes) * 100) : 0;
    const netLabel = item.netScore > 0 ? `+${item.netScore}` : `${item.netScore}`;
    const netColor = item.netScore > 0 ? "#FFD700" : item.netScore < 0 ? "#4ADE80" : "#aaa";
    return (
      <View style={s.lieCard} testID={`lie-row-${item.lieId}`}>
        <View style={s.lieHeader}>
          <View style={s.lieRankBadge}>
            <Text style={s.lieRankText}>#{index + 1}</Text>
          </View>
          <View style={s.netPill}>
            <Text style={[s.netNum, { color: netColor }]}>{netLabel}</Text>
            <Text style={s.netLabel}>net</Text>
          </View>
          <LieTrendBadge lieTrend={item.lieTrend} recentVotes={item.recentVotes} />
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => handleShare(item)}
            style={({ pressed }) => [s.shareBtn, pressed && { opacity: 0.6 }]}
            testID={`lie-share-${item.lieId}`}
            accessibilityLabel="Share this flagged lie"
          >
            <Ionicons
              name={copiedLieId === item.lieId ? "checkmark" : (Platform.OS === "web" ? "copy-outline" : "share-outline")}
              size={16}
              color={copiedLieId === item.lieId ? "#4ADE80" : "#ddd"}
            />
          </Pressable>
        </View>
        <Text style={s.lieText}>"{item.lieText}"</Text>
        <View style={s.barTrack}>
          <View style={[s.barAgree, { width: `${agreePct}%` }]} />
        </View>
        <View style={s.voteRow}>
          <View style={s.voteChip}>
            <Ionicons name="thumbs-up" size={13} color="#4ADE80" />
            <Text style={[s.voteNum, { color: "#4ADE80" }]}>{item.agree}</Text>
            <Text style={s.voteWord}>agree</Text>
          </View>
          <View style={s.voteChip}>
            <Ionicons name="thumbs-down" size={13} color="#ff6b6b" />
            <Text style={[s.voteNum, { color: "#ff6b6b" }]}>{item.disagree}</Text>
            <Text style={s.voteWord}>disagree</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={s.totalVotes}>{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</Text>
        </View>
      </View>
    );
  };

  const recentVotesTotal = detail?.recentVotes ?? 0;

  const trendingLie = detail?.lies.length
    ? (() => {
        const best = detail.lies.reduce<LieRow | null>((acc, lie) => {
          if (lie.recentVotes < TRENDING_MIN_VOTES) return acc;
          if (!acc || lie.recentVotes > acc.recentVotes) return lie;
          return acc;
        }, null);
        return best;
      })()
    : null;

  return (
    <View style={[s.container, { paddingTop: insets.top + webTop, paddingBottom: webBottom }]}>
      <LinearGradient
        colors={["rgba(255,215,0,0.10)", "rgba(0,0,0,0)", "#0a0a0a"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          style={s.iconBtn}
          testID="lie-detail-back"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: accentColor }]} numberOfLines={1}>
            FLAGGED LIES
          </Text>
          <Text style={s.headerSub} numberOfLines={1}>{personaName}</Text>
        </View>
        <View style={s.iconBtn} />
      </View>

      <View style={s.summaryCard}>
        {portrait ? (
          <Image source={portrait} style={s.summaryAvatar} resizeMode="cover" />
        ) : (
          <View style={[s.summaryAvatar, s.avatarFallback]}>
            <Ionicons name="person" size={28} color={accentColor} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.summaryName} numberOfLines={1}>{personaName}</Text>
          <Text style={s.summaryStats}>
            {detail?.lieCount ?? 0} flagged · {detail?.totalAgree ?? 0} agree · {detail?.totalDisagree ?? 0} disagree
          </Text>
          {detail && (
            <View style={s.trendRow}>
              <MiniTrendChart
                recentScore={detail.recentScore}
                priorScore={detail.priorScore}
                trend={detail.trend}
                recentVotes={recentVotesTotal}
              />
            </View>
          )}
        </View>
        <View style={s.scoreCol}>
          <Text style={[s.scoreNum, { color: accentColor }]}>
            {(detail?.lieScore ?? 0) > 0 ? `+${detail?.lieScore}` : (detail?.lieScore ?? 0)}
          </Text>
          <Text style={s.scoreLabel}>lie score</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      ) : !detail || detail.lies.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="document-text-outline" size={48} color="#555" />
          <Text style={[s.emptyTitle, { color: accentColor }]}>No flagged lies yet</Text>
          <Text style={s.emptyText}>
            When viewers vote on lies the AI catches during {personaName}'s interviews,
            the specific quotes will show up here.
          </Text>
          <Pressable
            onPress={() => router.replace("/interview")}
            style={[s.startBtn, { backgroundColor: accentColor }]}
            testID="lie-detail-start"
          >
            <Text style={s.startBtnText}>Start an Interview</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={detail.lies}
          keyExtractor={(it) => it.lieId}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
          ListHeaderComponent={
            trendingLie ? (
              <View style={{ marginBottom: 16 }}>
                <TrendingBanner
                  lie={trendingLie}
                  personaName={personaName}
                  copiedLieId={copiedLieId}
                  onShare={handleShare}
                />
                <View style={s.rankedLabel}>
                  <Text style={s.rankedLabelText}>ALL FLAGGED LIES</Text>
                </View>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={accentColor}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
  headerTitle: { fontSize: 16, fontWeight: "800", letterSpacing: 1.5 },
  headerSub: { color: "#aaa", fontSize: 11, marginTop: 2 },
  summaryCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 12, marginTop: 4, marginBottom: 8,
    padding: 12, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  summaryAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#222" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  summaryName: { color: "#fff", fontSize: 16, fontWeight: "800" },
  summaryStats: { color: "#aaa", fontSize: 12, marginTop: 3 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  trendContext: { color: "#666", fontSize: 10, fontWeight: "600" },
  scoreCol: { alignItems: "flex-end", minWidth: 64 },
  scoreNum: { fontSize: 20, fontWeight: "800" },
  scoreLabel: { color: "#888", fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 6 },
  emptyText: { color: "#aaa", fontSize: 13, textAlign: "center", maxWidth: 320 },
  startBtn: {
    marginTop: 12, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 22,
  },
  startBtnText: { color: "#000", fontWeight: "700" },
  lieCard: {
    padding: 14, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  lieHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8,
  },
  lieRankBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: "rgba(255,215,0,0.15)",
    borderWidth: 1, borderColor: "rgba(255,215,0,0.35)",
  },
  lieRankText: { color: "#FFD700", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  netPill: {
    flexDirection: "row", alignItems: "baseline", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  netNum: { fontSize: 14, fontWeight: "800" },
  netLabel: { color: "#888", fontSize: 10, fontWeight: "600", textTransform: "uppercase" },
  shareBtn: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  lieText: {
    color: "#f3f3f3", fontSize: 15, lineHeight: 22, fontStyle: "italic", marginBottom: 10,
  },
  barTrack: {
    height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,107,107,0.35)",
    overflow: "hidden", marginBottom: 8,
  },
  barAgree: {
    height: "100%", backgroundColor: "#4ADE80", borderRadius: 2,
  },
  voteRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  voteChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  voteNum: { fontSize: 12, fontWeight: "800" },
  voteWord: { color: "#aaa", fontSize: 11, fontWeight: "600" },
  totalVotes: { color: "#777", fontSize: 11, fontWeight: "600" },
  errorToast: {
    position: "absolute", left: 16, right: 16, bottom: 24 + webBottom,
    padding: 12, borderRadius: 10,
    backgroundColor: "rgba(255,80,80,0.95)",
    alignItems: "center",
  },
  errorToastText: { color: "#fff", fontWeight: "700" },
  rankedLabel: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  rankedLabelText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});
