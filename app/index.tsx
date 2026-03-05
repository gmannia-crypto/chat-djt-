import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  Alert,
  Image,
  Modal,
  Dimensions,
  ScrollView,
  AppState,
  TextInput,
  ActivityIndicator,
  Share,
  Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  withDelay,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";
import {
  Conversation,
  getAllConversations,
  createConversation,
  deleteConversation,
  Message,
} from "@/lib/chat-storage";

const FEEDBACK_SHOWN_KEY = "chatdjt_feedback_shown";
const FEEDBACK_CONV_COUNT_KEY = "chatdjt_conv_count";
const HOT_TAKE_CACHE_KEY = "chatdjt_hot_take_cache";
const STREAK_KEY = "chatdjt_streak";
const LAST_CHAT_DAY_KEY = "chatdjt_last_chat_day";
const MYSTERY_BOX_KEY = "chatdjt_mystery_box";

const MYSTERY_REWARDS = [
  { label: "Free Roast", icon: "flame", description: "Trump will personally roast you — for FREE. No tokens needed." },
  { label: "Double Fortune", icon: "crystal-ball", description: "Your next Fortune Parlor reading is DOUBLED. Twice the prophecy!" },
  { label: "Trump Stock Tip", icon: "trending-up", description: "An exclusive AI-generated stock hot take from the Don himself." },
  { label: "Property Discount", icon: "home", description: "VIP access to Trump Realty's top pick of the day. TREMENDOUS." },
  { label: "Cabinet Roast", icon: "people", description: "Unlock a bonus Cabinet Hot Seat roast. Savage and FREE." },
  { label: "Golden Tweet", icon: "logo-twitter", description: "Generate a viral Trump tweet on ANY topic. Pure gold." },
  { label: "Therapy Session", icon: "medical", description: "A free therapy session with Dr. Trump. Healing through WINNING." },
  { label: "VIP Fortune", icon: "star", description: "A rare PREMIUM fortune reading. Only winners get this." },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface NewsHeadline {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

function NewsCrawl({ headlines }: { headlines: NewsHeadline[] }) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const animationRef = useRef<number | null>(null);
  const contentWidth = useRef(0);
  const containerWidth = useRef(0);

  const crawlText = useMemo(() => {
    return headlines
      .map((h) => `${h.source.toUpperCase()}: ${h.title}`)
      .join("     \u2022     ");
  }, [headlines]);

  const isActiveRef = useRef(true);

  useEffect(() => {
    if (headlines.length === 0) return;

    let rafId: number;
    const speed = 0.7;

    function animate() {
      if (!isActiveRef.current) {
        rafId = requestAnimationFrame(animate);
        return;
      }
      scrollX.current += speed;
      if (contentWidth.current > 0 && scrollX.current >= contentWidth.current / 2) {
        scrollX.current = 0;
      }
      try {
        scrollRef.current?.scrollTo({ x: scrollX.current, animated: false });
      } catch {}
      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);
    animationRef.current = rafId;

    const appStateSub = AppState.addEventListener("change", (state) => {
      isActiveRef.current = state === "active";
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      appStateSub.remove();
    };
  }, [headlines]);

  if (headlines.length === 0) return null;

  const doubledText = `${crawlText}     \u2022     ${crawlText}`;

  return (
    <Animated.View entering={FadeIn.delay(600).duration(800)} style={styles.newsCrawlContainer}>
      <LinearGradient
        colors={["rgba(10, 8, 4, 0.85)", "rgba(15, 12, 6, 0.8)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.newsCrawlBadge}>
        <Text style={styles.newsCrawlBadgeText}>LIVE</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.newsCrawlScroll}
        onContentSizeChange={(w) => {
          contentWidth.current = w;
        }}
        onLayout={(e) => {
          containerWidth.current = e.nativeEvent.layout.width;
        }}
      >
        <Text style={styles.newsCrawlText}>{doubledText}</Text>
      </ScrollView>
    </Animated.View>
  );
}

function formatConversationForCopy(conv: Conversation): string {
  const header = `Chat DJT - ${conv.title}\n${new Date(conv.createdAt).toLocaleString()}\n${"─".repeat(40)}\n\n`;
  const body = conv.messages
    .map((m) => {
      const label = m.role === "user" ? "YOU" : "TRUMP";
      return `[${label}]: ${m.content}`;
    })
    .join("\n\n");
  return header + body;
}

function ConversationItem({
  item,
  index,
  onDelete,
  onCopy,
}: {
  item: Conversation;
  index: number;
  onDelete: (id: string) => void;
  onCopy: (conv: Conversation) => void;
}) {
  const lastMessage = item.messages[item.messages.length - 1];
  const preview = lastMessage
    ? lastMessage.content.slice(0, 80) + (lastMessage.content.length > 80 ? "..." : "")
    : "Start a tremendous conversation...";

  const timeAgo = getTimeAgo(item.updatedAt);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
      <Pressable
        style={({ pressed }) => [
          styles.conversationCard,
          pressed && styles.conversationCardPressed,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: "/chat/[id]", params: { id: item.id } });
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (Platform.OS === "web") {
            if (confirm("Delete this conversation?")) {
              onDelete(item.id);
            }
          } else {
            Alert.alert("Delete Chat", "Remove this tremendous conversation?", [
              { text: "Keep It", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => onDelete(item.id),
              },
            ]);
          }
        }}
        testID={`conversation-${item.id}`}
      >
        <View style={styles.conversationIcon}>
          <MaterialCommunityIcons name="crown" size={22} color={Colors.gold} />
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.conversationTime}>{timeAgo}</Text>
          </View>
          <Text style={styles.conversationPreview} numberOfLines={2}>
            {preview}
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onCopy(item);
          }}
          hitSlop={8}
          style={styles.copyButton}
          testID={`copy-conversation-${item.id}`}
        >
          <Ionicons name="copy-outline" size={18} color={Colors.gold} />
        </Pressable>
        <Feather name="chevron-right" size={18} color={Colors.whiteMuted} />
      </Pressable>
    </Animated.View>
  );
}

