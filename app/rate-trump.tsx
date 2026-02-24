import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { shareContent } from "@/lib/track-share";
import { useTokens } from "@/lib/token-context";
import { Audio } from "expo-av";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const EMOJI_LABELS = [
  { emoji: "\u274C", label: "TERRIBLE", color: "#FF4444" },
  { emoji: "\uD83D\uDE20", label: "BAD", color: "#FF6B35" },
  { emoji: "\uD83E\uDD37", label: "MEH", color: "#FFD700" },
  { emoji: "\uD83D\uDC4D", label: "GOOD", color: "#90EE90" },
  { emoji: "\uD83D\uDD25", label: "YUGE", color: "#4DFF4D" },
];

function getEmojiForRating(rating: number) {
  if (rating <= 20) return EMOJI_LABELS[0];
  if (rating <= 40) return EMOJI_LABELS[1];
  if (rating <= 60) return EMOJI_LABELS[2];
  if (rating <= 80) return EMOJI_LABELS[3];
  return EMOJI_LABELS[4];
}

function getGradientForRating(rating: number): [string, string] {
  if (rating <= 25) return ["#FF4444", "#CC0000"];
  if (rating <= 50) return ["#FF6B35", "#CC4400"];
  if (rating <= 75) return ["#FFD700", "#B8960F"];
  return ["#4DFF4D", "#00CC00"];
}

function getSliderTrackGradient(rating: number): string {
  const r = rating <= 50 ? 255 : Math.round(255 - ((rating - 50) / 50) * 205);
  const g = rating >= 50 ? 255 : Math.round((rating / 50) * 205 + 50);
  return `rgb(${r}, ${g}, 50)`;
}

type LeaderboardEntry = {
  display_name: string;
  rating: number;
  comment: string | null;
};

type LeaderboardData = {
  supporters: LeaderboardEntry[];
  haters: LeaderboardEntry[];
  totalRatings: number;
};

