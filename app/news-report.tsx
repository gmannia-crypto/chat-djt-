import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Image, Linking, ActivityIndicator, Platform, Animated as RNAnimated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInRight, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, cancelAnimation } from "react-native-reanimated";
import { getApiUrl } from "@/lib/query-client";
import { Audio } from "expo-av";

const ANCHOR_PORTRAITS: Record<string, any> = {
  "persona-gilbertgottfried": require("@/assets/images/persona-gilbertgottfried.jpg"),
  "persona-carlin": require("@/assets/images/persona-carlin.jpg"),
  "persona-carville": require("@/assets/images/persona-carville.png"),
  "persona-ruckus": require("@/assets/images/persona-ruckus.png"),
  "anchor-brockhardman": require("@/assets/images/anchor-brockhardman.png"),
  "anchor-destinyvega": require("@/assets/images/anchor-destinyvega.png"),
  "anchor-rexpemberton": require("@/assets/images/anchor-rexpemberton.png"),
  "anchor-tammytruthseeker": require("@/assets/images/anchor-tammytruthseeker.png"),
};

type Anchor = {
  id: string;
  name: string;
  showName: string;
  bio: string;
  themeColor: string;
  portrait: string;
};

type Segment = {
  index: number;
  headline: string;
  source: string;
  url: string;
  commentary: string;
  speakerText?: string; // GPT-generated text with transitions; falls back to commentary
  speakerId: string;
};

type Report = {
  anchor: { id: string; name: string; showName: string; bio: string; themeColor: string };
  duration: number;
  segments: Segment[];
  generatedAt: string;
};

const DURATION_OPTIONS = [
  { value: 5, label: "5 MIN", desc: "3 stories · brief" },
  { value: 10, label: "10 MIN", desc: "5 stories · detailed" },
  { value: 15, label: "15 MIN", desc: "7 stories · full show" },
];

