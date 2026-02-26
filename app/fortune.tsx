import React, { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  Share,
  Dimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Video, ResizeMode } from "expo-av";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";

const ZODIAC_SIGNS = [
  { name: "Aries", emoji: "\u2648", dates: "Mar 21 - Apr 19" },
  { name: "Taurus", emoji: "\u2649", dates: "Apr 20 - May 20" },
  { name: "Gemini", emoji: "\u264A", dates: "May 21 - Jun 20" },
  { name: "Cancer", emoji: "\u264B", dates: "Jun 21 - Jul 22" },
  { name: "Leo", emoji: "\u264C", dates: "Jul 23 - Aug 22" },
  { name: "Virgo", emoji: "\u264D", dates: "Aug 23 - Sep 22" },
  { name: "Libra", emoji: "\u264E", dates: "Sep 23 - Oct 22" },
  { name: "Scorpio", emoji: "\u264F", dates: "Oct 23 - Nov 21" },
  { name: "Sagittarius", emoji: "\u2650", dates: "Nov 22 - Dec 21" },
  { name: "Capricorn", emoji: "\u2651", dates: "Dec 22 - Jan 19" },
  { name: "Aquarius", emoji: "\u2652", dates: "Jan 20 - Feb 18" },
  { name: "Pisces", emoji: "\u2653", dates: "Feb 19 - Mar 20" },
];

