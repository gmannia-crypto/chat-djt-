import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, Pressable, StyleSheet, Platform, Dimensions,
  Share, ActivityIndicator, FlatList,
} from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn, FadeInDown, FadeInUp, FadeOut,
  useSharedValue, useAnimatedStyle,
  withTiming, withRepeat, withSequence, withSpring,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────
type Snippet = { speaker: string; speakerId: string; text: string; color: string };
type PollData = { question: string; optionA: string; optionB: string; hashtags: string[] };

// ─── Floating Heart Component ─────────────────────────────────────────────────
function FloatingHeart({ x, delay, onDone }: { x: number; delay: number; onDone: () => void }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      translateY.value = withTiming(-220, { duration: 2200 });
      opacity.value = withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 1800 }));
      scale.value = withSequence(withSpring(1.4), withTiming(0.9, { duration: 1600 }));
      setTimeout(() => runOnJS(onDone)(), 2200);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const colors = ["#ff4d4d", "#ff77a9", "#FFD700", "#ff6b35"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  return (
    <Animated.View style={[{ position: "absolute", bottom: 120, right: x }, style]}>
      <Ionicons name="heart" size={22} color={color} />
    </Animated.View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ item, idx }: { item: Snippet; idx: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(idx * 80).duration(300)} style={b.msgRow}>
      <View style={[b.avatar, { backgroundColor: `${item.color}30`, borderColor: `${item.color}88` }]}>
        <Text style={{ color: item.color, fontSize: 10, fontWeight: "900" }}>
          {item.speaker.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={b.bubble}>
        <Text style={[b.speakerName, { color: item.color }]}>{item.speaker}</Text>
        <Text style={b.msgText}>{item.text}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TikTokBroadcastScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; topic?: string }>();
  const category = params.category || "politics";
  const topic = params.topic || "";

  // Viewer count
  const [viewers, setViewers] = useState(() => Math.floor(Math.random() * 2000) + 800);

  // Live dot pulse
  const livePulse = useSharedValue(1);
  const livePulseStyle = useAnimatedStyle(() => ({ opacity: livePulse.value }));

  // Hearts
  const [hearts, setHearts] = useState<{ id: number; x: number; delay: number }[]>([]);
  const heartIdRef = useRef(0);

  // Guide
  const [showGuide, setShowGuide] = useState(true);

  // Poll
  const [poll, setPoll] = useState<PollData | null>(null);
  const [pollLoading, setPollLoading] = useState(false);
  const [voteA, setVoteA] = useState(0);
  const [voteB, setVoteB] = useState(0);
  const [myVote, setMyVote] = useState<"A" | "B" | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollBarA = useSharedValue(50);
  const pollBarB = useSharedValue(50);
  const pollBarStyleA = useAnimatedStyle(() => ({ width: `${pollBarA.value}%` as any }));
  const pollBarStyleB = useAnimatedStyle(() => ({ width: `${pollBarB.value}%` as any }));

  // Debate feed
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [visibleMsgs, setVisibleMsgs] = useState<Snippet[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const snippetIdxRef = useRef(0);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatRef = useRef<FlatList>(null);

  // ── Animations ──────────────────────────────────────────────────────────────
  useEffect(() => {
    livePulse.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
    );
  }, []);

  // ── Viewer count ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setViewers((v) => v + Math.floor(Math.random() * 12) - 3);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // ── Heart spawner ────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      const count = Math.floor(Math.random() * 3) + 1;
      const newHearts = Array.from({ length: count }, (_, i) => ({
        id: ++heartIdRef.current,
        x: Math.floor(Math.random() * 60) + 10,
        delay: i * 200,
      }));
      setHearts((prev) => [...prev, ...newHearts].slice(-15));
    }, 3500);
    return () => clearInterval(t);
  }, []);

  // ── Fetch poll ───────────────────────────────────────────────────────────────
  const fetchPoll = useCallback(async () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setPollLoading(true);
    setMyVote(null);
    setVoteA(0);
    setVoteB(0);
    pollBarA.value = withTiming(50, { duration: 400 });
    pollBarB.value = withTiming(50, { duration: 400 });
    try {
      const r = await fetch(new URL("/api/arena/poll-question", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, topic: topic || undefined }),
      });
      if (r.ok) {
        const data: PollData = await r.json();
        setPoll(data);
      }
    } catch {}
    setPollLoading(false);
    // Auto-rotate poll every 90 seconds
    pollTimerRef.current = setTimeout(fetchPoll, 90000);
  }, [category, topic]);

  // ── Fetch debate snippets ────────────────────────────────────────────────────
  const fetchSnippets = useCallback(async () => {
    setFeedLoading(true);
    try {
      const r = await fetch(new URL("/api/arena/broadcast-snippets", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, topic: topic || undefined }),
      });
      if (r.ok) {
        const data: Snippet[] = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          setSnippets(data);
          snippetIdxRef.current = 0;
        }
      }
    } catch {}
    setFeedLoading(false);
  }, [category, topic]);

  // ── Message ticker — drip snippets in one at a time ──────────────────────────
  useEffect(() => {
    if (snippets.length === 0) return;
    const tick = () => {
      const idx = snippetIdxRef.current;
      if (idx < snippets.length) {
        setVisibleMsgs((prev) => {
          const updated = [...prev, snippets[idx]];
          return updated.slice(-12); // keep last 12 messages
        });
        snippetIdxRef.current = idx + 1;
        msgTimerRef.current = setTimeout(tick, 4500);
      } else {
        // Refetch when exhausted
        fetchSnippets();
      }
    };
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(tick, 800);
    return () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current); };
  }, [snippets]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (visibleMsgs.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [visibleMsgs]);

  // ── Boot ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPoll();
    fetchSnippets();
    // Auto-hide guide after 8s
    const t = setTimeout(() => setShowGuide(false), 8000);
    return () => {
      clearTimeout(t);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    };
  }, []);

  // ── Vote ─────────────────────────────────────────────────────────────────────
  const castVote = useCallback((side: "A" | "B") => {
    if (myVote) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMyVote(side);
    const newA = side === "A" ? voteA + 1 : voteA;
    const newB = side === "B" ? voteB + 1 : voteB;
    const total = newA + newB;
    const pA = total > 0 ? Math.round((newA / total) * 100) : 50;
    const pB = 100 - pA;
    if (side === "A") setVoteA((p) => p + 1); else setVoteB((p) => p + 1);
    pollBarA.value = withTiming(pA, { duration: 600 });
    pollBarB.value = withTiming(pB, { duration: 600 });
    // Spawn hearts on vote
    const newHearts = Array.from({ length: 5 }, (_, i) => ({
      id: ++heartIdRef.current,
      x: Math.floor(Math.random() * 60) + 10,
      delay: i * 150,
    }));
    setHearts((prev) => [...prev, ...newHearts].slice(-20));
  }, [myVote, voteA, voteB]);

  // ── Share ────────────────────────────────────────────────────────────────────
  const shareBroadcast = useCallback(async () => {
    if (!poll) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const total = voteA + voteB;
    const pctA = total > 0 ? Math.round((voteA / total) * 100) : 50;
    const tags = poll.hashtags?.map((h) => `#${h}`).join(" ") || "#ChatDJT";
    const msg = `🔴 LIVE NOW on TikTok!\n\n"${poll.question}"\n\n🅰️ ${poll.optionA} — ${pctA}%\n🅱️ ${poll.optionB} — ${100 - pctA}%\n\n${tags}\n\nWatch live + vote: thearena.rip`;
    try {
      if (Platform.OS === "web" && navigator.share) await navigator.share({ title: "Live Poll", text: msg });
      else await Share.share({ message: msg, title: "Chat DJT Live" });
    } catch {}
  }, [poll, voteA, voteB]);

  const total = voteA + voteB;
  const pctA = total > 0 ? Math.round((voteA / total) * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LinearGradient
          colors={["#0d0000", "#0a0a0a", "#000d1a"]}
          style={StyleSheet.absoluteFill}
        />

        {/* ── Hearts layer ──────────────────────────────────────────────── */}
        <View style={s.heartsLayer} pointerEvents="none">
          {hearts.map((h) => (
            <FloatingHeart
              key={h.id}
              x={h.x}
              delay={h.delay}
              onDone={() => setHearts((prev) => prev.filter((x) => x.id !== h.id))}
            />
          ))}
        </View>

        {/* ── Top bar ───────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <Pressable onPress={() => router.back()} style={s.exitBtn}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>

          <View style={s.liveChip}>
            <Animated.View style={[s.liveDot, livePulseStyle]} />
            <Text style={s.liveText}>LIVE</Text>
          </View>

          <View style={s.viewerChip}>
            <Ionicons name="eye" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={s.viewerText}>{viewers.toLocaleString()}</Text>
          </View>

          <View style={{ flex: 1 }} />

          <Pressable onPress={shareBroadcast} style={s.topShareBtn}>
            <Ionicons name="share-social-outline" size={18} color="#FFD700" />
          </Pressable>

          <Pressable onPress={() => { fetchSnippets(); fetchPoll(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={s.topRefreshBtn}>
            <Ionicons name="refresh" size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        </View>

        {/* ── Topic badge ───────────────────────────────────────────────── */}
        <View style={s.topicBadge}>
          <Text style={s.topicText} numberOfLines={1}>
            {topic || category.charAt(0).toUpperCase() + category.slice(1)} · Chat DJT Arena
          </Text>
        </View>

        {/* ── Screen Share Guide ────────────────────────────────────────── */}
        {showGuide && (
          <Animated.View entering={FadeInDown.duration(400)} exiting={FadeOut.duration(300)} style={s.guideCard}>
            <View style={s.guideHeader}>
              <Ionicons name="phone-portrait-outline" size={16} color="#FFD700" />
              <Text style={s.guideTitle}>HOW TO STREAM ON TIKTOK LIVE</Text>
              <Pressable onPress={() => setShowGuide(false)} style={s.guideDismiss}>
                <Ionicons name="close" size={14} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
            <View style={{ gap: 6 }}>
              {[
                ["1", "Open TikTok → tap + → select LIVE"],
                ["2", 'Choose "Share Screen" mode'],
                ["3", "Select Chat DJT from app list"],
                ["4", "This screen streams live to your audience!"],
              ].map(([step, text]) => (
                <View key={step} style={s.guideRow}>
                  <View style={s.guideStepBadge}><Text style={s.guideStepNum}>{step}</Text></View>
                  <Text style={s.guideStepText}>{text}</Text>
                </View>
              ))}
            </View>
            <Pressable onPress={() => setShowGuide(false)} style={s.guideGotIt}>
              <Text style={s.guideGotItText}>GOT IT — HIDE GUIDE</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Debate feed ───────────────────────────────────────────────── */}
        <View style={s.feedArea}>
          {feedLoading && visibleMsgs.length === 0 ? (
            <View style={s.feedLoader}>
              <ActivityIndicator color="#ff4d4d" size="small" />
              <Text style={s.feedLoaderText}>Loading debate…</Text>
            </View>
          ) : (
            <FlatList
              ref={flatRef}
              data={visibleMsgs}
              keyExtractor={(_, i) => `msg-${i}`}
              renderItem={({ item, index }) => <MessageBubble item={item} idx={index} />}
              contentContainerStyle={s.feedList}
              showsVerticalScrollIndicator={false}
              scrollEnabled
            />
          )}
        </View>

        {/* ── Poll overlay ──────────────────────────────────────────────── */}
        <View style={s.pollOverlay}>
          <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.96)"]} style={StyleSheet.absoluteFill} />
          <View style={s.pollInner}>
            {pollLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 18 }}>
                <ActivityIndicator color="#ff4d4d" size="small" />
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 6 }}>
                  Generating poll…
                </Text>
              </View>
            ) : poll ? (
              <Animated.View entering={FadeInUp.duration(400)}>
                {/* Poll header */}
                <View style={s.pollHead}>
                  <View style={s.pollLiveBadge}>
                    <Animated.View style={[{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#ff4d4d", marginRight: 4 }, livePulseStyle]} />
                    <Text style={s.pollLiveTxt}>LIVE POLL</Text>
                  </View>
                  <Pressable onPress={() => { fetchPoll(); Haptics.selectionAsync(); }} style={s.pollRefreshBtn}>
                    <Ionicons name="refresh-outline" size={14} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                </View>

                <Text style={s.pollQ} numberOfLines={3}>{poll.question}</Text>

                {/* Vote options */}
                <View style={{ gap: 8, marginBottom: 10 }}>
                  {(["A", "B"] as const).map((side) => {
                    const isA = side === "A";
                    const opt = isA ? poll.optionA : poll.optionB;
                    const pct = isA ? pctA : pctB;
                    const voted = myVote === side;
                    const barColor = isA ? "#ef4444" : "#3b82f6";
                    const barAnim = isA ? pollBarStyleA : pollBarStyleB;
                    return (
                      <Pressable
                        key={side}
                        onPress={() => castVote(side)}
                        disabled={myVote !== null}
                        style={[s.voteOpt, voted && { borderColor: barColor, borderWidth: 2 }]}
                      >
                        {myVote && (
                          <Animated.View style={[s.voteBarFill, { backgroundColor: `${barColor}38` }, barAnim]} />
                        )}
                        <View style={s.voteOptInner}>
                          <View style={[s.voteSideBadge, { backgroundColor: voted ? barColor : `${barColor}25` }]}>
                            <Text style={[s.voteSideText, { color: voted ? "#fff" : barColor }]}>{side}</Text>
                          </View>
                          <Text style={s.voteOptText} numberOfLines={2}>{opt}</Text>
                          {myVote && <Text style={[s.votePctText, { color: voted ? barColor : "rgba(255,255,255,0.4)" }]}>{pct}%</Text>}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Tags + share */}
                <View style={s.pollFooter}>
                  <View style={{ flexDirection: "row", gap: 5, flex: 1, flexWrap: "wrap" }}>
                    {poll.hashtags?.slice(0, 3).map((t, i) => (
                      <Text key={i} style={s.pollTag}>#{t}</Text>
                    ))}
                  </View>
                  <Pressable onPress={shareBroadcast} style={s.pollShareBtn}>
                    <Ionicons name="logo-tiktok" size={14} color="#fff" />
                    <Text style={s.pollShareText}>SHARE</Text>
                  </Pressable>
                </View>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0a" },

  heartsLayer: { position: "absolute", right: 0, bottom: 0, top: 0, width: 100, zIndex: 20, pointerEvents: "none" as any },

  topBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 10, gap: 8, zIndex: 10,
  },
  exitBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center",
  },
  liveChip: {
    flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, backgroundColor: "#ff4d4d",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  viewerChip: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)",
  },
  viewerText: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700" },
  topShareBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,215,0,0.1)",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)",
  },
  topRefreshBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },

  topicBadge: {
    alignSelf: "center", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 8, marginHorizontal: 16,
  },
  topicText: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", textAlign: "center" },

  guideCard: {
    marginHorizontal: 14, marginBottom: 10, padding: 14, borderRadius: 14,
    backgroundColor: "rgba(255,215,0,0.06)", borderWidth: 1, borderColor: "rgba(255,215,0,0.25)", zIndex: 10,
  },
  guideHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  guideTitle: { color: "#FFD700", fontSize: 11, fontWeight: "900", letterSpacing: 0.8, flex: 1 },
  guideDismiss: { padding: 2 },
  guideRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  guideStepBadge: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: "#ff4d4d",
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  guideStepNum: { color: "#fff", fontSize: 10, fontWeight: "900" },
  guideStepText: { flex: 1, color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 20 },
  guideGotIt: {
    marginTop: 12, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "rgba(255,68,68,0.15)", borderWidth: 1, borderColor: "rgba(255,68,68,0.4)",
  },
  guideGotItText: { color: "#ff4d4d", fontSize: 11, fontWeight: "900", letterSpacing: 1 },

  feedArea: { flex: 1, overflow: "hidden" },
  feedLoader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  feedLoaderText: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  feedList: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 16, gap: 8 },

  pollOverlay: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingBottom: Platform.OS === "web" ? 34 : 0,
    zIndex: 15,
  },
  pollInner: { padding: 14, paddingTop: 32 },
  pollHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  pollLiveBadge: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, backgroundColor: "rgba(255,68,68,0.2)", borderWidth: 1, borderColor: "rgba(255,68,68,0.5)",
  },
  pollLiveTxt: { color: "#ff4d4d", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  pollRefreshBtn: { padding: 6 },
  pollQ: {
    color: "#fff", fontSize: 17, fontWeight: "900", lineHeight: 24,
    marginBottom: 12, textAlign: "center",
  },

  voteOpt: {
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)",
  },
  voteBarFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 12 },
  voteOptInner: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10, zIndex: 1 },
  voteSideBadge: {
    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
  },
  voteSideText: { fontSize: 13, fontWeight: "900" },
  voteOptText: { flex: 1, color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "700" },
  votePctText: { fontSize: 15, fontWeight: "900", minWidth: 34, textAlign: "right" },

  pollFooter: { flexDirection: "row", alignItems: "center", gap: 8 },
  pollTag: { color: "rgba(255,255,255,0.35)", fontSize: 11 },
  pollShareBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 20, backgroundColor: "#ff4d4d",
  },
  pollShareText: { color: "#fff", fontSize: 11, fontWeight: "900" },
});

// ─── Message bubble styles ────────────────────────────────────────────────────
const b = StyleSheet.create({
  msgRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  avatar: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    borderWidth: 1, flexShrink: 0, marginTop: 2,
  },
  bubble: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12,
    padding: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  speakerName: { fontSize: 11, fontWeight: "900", marginBottom: 3, letterSpacing: 0.3 },
  msgText: { color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 19 },
});