export default function NewsReportScreen() {
  const insets = useSafeAreaInsets();
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [selectedAnchor, setSelectedAnchor] = useState<string>("ruckus");
  const [selectedDuration, setSelectedDuration] = useState(5);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [activeSegment, setActiveSegment] = useState<number>(-1);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const autoPlayRef = useRef(false);
  const cancelRef = useRef(false);

  const pulseAnim = useSharedValue(1);
  const liveOpacity = useSharedValue(1);

  useEffect(() => {
    fetch(`${getApiUrl()}/api/news-report/anchors`)
      .then(r => r.json())
      .then(d => setAnchors(d.anchors || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (playingAudio) {
      pulseAnim.value = withRepeat(withSequence(withTiming(1.06, { duration: 400 }), withTiming(1, { duration: 400 })), -1, false);
      liveOpacity.value = withRepeat(withSequence(withTiming(0, { duration: 500 }), withTiming(1, { duration: 500 })), -1, false);
    } else {
      cancelAnimation(pulseAnim);
      cancelAnimation(liveOpacity);
      pulseAnim.value = withTiming(1);
      liveOpacity.value = withTiming(1);
    }
  }, [playingAudio]);

  const portraitStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));
  const liveStyle = useAnimatedStyle(() => ({ opacity: liveOpacity.value }));

  const stopAudio = useCallback(async () => {
    cancelRef.current = true;
    autoPlayRef.current = false;
    setIsAutoPlaying(false);
    setPlayingAudio(false);
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, []);

  const speakSegment = useCallback(async (seg: Segment, themeColor: string) => {
    if (cancelRef.current) return;
    setActiveSegment(seg.index);
    setPlayingAudio(true);

    const fullText = seg.speakerText || seg.commentary;

    try {
      const apiUrl = getApiUrl();
      const resp = await fetch(`${apiUrl}/api/news-report/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText, anchorId: seg.speakerId }),
      });
      if (!resp.ok || cancelRef.current) { setPlayingAudio(false); return; }

      const blob = await resp.blob();
      const uri = URL.createObjectURL(blob);

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });
      soundRef.current = sound;

      await new Promise<void>((resolve) => {
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish || !status.isLoaded) { resolve(); }
        });
      });

      try { await sound.unloadAsync(); } catch {}
      soundRef.current = null;
      if (Platform.OS !== "web") try { URL.revokeObjectURL(uri); } catch {}
    } catch {
      // silent fail — move on
    }

    if (!cancelRef.current) setPlayingAudio(false);
  }, [report]);

  const startAutoPlay = useCallback(async (segs: Segment[], themeColor: string) => {
    cancelRef.current = false;
    autoPlayRef.current = true;
    setIsAutoPlaying(true);
    for (const seg of segs) {
      if (cancelRef.current) break;
      await speakSegment(seg, themeColor);
      if (cancelRef.current) break;
      await new Promise(r => setTimeout(r, 600));
    }
    if (!cancelRef.current) {
      setIsAutoPlaying(false);
      setPlayingAudio(false);
      setActiveSegment(-1);
    }
  }, [speakSegment]);

  const generateReport = useCallback(async () => {
    await stopAudio();
    setReport(null);
    setActiveSegment(-1);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const resp = await fetch(`${getApiUrl()}/api/news-report/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anchorId: selectedAnchor, duration: selectedDuration }),
      });
      const data = await resp.json();
      setReport(data);
      setLoading(false);
      setTimeout(() => startAutoPlay(data.segments, data.anchor.themeColor), 800);
    } catch {
      setLoading(false);
    }
  }, [selectedAnchor, selectedDuration, stopAudio, startAutoPlay]);

  const selectedAnchorData = anchors.find(a => a.id === selectedAnchor);
  const themeColor = selectedAnchorData?.themeColor || "#FFD700";
  const portrait = selectedAnchorData ? ANCHOR_PORTRAITS[selectedAnchorData.portrait] : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => { stopAudio(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>NEWS WORLD REPORT</Text>
          <Text style={styles.headerSub}>LIVE · BIASED · UNHINGED</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Anchor Selector */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.sectionLabel}>SELECT YOUR ANCHOR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anchorRow}>
            {anchors.map((a) => {
              const isSelected = a.id === selectedAnchor;
              const img = ANCHOR_PORTRAITS[a.portrait];
              return (
                <Pressable
                  key={a.id}
                  onPress={() => { setSelectedAnchor(a.id); Haptics.selectionAsync(); setReport(null); }}
                  style={[styles.anchorChip, isSelected && { borderColor: a.themeColor, backgroundColor: a.themeColor + "22" }]}
                >
                  {img ? (
                    <Image source={img} style={[styles.anchorThumb, isSelected && { borderColor: a.themeColor }]} />
                  ) : (
                    <View style={[styles.anchorThumbPlaceholder, { backgroundColor: a.themeColor + "44" }]}>
                      <Text style={{ fontSize: 20 }}>📺</Text>
                    </View>
                  )}
                  <Text style={[styles.anchorChipName, isSelected && { color: a.themeColor }]} numberOfLines={2}>{a.name}</Text>
                  {isSelected && <View style={[styles.anchorDot, { backgroundColor: a.themeColor }]} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Selected Anchor Card */}
        {selectedAnchorData && (
          <Animated.View key={selectedAnchor} entering={FadeIn.duration(300)} style={[styles.anchorCard, { borderColor: themeColor + "66" }]}>
            <View style={styles.anchorCardLeft}>
              {portrait ? (
                <Image source={portrait} style={[styles.anchorCardPortrait, { borderColor: themeColor }]} />
              ) : (
                <View style={[styles.anchorCardPortrait, { backgroundColor: themeColor + "33", alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: 36 }}>📺</Text>
                </View>
              )}
            </View>
            <View style={styles.anchorCardRight}>
              <View style={[styles.showNameBadge, { backgroundColor: themeColor + "33", borderColor: themeColor + "66" }]}>
                <Text style={[styles.showNameText, { color: themeColor }]}>{selectedAnchorData.showName}</Text>
              </View>
              <Text style={styles.anchorCardName}>{selectedAnchorData.name}</Text>
              <Text style={styles.anchorCardBio}>{selectedAnchorData.bio}</Text>
            </View>
          </Animated.View>
        )}

        {/* Duration Picker */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={styles.sectionLabel}>BROADCAST LENGTH</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((opt) => {
              const isActive = selectedDuration === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => { setSelectedDuration(opt.value); Haptics.selectionAsync(); setReport(null); }}
                  style={[styles.durationPill, isActive && { backgroundColor: themeColor + "33", borderColor: themeColor }]}
                >
                  <Text style={[styles.durationLabel, isActive && { color: themeColor }]}>{opt.label}</Text>
                  <Text style={[styles.durationDesc, isActive && { color: themeColor + "cc" }]}>{opt.desc}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Broadcast Button */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.broadcastBtnWrap}>
          <Pressable
            onPress={generateReport}
            disabled={loading || !selectedAnchorData}
            style={({ pressed }) => [styles.broadcastBtn, { borderColor: themeColor, backgroundColor: themeColor + "22" }, pressed && { opacity: 0.75 }]}
          >
            {loading ? (
              <ActivityIndicator color={themeColor} size="small" />
            ) : (
              <MaterialCommunityIcons name="broadcast" size={22} color={themeColor} />
            )}
            <Text style={[styles.broadcastBtnText, { color: themeColor }]}>
              {loading ? "FETCHING REAL NEWS..." : isAutoPlaying ? "ON AIR — TAP TO RESTART" : "GO ON AIR"}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Loading state */}
        {loading && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.loadingCard}>
            <MaterialCommunityIcons name="satellite-uplink" size={32} color={themeColor} />
            <Text style={[styles.loadingText, { color: themeColor }]}>SCANNING LIVE FEEDS...</Text>
            <Text style={styles.loadingSubText}>Pulling real headlines from 20+ sources</Text>
          </Animated.View>
        )}

        {/* Report */}
        {report && (
          <Animated.View entering={FadeIn.duration(400)}>
            {/* On Air Banner */}
            <View style={[styles.onAirBanner, { borderColor: themeColor + "55", backgroundColor: "#0a0a0f" }]}>
              <View style={styles.onAirLeft}>
                {portrait && (
                  <Animated.View style={[portraitStyle]}>
                    <Image source={portrait} style={[styles.onAirPortrait, { borderColor: playingAudio ? themeColor : "#333" }]} />
                  </Animated.View>
                )}
                <View style={styles.onAirInfo}>
                  <Text style={[styles.onAirShowName, { color: themeColor }]}>{report.anchor.showName}</Text>
                  <Text style={styles.onAirAnchorName}>{report.anchor.name}</Text>
                  <Text style={styles.onAirDuration}>{report.segments.length - 1} stories · {report.duration} min</Text>
                </View>
              </View>
              <View style={styles.onAirRight}>
                {isAutoPlaying ? (
                  <Animated.View style={[styles.liveTag, liveStyle, { backgroundColor: "#FF0000" }]}>
                    <Text style={styles.liveTagText}>● LIVE</Text>
                  </Animated.View>
                ) : (
                  <View style={[styles.liveTag, { backgroundColor: "#333" }]}>
                    <Text style={styles.liveTagText}>▶ PLAY</Text>
                  </View>
                )}
                {isAutoPlaying && (
                  <Pressable onPress={stopAudio} style={styles.stopBtn}>
                    <Ionicons name="stop-circle" size={28} color="#FF4444" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Segment Cards */}
            {report.segments.map((seg, idx) => {
              const isActive = activeSegment === seg.index;
              const isIntro = seg.index === 0;

              if (isIntro) {
                // Opening card — anchor intro
                return (
                  <Animated.View key="intro" entering={FadeInRight.delay(0).duration(400)}>
                    <Pressable
                      onPress={() => { if (!isAutoPlaying) { cancelRef.current = false; startAutoPlay(report.segments, report.anchor.themeColor); } }}
                      style={[styles.introCard, isActive && { borderColor: themeColor, backgroundColor: themeColor + "11" }]}
                    >
                      <View style={styles.storyMeta}>
                        <View style={[styles.storyNumBadge, { backgroundColor: isActive ? themeColor : "#222" }]}>
                          {isActive && playingAudio
                            ? <MaterialCommunityIcons name="waveform" size={12} color="#000" />
                            : <Ionicons name="mic" size={12} color={isActive ? "#000" : themeColor} />
                          }
                        </View>
                        <Text style={[styles.storySource, { color: themeColor + "cc" }]}>OPENING · {report.anchor.showName}</Text>
                        {!isAutoPlaying && <Ionicons name="play-circle-outline" size={16} color="#444" style={{ marginLeft: "auto" }} />}
                      </View>
                      <View style={[styles.commentaryBox, isActive && { borderLeftColor: themeColor }]}>
                        <Text style={[styles.commentaryText, { fontStyle: "normal", color: isActive ? "#ddd" : "#888" }]}>{seg.commentary}</Text>
                      </View>
                      {isActive && (
                        <View style={[styles.chyron, { backgroundColor: themeColor }]}>
                          <Text style={styles.chyronText}>GOOD EVENING · {report.anchor.name.toUpperCase()}</Text>
                        </View>
                      )}
                    </Pressable>
                  </Animated.View>
                );
              }

              return (
                <Animated.View key={seg.index} entering={FadeInRight.delay(idx * 100).duration(400)}>
                  <Pressable
                    onPress={() => { if (!isAutoPlaying) { cancelRef.current = false; startAutoPlay(report.segments.slice(idx), report.anchor.themeColor); } }}
                    style={[styles.storyCard, isActive && { borderColor: themeColor, backgroundColor: themeColor + "11" }]}
                  >
                    {/* Story number + source */}
                    <View style={styles.storyMeta}>
                      <View style={[styles.storyNumBadge, { backgroundColor: isActive ? themeColor : "#222" }]}>
                        {isActive && playingAudio
                          ? <MaterialCommunityIcons name="waveform" size={12} color="#000" />
                          : <Text style={[styles.storyNum, { color: isActive ? "#000" : themeColor }]}>{seg.index}</Text>
                        }
                      </View>
                      <Text style={styles.storySource}>{seg.source}</Text>
                      {seg.url ? (
                        <Pressable onPress={() => Linking.openURL(seg.url)} style={styles.linkBtn}>
                          <Ionicons name="open-outline" size={12} color="#666" />
                        </Pressable>
                      ) : null}
                      {!isAutoPlaying && <Ionicons name="play-circle-outline" size={16} color="#444" style={{ marginLeft: "auto" }} />}
                    </View>

                    {/* Headline */}
                    <Text style={[styles.storyHeadline, isActive && { color: "#fff" }]}>{seg.headline}</Text>

                    {/* Commentary */}
                    <View style={[styles.commentaryBox, isActive && { borderLeftColor: themeColor }]}>
                      <Text style={styles.commentaryText}>{seg.commentary}</Text>
                    </View>

                    {/* Chyron stripe */}
                    {isActive && (
                      <View style={[styles.chyron, { backgroundColor: themeColor }]}>
                        <Text style={styles.chyronText}>{report.anchor.name.toUpperCase()} · {report.anchor.showName}</Text>
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}

            <View style={{ height: 32 }} />
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050508" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, paddingTop: Platform.OS === "web" ? 67 : 8, borderBottomWidth: 1, borderBottomColor: "#1a1a2e" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 15, fontWeight: "800", color: "#fff", letterSpacing: 2 },
  headerSub: { fontSize: 10, color: "#FF4444", letterSpacing: 1.5, marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: "#666", letterSpacing: 2, marginTop: 20, marginBottom: 10 },

  // Anchor selector
  anchorRow: { paddingBottom: 4, gap: 8, paddingRight: 16 },
  anchorChip: { alignItems: "center", width: 76, borderRadius: 12, borderWidth: 1.5, borderColor: "#222", padding: 8, backgroundColor: "#0d0d15" },
  anchorThumb: { width: 52, height: 52, borderRadius: 26, marginBottom: 6, borderWidth: 2, borderColor: "#333" },
  anchorThumbPlaceholder: { width: 52, height: 52, borderRadius: 26, marginBottom: 6, alignItems: "center", justifyContent: "center" },
  anchorChipName: { fontSize: 10, fontWeight: "600", color: "#999", textAlign: "center", lineHeight: 13 },
  anchorDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },

  // Anchor card
  anchorCard: { flexDirection: "row", backgroundColor: "#0d0d15", borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 4, gap: 14 },
  anchorCardLeft: {},
  anchorCardPortrait: { width: 72, height: 72, borderRadius: 36, borderWidth: 2 },
  anchorCardRight: { flex: 1, justifyContent: "center", gap: 4 },
  showNameBadge: { alignSelf: "flex-start", borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  showNameText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  anchorCardName: { fontSize: 16, fontWeight: "800", color: "#fff" },
  anchorCardBio: { fontSize: 12, color: "#777", fontStyle: "italic" },

  // Duration
  durationRow: { flexDirection: "row", gap: 10 },
  durationPill: { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: "#222", padding: 10, alignItems: "center", backgroundColor: "#0d0d15" },
  durationLabel: { fontSize: 13, fontWeight: "800", color: "#555", letterSpacing: 1 },
  durationDesc: { fontSize: 9, color: "#444", marginTop: 2, letterSpacing: 0.5 },

  // Broadcast button
  broadcastBtnWrap: { marginTop: 20, marginBottom: 4 },
  broadcastBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 2, borderRadius: 12, paddingVertical: 16, backgroundColor: "#0d0d15" },
  broadcastBtnText: { fontSize: 15, fontWeight: "900", letterSpacing: 2 },

  // Loading
  loadingCard: { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, fontWeight: "800", letterSpacing: 2 },
  loadingSubText: { fontSize: 12, color: "#555" },

  // On Air Banner
  onAirBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 24, marginBottom: 4 },
  onAirLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  onAirPortrait: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5 },
  onAirInfo: { flex: 1 },
  onAirShowName: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  onAirAnchorName: { fontSize: 16, fontWeight: "800", color: "#fff", marginTop: 1 },
  onAirDuration: { fontSize: 11, color: "#666", marginTop: 2 },
  onAirRight: { alignItems: "center", gap: 8 },
  liveTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  liveTagText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  stopBtn: { marginTop: 2 },

  // Intro card
  introCard: { borderRadius: 12, borderWidth: 1, borderColor: "#1a1a2e", backgroundColor: "#0a0a12", padding: 14, marginTop: 10 },
  // Story cards
  storyCard: { borderRadius: 12, borderWidth: 1, borderColor: "#1a1a2e", backgroundColor: "#0d0d15", padding: 14, marginTop: 10 },
  storyMeta: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  storyNumBadge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  storyNum: { fontSize: 11, fontWeight: "800" },
  storySource: { fontSize: 10, color: "#666", fontWeight: "600", letterSpacing: 0.5, flex: 1 },
  linkBtn: { padding: 4 },
  storyHeadline: { fontSize: 14, fontWeight: "700", color: "#ccc", lineHeight: 20, marginBottom: 10 },
  commentaryBox: { borderLeftWidth: 3, borderLeftColor: "#333", paddingLeft: 12 },
  commentaryText: { fontSize: 13, color: "#aaa", lineHeight: 20, fontStyle: "italic" },
  chyron: { marginTop: 10, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  chyronText: { fontSize: 9, fontWeight: "800", color: "#000", letterSpacing: 1 },
});
