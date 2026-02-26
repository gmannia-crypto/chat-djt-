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

function getZodiacSign(month: number, day: number): string {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
  return "Pisces";
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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

  const [firstName, setFirstName] = useState("");
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [birthDay, setBirthDay] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [fortune, setFortune] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const zodiacSign = birthMonth && birthDay
    ? getZodiacSign(birthMonth, parseInt(birthDay) || 1)
    : null;
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

  const canSubmit = firstName.trim().length > 0 && zodiacSign && selectedTopic;

  const handleGetFortune = async () => {
    if (!canSubmit) {
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
      const hdrs: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) hdrs["x-device-id"] = deviceId;
      const dobString = `${MONTHS[(birthMonth || 1) - 1]} ${birthDay}`;
      const res = await fetch(`${baseUrl}/api/fortune`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({ name: firstName.trim(), zodiac: zodiacSign, dob: dobString, topic: selectedTopic }),
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
        message: `\uD83D\uDD2E TRUMP'S FORTUNE PARLOR \uD83D\uDD2E\n\n${firstName}'s Fortune (${zodiacSign}) | ${selectedTopic}\n\n"${fortune}"\n\nGet your fortune at Chat DJT!`,
      });
    } catch {}
  };

  const handleNewFortune = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFortune(null);
    setFirstName("");
    setBirthMonth(null);
    setBirthDay("");
    setSelectedTopic(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <Video
        ref={videoRef}
        source={require("@/assets/trump-crystal-ball.mp4")}
        style={styles.videoBg}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        isLooping={false}
        isMuted={true}
      />
      <LinearGradient
        colors={["rgba(10,10,10,0.3)", "rgba(10,10,10,0.55)", "rgba(10,10,10,0.85)", Colors.background]}
        locations={[0, 0.3, 0.55, 0.75]}
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
        <Animated.View entering={FadeIn.duration(800)} style={styles.subtitleContainer}>
          <Animated.View style={[styles.videoGlow, glowAnimStyle]} />
          <Text style={styles.parlorSubtitle}>Trump sees all. Trump knows all.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <Text style={styles.sectionLabel}>YOUR FIRST NAME</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter your first name"
            placeholderTextColor={Colors.whiteMuted}
            style={styles.nameInput}
            maxLength={30}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(450).duration(500)}>
          <Text style={styles.sectionLabel}>DATE OF BIRTH</Text>
          <View style={styles.dobRow}>
            <Pressable
              onPress={() => setShowMonthPicker(!showMonthPicker)}
              style={[styles.dobField, styles.dobMonth]}
            >
              <Text style={[styles.dobFieldText, !birthMonth && { color: Colors.whiteMuted }]}>
                {birthMonth ? MONTHS[birthMonth - 1] : "Month"}
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.whiteMuted} />
            </Pressable>
            <TextInput
              value={birthDay}
              onChangeText={(t) => { const n = t.replace(/[^0-9]/g, ""); if (parseInt(n) <= 31 || n === "") setBirthDay(n); }}
              placeholder="Day"
              placeholderTextColor={Colors.whiteMuted}
              style={[styles.dobField, styles.dobDay]}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          {showMonthPicker && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.monthPicker}>
              {MONTHS.map((m, i) => (
                <Pressable
                  key={m}
                  onPress={() => { setBirthMonth(i + 1); setShowMonthPicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[styles.monthOption, birthMonth === i + 1 && styles.monthOptionSelected]}
                >
                  <Text style={[styles.monthOptionText, birthMonth === i + 1 && { color: "#C084FC" }]}>{m}</Text>
                </Pressable>
              ))}
            </Animated.View>
          )}
          {zodiacSign && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.zodiacBadge}>
              <Text style={styles.zodiacBadgeText}>{zodiacSign}</Text>
            </Animated.View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(500)}>
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
            disabled={loading || !canSubmit}
            style={({ pressed }) => [
              styles.fortuneButton,
              !canSubmit && styles.fortuneButtonDisabled,
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
  videoBg: {
    ...StyleSheet.absoluteFillObject,
    width: "100%" as any,
    height: "100%" as any,
  },
  subtitleContainer: {
    alignItems: "center",
    marginTop: 120,
    marginBottom: 24,
  },
  videoGlow: {
    position: "absolute",
    bottom: -5,
    width: 160,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#9333EA",
    ...Platform.select({
      web: { boxShadow: "0 0 40px rgba(147, 51, 234, 0.4)" },
      default: {},
    }),
  },
  parlorSubtitle: {
    fontSize: 16,
    color: Colors.white,
    fontStyle: "italic",
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.whiteMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 8,
  },
  nameInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.white,
    marginBottom: 20,
  },
  dobRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  dobField: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dobMonth: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dobDay: {
    flex: 1,
    fontSize: 16,
    color: Colors.white,
    textAlign: "center" as const,
  },
  dobFieldText: {
    fontSize: 16,
    color: Colors.white,
  },
  monthPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
    backgroundColor: "rgba(20,20,20,0.95)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  monthOptionSelected: {
    backgroundColor: "rgba(147, 51, 234, 0.2)",
  },
  monthOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.whiteDim,
  },
  zodiacBadge: {
    alignSelf: "flex-start" as const,
    backgroundColor: "rgba(147, 51, 234, 0.18)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(147, 51, 234, 0.4)",
  },
  zodiacBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#C084FC",
    letterSpacing: 0.5,
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