export default function RateTrumpScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const { deviceId } = useTokens();

  const [rating, setRating] = useState(50);
  const [comment, setComment] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [trumpResponse, setTrumpResponse] = useState<{
    text: string;
    mood: string;
    rating: number;
  } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  const sliderWidth = SCREEN_WIDTH - 80;
  const sliderRef = useRef<View>(null);
  const sliderLayoutRef = useRef({ x: 0, width: sliderWidth });

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
    fetchLeaderboard();
  }, []);

  async function fetchLeaderboard() {
    try {
      setLeaderboardLoading(true);
      const apiUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${apiUrl}/api/rate-trump/leaderboard`);
      const data = await res.json();
      setLeaderboard(data);
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    } finally {
      setLeaderboardLoading(false);
    }
  }

  const submitPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleSliderPress = useCallback(
    (pageX: number) => {
      const layout = sliderLayoutRef.current;
      const relX = pageX - layout.x;
      const pct = Math.max(0, Math.min(100, Math.round((relX / layout.width) * 100)));
      setRating(pct);
      Haptics.selectionAsync();
    },
    []
  );

  async function handleSubmit() {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);
    setTrumpResponse(null);

    try {
      const apiUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${apiUrl}/api/rate-trump`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
          displayName: displayName.trim() || undefined,
          deviceId: deviceId || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTrumpResponse(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleSpeak(data.text, data.mood);
      fetchLeaderboard();
    } catch (err) {
      console.error("Rate Trump error:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSpeak(text: string, mood: string) {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setSpeaking(true);
      const ttsRes = await fetch(`${getApiUrl()}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mood }),
      });
      if (!ttsRes.ok) {
        setSpeaking(false);
        return;
      }
      const blob = await ttsRes.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const { sound } = await Audio.Sound.createAsync(
            { uri: `data:audio/mpeg;base64,${base64}` },
            { shouldPlay: true }
          );
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status) => {
            if ("didJustFinish" in status && status.didJustFinish) {
              setSpeaking(false);
            }
          });
        } catch {
          setSpeaking(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      setSpeaking(false);
    }
  }

  function handleShare() {
    if (!trumpResponse) return;
    const emojiInfo = getEmojiForRating(trumpResponse.rating);
    const shareText = `${emojiInfo.emoji} I rated Trump ${trumpResponse.rating}% and he said:\n\n"${trumpResponse.text.slice(0, 250)}${trumpResponse.text.length > 250 ? "..." : ""}"\n\nRate him yourself \u{1F447}\nchat-djt.replit.app`;
    shareContent({
      text: shareText,
      feature: "rate_trump",
      deviceId: deviceId || undefined,
    });
  }

  function handleRateAgain() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTrumpResponse(null);
    setComment("");
    setRating(50);
  }

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const currentEmoji = getEmojiForRating(rating);
  const gradientColors = getGradientForRating(rating);
  const thumbColor = getSliderTrackGradient(rating);
  const thumbLeft = (rating / 100) * sliderWidth;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          hitSlop={16}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>RATE TRUMP</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!trumpResponse ? (
          <Animated.View entering={FadeIn.duration(500)}>
            <View style={styles.titleCard}>
              <LinearGradient
                colors={["rgba(255, 77, 77, 0.12)", "rgba(255, 77, 77, 0.04)"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.pollEmoji}>{"\uD83D\uDCCA"}</Text>
              <Text style={styles.titleText}>RATE TRUMP'S PERFORMANCE</Text>
              <Text style={styles.subtitleText}>How's he doing so far? Be honest — he'll find out...</Text>
            </View>

            <View style={styles.sliderSection}>
              <View style={styles.sliderLabels}>
                <Text style={[styles.sliderLabel, { color: "#FF4444" }]}>{"\u274C"} TERRIBLE</Text>
                <Text style={[styles.sliderLabel, { color: "#FFD700" }]}>{"\uD83E\uDD37"} MEH</Text>
                <Text style={[styles.sliderLabel, { color: "#4DFF4D" }]}>{"\uD83D\uDD25"} YUGE</Text>
              </View>

              <View
                ref={sliderRef}
                style={styles.sliderTrack}
                onLayout={(e) => {
                  sliderRef.current?.measureInWindow((x, _y, w) => {
                    sliderLayoutRef.current = { x, width: w };
                  });
                }}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => handleSliderPress(e.nativeEvent.pageX)}
                onResponderMove={(e) => handleSliderPress(e.nativeEvent.pageX)}
              >
                <LinearGradient
                  colors={["#FF4444", "#FF6B35", "#FFD700", "#90EE90", "#4DFF4D"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sliderGradient}
                />
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      left: thumbLeft - 16,
                      backgroundColor: thumbColor,
                    },
                  ]}
                >
                  <Text style={styles.thumbEmoji}>{currentEmoji.emoji}</Text>
                </View>
              </View>

              <View style={styles.ratingDisplay}>
                <Text style={[styles.ratingNumber, { color: currentEmoji.color }]}>
                  {rating}
                </Text>
                <Text style={styles.ratingPercent}>%</Text>
              </View>
              <Text style={[styles.ratingLabel, { color: currentEmoji.color }]}>
                {currentEmoji.label}
              </Text>
            </View>

            <View style={styles.nicknameSection}>
              <Text style={styles.commentLabel}>
                Your name for the leaderboard (optional)
              </Text>
              <View style={styles.nicknameRow}>
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  style={styles.nicknameInput}
                  value={displayName}
                  onChangeText={(t) => setDisplayName(t.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
                  placeholder="MAGAMike"
                  placeholderTextColor={Colors.whiteMuted}
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>
                Want to add a comment? (Trump might respond to it...)
              </Text>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Tell him why you rated that way..."
                placeholderTextColor={Colors.whiteMuted}
                multiline
                maxLength={280}
                numberOfLines={2}
                textAlignVertical="top"
              />
              {comment.length > 0 && (
                <Text style={styles.charCount}>{comment.length}/280</Text>
              )}
            </View>

            <Animated.View style={submitPulseStyle}>
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                ]}
              >
                <LinearGradient
                  colors={loading ? ["#666", "#444"] : (gradientColors as [string, string])}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                {loading ? (
                  <View style={styles.submitInner}>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.submitText}>TRUMP IS READING...</Text>
                  </View>
                ) : (
                  <View style={styles.submitInner}>
                    <Text style={styles.submitEmoji}>{"\uD83D\uDDF3\uFE0F"}</Text>
                    <Text style={styles.submitText}>SUBMIT MY RATING — LET TRUMP RESPOND</Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(600)}>
            <View style={styles.responseHeader}>
              <View style={styles.responseRatingBadge}>
                <Text style={styles.responseRatingText}>
                  You rated: {trumpResponse.rating}%
                </Text>
              </View>
              <Text style={[styles.responseMood, {
                color: trumpResponse.mood === "FIRED_UP" ? "#FF4444" : Colors.gold,
              }]}>
                {trumpResponse.mood === "FIRED_UP" ? "\uD83D\uDD25 FIRED UP" : "\uD83D\uDE0E CALM"}
              </Text>
            </View>

            <View style={styles.responseCard}>
              <LinearGradient
                colors={
                  trumpResponse.mood === "FIRED_UP"
                    ? ["rgba(255, 68, 68, 0.1)", "rgba(255, 68, 68, 0.03)"]
                    : ["rgba(212, 164, 32, 0.1)", "rgba(212, 164, 32, 0.03)"]
                }
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              />
              <View style={styles.responseAvatarRow}>
                <Image
                  source={require("@/assets/images/trump-avatar.jpg")}
                  style={styles.responseAvatar}
                />
                {speaking && (
                  <View style={styles.speakingBadge}>
                    <MaterialCommunityIcons name="volume-high" size={14} color="#FFF" />
                  </View>
                )}
              </View>
              <Text style={styles.responseText}>{trumpResponse.text}</Text>
            </View>

            <View style={styles.responseActions}>
              <Pressable
                onPress={() => {
                  if (trumpResponse) handleSpeak(trumpResponse.text, trumpResponse.mood);
                }}
                disabled={speaking}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.speakButton,
                  pressed && { opacity: 0.7 },
                  speaking && { opacity: 0.5 },
                ]}
              >
                <MaterialCommunityIcons
                  name={speaking ? "volume-high" : "play"}
                  size={18}
                  color="#FFF"
                />
                <Text style={styles.actionButtonText}>
                  {speaking ? "SPEAKING..." : "HEAR IT"}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.shareButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="share-outline" size={18} color={Colors.gold} />
                <Text style={[styles.actionButtonText, { color: Colors.gold }]}>SHARE</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleRateAgain}
              style={({ pressed }) => [
                styles.rateAgainButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="refresh" size={18} color={Colors.whiteDim} />
              <Text style={styles.rateAgainText}>RATE AGAIN</Text>
            </Pressable>
          </Animated.View>
        )}

        {leaderboard && (leaderboard.supporters.length > 0 || leaderboard.haters.length > 0) && (
          <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.leaderboardSection}>
            <View style={styles.leaderboardHeader}>
              <Text style={styles.leaderboardTitle}>{"\uD83C\uDFC6"} BIGGEST FANS & HATERS {"\uD83C\uDFC6"}</Text>
              {leaderboard.totalRatings > 0 && (
                <Text style={styles.totalRatings}>{leaderboard.totalRatings} total ratings</Text>
              )}
            </View>

            <View style={styles.leaderboardColumns}>
              <View style={styles.leaderboardColumn}>
                <View style={styles.columnHeader}>
                  <Text style={styles.columnHeaderText}>{"\uD83D\uDD25"} TOP SUPPORTERS</Text>
                </View>
                {leaderboard.supporters.length === 0 ? (
                  <Text style={styles.emptyText}>No supporters yet</Text>
                ) : (
                  leaderboard.supporters.map((entry, i) => (
                    <View key={`s-${i}`} style={styles.leaderboardRow}>
                      <Text style={styles.rankText}>{i + 1}.</Text>
                      <View style={styles.entryInfo}>
                        <Text style={styles.entryName} numberOfLines={1}>@{entry.display_name}</Text>
                        <Text style={[styles.entryRating, { color: "#4DFF4D" }]}>{entry.rating}%</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.leaderboardColumn}>
                <View style={[styles.columnHeader, styles.columnHeaderHaters]}>
                  <Text style={styles.columnHeaderText}>{"\u274C"} TOP HATERS</Text>
                </View>
                {leaderboard.haters.length === 0 ? (
                  <Text style={styles.emptyText}>No haters yet</Text>
                ) : (
                  leaderboard.haters.map((entry, i) => (
                    <View key={`h-${i}`} style={styles.leaderboardRow}>
                      <Text style={styles.rankText}>{i + 1}.</Text>
                      <View style={styles.entryInfo}>
                        <Text style={styles.entryName} numberOfLines={1}>@{entry.display_name}</Text>
                        <Text style={[styles.entryRating, { color: "#FF4444" }]}>{entry.rating}%</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {leaderboardLoading && (
          <View style={styles.leaderboardLoading}>
            <ActivityIndicator size="small" color={Colors.gold} />
            <Text style={styles.loadingText}>Loading leaderboard...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FF4D4D",
    letterSpacing: 2,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  titleCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.3)",
    overflow: "hidden",
    marginBottom: 28,
  },
  pollEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  titleText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FF4D4D",
    textAlign: "center",
    letterSpacing: 1,
    fontFamily: "PlayfairDisplay_900Black",
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 15,
    color: Colors.whiteDim,
    textAlign: "center",
    lineHeight: 22,
  },
  sliderSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  sliderLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sliderTrack: {
    width: "100%",
    height: 44,
    justifyContent: "center",
    position: "relative",
  },
  sliderGradient: {
    height: 10,
    borderRadius: 5,
    width: "100%",
  },
  sliderThumb: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    top: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  thumbEmoji: {
    fontSize: 16,
  },
  ratingDisplay: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 16,
  },
  ratingNumber: {
    fontSize: 64,
    fontWeight: "900",
    fontFamily: "PlayfairDisplay_900Black",
    lineHeight: 68,
  },
  ratingPercent: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.whiteDim,
    marginBottom: 8,
    marginLeft: 2,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 3,
    marginTop: 4,
  },
  commentSection: {
    marginBottom: 24,
  },
  commentLabel: {
    fontSize: 14,
    color: Colors.whiteDim,
    marginBottom: 10,
  },
  commentInput: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    color: Colors.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.25)",
    minHeight: 60,
    maxHeight: 100,
  },
  charCount: {
    fontSize: 11,
    color: Colors.whiteMuted,
    textAlign: "right",
    marginTop: 4,
  },
  submitButton: {
    borderRadius: 50,
    overflow: "hidden",
    shadowColor: "#FF4D4D",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  submitInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  submitEmoji: {
    fontSize: 22,
  },
  submitText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 1,
  },
  responseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  responseRatingBadge: {
    backgroundColor: "rgba(255, 77, 77, 0.15)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.3)",
  },
  responseRatingText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF4D4D",
  },
  responseMood: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
  responseCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.2)",
    overflow: "hidden",
    marginBottom: 16,
  },
  responseAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  responseAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  speakingBadge: {
    backgroundColor: "#FF4444",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  responseText: {
    fontSize: 16,
    color: Colors.white,
    lineHeight: 24,
  },
  responseActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
  },
  speakButton: {
    backgroundColor: "rgba(255, 68, 68, 0.15)",
    borderColor: "rgba(255, 68, 68, 0.4)",
  },
  shareButton: {
    backgroundColor: "rgba(212, 164, 32, 0.12)",
    borderColor: "rgba(212, 164, 32, 0.35)",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 1,
  },
  rateAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rateAgainText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.whiteDim,
    letterSpacing: 1,
  },
  nicknameSection: {
    marginBottom: 18,
  },
  nicknameRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.3)",
    paddingHorizontal: 14,
  },
  atSign: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.gold,
    marginRight: 4,
  },
  nicknameInput: {
    flex: 1,
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 12,
  },
  leaderboardSection: {
    marginTop: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.3)",
    overflow: "hidden",
    backgroundColor: "rgba(26, 26, 26, 0.8)",
  },
  leaderboardHeader: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 77, 77, 0.2)",
  },
  leaderboardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FF4D4D",
    letterSpacing: 1,
    textAlign: "center",
    fontFamily: "PlayfairDisplay_900Black",
  },
  totalRatings: {
    fontSize: 12,
    color: Colors.whiteMuted,
    marginTop: 4,
  },
  leaderboardColumns: {
    flexDirection: "row",
  },
  leaderboardColumn: {
    flex: 1,
    padding: 12,
  },
  columnHeader: {
    backgroundColor: "rgba(77, 255, 77, 0.1)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  columnHeaderHaters: {
    backgroundColor: "rgba(255, 68, 68, 0.1)",
  },
  columnHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.white,
    letterSpacing: 1,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 6,
  },
  rankText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.whiteMuted,
    width: 18,
  },
  entryInfo: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryName: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.white,
    flex: 1,
  },
  entryRating: {
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 4,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.whiteMuted,
    textAlign: "center",
    paddingVertical: 12,
    fontStyle: "italic",
  },
  leaderboardLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.whiteMuted,
  },
});
