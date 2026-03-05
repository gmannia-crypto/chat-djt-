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
import { router, useLocalSearchParams } from "expo-router";
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
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { shareContent } from "@/lib/track-share";
import { useTokens } from "@/lib/token-context";
import { Audio } from "expo-av";
import { playAudioFromResponse } from "@/lib/audio-helper";

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

type ChallengeData = {
  id: string;
  challenger_name: string;
  challenger_rating: number;
  challenger_comment: string | null;
};

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const { deviceId } = useTokens();

  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(true);
  const [challengeError, setChallengeError] = useState(false);

  const [rating, setRating] = useState(50);
  const [displayName, setDisplayName] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [trumpResponse, setTrumpResponse] = useState<{
    text: string;
    mood: string;
    rating: number;
  } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

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
    fetchChallenge();
  }, []);

  async function fetchChallenge() {
    try {
      setChallengeLoading(true);
      const apiUrl = getApiUrl().replace(/\/$/, "");
      const res = await fetch(`${apiUrl}/api/challenge/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setChallenge(data);
    } catch {
      setChallengeError(true);
    } finally {
      setChallengeLoading(false);
    }
  }

  const submitPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleSliderPress = useCallback((pageX: number) => {
    const layout = sliderLayoutRef.current;
    const relX = pageX - layout.x;
    const pct = Math.max(0, Math.min(100, Math.round((relX / layout.width) * 100)));
    setRating(pct);
    Haptics.selectionAsync();
  }, []);

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
      setRevealed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleSpeak(data.text, data.mood);
    } catch (err) {
      console.error("Challenge rate error:", err);
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
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const ttsRes = await globalThis.fetch(`${getApiUrl()}api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mood }),
      });
      if (!ttsRes.ok) { setSpeaking(false); return; }
      const sound = await playAudioFromResponse(ttsRes);
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) setSpeaking(false);
      });
    } catch { setSpeaking(false); }
  }

  function handleShare() {
    if (!trumpResponse || !challenge) return;
    const myEmoji = getEmojiForRating(trumpResponse.rating);
    const theirEmoji = getEmojiForRating(challenge.challenger_rating);
    shareContent({
      text: `${theirEmoji.emoji} @${challenge.challenger_name} rated Trump ${challenge.challenger_rating}%\n${myEmoji.emoji} I rated Trump ${trumpResponse.rating}%\n\nWho's right? Rate him yourself \u{1F447}\nchat-djt.replit.app`,
      feature: "rate_trump_challenge_response",
      deviceId: deviceId || undefined,
    });
  }

  useEffect(() => {
    return () => { if (soundRef.current) soundRef.current.unloadAsync(); };
  }, []);

  const currentEmoji = getEmojiForRating(rating);
  const gradientColors = getGradientForRating(rating);
  const thumbColor = getSliderTrackGradient(rating);
  const thumbLeft = (rating / 100) * sliderWidth;

  if (challengeLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top + webTopInset }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.loadingLabel}>Loading challenge...</Text>
      </View>
    );
  }

  if (challengeError || !challenge) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top + webTopInset }]}>
        <Ionicons name="alert-circle" size={48} color="#FF4444" />
        <Text style={styles.errorTitle}>Challenge Not Found</Text>
        <Text style={styles.errorSub}>This challenge link may have expired or doesn't exist.</Text>
        <Pressable onPress={() => router.replace("/")} style={styles.goHomeButton}>
          <Text style={styles.goHomeText}>GO HOME</Text>
        </Pressable>
      </View>
    );
  }

  const challengerEmoji = getEmojiForRating(challenge.challenger_rating);
  const diff = trumpResponse ? trumpResponse.rating - challenge.challenger_rating : 0;

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
        <Text style={styles.headerTitle}>CHALLENGE</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeIn.duration(500)} style={styles.challengeCard}>
          <LinearGradient
            colors={["rgba(255, 107, 53, 0.15)", "rgba(255, 68, 68, 0.05)"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={styles.challengeEmoji}>{"\u{1F91C}\u{1F91B}"}</Text>
          <Text style={styles.challengeTitle}>YOU'VE BEEN CHALLENGED!</Text>
          <Text style={styles.challengeSubtitle}>
            @{challenge.challenger_name} rated Trump and dares you to do the same
          </Text>
          {!revealed && (
            <View style={styles.hiddenRating}>
              <Ionicons name="lock-closed" size={16} color={Colors.gold} />
              <Text style={styles.hiddenRatingText}>Their rating will be revealed after you vote</Text>
            </View>
          )}
        </Animated.View>

        {revealed && trumpResponse && (
          <Animated.View entering={FadeInDown.duration(600)} style={styles.comparisonCard}>
            <LinearGradient
              colors={["rgba(212, 164, 32, 0.12)", "rgba(212, 164, 32, 0.03)"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <Text style={styles.comparisonTitle}>{"\u{1F4CA}"} THE RESULTS ARE IN</Text>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonSide}>
                <Text style={styles.comparisonName}>@{challenge.challenger_name}</Text>
                <Text style={[styles.comparisonRating, { color: challengerEmoji.color }]}>
                  {challenge.challenger_rating}%
                </Text>
                <Text style={styles.comparisonLabel}>{challengerEmoji.emoji} {challengerEmoji.label}</Text>
              </View>
              <View style={styles.vsCircle}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <View style={styles.comparisonSide}>
                <Text style={styles.comparisonName}>YOU</Text>
                <Text style={[styles.comparisonRating, { color: currentEmoji.color }]}>
                  {trumpResponse.rating}%
                </Text>
                <Text style={styles.comparisonLabel}>{currentEmoji.emoji} {currentEmoji.label}</Text>
              </View>
            </View>
            <Text style={styles.diffText}>
              {diff === 0
                ? "\uD83E\uDD1D You both agree!"
                : diff > 0
                ? `\u{1F449} You rated ${Math.abs(diff)}% higher`
                : `\u{1F449} You rated ${Math.abs(diff)}% lower`}
            </Text>
          </Animated.View>
        )}

        {revealed && trumpResponse && (
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
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
                <Text style={[styles.responseMood, {
                  color: trumpResponse.mood === "FIRED_UP" ? "#FF4444" : Colors.gold,
                }]}>
                  {trumpResponse.mood === "FIRED_UP" ? "\uD83D\uDD25 FIRED UP" : "\uD83D\uDE0E CALM"}
                </Text>
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
                onPress={() => { if (trumpResponse) handleSpeak(trumpResponse.text, trumpResponse.mood); }}
                disabled={speaking}
                style={({ pressed }) => [styles.actionButton, styles.speakButton, pressed && { opacity: 0.7 }, speaking && { opacity: 0.5 }]}
              >
                <MaterialCommunityIcons name={speaking ? "volume-high" : "play"} size={18} color="#FFF" />
                <Text style={styles.actionButtonText}>{speaking ? "SPEAKING..." : "HEAR IT"}</Text>
              </Pressable>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [styles.actionButton, styles.shareButton, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="share-outline" size={18} color={Colors.gold} />
                <Text style={[styles.actionButtonText, { color: Colors.gold }]}>SHARE</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => router.replace("/rate-trump")}
              style={({ pressed }) => [styles.goRateButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="star" size={18} color={Colors.gold} />
              <Text style={styles.goRateText}>RATE TRUMP YOURSELF</Text>
            </Pressable>
          </Animated.View>
        )}

        {!revealed && (
          <Animated.View entering={FadeInUp.delay(200).duration(500)}>
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
                <View style={[styles.sliderThumb, { left: thumbLeft - 16, backgroundColor: thumbColor }]}>
                  <Text style={styles.thumbEmoji}>{currentEmoji.emoji}</Text>
                </View>
              </View>

              <View style={styles.ratingDisplay}>
                <Text style={[styles.ratingNumber, { color: currentEmoji.color }]}>{rating}</Text>
                <Text style={styles.ratingPercent}>%</Text>
              </View>
              <Text style={[styles.ratingLabel, { color: currentEmoji.color }]}>{currentEmoji.label}</Text>
            </View>

            <View style={styles.nicknameSection}>
              <Text style={styles.fieldLabel}>Your name (optional)</Text>
              <View style={styles.nicknameRow}>
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  style={styles.nicknameInput}
                  value={displayName}
                  onChangeText={(t) => setDisplayName(t.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
                  placeholder="YourName"
                  placeholderTextColor={Colors.whiteMuted}
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.commentSection}>
              <Text style={styles.fieldLabel}>Add a comment (optional)</Text>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Tell Trump why..."
                placeholderTextColor={Colors.whiteMuted}
                multiline
                maxLength={280}
                numberOfLines={2}
                textAlignVertical="top"
              />
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
                    <Text style={styles.submitText}>ACCEPT CHALLENGE</Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          </Animated.View>
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
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  loadingLabel: {
    fontSize: 15,
    color: Colors.whiteDim,
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FF4444",
    marginTop: 16,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  errorSub: {
    fontSize: 14,
    color: Colors.whiteDim,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  goHomeButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  goHomeText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1,
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
    color: "#FF6B35",
    letterSpacing: 2,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  challengeCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 53, 0.3)",
    overflow: "hidden",
    marginBottom: 24,
  },
  challengeEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  challengeTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FF6B35",
    textAlign: "center",
    letterSpacing: 1,
    fontFamily: "PlayfairDisplay_900Black",
    marginBottom: 8,
  },
  challengeSubtitle: {
    fontSize: 15,
    color: Colors.whiteDim,
    textAlign: "center",
    lineHeight: 22,
  },
  hiddenRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    backgroundColor: "rgba(212, 164, 32, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hiddenRatingText: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: "600",
  },
  comparisonCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.3)",
    overflow: "hidden",
    marginBottom: 20,
    alignItems: "center",
  },
  comparisonTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.gold,
    letterSpacing: 1,
    marginBottom: 16,
    fontFamily: "PlayfairDisplay_900Black",
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 16,
  },
  comparisonSide: {
    flex: 1,
    alignItems: "center",
  },
  comparisonName: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.whiteDim,
    marginBottom: 6,
  },
  comparisonRating: {
    fontSize: 36,
    fontWeight: "900",
    fontFamily: "PlayfairDisplay_900Black",
  },
  comparisonLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    color: Colors.whiteDim,
  },
  vsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 107, 53, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 53, 0.4)",
  },
  vsText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FF6B35",
  },
  diffText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.white,
    textAlign: "center",
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
  responseMood: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
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
    marginBottom: 16,
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
  goRateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  goRateText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.gold,
    letterSpacing: 1,
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
  nicknameSection: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 14,
    color: Colors.whiteDim,
    marginBottom: 10,
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
  commentSection: {
    marginBottom: 24,
  },
  commentInput: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    color: Colors.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 53, 0.25)",
    minHeight: 60,
    maxHeight: 100,
  },
  submitButton: {
    borderRadius: 50,
    overflow: "hidden",
    shadowColor: "#FF6B35",
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
});
