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
  const { deviceId } = useTokens();

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
    }, [])
  );

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const conv = await createConversation("LIVE News");
    router.push({ pathname: "/chat/[id]", params: { id: conv.id, mode: "livenews" } });
  }

  async function handleNostradamusMode() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const conv = await createConversation("TRUMP-STRADAMUS");
    router.push({ pathname: "/chat/[id]", params: { id: conv.id, mode: "nostradamus" } });
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
        <View style={styles.headerRight} />
      </Animated.View>

      <Pressable style={styles.centerContent} onPress={handleSecretTap} testID="secret-tap-area">
        {streak > 0 && (
          <Animated.View entering={FadeIn.delay(400).duration(500)} style={styles.streakBadge}>
            <MaterialCommunityIcons name="fire" size={16} color="#FF6B35" />
            <Text style={styles.streakText}>{streak} day streak</Text>
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
            <MaterialCommunityIcons name="crystal-ball" size={18} color="#BB86FC" />
            <Text style={styles.modeButtonText}>PREDICT</Text>
          </Pressable>
        </Animated.View>
      </Pressable>

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

      <View style={[styles.bottomBarContainer, { paddingBottom: insets.bottom + webBottomInset }]}>
        <View style={styles.brandBar}>
          <Text style={styles.brandByText}>by</Text>
          <Image
            source={require("@/assets/images/dynamic-creations.jpg")}
            style={styles.brandLogo}
            resizeMode="contain"
          />
        </View>
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
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
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
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
    fontSize: 12,
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
    marginBottom: 8,
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
});