const TOPICS = [
  { name: "Love Life", emoji: "\u2764\uFE0F", color: "#FF4D6D" },
  { name: "Career", emoji: "\uD83D\uDCBC", color: "#60A5FA" },
  { name: "Money", emoji: "\uD83D\uDCB0", color: Colors.gold },
  { name: "Family", emoji: "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66", color: "#34D399" },
  { name: "Health", emoji: "\uD83D\uDCAA", color: "#F472B6" },
  { name: "General Luck", emoji: "\uD83C\uDF40", color: "#A78BFA" },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function FortuneScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const { hasTokens, deviceId } = useTokens();

  const [selectedZodiac, setSelectedZodiac] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [fortune, setFortune] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const videoRef = useRef<Video>(null);

  const glowValue = useSharedValue(0.3);

  React.useEffect(() => {
    glowValue.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500 }),
        withTiming(0.3, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowValue.value,
  }));

  useFocusEffect(
    useCallback(() => {
      const playAndPause = async () => {
        if (!videoRef.current) return;
        try {
          await videoRef.current.setPositionAsync(0);
          await videoRef.current.playAsync();
          setTimeout(async () => {
            try {
              await videoRef.current?.pauseAsync();
            } catch {}
          }, 5000);
        } catch {}
      };
      playAndPause();
    }, [])
  );

  const handleGetFortune = async () => {
    if (!selectedZodiac || !selectedTopic) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!hasTokens) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.push("/subscribe");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);
    setFortune(null);

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) headers["x-device-id"] = deviceId;
      const res = await fetch(`${baseUrl}/api/fortune`, {
        method: "POST",
        headers,
        body: JSON.stringify({ zodiac: selectedZodiac, topic: selectedTopic }),
      });

      if (!res.ok) throw new Error("Fortune failed");
      const data = await res.json();
      setFortune(data.fortune);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    } catch (err) {
      setFortune("The spirits are confused... even Trump couldn't see this one coming. Try again!");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!fortune) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `\uD83D\uDD2E TRUMP'S FORTUNE PARLOR \uD83D\uDD2E\n\n${selectedZodiac} | ${selectedTopic}\n\n"${fortune}"\n\nGet your fortune at Chat DJT!`,
      });
    } catch {}
  };

  const handleNewFortune = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFortune(null);
    setSelectedZodiac(null);
    setSelectedTopic(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient
        colors={["rgba(128, 0, 128, 0.08)", Colors.background, "rgba(128, 0, 128, 0.05)"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          hitSlop={12}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>{"\uD83D\uDD2E"} FORTUNE PARLOR</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(800)} style={styles.crystalBallContainer}>
          <Animated.View style={[styles.videoGlow, glowAnimStyle]} />
          <View style={styles.videoWrapper}>
            <Video
              ref={videoRef}
              source={require("@/assets/trump-crystal-ball.mp4")}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
              isLooping={false}
              isMuted={true}
            />
          </View>
          <Text style={styles.parlorSubtitle}>Trump sees all. Trump knows all.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <Text style={styles.sectionLabel}>YOUR ZODIAC SIGN</Text>
          <View style={styles.zodiacGrid}>
            {ZODIAC_SIGNS.map((sign) => (
              <Pressable
                key={sign.name}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedZodiac(sign.name); }}
                style={[
                  styles.zodiacChip,
                  selectedZodiac === sign.name && styles.zodiacChipSelected,
                ]}
              >
                <Text style={styles.zodiacEmoji}>{sign.emoji}</Text>
                <Text style={[
                  styles.zodiacName,
                  selectedZodiac === sign.name && styles.zodiacNameSelected,
                ]}>{sign.name}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(500)}>
          <Text style={styles.sectionLabel}>WHAT DO YOU WANT TO KNOW?</Text>
          <View style={styles.topicGrid}>
            {TOPICS.map((topic) => (
              <Pressable
                key={topic.name}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedTopic(topic.name); }}
                style={[
                  styles.topicChip,
                  selectedTopic === topic.name && { borderColor: topic.color, backgroundColor: `${topic.color}20` },
                ]}
              >
                <Text style={styles.topicEmoji}>{topic.emoji}</Text>
                <Text style={[
                  styles.topicName,
                  selectedTopic === topic.name && { color: topic.color },
                ]}>{topic.name}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(700).duration(500)} style={styles.buttonContainer}>
          <Pressable
            onPress={handleGetFortune}
            disabled={loading || !selectedZodiac || !selectedTopic}
            style={({ pressed }) => [
              styles.fortuneButton,
              (!selectedZodiac || !selectedTopic) && styles.fortuneButtonDisabled,
              pressed && { opacity: 0.8 },
            ]}
          >
            <LinearGradient
              colors={loading ? ["#666", "#444"] : ["#9333EA", "#7C3AED", "#6D28D9"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.fortuneButtonText}>CONSULTING THE SPIRITS...</Text>
              </View>
            ) : (
              <Text style={styles.fortuneButtonText}>{"\uD83D\uDD2E"} SEE YOUR FUTURE</Text>
            )}
          </Pressable>
        </Animated.View>

        {fortune && (
          <Animated.View entering={FadeInUp.duration(600)} style={styles.fortuneResultCard}>
            <LinearGradient
              colors={["rgba(147, 51, 234, 0.15)", "rgba(109, 40, 217, 0.08)"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={styles.fortuneLabel}>{"\uD83D\uDD2E"} TRUMP PREDICTS:</Text>
            <Text style={styles.fortuneText}>"{fortune}"</Text>

            <View style={styles.fortuneActions}>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [styles.fortuneActionButton, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="share-outline" size={16} color="#9333EA" />
                <Text style={styles.fortuneActionText}>SHARE</Text>
              </Pressable>
              <Pressable
                onPress={handleNewFortune}
                style={({ pressed }) => [styles.fortuneActionButton, styles.newFortuneButton, pressed && { opacity: 0.7 }]}
              >
                <MaterialCommunityIcons name="crystal-ball" size={16} color="#fff" />
                <Text style={[styles.fortuneActionText, { color: "#fff" }]}>NEW FORTUNE</Text>
              </Pressable>
            </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#9333EA",
    letterSpacing: 1.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  crystalBallContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 24,
  },
  videoGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#9333EA",
    top: -10,
    ...Platform.select({
      web: { boxShadow: "0 0 80px rgba(147, 51, 234, 0.5)" },
      default: {},
    }),
  },
  videoWrapper: {
    width: 220,
    height: 220,
    borderRadius: 110,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(147, 51, 234, 0.6)",
    backgroundColor: "#000",
  },
  video: {
    width: 220,
    height: 220,
  },
  parlorSubtitle: {
    fontSize: 14,
    color: Colors.whiteDim,
    fontStyle: "italic",
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.whiteMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 8,
  },
  zodiacGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  zodiacChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  zodiacChipSelected: {
    borderColor: "#9333EA",
    backgroundColor: "rgba(147, 51, 234, 0.18)",
  },
  zodiacEmoji: {
    fontSize: 16,
  },
  zodiacName: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.whiteDim,
  },
  zodiacNameSelected: {
    color: "#C084FC",
  },
  topicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 28,
  },
  topicChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    minWidth: (SCREEN_WIDTH - 60) / 2,
  },
  topicEmoji: {
    fontSize: 18,
  },
  topicName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.whiteDim,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  fortuneButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fortuneButtonDisabled: {
    opacity: 0.4,
  },
  fortuneButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fortuneResultCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(147, 51, 234, 0.4)",
    overflow: "hidden",
    marginBottom: 20,
  },
  fortuneLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#9333EA",
    letterSpacing: 1,
    marginBottom: 12,
  },
  fortuneText: {
    fontSize: 17,
    color: Colors.white,
    lineHeight: 26,
    fontStyle: "italic",
  },
  fortuneActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  fortuneActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(147, 51, 234, 0.4)",
    backgroundColor: "rgba(147, 51, 234, 0.1)",
  },
  fortuneActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9333EA",
    letterSpacing: 0.5,
  },
  newFortuneButton: {
    backgroundColor: "#9333EA",
    borderColor: "#9333EA",
  },
});