const ADMIN_PASSCODE = "Greatestofalltime";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archiveVisible, setArchiveVisible] = useState(false);
  const secretTapCount = useRef(0);
  const secretTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [passcodeVisible, setPasscodeVisible] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [hotTake, setHotTake] = useState<{ take: string; headline: string } | null>(null);
  const [hotTakeLoading, setHotTakeLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const [dailyChallenge, setDailyChallenge] = useState<string | null>(null);
  const [mysteryTimeLeft, setMysteryTimeLeft] = useState(0);
  const [mysteryReady, setMysteryReady] = useState(false);
  const [mysteryPrize, setMysteryPrize] = useState<typeof MYSTERY_REWARDS[0] | null>(null);
  const [mysteryRevealing, setMysteryRevealing] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<{ name: string; score: number; avatar: string; isYou?: boolean }[]>([]);
  const [fearGreed, setFearGreed] = useState<{ value: number; label: string; trumpComment: string } | null>(null);
  const [liveUsers, setLiveUsers] = useState(1247);
  const [activityFeed, setActivityFeed] = useState<string[]>([]);
  const [badges, setBadges] = useState<{ id: string; label: string; emoji: string; desc: string; earned: boolean }[]>([]);
  const [weeklyCountdown, setWeeklyCountdown] = useState({ days: 0, hours: 0, minutes: 0, isLive: false });
  const [weeklyReminder, setWeeklyReminder] = useState(false);
  const { deviceId, hasTokens } = useTokens();

  const pulseScale = useSharedValue(1);
  const pulseGlow = useSharedValue(0.4);

  React.useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
    pulseGlow.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 800 }),
        withTiming(0.4, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const pulseTherapyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    shadowOpacity: pulseGlow.value,
  }));

  const pulseFortuneStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    shadowOpacity: pulseGlow.value,
  }));

  function handleSecretTap() {
    secretTapCount.current += 1;
    if (secretTapTimer.current) clearTimeout(secretTapTimer.current);
    if (secretTapCount.current >= 5) {
      secretTapCount.current = 0;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setPasscodeInput("");
      setPasscodeError(false);
      setPasscodeVisible(true);
    } else {
      secretTapTimer.current = setTimeout(() => {
        secretTapCount.current = 0;
      }, 2000);
    }
  }

  function handlePasscodeSubmit() {
    if (passcodeInput === ADMIN_PASSCODE) {
      setPasscodeVisible(false);
      setPasscodeInput("");
      setPasscodeError(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push("/admin");
    } else {
      setPasscodeError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadConversations();
      checkFeedbackPrompt();
      updateStreak();
      fetchDailyChallenge();
      initMysteryBox();
      fetchLeaderboard();
      fetchFearGreed();
      loadBadges();
      checkWeeklyReminder();
    }, [])
  );

  function getNextSunday8pm(): Date {
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + daysUntilSunday);
    next.setUTCHours(20, 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 7);
    }
    return next;
  }

  useEffect(() => {
    function updateCountdown() {
      const now = Date.now();
      const target = getNextSunday8pm().getTime();
      const diff = target - now;
      if (diff <= 0) {
        setWeeklyCountdown({ days: 0, hours: 0, minutes: 0, isLive: true });
      } else {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setWeeklyCountdown({ days: d, hours: h, minutes: m, isLive: false });
      }
    }
    updateCountdown();
    const iv = setInterval(updateCountdown, 60000);
    return () => clearInterval(iv);
  }, []);

  async function checkWeeklyReminder() {
    try {
      const val = await AsyncStorage.getItem("chatdjt_weekly_reminder");
      setWeeklyReminder(val === "true");
    } catch {}
  }

  async function toggleWeeklyReminder() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = !weeklyReminder;
    setWeeklyReminder(next);
    await AsyncStorage.setItem("chatdjt_weekly_reminder", next ? "true" : "false");
    if (next) {
      Alert.alert("Reminder Set!", "We'll remind you when Trump's Weekly Address drops every Sunday at 8 PM EST.");
    }
  }

  async function loadBadges() {
    try {
      const [streakStr, convData, mysteryOpened, ratedData, fortuneData, propertyData] = await Promise.all([
        AsyncStorage.getItem("chatdjt_streak"),
        AsyncStorage.getItem("chatdjt_conversations"),
        AsyncStorage.getItem("chatdjt_mystery_opened"),
        AsyncStorage.getItem("chatdjt_rated_trump"),
        AsyncStorage.getItem("chatdjt_fortune_count"),
        AsyncStorage.getItem("chatdjt_property_analyses"),
      ]);

      const currentStreak = parseInt(streakStr || "0") || 0;
      let convCount = 0;
      try {
        const parsed = JSON.parse(convData || "[]");
        convCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {}
      const hasOpenedMystery = !!mysteryOpened;
      const hasRated = !!ratedData;
      const fortuneCount = parseInt(fortuneData || "0") || 0;
      const propertyCount = parseInt(propertyData || "0") || 0;

      setBadges([
        { id: "streak3", label: "3-Day Streak", emoji: "\uD83D\uDD25", desc: "Chat 3 days in a row", earned: currentStreak >= 3 },
        { id: "streak7", label: "7-Day Streak", emoji: "\uD83C\uDF1F", desc: "Chat 7 days in a row", earned: currentStreak >= 7 },
        { id: "streak30", label: "30-Day Legend", emoji: "\uD83D\uDC51", desc: "Chat 30 days in a row", earned: currentStreak >= 30 },
        { id: "first_chat", label: "First Chat", emoji: "\uD83D\uDCAC", desc: "Start your first conversation", earned: convCount >= 1 },
        { id: "chat5", label: "Regular", emoji: "\uD83C\uDFAF", desc: "Have 5 conversations", earned: convCount >= 5 },
        { id: "chat20", label: "Power User", emoji: "\u26A1", desc: "Have 20 conversations", earned: convCount >= 20 },
        { id: "fortune", label: "Fortune Teller", emoji: "\uD83D\uDD2E", desc: "Use Fortune Parlor 10 times", earned: fortuneCount >= 10 },
        { id: "property", label: "Property Mogul", emoji: "\uD83C\uDFE0", desc: "Analyze 5 properties", earned: propertyCount >= 5 },
        { id: "mystery", label: "Mystery Opener", emoji: "\uD83C\uDF81", desc: "Open a Mystery Box", earned: hasOpenedMystery },
        { id: "rated", label: "Rated Trump", emoji: "\uD83D\uDDF3\uFE0F", desc: "Rate Trump at least once", earned: hasRated },
        { id: "explorer", label: "Explorer", emoji: "\uD83E\uDDED", desc: "Try all app features", earned: convCount >= 5 && currentStreak >= 3 && fortuneCount >= 1 },
      ]);
    } catch {}
  }

  async function initMysteryBox() {
    try {
      const stored = await AsyncStorage.getItem(MYSTERY_BOX_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const elapsed = Math.floor((Date.now() - data.lockedAt) / 1000);
        const remaining = Math.max(0, 86400 - elapsed);
        if (remaining <= 0) {
          setMysteryReady(true);
          setMysteryTimeLeft(0);
        } else {
          setMysteryReady(false);
          setMysteryTimeLeft(remaining);
        }
      } else {
        const now = Date.now();
        await AsyncStorage.setItem(MYSTERY_BOX_KEY, JSON.stringify({ lockedAt: now }));
        setMysteryTimeLeft(86400);
        setMysteryReady(false);
      }
    } catch {}
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveUsers(1247 + Math.floor(Math.random() * 200) - 100);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const ACTIVITY_TEMPLATES = useMemo(() => [
    "@MAGAMike just got roasted by Trump",
    "@CryptoQueen predicted the future",
    "@PatriotPaul bought a property in Texas",
    "@Grandma rated Trump 94%",
    "@ElonFan challenged Trump to a debate",
    "@WallStreetWolf won a Financial Faceoff",
    "@TrumpLover45 opened a Mystery Box",
    "@BitcoinBro asked about Dogecoin",
    "@SilverSurfer got Grandma's advice",
    "@MuskFanboy debated on energy policy",
    "@GoldBug2024 checked the Fear & Greed Index",
    "@RealEstateKing searched properties in Miami",
    "@FreedomEagle started a therapy session",
    "@DiamondHands got Uncle Ruckus'd",
    "@BasedTrader used the mortgage calculator",
    "@AmericaFirst shared a Trump prophecy",
    "@StonksMaster beat Trump in Round 3",
    "@MAGAMom got Bernie Mac's take",
    "@CryptoKing explored Trump's Picks",
    "@PatriotPete rated Trump 100%",
  ], []);

  useEffect(() => {
    const initial = ACTIVITY_TEMPLATES.slice(0, 3);
    setActivityFeed(initial);
    const interval = setInterval(() => {
      const random = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
      setActivityFeed((prev) => {
        const next = [random, ...prev];
        return next.slice(0, 5);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [ACTIVITY_TEMPLATES]);

  useEffect(() => {
    if (mysteryReady || mysteryTimeLeft <= 0) return;
    const interval = setInterval(() => {
      setMysteryTimeLeft((prev) => {
        if (prev <= 1) {
          setMysteryReady(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mysteryReady, mysteryTimeLeft]);

  async function openMysteryBox() {
    if (!mysteryReady || mysteryRevealing) return;
    setMysteryRevealing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((r) => setTimeout(r, 1200));
    const prize = MYSTERY_REWARDS[Math.floor(Math.random() * MYSTERY_REWARDS.length)];
    setMysteryPrize(prize);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMysteryRevealing(false);
    setMysteryReady(false);
    setMysteryTimeLeft(86400);
    await AsyncStorage.setItem(MYSTERY_BOX_KEY, JSON.stringify({ lockedAt: Date.now() }));
    await AsyncStorage.setItem("chatdjt_mystery_opened", "true").catch(() => {});
  }

  function dismissMysteryPrize() {
    setMysteryPrize(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function fetchLeaderboard() {
    try {
      const baseUrl = getApiUrl();
      const res = await globalThis.fetch(`${baseUrl}api/rate-trump/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        const topUsers: { name: string; score: number; avatar: string; isYou?: boolean }[] = [];
        const avatars = ["\uD83C\uDDFA\uD83C\uDDF8", "\uD83D\uDC51", "\uD83D\uDD25", "\u2B50", "\uD83C\uDFC6", "\uD83E\uDD85", "\uD83D\uDCB0", "\uD83D\uDCAA"];
        if (data.supporters && data.supporters.length > 0) {
          data.supporters.slice(0, 5).forEach((s: any, i: number) => {
            topUsers.push({
              name: s.display_name ? `@${s.display_name.replace(/\s+/g, "")}` : `@User${i + 1}`,
              score: Math.round((s.rating / 100) * 15000 + Math.random() * 2000),
              avatar: avatars[i % avatars.length],
            });
          });
        }
        if (topUsers.length === 0) {
          topUsers.push(
            { name: "@MAGAMike", score: 15420, avatar: "\uD83C\uDDFA\uD83C\uDDF8" },
            { name: "@CryptoQueen", score: 13200, avatar: "\uD83D\uDC51" },
            { name: "@GrandmaLovesTrump", score: 9870, avatar: "\uD83D\uDC75" },
          );
        }
        topUsers.push({ name: "You", score: Math.round(streak * 500 + conversations.length * 200 + Math.random() * 1000), avatar: "\uD83D\uDC49", isYou: true });
        topUsers.sort((a, b) => b.score - a.score);
        setLeaderboardData(topUsers);
      }
    } catch {}
  }

  async function fetchFearGreed() {
    try {
      const res = await globalThis.fetch("https://api.alternative.me/fng/?limit=1");
      if (res.ok) {
        const data = await res.json();
        const value = parseInt(data.data?.[0]?.value) || 50;
        const label = data.data?.[0]?.value_classification || "Neutral";
        let trumpComment = "";
        if (value >= 75) {
          trumpComment = "GREEDY! Very smart! The market's HOT, just like my rallies! Buy MORE! Winners don't hesitate! Believe me!";
        } else if (value >= 50) {
          trumpComment = "Neutral? That's LOW ENERGY! Markets should be EXCITED! Like when I ring the NYSE bell — TREMENDOUS energy!";
        } else if (value >= 25) {
          trumpComment = "Fear in the market? PERFECT buying opportunity! I LOVE when people are scared — that's when the DEALS happen! Art of the Deal, baby!";
        } else {
          trumpComment = "EXTREME FEAR?! Everyone's panicking! You know what I do when everyone panics? I BUY EVERYTHING! That's how I became a BILLIONAIRE!";
        }
        setFearGreed({ value, label, trumpComment });
      }
    } catch {}
  }

  async function loadConversations() {
    const convs = await getAllConversations();
    setConversations(convs);
  }

  async function updateStreak() {
    try {
      const today = Math.floor(Date.now() / 86400000);
      const lastDayStr = await AsyncStorage.getItem(LAST_CHAT_DAY_KEY);
      const streakStr = await AsyncStorage.getItem(STREAK_KEY);
      const lastDay = lastDayStr ? parseInt(lastDayStr, 10) : 0;
      const currentStreak = streakStr ? parseInt(streakStr, 10) : 0;

      const convs = await getAllConversations();
      const hasChattedToday = convs.some(c => Math.floor(c.updatedAt / 86400000) === today && c.messages.length >= 2);

      if (hasChattedToday) {
        if (lastDay === today - 1 || lastDay === today) {
          const newStreak = lastDay === today ? currentStreak : currentStreak + 1;
          await AsyncStorage.setItem(STREAK_KEY, String(newStreak));
          await AsyncStorage.setItem(LAST_CHAT_DAY_KEY, String(today));
          setStreak(newStreak);
        } else if (lastDay < today - 1) {
          await AsyncStorage.setItem(STREAK_KEY, "1");
          await AsyncStorage.setItem(LAST_CHAT_DAY_KEY, String(today));
          setStreak(1);
        } else {
          setStreak(currentStreak);
        }
      } else {
        if (lastDay === today - 1) {
          setStreak(currentStreak);
        } else if (lastDay < today - 1) {
          setStreak(0);
        } else {
          setStreak(currentStreak);
        }
      }
    } catch {}
  }

  async function fetchDailyChallenge() {
    try {
      const baseUrl = getApiUrl();
      const res = await globalThis.fetch(`${baseUrl}api/daily-challenge`);
      if (res.ok) {
        const data = await res.json();
        setDailyChallenge(data.challenge);
      }
    } catch {}
  }

  async function checkFeedbackPrompt() {
    try {
      const alreadyShown = await AsyncStorage.getItem(FEEDBACK_SHOWN_KEY);
      if (alreadyShown) return;
      const countStr = await AsyncStorage.getItem(FEEDBACK_CONV_COUNT_KEY);
      const count = countStr ? parseInt(countStr, 10) : 0;
      const convs = await getAllConversations();
      const actualCount = convs.filter((c) => c.messages.length >= 2).length;
      if (actualCount > count) {
        await AsyncStorage.setItem(FEEDBACK_CONV_COUNT_KEY, String(actualCount));
      }
      if (actualCount >= 3) {
        setFeedbackVisible(true);
      }
    } catch {}
  }

  async function submitFeedback() {
    if (feedbackRating === 0) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await apiRequest("POST", "/api/feedback", {
        rating: feedbackRating,
        comment: feedbackComment.trim() || null,
        deviceId,
      });
      setFeedbackSubmitted(true);
      await AsyncStorage.setItem(FEEDBACK_SHOWN_KEY, "true");
      setTimeout(() => {
        setFeedbackVisible(false);
        setFeedbackSubmitted(false);
        setFeedbackRating(0);
        setFeedbackComment("");
      }, 2000);
    } catch {
      setFeedbackVisible(false);
      await AsyncStorage.setItem(FEEDBACK_SHOWN_KEY, "true");
    }
  }

  async function dismissFeedback() {
    setFeedbackVisible(false);
    await AsyncStorage.setItem(FEEDBACK_SHOWN_KEY, "true");
  }

  async function fetchHotTake(headlineText: string) {
    try {
      setHotTakeLoading(true);
      const cached = await AsyncStorage.getItem(HOT_TAKE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
          setHotTake({ take: parsed.take, headline: parsed.headline });
          setHotTakeLoading(false);
          return;
        }
      }

      const baseUrl = getApiUrl();
      const url = new URL("/api/hot-take", baseUrl);
      url.searchParams.set("headline", headlineText);
      const res = await globalThis.fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setHotTake(data);
        await AsyncStorage.setItem(HOT_TAKE_CACHE_KEY, JSON.stringify({
          ...data,
          timestamp: Date.now(),
        }));
      }
    } catch {
    } finally {
      setHotTakeLoading(false);
    }
  }

  async function handleNewChat() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const conv = await createConversation("New Chat");
    router.push({ pathname: "/chat/[id]", params: { id: conv.id } });
  }

  async function handleDailyChallenge() {
    if (!dailyChallenge) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const conv = await createConversation("Daily Challenge");
    router.push({ pathname: "/chat/[id]", params: { id: conv.id, mode: "challenge", challengeText: dailyChallenge } });
  }

  async function handleRoastMode() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const conv = await createConversation("Roast Session");
    router.push({ pathname: "/chat/[id]", params: { id: conv.id, mode: "roast" } });
  }

  async function handleDebateMode() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const conv = await createConversation("Debate Mode");
    router.push({ pathname: "/chat/[id]", params: { id: conv.id, mode: "debate" } });
  }

  async function handleLiveNewsMode() {
    if (!hasTokens) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.push("/subscribe");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const conv = await createConversation("LIVE News");
    router.push({ pathname: "/chat/[id]", params: { id: conv.id, mode: "livenews" } });
  }

  async function handleNostradamusMode() {
    if (!hasTokens) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.push("/subscribe");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const conv = await createConversation("Trump-adomas");
    router.push({ pathname: "/chat/[id]", params: { id: conv.id, mode: "nostradamus" } });
  }

  async function handleTruthSocialMode() {
    if (!hasTokens) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.push("/subscribe");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const conv = await createConversation("Truth Social");
    router.push({ pathname: "/chat/[id]", params: { id: conv.id, mode: "truthsocial" } });
  }

  async function handleDelete(id: string) {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleCopy(conv: Conversation) {
    try {
      const text = formatConversationForCopy(conv);
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (Platform.OS === "web") {
        alert("Conversation copied to clipboard!");
      } else {
        Alert.alert("Copied", "Conversation copied to clipboard. You can paste it anywhere.");
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const tickerQuery = useQuery<{
    trumpCoin: { price: number; change24h: number } | null;
    dowJones: { price: number; changePercent: number } | null;
    approval: { approve: number; disapprove: number | null } | null;
    nationalDebt: { amount: number; date: string } | null;
  }>({
    queryKey: ["/api/tickers"],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const newsQuery = useQuery<{ headlines: NewsHeadline[] }>({
    queryKey: ["/api/news"],
    refetchInterval: 3 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const tickers = tickerQuery.data;
  const headlines = newsQuery.data?.headlines ?? [];

  useEffect(() => {
    if (headlines.length > 0 && !hotTake && !hotTakeLoading) {
      const randomIdx = Math.floor(Math.random() * Math.min(headlines.length, 10));
      fetchHotTake(headlines[randomIdx].title);
    }
  }, [headlines.length]);

  function formatCompact(n: number): string {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toLocaleString()}`;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.woodFrameOuter}>
        <View style={styles.woodFrameInner}>
          <Image
            source={require("@/assets/images/djt-logo.png")}
            style={styles.backgroundLogo}
            resizeMode="cover"
          />
        </View>
      </View>
      <LinearGradient
        colors={["rgba(10, 10, 10, 0)", "rgba(10, 10, 10, 0)", "rgba(10, 10, 10, 0.4)"]}
        style={styles.backgroundOverlay}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Animated.View
        entering={FadeInUp.duration(600)}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              loadConversations();
              setArchiveVisible(true);
            }}
            style={styles.glossyHeaderBtn}
            testID="archive-button"
          >
            <View style={styles.glossyHeaderCircle}>
              <Ionicons name="folder-open" size={18} color="#1A1000" />
            </View>
            <Text style={styles.glossyHeaderLabel}>Archive</Text>
          </Pressable>
        </View>
        <Pressable onPress={handleSecretTap} style={styles.headerBrand}>
          <Text style={styles.headerBrandBy}>by</Text>
          <Image
            source={require("@/assets/images/dynamic-creations.jpg")}
            style={styles.headerBrandLogo}
            resizeMode="contain"
          />
        </Pressable>
        <View style={styles.liveUsersBadge}>
          <View style={styles.liveUsersDot} />
          <Text style={styles.liveUsersCount}>{liveUsers.toLocaleString()}</Text>
          <Text style={styles.liveUsersLabel}>live</Text>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.centerScroll}
        contentContainerStyle={styles.centerContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {streak > 0 && (
          <Animated.View entering={FadeIn.delay(400).duration(500)} style={styles.streakRow}>
            <View style={styles.streakBadge}>
              <MaterialCommunityIcons name="fire" size={16} color="#FF6B35" />
              <Text style={styles.streakText}>{streak} day streak</Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const msg = `I've used Chat DJT for ${streak} days in a row! \uD83D\uDD25 Can you beat my streak?`;
                if (Platform.OS === "web") {
                  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`;
                  Linking.openURL(tweetUrl);
                } else {
                  Share.share({ message: msg });
                }
              }}
              style={({ pressed }) => [styles.streakShareBtn, pressed && { opacity: 0.7 }]}
              testID="share-streak-btn"
            >
              <Ionicons name="share-outline" size={12} color="#FF6B35" />
              <Text style={styles.streakShareText}>SHARE</Text>
            </Pressable>
          </Animated.View>
        )}

        {hotTake && (
          <Animated.View entering={FadeIn.delay(800).duration(600)} style={styles.hotTakeBubble}>
            <View style={styles.hotTakeHeader}>
              <MaterialCommunityIcons name="crown" size={14} color={Colors.gold} />
              <Text style={styles.hotTakeLabel}>HOT TAKE</Text>
            </View>
            <Text style={styles.hotTakeText} numberOfLines={4}>"{hotTake.take}"</Text>
            <Text style={styles.hotTakeHeadline} numberOfLines={2}>Re: {hotTake.headline}</Text>
          </Animated.View>
        )}
        {hotTakeLoading && !hotTake && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.hotTakeBubble}>
            <ActivityIndicator size="small" color={Colors.gold} />
          </Animated.View>
        )}

        {activityFeed.length > 0 && (
          <Animated.View entering={FadeInDown.delay(850).duration(400)} style={styles.activityWall}>
            <View style={styles.activityHeader}>
              <Ionicons name="flash" size={14} color="#ff4d4d" />
              <Text style={styles.activityTitle}>LIVE ACTIVITY</Text>
            </View>
            {activityFeed.map((activity, i) => (
              <Animated.View
                key={`act-${i}-${activity}`}
                entering={FadeIn.duration(400)}
                style={[styles.activityItem, i === 0 && styles.activityItemNew]}
              >
                <Text style={styles.activityDot}>{i === 0 ? "\u26A1" : "\u2022"}</Text>
                <Text style={[styles.activityText, i === 0 && styles.activityTextNew]} numberOfLines={1}>{activity}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        {dailyChallenge && (
          <Animated.View entering={FadeInDown.delay(900).duration(500)}>
            <Pressable
              onPress={handleDailyChallenge}
              style={({ pressed }) => [styles.dailyChallengeCard, pressed && { opacity: 0.8 }]}
            >
              <View style={styles.dailyChallengeHeader}>
                <Ionicons name="flash" size={14} color="#FFD700" />
                <Text style={styles.dailyChallengeLabel}>DAILY CHALLENGE</Text>
              </View>
              <Text style={styles.dailyChallengeText} numberOfLines={2}>{dailyChallenge}</Text>
              <Text style={styles.dailyChallengeCta}>Tap to accept</Text>
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(920).duration(500)} style={styles.weeklyCard}>
          <LinearGradient
            colors={["rgba(255,215,0,0.08)", "rgba(255,77,77,0.06)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.weeklyGradient}
          >
            <View style={styles.weeklyHeader}>
              <MaterialCommunityIcons name="microphone-variant" size={18} color={Colors.gold} />
              <Text style={styles.weeklyTitle}>TRUMP'S WEEKLY ADDRESS</Text>
            </View>
            {weeklyCountdown.isLive ? (
              <View style={styles.weeklyLiveRow}>
                <View style={styles.weeklyLiveDot} />
                <Text style={styles.weeklyLiveText}>LIVE NOW</Text>
              </View>
            ) : (
              <View style={styles.weeklyCountdownRow}>
                <View style={styles.weeklyTimeBlock}>
                  <Text style={styles.weeklyTimeNum}>{weeklyCountdown.days}</Text>
                  <Text style={styles.weeklyTimeLabel}>DAYS</Text>
                </View>
                <Text style={styles.weeklyTimeSep}>:</Text>
                <View style={styles.weeklyTimeBlock}>
                  <Text style={styles.weeklyTimeNum}>{weeklyCountdown.hours}</Text>
                  <Text style={styles.weeklyTimeLabel}>HRS</Text>
                </View>
                <Text style={styles.weeklyTimeSep}>:</Text>
                <View style={styles.weeklyTimeBlock}>
                  <Text style={styles.weeklyTimeNum}>{weeklyCountdown.minutes}</Text>
                  <Text style={styles.weeklyTimeLabel}>MIN</Text>
                </View>
              </View>
            )}
            <Text style={styles.weeklySubtext}>Every Sunday at 8 PM EST</Text>
            <Pressable
              onPress={toggleWeeklyReminder}
              style={({ pressed }) => [styles.weeklyRemindBtn, weeklyReminder && styles.weeklyRemindBtnActive, pressed && { opacity: 0.7 }]}
              testID="weekly-remind-btn"
            >
              <Ionicons name={weeklyReminder ? "notifications" : "notifications-outline"} size={14} color={weeklyReminder ? "#0a0a0a" : Colors.gold} />
              <Text style={[styles.weeklyRemindText, weeklyReminder && styles.weeklyRemindTextActive]}>{weeklyReminder ? "REMINDED" : "REMIND ME"}</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(950).duration(500)}>
          <Pressable
            onPress={mysteryReady ? openMysteryBox : undefined}
            disabled={!mysteryReady || mysteryRevealing}
            style={({ pressed }) => [pressed && mysteryReady && { opacity: 0.85 }]}
          >
            <LinearGradient
              colors={mysteryReady ? ["#FFD700", "#b8860b", "#FFD700"] : ["#1a1a2e", "#16213e", "#1a1a2e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mysteryBoxCard}
            >
              <View style={styles.mysteryBoxHeader}>
                <Text style={styles.mysteryBoxEmoji}>{mysteryReady ? "\uD83C\uDF81" : "\uD83D\uDD12"}</Text>
                <View>
                  <Text style={[styles.mysteryBoxTitle, mysteryReady && { color: "#0a0a0a" }]}>MYSTERY BOX</Text>
                  <Text style={[styles.mysteryBoxSub, mysteryReady && { color: "#0a0a0a" }]}>
                    {mysteryRevealing ? "REVEALING..." : mysteryReady ? "TAP TO OPEN!" : `Opens in: ${Math.floor(mysteryTimeLeft / 3600)}h ${Math.floor((mysteryTimeLeft % 3600) / 60)}m ${mysteryTimeLeft % 60}s`}
                  </Text>
                </View>
                {mysteryRevealing && <ActivityIndicator size="small" color={mysteryReady ? "#0a0a0a" : "#FFD700"} style={{ marginLeft: "auto" }} />}
              </View>
              {!mysteryReady && (
                <View style={styles.mysteryProgressBar}>
                  <View style={[styles.mysteryProgressFill, { width: `${Math.max(0, ((86400 - mysteryTimeLeft) / 86400) * 100)}%` as any }]} />
                </View>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(950).duration(600)} style={styles.viralCtaRow}>
          <Animated.View style={pulseTherapyStyle}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                router.push("/therapy");
              }}
              style={({ pressed }) => [styles.viralCtaButton, styles.viralTherapy, pressed && { opacity: 0.85 }]}
              testID="viral-therapy-btn"
            >
              <LinearGradient
                colors={["#00C853", "#00E676", "#69F0AE"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.viralCtaGradient}
              >
                <MaterialCommunityIcons name="brain" size={22} color="#fff" />
                <Text style={styles.viralCtaText}>TRUMP THERAPY</Text>
                <View style={styles.viralCtaBadge}>
                  <Text style={styles.viralCtaBadgeText}>FREE</Text>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
          <Animated.View style={pulseFortuneStyle}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                router.push("/fortune");
              }}
              style={({ pressed }) => [styles.viralCtaButton, styles.viralFortune, pressed && { opacity: 0.85 }]}
              testID="viral-fortune-btn"
            >
              <LinearGradient
                colors={["#7C4DFF", "#B388FF", "#E040FB"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.viralCtaGradient}
              >
                <MaterialCommunityIcons name="crystal-ball" size={22} color="#fff" />
                <Text style={styles.viralCtaText}>FORTUNE PARLOR</Text>
                <View style={styles.viralCtaBadge}>
                  <Text style={styles.viralCtaBadgeText}>TRY</Text>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(1000).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={handleRoastMode}
            style={({ pressed }) => [styles.modeButton, styles.roastButton, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="fire" size={18} color="#FF4444" />
            <Text style={styles.modeButtonText}>ROAST ME</Text>
          </Pressable>
          <Pressable
            onPress={handleDebateMode}
            style={({ pressed }) => [styles.modeButton, styles.debateButton, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="podium" size={18} color={Colors.gold} />
            <Text style={styles.modeButtonText}>DEBATE</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(1100).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={handleLiveNewsMode}
            style={({ pressed }) => [styles.modeButton, styles.liveNewsButton, pressed && { opacity: 0.7 }]}
            testID="livenews-button"
          >
            <View style={styles.liveDot} />
            <Text style={styles.modeButtonText}>LIVE NEWS</Text>
          </Pressable>
          <Pressable
            onPress={handleNostradamusMode}
            style={({ pressed }) => [styles.modeButton, styles.nostradamusButton, pressed && { opacity: 0.7 }]}
            testID="nostradamus-button"
          >
            <Image
              source={require("@/assets/images/trumpadamus.jpeg")}
              style={{ width: 26, height: 26, borderRadius: 13 }}
            />
            <Text style={styles.modeButtonText}>PREDICT</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(1200).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={handleTruthSocialMode}
            style={({ pressed }) => [styles.modeButton, styles.truthSocialButton, pressed && { opacity: 0.7 }]}
            testID="truthsocial-button"
          >
            <Ionicons name="megaphone" size={16} color="#4A90D9" />
            <Text style={styles.modeButtonText}>TRUTH SOCIAL</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!hasTokens) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                router.push("/subscribe");
                return;
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/cabinet");
            }}
            style={({ pressed }) => [styles.modeButton, styles.cabinetButton, pressed && { opacity: 0.7 }]}
            testID="cabinet-button"
          >
            <Ionicons name="flame" size={16} color="#F97316" />
            <Text style={styles.modeButtonText}>HOT SEAT</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(1300).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/dashboard");
            }}
            style={({ pressed }) => [styles.modeButton, styles.dashboardButton, pressed && { opacity: 0.7 }]}
            testID="dashboard-button"
          >
            <Ionicons name="stats-chart" size={16} color="#60A5FA" />
            <Text style={styles.modeButtonText}>DASHBOARD</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/rate-trump");
            }}
            style={({ pressed }) => [styles.modeButton, styles.rateTrumpButton, pressed && { opacity: 0.7 }]}
            testID="rate-trump-button"
          >
            <MaterialCommunityIcons name="poll" size={16} color="#FF4D4D" />
            <Text style={styles.modeButtonText}>RATE HIM</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(1400).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/fortune");
            }}
            style={({ pressed }) => [styles.modeButton, styles.fortuneButton, pressed && { opacity: 0.7 }]}
            testID="fortune-button"
          >
            <MaterialCommunityIcons name="crystal-ball" size={16} color="#9333EA" />
            <Text style={styles.modeButtonText}>FORTUNE</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/therapy");
            }}
            style={({ pressed }) => [styles.modeButton, styles.therapyButton, pressed && { opacity: 0.7 }]}
            testID="therapy-button"
          >
            <MaterialCommunityIcons name="brain" size={16} color="#ff4d4d" />
            <Text style={styles.modeButtonText}>THERAPY</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(1500).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/real-estate");
            }}
            style={({ pressed }) => [styles.modeButton, styles.realEstateButton, pressed && { opacity: 0.7 }]}
            testID="real-estate-button"
          >
            <MaterialCommunityIcons name="office-building" size={16} color="#4ADE80" />
            <Text style={styles.modeButtonText}>REALTY</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/game");
            }}
            style={({ pressed }) => [styles.modeButton, styles.gameButton, pressed && { opacity: 0.7 }]}
            testID="game-button"
          >
            <MaterialCommunityIcons name="gamepad-variant" size={16} color="#FBBF24" />
            <Text style={styles.modeButtonText}>BILLIONAIRES</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(1600).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/faceoff");
            }}
            style={({ pressed }) => [styles.modeButton, styles.faceoffButton, pressed && { opacity: 0.7 }]}
            testID="faceoff-button"
          >
            <MaterialCommunityIcons name="sword-cross" size={16} color="#FF6B35" />
            <Text style={styles.modeButtonText}>FACEOFF</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/debate");
            }}
            style={({ pressed }) => [styles.modeButton, styles.debateButton, pressed && { opacity: 0.7 }]}
            testID="debate-button"
          >
            <Ionicons name="flash" size={16} color="#FF4D4D" />
            <Text style={styles.modeButtonText}>DEBATE</Text>
          </Pressable>
        </Animated.View>

        {fearGreed && (
          <Animated.View entering={FadeInDown.delay(1650).duration(500)} style={styles.fearGreedCard}>
            <View style={styles.fearGreedHeader}>
              <Ionicons name="trending-up" size={18} color={fearGreed.value >= 50 ? "#22c55e" : "#ef4444"} />
              <Text style={styles.fearGreedTitle}>CRYPTO FEAR & GREED</Text>
            </View>
            <View style={styles.fearGreedMeter}>
              <View style={styles.fearGreedBarBg}>
                <LinearGradient
                  colors={["#ef4444", "#f59e0b", "#22c55e"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.fearGreedBarFill, { width: `${fearGreed.value}%` } as any]}
                />
                <View style={[styles.fearGreedIndicator, { left: `${Math.min(fearGreed.value, 96)}%` } as any]}>
                  <Text style={styles.fearGreedIndicatorText}>{fearGreed.value}</Text>
                </View>
              </View>
              <View style={styles.fearGreedLabels}>
                <Text style={styles.fearGreedLabelLeft}>FEAR</Text>
                <Text style={[styles.fearGreedLabelCenter, { color: fearGreed.value >= 50 ? "#22c55e" : "#ef4444" }]}>{fearGreed.label.toUpperCase()}</Text>
                <Text style={styles.fearGreedLabelRight}>GREED</Text>
              </View>
            </View>
            <View style={styles.fearGreedQuote}>
              <MaterialCommunityIcons name="format-quote-open" size={14} color={Colors.gold} />
              <Text style={styles.fearGreedQuoteText}>{fearGreed.trumpComment}</Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const msg = `Crypto Fear & Greed Index: ${fearGreed.value}/100 (${fearGreed.label})\nTrump says: "${fearGreed.trumpComment}"`;
                if (Platform.OS === "web") {
                  Clipboard.setStringAsync(msg);
                  Alert.alert("Copied!", "Shared to clipboard");
                } else {
                  Share.share({ message: msg });
                }
              }}
              style={({ pressed }) => [styles.fearGreedShareBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="share-outline" size={13} color={Colors.gold} />
              <Text style={styles.fearGreedShareText}>SHARE</Text>
            </Pressable>
          </Animated.View>
        )}

        {leaderboardData.length > 0 && (
          <Animated.View entering={FadeInDown.delay(1700).duration(500)} style={styles.leaderboardCard}>
            <View style={styles.leaderboardHeader}>
              <Text style={styles.leaderboardEmoji}>{"\uD83C\uDFC6"}</Text>
              <Text style={styles.leaderboardTitle}>TOP TRUMP SCORES</Text>
            </View>
            {leaderboardData.map((user, i) => (
              <View key={`lb-${i}`} style={[styles.leaderboardRow, i === 0 && styles.leaderboardRowFirst, user.isYou && styles.leaderboardRowYou]}>
                <Text style={[styles.leaderboardRank, i === 0 && { color: "#FFD700" }]}>{i + 1}.</Text>
                <Text style={styles.leaderboardAvatar}>{user.avatar}</Text>
                <Text style={[styles.leaderboardName, user.isYou && { color: "#FFD700", fontWeight: "900" as const }]} numberOfLines={1}>{user.name}</Text>
                <Text style={[styles.leaderboardScore, i === 0 && { color: "#FFD700" }]}>{user.score.toLocaleString()}</Text>
              </View>
            ))}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                router.push("/rate-trump");
              }}
              style={({ pressed }) => [styles.leaderboardCta, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="people" size={14} color="#0a0a0a" />
              <Text style={styles.leaderboardCtaText}>CHALLENGE THE LEADER</Text>
            </Pressable>
          </Animated.View>
        )}

        {badges.length > 0 && (
          <Animated.View entering={FadeInDown.delay(1800).duration(500)} style={styles.badgesCard}>
            <View style={styles.badgesHeader}>
              <Text style={styles.badgesEmoji}>{"\uD83C\uDFC5"}</Text>
              <Text style={styles.badgesTitle}>YOUR BADGES</Text>
              <Text style={styles.badgesCount}>{badges.filter(b => b.earned).length}/{badges.length}</Text>
            </View>
            <View style={styles.badgesGrid}>
              {badges.map((badge) => (
                <View
                  key={badge.id}
                  style={[styles.badgeItem, badge.earned ? styles.badgeEarned : styles.badgeLocked]}
                >
                  <Text style={[styles.badgeEmoji, !badge.earned && styles.badgeEmojiLocked]}>{badge.emoji}</Text>
                  <Text style={[styles.badgeLabel, badge.earned && styles.badgeLabelEarned]} numberOfLines={1}>{badge.label}</Text>
                  <Text style={styles.badgeDesc} numberOfLines={1}>{badge.earned ? "Earned!" : badge.desc}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        <Text style={styles.legalDisclaimer}>
          Not affiliated with Donald J. Trump, The Trump Organization, or any political entity. For entertainment purposes only. Affiliate links generate commissions.
        </Text>
      </ScrollView>

      <View
        style={[
          styles.fabContainer,
          { bottom: insets.bottom + webBottomInset + 76 },
        ]}
      >
        <Pressable
          onPress={handleNewChat}
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed,
          ]}
          testID="new-chat-button"
        >
          <LinearGradient
            colors={[Colors.goldLight, Colors.gold, Colors.goldDark]}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="add" size={30} color={Colors.black} />
          </LinearGradient>
        </Pressable>
      </View>

      <Text style={styles.parodyFooter}>
        {"\uD83C\uDFAD"} AI PARODY {"\u2022"} NOT AFFILIATED WITH DONALD TRUMP {"\u2022"} FOR ENTERTAINMENT ONLY
      </Text>

      <View style={[styles.bottomBarContainer, { paddingBottom: insets.bottom + webBottomInset }]}>
        {headlines.length > 0 && <NewsCrawl headlines={headlines} />}

        {tickers && (
          <Animated.View entering={FadeIn.delay(400).duration(500)} style={styles.tickerContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tickerScroll}
            >
              {tickers.trumpCoin && (
                <View style={styles.tickerItem}>
                  <FontAwesome5 name="coins" size={11} color={Colors.gold} />
                  <Text style={styles.tickerLabel}>$TRUMP</Text>
                  <Text style={styles.tickerValue}>
                    ${tickers.trumpCoin.price < 1 ? tickers.trumpCoin.price.toFixed(4) : tickers.trumpCoin.price.toFixed(2)}
                  </Text>
                  {tickers.trumpCoin.change24h != null && (
                    <Text style={[styles.tickerChange, { color: tickers.trumpCoin.change24h >= 0 ? "#4ADE80" : "#F87171" }]}>
                      {tickers.trumpCoin.change24h >= 0 ? "+" : ""}{tickers.trumpCoin.change24h.toFixed(1)}%
                    </Text>
                  )}
                  <View style={styles.tickerDivider} />
                </View>
              )}

              {tickers.dowJones && (
                <View style={styles.tickerItem}>
                  <Feather name="trending-up" size={12} color={Colors.gold} />
                  <Text style={styles.tickerLabel}>DOW</Text>
                  <Text style={styles.tickerValue}>
                    {tickers.dowJones.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[styles.tickerChange, { color: tickers.dowJones.changePercent >= 0 ? "#4ADE80" : "#F87171" }]}>
                    {tickers.dowJones.changePercent >= 0 ? "+" : ""}{tickers.dowJones.changePercent.toFixed(2)}%
                  </Text>
                  <View style={styles.tickerDivider} />
                </View>
              )}

              {tickers.approval && (
                <View style={styles.tickerItem}>
                  <Ionicons name="thumbs-up" size={12} color={Colors.gold} />
                  <Text style={styles.tickerLabel}>APPROVE</Text>
                  <Text style={styles.tickerValue}>{tickers.approval.approve}%</Text>
                  {tickers.approval.disapprove != null && (
                    <Text style={[styles.tickerChange, { color: Colors.whiteMuted }]}>
                      / {tickers.approval.disapprove}%
                    </Text>
                  )}
                  <View style={styles.tickerDivider} />
                </View>
              )}

              {tickers.nationalDebt && (
                <View style={styles.tickerItem}>
                  <MaterialCommunityIcons name="bank" size={13} color={Colors.gold} />
                  <Text style={styles.tickerLabel}>DEBT</Text>
                  <Text style={styles.tickerValue}>
                    {formatCompact(tickers.nationalDebt.amount)}
                  </Text>
                </View>
              )}

              {!tickers.trumpCoin && !tickers.dowJones && !tickers.approval && !tickers.nationalDebt && (
                <Text style={styles.tickerLoading}>Loading market data...</Text>
              )}
            </ScrollView>
          </Animated.View>
        )}
      </View>

      <Modal
        visible={archiveVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setArchiveVisible(false)}
      >
        <View style={[styles.archiveContainer, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
          <View style={styles.archiveHeader}>
            <Text style={styles.archiveTitle}>Archive</Text>
            <Pressable
              onPress={() => setArchiveVisible(false)}
              style={styles.archiveCloseButton}
              testID="archive-close-button"
            >
              <Ionicons name="close" size={24} color={Colors.white} />
            </Pressable>
          </View>
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <ConversationItem item={item} index={index} onDelete={handleDelete} onCopy={handleCopy} />
            )}
            contentContainerStyle={[
              styles.archiveListContent,
              { paddingBottom: insets.bottom + webBottomInset + 20 },
            ]}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={Colors.goldDark} />
                <Text style={styles.emptyTitle}>No Chats Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start a new conversation and it will appear here.
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>

      <Modal
        visible={feedbackVisible}
        animationType="fade"
        transparent
        onRequestClose={dismissFeedback}
      >
        <Pressable style={styles.feedbackOverlay} onPress={dismissFeedback}>
          <Pressable style={styles.feedbackCard} onPress={() => {}}>
            {feedbackSubmitted ? (
              <View style={styles.feedbackSuccess}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.gold} />
                <Text style={styles.feedbackSuccessText}>Thanks for the feedback!</Text>
              </View>
            ) : (
              <>
                <MaterialCommunityIcons name="crown" size={28} color={Colors.gold} />
                <Text style={styles.feedbackTitle}>Rate Chat DJT</Text>
                <Text style={styles.feedbackSubtitle}>How's your experience been?</Text>
                <View style={styles.feedbackStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setFeedbackRating(star);
                      }}
                      hitSlop={4}
                    >
                      <Ionicons
                        name={feedbackRating >= star ? "star" : "star-outline"}
                        size={36}
                        color={feedbackRating >= star ? Colors.gold : Colors.whiteMuted}
                      />
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.feedbackInput}
                  placeholder="Tell Trump what you think... (optional)"
                  placeholderTextColor={Colors.whiteMuted}
                  value={feedbackComment}
                  onChangeText={setFeedbackComment}
                  multiline
                  maxLength={500}
                />
                <View style={styles.feedbackButtons}>
                  <Pressable onPress={dismissFeedback} style={styles.feedbackSkip}>
                    <Text style={styles.feedbackSkipText}>Not Now</Text>
                  </Pressable>
                  <Pressable
                    onPress={submitFeedback}
                    style={[styles.feedbackSubmit, feedbackRating === 0 && { opacity: 0.4 }]}
                    disabled={feedbackRating === 0}
                  >
                    <Text style={styles.feedbackSubmitText}>Submit</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={passcodeVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPasscodeVisible(false)}
      >
        <Pressable
          style={styles.passcodeOverlay}
          onPress={() => setPasscodeVisible(false)}
        >
          <Pressable style={styles.passcodeCard} onPress={() => {}}>
            <View style={styles.passcodeIconRow}>
              <MaterialCommunityIcons name="shield-lock" size={32} color={Colors.gold} />
            </View>
            <Text style={styles.passcodeTitle}>Enter Passcode</Text>
            <TextInput
              style={[
                styles.passcodeInput,
                passcodeError && styles.passcodeInputError,
              ]}
              value={passcodeInput}
              onChangeText={(t) => {
                setPasscodeInput(t);
                setPasscodeError(false);
              }}
              placeholder="Passcode"
              placeholderTextColor={Colors.whiteMuted}
              secureTextEntry
              autoFocus
              onSubmitEditing={handlePasscodeSubmit}
              returnKeyType="go"
            />
            {passcodeError && (
              <Text style={styles.passcodeErrorText}>Wrong passcode</Text>
            )}
            <Pressable
              onPress={handlePasscodeSubmit}
              style={({ pressed }) => [
                styles.passcodeSubmit,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.passcodeSubmitText}>Enter</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!mysteryPrize}
        animationType="fade"
        transparent
        onRequestClose={dismissMysteryPrize}
      >
        <Pressable style={styles.mysteryOverlay} onPress={dismissMysteryPrize}>
          <Pressable style={styles.mysteryPrizeCard} onPress={() => {}}>
            <LinearGradient
              colors={["#FFD700", "#b8860b", "#FFD700"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mysteryPrizeGradient}
            >
              <Text style={styles.mysteryPrizeEmoji}>{"\uD83C\uDF89"}</Text>
              <Text style={styles.mysteryPrizeTitle}>YOU WON!</Text>
              {mysteryPrize && (
                <>
                  <View style={styles.mysteryPrizeLabelRow}>
                    <Ionicons name={mysteryPrize.icon as any} size={22} color="#0a0a0a" />
                    <Text style={styles.mysteryPrizeLabelText}>{mysteryPrize.label}</Text>
                  </View>
                  <Text style={styles.mysteryPrizeDesc}>{mysteryPrize.description}</Text>
                </>
              )}
              <Pressable onPress={dismissMysteryPrize} style={styles.mysteryPrizeDismiss}>
                <Text style={styles.mysteryPrizeDismissText}>CLAIM & CLOSE</Text>
              </Pressable>
              <Text style={styles.mysteryPrizeTimer}>Next box in 24 hours</Text>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  woodFrameOuter: {
    position: "absolute",
    top: "10%",
    left: "10%",
    right: "10%",
    bottom: "25%",
    borderRadius: 12,
    borderWidth: 6,
    borderColor: "#3B2415",
    backgroundColor: "#1E0F07",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 20,
    overflow: "hidden",
  },
  woodFrameInner: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#5C3820",
    overflow: "hidden",
  },
  backgroundLogo: {
    width: "100%",
    height: "100%",
  },
  backgroundOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  newsCrawlContainer: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    zIndex: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212, 164, 32, 0.15)",
  },
  newsCrawlBadge: {
    backgroundColor: "#B91C1C",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: 10,
    marginRight: 8,
    zIndex: 2,
  },
  newsCrawlBadgeText: {
    fontSize: 8,
    fontWeight: "900" as const,
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  newsCrawlScroll: {
    flex: 1,
    zIndex: 1,
  },
  newsCrawlText: {
    fontSize: 11,
    color: "rgba(212, 164, 32, 0.75)",
    fontWeight: "500" as const,
    letterSpacing: 0.3,
    lineHeight: 32,
    paddingRight: 40,
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212, 164, 32, 0.15)",
  },
  brandByText: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.4)",
    fontStyle: "italic",
  },
  brandLogo: {
    width: 100,
    height: 24,
  },
  parodyFooter: {
    fontSize: 11,
    color: "#666666",
    textAlign: "center",
    paddingVertical: 6,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    letterSpacing: 0.5,
  },
  bottomBarContainer: {
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  tickerContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212, 164, 32, 0.3)",
    paddingVertical: 8,
  },
  tickerScroll: {
    paddingHorizontal: 14,
    paddingRight: 80,
    alignItems: "center",
    gap: 0,
  },
  tickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 4,
  },
  tickerLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.gold,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  tickerValue: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  tickerChange: {
    fontSize: 10,
    fontWeight: "600" as const,
  },
  tickerDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(212, 164, 32, 0.3)",
    marginHorizontal: 8,
  },
  tickerLoading: {
    fontSize: 11,
    color: Colors.whiteMuted,
    fontStyle: "italic",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerBrand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  headerBrandBy: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
    fontStyle: "italic",
  },
  headerBrandLogo: {
    width: 130,
    height: 30,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  liveUsersBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 77, 77, 0.15)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.3)",
  },
  liveUsersDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ff4d4d",
  },
  liveUsersCount: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#ff4d4d",
  },
  liveUsersLabel: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: "rgba(255, 77, 77, 0.7)",
  },
  activityWall: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.15)",
    gap: 6,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  activityTitle: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "rgba(255, 77, 77, 0.8)",
    letterSpacing: 1.5,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 3,
  },
  activityItemNew: {
    backgroundColor: "rgba(255, 77, 77, 0.06)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  activityDot: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
  },
  activityText: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  activityTextNew: {
    color: "#ff4d4d",
    fontWeight: "600" as const,
  },
  glossyHeaderBtn: {
    alignItems: "center",
    gap: 3,
  },
  glossyHeaderCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gold,
    borderWidth: 1.5,
    borderColor: "#E8C84A",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(212, 164, 32, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
      },
      default: {},
    }),
  },
  glossyHeaderLabel: {
    fontSize: 9,
    color: Colors.whiteMuted,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
  },
  centerScroll: {
    flex: 1,
    zIndex: 5,
    ...(Platform.OS === "web" ? { overflow: "auto" as any } : {}),
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
    paddingVertical: 10,
    ...(Platform.OS === "web" ? { minHeight: "100%" as any } : {}),
  },
  brandTitle: {
    fontSize: 42,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.gold,
    letterSpacing: 6,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  fabContainer: {
    position: "absolute",
    right: 20,
    zIndex: 10,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.92 }],
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  archiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  archiveTitle: {
    fontSize: 24,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
    letterSpacing: 1,
  },
  archiveCloseButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  conversationCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  conversationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(212, 164, 32, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  conversationContent: {
    flex: 1,
    marginRight: 8,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationTitle: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    flex: 1,
    marginRight: 8,
  },
  conversationTime: {
    fontSize: 12,
    color: Colors.whiteMuted,
  },
  conversationPreview: {
    fontSize: 13,
    color: Colors.whiteDim,
    lineHeight: 18,
  },
  copyButton: {
    padding: 6,
    marginRight: 4,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.whiteDim,
    textAlign: "center",
    lineHeight: 22,
  },
  passcodeOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  passcodeCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 28,
    width: 300,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.25)",
    ...Platform.select({
      web: {
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      },
      default: {},
    }),
  },
  passcodeIconRow: {
    marginBottom: 16,
  },
  passcodeTitle: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    marginBottom: 20,
  },
  passcodeInput: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: "center",
    letterSpacing: 2,
  },
  passcodeInputError: {
    borderColor: "#F87171",
  },
  passcodeErrorText: {
    fontSize: 13,
    color: "#F87171",
    marginTop: 8,
  },
  passcodeSubmit: {
    marginTop: 16,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: "100%",
    alignItems: "center",
  },
  passcodeSubmitText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#0A0A0A",
  },
  hotTakeBubble: {
    backgroundColor: "rgba(20, 20, 20, 0.5)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 30,
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.3)",
    maxWidth: 340,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      },
      default: {},
    }),
  },
  hotTakeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  hotTakeLabel: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: Colors.gold,
    letterSpacing: 1.5,
  },
  hotTakeText: {
    fontSize: 15,
    color: Colors.white,
    fontStyle: "italic",
    lineHeight: 22,
    marginBottom: 8,
  },
  hotTakeHeadline: {
    fontSize: 11,
    color: Colors.whiteMuted,
    lineHeight: 16,
  },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  feedbackCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 28,
    width: 320,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.25)",
    ...Platform.select({
      web: {
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      },
      default: {},
    }),
  },
  feedbackTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
    marginTop: 12,
  },
  feedbackSubtitle: {
    fontSize: 14,
    color: Colors.whiteDim,
    marginTop: 4,
    marginBottom: 16,
  },
  feedbackStars: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  feedbackInput: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  feedbackButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  feedbackSkip: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  feedbackSkipText: {
    fontSize: 14,
    color: Colors.whiteDim,
    fontWeight: "600" as const,
  },
  feedbackSubmit: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: Colors.gold,
  },
  feedbackSubmitText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#0A0A0A",
  },
  feedbackSuccess: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  feedbackSuccessText: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
  },
  modeButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  roastButton: {
    backgroundColor: "rgba(255, 68, 68, 0.15)",
    borderColor: "rgba(255, 68, 68, 0.4)",
  },
  debateButton: {
    backgroundColor: "rgba(212, 164, 32, 0.15)",
    borderColor: "rgba(212, 164, 32, 0.4)",
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: Colors.white,
    letterSpacing: 1,
  },
  liveNewsButton: {
    backgroundColor: "rgba(220, 38, 38, 0.15)",
    borderColor: "rgba(220, 38, 38, 0.4)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#DC2626",
  },
  nostradamusButton: {
    backgroundColor: "rgba(187, 134, 252, 0.12)",
    borderColor: "rgba(187, 134, 252, 0.35)",
  },
  truthSocialButton: {
    backgroundColor: "rgba(74, 144, 217, 0.15)",
    borderColor: "rgba(74, 144, 217, 0.4)",
  },
  cabinetButton: {
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    borderColor: "rgba(249, 115, 22, 0.4)",
  },
  dashboardButton: {
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    borderColor: "rgba(96, 165, 250, 0.4)",
  },
  rateTrumpButton: {
    backgroundColor: "rgba(255, 77, 77, 0.15)",
    borderColor: "rgba(255, 77, 77, 0.4)",
  },
  fortuneButton: {
    backgroundColor: "rgba(147, 51, 234, 0.15)",
    borderColor: "rgba(147, 51, 234, 0.4)",
  },
  therapyButton: {
    backgroundColor: "rgba(255, 77, 77, 0.15)",
    borderColor: "rgba(255, 77, 77, 0.4)",
  },
  realEstateButton: {
    backgroundColor: "rgba(74, 222, 128, 0.15)",
    borderColor: "rgba(74, 222, 128, 0.4)",
  },
  gameButton: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderColor: "rgba(251, 191, 36, 0.4)",
  },
  faceoffButton: {
    backgroundColor: "rgba(255, 107, 53, 0.15)",
    borderColor: "rgba(255, 107, 53, 0.4)",
  },
  debateButton: {
    backgroundColor: "rgba(255, 77, 77, 0.15)",
    borderColor: "rgba(255, 77, 77, 0.4)",
  },
  fearGreedCard: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.2)",
    gap: 12,
  },
  fearGreedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fearGreedTitle: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: Colors.white,
    letterSpacing: 1.5,
  },
  fearGreedMeter: {
    gap: 6,
  },
  fearGreedBarBg: {
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    position: "relative",
  },
  fearGreedBarFill: {
    height: "100%",
    borderRadius: 12,
  },
  fearGreedIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  fearGreedIndicatorText: {
    fontSize: 12,
    fontWeight: "900" as const,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fearGreedLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fearGreedLabelLeft: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#ef4444",
    letterSpacing: 1,
  },
  fearGreedLabelCenter: {
    fontSize: 12,
    fontWeight: "900" as const,
    letterSpacing: 1,
  },
  fearGreedLabelRight: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#22c55e",
    letterSpacing: 1,
  },
  fearGreedQuote: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
  },
  fearGreedQuoteText: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
    fontStyle: "italic",
  },
  fearGreedShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(212,164,32,0.1)",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.2)",
  },
  fearGreedShareText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: Colors.gold,
    letterSpacing: 1,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 107, 53, 0.15)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 53, 0.3)",
  },
  streakShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 107, 53, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 53, 0.25)",
  },
  streakShareText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "#FF6B35",
    letterSpacing: 0.5,
  },
  streakText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#FF6B35",
    letterSpacing: 0.5,
  },
  dailyChallengeCard: {
    backgroundColor: "rgba(20, 15, 5, 0.5)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 30,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
    maxWidth: 340,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      },
      default: {},
    }),
  },
  dailyChallengeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  dailyChallengeLabel: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "#FFD700",
    letterSpacing: 1.5,
  },
  dailyChallengeText: {
    fontSize: 14,
    color: Colors.white,
    lineHeight: 20,
    marginBottom: 6,
  },
  dailyChallengeCta: {
    fontSize: 11,
    color: Colors.goldDark,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
  },
  viralCtaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 24,
    maxWidth: 380,
    alignSelf: "center",
    width: "100%",
  },
  viralCtaButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 0 20px rgba(0,200,83,0.3)",
      },
      default: {
        shadowColor: "#00C853",
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 20,
        elevation: 8,
      },
    }),
  },
  viralTherapy: {
    ...Platform.select({
      web: {
        boxShadow: "0 0 20px rgba(0,200,83,0.35)",
      },
      default: {
        shadowColor: "#00C853",
      },
    }),
  },
  viralFortune: {
    ...Platform.select({
      web: {
        boxShadow: "0 0 20px rgba(124,77,255,0.35)",
      },
      default: {
        shadowColor: "#7C4DFF",
      },
    }),
  },
  viralCtaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  viralCtaText: {
    fontSize: 12,
    fontWeight: "900" as const,
    color: "#fff",
    letterSpacing: 1.2,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  viralCtaBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viralCtaBadgeText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 1,
  },
  leaderboardCard: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: "rgba(255,215,0,0.06)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
    maxWidth: 380,
    alignSelf: "center" as const,
    width: "100%" as any,
  },
  leaderboardHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: 12,
  },
  leaderboardEmoji: {
    fontSize: 20,
  },
  leaderboardTitle: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#FFD700",
    letterSpacing: 2,
  },
  leaderboardRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    gap: 8,
  },
  leaderboardRowFirst: {
    backgroundColor: "rgba(255,215,0,0.08)",
    borderRadius: 8,
    marginBottom: 2,
  },
  leaderboardRowYou: {
    backgroundColor: "rgba(255,215,0,0.12)",
    borderRadius: 8,
  },
  leaderboardRank: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "rgba(255,255,255,0.5)",
    width: 22,
    textAlign: "center" as const,
  },
  leaderboardAvatar: {
    fontSize: 18,
    width: 26,
    textAlign: "center" as const,
  },
  leaderboardName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  leaderboardScore: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "#FF4D4D",
    letterSpacing: 0.5,
  },
  leaderboardCta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    marginTop: 12,
    backgroundColor: "#FFD700",
    paddingVertical: 10,
    borderRadius: 10,
  },
  leaderboardCtaText: {
    fontSize: 12,
    fontWeight: "900" as const,
    color: "#0a0a0a",
    letterSpacing: 1.2,
  },
  mysteryBoxCard: {
    marginHorizontal: 24,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
    maxWidth: 380,
    alignSelf: "center" as const,
    width: "100%" as any,
  },
  mysteryBoxHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  mysteryBoxEmoji: {
    fontSize: 28,
  },
  mysteryBoxTitle: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#FFD700",
    letterSpacing: 2,
  },
  mysteryBoxSub: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "rgba(255,215,0,0.7)",
    marginTop: 2,
  },
  mysteryProgressBar: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden" as const,
  },
  mysteryProgressFill: {
    height: "100%" as any,
    backgroundColor: "#FFD700",
    borderRadius: 2,
  },
  mysteryOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  mysteryPrizeCard: {
    borderRadius: 20,
    overflow: "hidden" as const,
    width: "85%" as any,
    maxWidth: 340,
  },
  mysteryPrizeGradient: {
    padding: 30,
    alignItems: "center" as const,
  },
  mysteryPrizeEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  mysteryPrizeTitle: {
    fontSize: 28,
    fontWeight: "900" as const,
    color: "#0a0a0a",
    letterSpacing: 3,
    marginBottom: 16,
  },
  mysteryPrizeLabelRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: 10,
  },
  mysteryPrizeLabelText: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: "#0a0a0a",
  },
  mysteryPrizeDesc: {
    fontSize: 14,
    color: "rgba(10,10,10,0.75)",
    textAlign: "center" as const,
    lineHeight: 20,
    marginBottom: 20,
  },
  mysteryPrizeDismiss: {
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  mysteryPrizeDismissText: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "#FFD700",
    letterSpacing: 1.5,
  },
  mysteryPrizeTimer: {
    fontSize: 11,
    color: "rgba(10,10,10,0.5)",
    fontWeight: "600" as const,
  },
  weeklyCard: {
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
  },
  weeklyGradient: {
    padding: 16,
    alignItems: "center" as const,
  },
  weeklyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  weeklyTitle: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: Colors.gold,
    letterSpacing: 1.5,
  },
  weeklyCountdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  weeklyTimeBlock: {
    alignItems: "center" as const,
    backgroundColor: "rgba(255,215,0,0.1)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 54,
  },
  weeklyTimeNum: {
    fontSize: 22,
    fontWeight: "900" as const,
    color: Colors.gold,
  },
  weeklyTimeLabel: {
    fontSize: 8,
    fontWeight: "700" as const,
    color: "rgba(255,215,0,0.6)",
    letterSpacing: 1,
    marginTop: 2,
  },
  weeklyTimeSep: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "rgba(255,215,0,0.4)",
  },
  weeklyLiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  weeklyLiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ff4d4d",
  },
  weeklyLiveText: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: "#ff4d4d",
    letterSpacing: 2,
  },
  weeklySubtext: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    marginBottom: 12,
  },
  weeklyRemindBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
    backgroundColor: "rgba(255,215,0,0.05)",
  },
  weeklyRemindBtnActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  weeklyRemindText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: Colors.gold,
    letterSpacing: 1,
  },
  weeklyRemindTextActive: {
    color: "#0a0a0a",
  },
  badgesCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.15)",
  },
  badgesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  badgesEmoji: {
    fontSize: 18,
  },
  badgesTitle: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: Colors.gold,
    letterSpacing: 1.5,
    flex: 1,
  },
  badgesCount: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "rgba(255,215,0,0.7)",
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badgeItem: {
    width: "30%" as any,
    minWidth: 95,
    borderRadius: 12,
    padding: 10,
    alignItems: "center" as const,
    borderWidth: 1,
  },
  badgeEarned: {
    backgroundColor: "rgba(255,215,0,0.08)",
    borderColor: "rgba(255,215,0,0.3)",
  },
  badgeLocked: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderColor: "rgba(255,255,255,0.08)",
    opacity: 0.5,
  },
  badgeEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  badgeEmojiLocked: {
    opacity: 0.4,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center" as const,
    marginBottom: 2,
  },
  badgeLabelEarned: {
    color: Colors.gold,
  },
  badgeDesc: {
    fontSize: 8,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center" as const,
  },
  legalDisclaimer: {
    fontSize: 9,
    color: "rgba(255,255,255,0.15)",
    textAlign: "center" as const,
    lineHeight: 14,
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
});
