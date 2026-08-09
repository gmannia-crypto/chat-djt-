import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform,
  Share, ActivityIndicator, TextInput,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeOut, useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";

const webTop = Platform.OS === "web" ? 67 : 0;
const webBottom = Platform.OS === "web" ? 34 : 0;

const CATEGORIES = [
  { id: "politics", label: "Politics", icon: "flag", color: "#ef4444" },
  { id: "sports", label: "Sports", icon: "american-football", color: "#3b82f6" },
  { id: "finance", label: "Finance", icon: "trending-up", color: "#10b981" },
  { id: "science", label: "Science", icon: "flask", color: "#8b5cf6" },
  { id: "health", label: "Health", icon: "heart", color: "#ec4899" },
  { id: "wealth", label: "Wealth", icon: "diamond", color: "#f59e0b" },
  { id: "motivation", label: "Motivation", icon: "flame", color: "#f97316" },
  { id: "custom", label: "Custom", icon: "create", color: "#4ADE80" },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];

type PollData = {
  question: string;
  optionA: string;
  optionB: string;
  hashtags: string[];
};

type Phase = "pre" | "live" | "post";

const PHASE_LABELS: Record<Phase, string> = { pre: "BEFORE DEBATE", live: "LIVE NOW", post: "AFTER DEBATE" };
const PHASE_COLORS: Record<Phase, string> = { pre: "#60a5fa", live: "#ff4d4d", post: "#4ADE80" };

export default function TikTokLiveScreen() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<CategoryId>("politics");
  const [phase, setPhase] = useState<Phase>("live");
  const [customTopic, setCustomTopic] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [voteA, setVoteA] = useState(0);
  const [voteB, setVoteB] = useState(0);
  const [myVote, setMyVote] = useState<"A" | "B" | null>(null);

  const [pollHistory, setPollHistory] = useState<PollData[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const liveDotOpacity = useSharedValue(1);
  const liveDotStyle = useAnimatedStyle(() => ({ opacity: liveDotOpacity.value }));

  useEffect(() => {
    liveDotOpacity.value = withRepeat(withSequence(withTiming(0.2, { duration: 600 }), withTiming(1, { duration: 600 })), -1);
  }, []);

  const fetchPoll = useCallback(async (cat?: CategoryId) => {
    const usedCat = cat || category;
    setLoading(true);
    setError(null);
    setMyVote(null);
    setVoteA(0);
    setVoteB(0);
    setPoll(null);
    try {
      const topic = usedCat === "custom" && customTopic.trim() ? customTopic.trim() : undefined;
      const r = await fetch(new URL("/api/arena/poll-question", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: usedCat, topic }),
      });
      if (!r.ok) throw new Error("Failed");
      const data: PollData = await r.json();
      setPoll(data);
      setPollHistory((prev) => [data, ...prev.slice(0, 19)]);
      setHistoryIdx(-1);
    } catch {
      setError("Couldn't generate poll. Check your connection.");
    }
    finally { setLoading(false); }
  }, [category, customTopic]);

  useEffect(() => { fetchPoll(); }, []);

  const castVote = useCallback((side: "A" | "B") => {
    if (myVote) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMyVote(side);
    if (side === "A") setVoteA((p) => p + 1); else setVoteB((p) => p + 1);
  }, [myVote]);

  const sharePoll = useCallback(async () => {
    if (!poll) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const total = voteA + voteB;
    const pctA = total > 0 ? Math.round((voteA / total) * 100) : 50;
    const pctB = 100 - pctA;
    const phaseStr = phase === "pre" ? "Before the debate:" : phase === "live" ? "LIVE RIGHT NOW:" : "Post-debate verdict:";
    const tags = poll.hashtags?.map((h) => `#${h}`).join(" ") || "#ChatDJT #Poll";
    const msg = `🗳️ ${phaseStr}\n\n"${poll.question}"\n\n🅰️ ${poll.optionA} — ${pctA}%\n🅱️ ${poll.optionB} — ${pctB}%\n\n${tags}\n\nVote + watch live on The Arena 🔥\nthearena.rip`;
    try {
      if (Platform.OS === "web" && navigator.share) await navigator.share({ title: "Live Poll", text: msg });
      else await Share.share({ message: msg, title: "Live Poll — Chat DJT" });
    } catch {}
  }, [poll, voteA, voteB, phase]);

  const cat = CATEGORIES.find((c) => c.id === category)!;
  const total = voteA + voteB;
  const pctA = total > 0 ? Math.round((voteA / total) * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <View style={[s.container, { paddingTop: insets.top + webTop }]}>
      <LinearGradient colors={["rgba(255,68,68,0.12)", "rgba(0,0,0,0)", "#0a0a0a"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={s.headerCenter}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Animated.View style={[s.liveDot, liveDotStyle]} />
            <Text style={s.headerTitle}>TIKTOK LIVE POLLS</Text>
          </View>
          <Text style={s.headerSub}>Chat DJT · Viral Question Generator</Text>
        </View>
        <Pressable onPress={sharePoll} style={s.shareBtn} disabled={!poll}>
          <Ionicons name="share-social" size={18} color={poll ? "#FFD700" : "#555"} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + webBottom + 30 }} showsVerticalScrollIndicator={false}>

        {/* Phase toggle */}
        <View style={s.phaseRow}>
          {(["pre", "live", "post"] as Phase[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => { Haptics.selectionAsync(); setPhase(p); }}
              style={[s.phaseChip, phase === p && { backgroundColor: `${PHASE_COLORS[p]}22`, borderColor: PHASE_COLORS[p] }]}
            >
              {p === "live" && phase === "live" && (
                <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#ff4d4d", marginRight: 4 }, liveDotStyle]} />
              )}
              <Text style={[s.phaseChipText, phase === p && { color: PHASE_COLORS[p] }]}>{PHASE_LABELS[p]}</Text>
            </Pressable>
          ))}
        </View>

        {/* Category selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                Haptics.selectionAsync();
                setCategory(c.id);
                if (c.id !== "custom") fetchPoll(c.id);
                else setShowCustomInput(true);
              }}
              style={[s.catChip, category === c.id && { backgroundColor: `${c.color}22`, borderColor: c.color }]}
            >
              <Ionicons name={c.icon as any} size={14} color={category === c.id ? c.color : "#888"} />
              <Text style={[s.catChipText, category === c.id && { color: c.color }]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Custom topic input */}
        {category === "custom" && showCustomInput && (
          <Animated.View entering={FadeInDown.duration(220)} style={s.customInputRow}>
            <TextInput
              value={customTopic}
              onChangeText={setCustomTopic}
              placeholder="Enter your debate topic…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={s.customInput}
              maxLength={120}
              returnKeyType="go"
              onSubmitEditing={() => { if (customTopic.trim()) fetchPoll("custom"); }}
            />
            <Pressable
              onPress={() => { if (customTopic.trim()) fetchPoll("custom"); }}
              disabled={!customTopic.trim() || loading}
              style={[s.customGoBtn, (!customTopic.trim() || loading) && { opacity: 0.4 }]}
            >
              <Ionicons name="arrow-forward" size={18} color="#000" />
            </Pressable>
          </Animated.View>
        )}

        {/* Main poll card */}
        <View style={s.pollCard}>
          <LinearGradient colors={["#1a0f0f", "#0f0a0a"]} style={StyleSheet.absoluteFill} borderRadius={20} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={[s.phaseBadge, { backgroundColor: `${PHASE_COLORS[phase]}22`, borderColor: PHASE_COLORS[phase] }]}>
                {phase === "live" && <Animated.View style={[{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#ff4d4d", marginRight: 3 }, liveDotStyle]} />}
                <Text style={[s.phaseBadgeText, { color: PHASE_COLORS[phase] }]}>{PHASE_LABELS[phase]}</Text>
              </View>
              <View style={[s.catBadge, { backgroundColor: `${cat.color}18`, borderColor: `${cat.color}55` }]}>
                <Ionicons name={cat.icon as any} size={11} color={cat.color} />
                <Text style={[s.catBadgeText, { color: cat.color }]}>{cat.label.toUpperCase()}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => fetchPoll()}
              disabled={loading}
              style={[s.refreshBtn, loading && { opacity: 0.4 }]}
            >
              <Ionicons name="refresh" size={16} color="#888" />
            </Pressable>
          </View>

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <ActivityIndicator color="#ff4d4d" size="large" />
              <Text style={{ color: "#888", fontSize: 13, marginTop: 12 }}>Generating viral poll…</Text>
            </View>
          ) : error ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Ionicons name="wifi-outline" size={32} color="#555" />
              <Text style={{ color: "#888", fontSize: 13, marginTop: 10 }}>{error}</Text>
              <Pressable onPress={() => fetchPoll()} style={s.retryBtn}>
                <Text style={{ color: "#FFD700", fontWeight: "900", fontSize: 13 }}>RETRY</Text>
              </Pressable>
            </View>
          ) : poll ? (
            <Animated.View entering={FadeIn.duration(300)}>
              <Text style={s.pollQuestion}>{poll.question}</Text>

              <View style={{ gap: 12, marginBottom: 18 }}>
                {(["A", "B"] as const).map((side) => {
                  const isA = side === "A";
                  const opt = isA ? poll.optionA : poll.optionB;
                  const votes = isA ? voteA : voteB;
                  const pct = isA ? pctA : pctB;
                  const voted = myVote === side;
                  const anyVote = myVote !== null;
                  const barColor = isA ? "#ff4d4d" : "#3b82f6";
                  return (
                    <Pressable
                      key={side}
                      onPress={() => castVote(side)}
                      disabled={anyVote}
                      style={[s.voteBtn, voted && { borderColor: barColor, borderWidth: 2 }]}
                    >
                      {anyVote && (
                        <View style={[s.voteBar, { width: `${pct}%` as any, backgroundColor: `${barColor}30` }]} />
                      )}
                      <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12, zIndex: 1 }}>
                        <View style={[s.voteLabel, { backgroundColor: voted ? barColor : `${barColor}22`, borderColor: `${barColor}66` }]}>
                          <Text style={[s.voteLabelText, { color: voted ? "#fff" : barColor }]}>{side}</Text>
                        </View>
                        <Text style={[s.voteText, voted && { color: "#fff" }]} numberOfLines={2}>{opt}</Text>
                        {anyVote && (
                          <Text style={[s.votePct, { color: voted ? barColor : "rgba(255,255,255,0.45)" }]}>{pct}%</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {myVote && (
                <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: "center", marginBottom: 12 }}>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                    {total} vote{total !== 1 ? "s" : ""} cast · {myVote === "A" ? poll.optionA : poll.optionB} is winning
                  </Text>
                </Animated.View>
              )}

              {/* Hashtags */}
              {poll.hashtags?.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {poll.hashtags.map((tag, i) => (
                    <View key={i} style={s.hashTag}>
                      <Text style={s.hashTagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Action row */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable onPress={() => fetchPoll()} style={[s.actionBtn, { flex: 1, backgroundColor: "rgba(255,255,255,0.06)" }]}>
                  <Ionicons name="refresh" size={16} color="#888" />
                  <Text style={{ color: "#888", fontSize: 12, fontWeight: "800" }}>NEW POLL</Text>
                </Pressable>
                <Pressable onPress={sharePoll} style={[s.actionBtn, { flex: 2, backgroundColor: "#ff4d4d" }]}>
                  <Ionicons name="logo-tiktok" size={16} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>SHARE ON TIKTOK</Text>
                </Pressable>
              </View>

              {/* GO LIVE button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  const params: Record<string, string> = { category };
                  if (category === "custom" && customTopic.trim()) params.topic = customTopic.trim();
                  router.push({ pathname: "/tiktok-broadcast", params });
                }}
                style={s.goLiveBtn}
              >
                <LinearGradient
                  colors={["#ff1a1a", "#cc0000"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.goLiveGradient}
                >
                  <View style={s.goLiveDot} />
                  <Ionicons name="radio" size={20} color="#fff" />
                  <Text style={s.goLiveText}>GO LIVE — SCREEN SHARE MODE</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>

        {/* Poll history */}
        {pollHistory.length > 1 && (
          <View style={s.historySection}>
            <Text style={s.historyTitle}>RECENT POLLS</Text>
            {pollHistory.slice(1, 6).map((p, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPoll(p);
                  setMyVote(null);
                  setVoteA(0);
                  setVoteB(0);
                }}
                style={s.historyRow}
              >
                <Ionicons name="bar-chart-outline" size={14} color="#555" />
                <Text style={s.historyText} numberOfLines={1}>{p.question}</Text>
                <Ionicons name="chevron-forward" size={14} color="#555" />
              </Pressable>
            ))}
          </View>
        )}

        {/* Tips */}
        <View style={s.tipsCard}>
          <Text style={s.tipsTitle}>💡 TIKTOK LIVE TIPS</Text>
          <Text style={s.tipText}>• Post your poll 10 minutes before going live to build hype</Text>
          <Text style={s.tipText}>• Switch phases (Before → Live → After) as the debate progresses</Text>
          <Text style={s.tipText}>• Refresh every 5–10 min for fresh angles during long debates</Text>
          <Text style={s.tipText}>• Generate 3–5 polls and queue them up before your stream</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 1.5 },
  headerSub: { color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 1 },
  shareBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,215,0,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.2)" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff4d4d" },

  phaseRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 14, marginTop: 4 },
  phaseChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  phaseChipText: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  catScroll: { marginBottom: 14 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  catChipText: { color: "#888", fontSize: 12, fontWeight: "700" },

  customInputRow: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 14 },
  customInput: { flex: 1, color: "#fff", fontSize: 13, padding: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(74,222,128,0.3)" },
  customGoBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#4ADE80", alignItems: "center", justifyContent: "center" },

  pollCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,68,68,0.25)", overflow: "hidden" },
  phaseBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  phaseBadgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  catBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  catBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },
  retryBtn: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: "rgba(255,215,0,0.1)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },

  pollQuestion: { color: "#fff", fontSize: 18, fontWeight: "900", lineHeight: 26, textAlign: "center", marginBottom: 22 },

  voteBtn: { borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden", backgroundColor: "rgba(255,255,255,0.03)" },
  voteBar: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 14 },
  voteLabel: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  voteLabelText: { fontSize: 14, fontWeight: "900" },
  voteText: { flex: 1, color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "700" },
  votePct: { fontSize: 16, fontWeight: "900", minWidth: 36, textAlign: "right" },

  hashTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  hashTagText: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "600" },

  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },

  goLiveBtn: { marginTop: 10, borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: "#ff1a1a" },
  goLiveGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, paddingHorizontal: 16, gap: 10 },
  goLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff", opacity: 0.9 },
  goLiveText: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 1 },

  historySection: { marginHorizontal: 16, marginBottom: 16 },
  historyTitle: { color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 8 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  historyText: { flex: 1, color: "rgba(255,255,255,0.55)", fontSize: 13 },

  tipsCard: { marginHorizontal: 16, marginBottom: 10, padding: 16, borderRadius: 14, backgroundColor: "rgba(255,215,0,0.04)", borderWidth: 1, borderColor: "rgba(255,215,0,0.15)" },
  tipsTitle: { color: "#FFD700", fontSize: 11, fontWeight: "900", letterSpacing: 1, marginBottom: 10 },
  tipText: { color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 20 },
});
