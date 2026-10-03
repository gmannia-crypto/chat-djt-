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
import { Audio } from "expo-av";
import { playTTS } from "@/lib/audio-helper";
import { useSoundEffects } from "@/lib/use-sound";
import { SoundToggle } from "@/components/SoundToggle";
import { useSound } from "@/lib/sound-context";
import { playRewardChime } from "@/lib/arena-sfx";
import { SuggestionBox } from "@/components/SuggestionBox";
import { ShareAppButton } from "@/components/ShareAppButton";
import { useEngagement } from "@/lib/engagement-context";
import { useLiveActivity } from "@/lib/live-activity-context";
import { useScreenTracker, useTrackEvent, trackAnalyticsEvent } from "@/lib/use-analytics";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutUp,
  FadeIn,
  ZoomIn,
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
import { formatInviteSuccessDetail } from "@/lib/referral-invite-format";
import {
  Conversation,
  getAllConversations,
  createConversation,
  deleteConversation,
  Message,
} from "@/lib/chat-storage";
import {
  getCollection,
  addCard,
  getCardById,
  getCollectionStats,
  CARD_CATALOG,
  RARITY_COLORS,
  type OwnedCard,
} from "@/lib/collectibles";
import {
  PERSONA_UNLOCKS,
  PersonaUnlockModal,
  ARENA_MYSTERY_PERSONA_IDS,
  ARENA_MYSTERY_PERSONA_NAMES,
  ARENA_MYSTERY_UNLOCK_KEY,
  MysteryPersonaTeaser,
  getMysteryTeaserPalettes,
  useUnseenMysteryCount,
  type MysteryTeaserPalette,
} from "@/lib/persona-unlocks";
import { CashAppDonate } from "@/components/CashAppDonate";
import { ProposedHomeEntry } from "@/components/home/ProposedHomeEntry";
import { ArenaSetupBackdrop } from "@/components/arena-setup/ArenaSetupBackdrop";

const FEEDBACK_SHOWN_KEY = "chatdjt_feedback_shown";
const FEEDBACK_CONV_COUNT_KEY = "chatdjt_conv_count";
const HOT_TAKE_CACHE_KEY = "chatdjt_hot_take_cache";
const ONBOARDING_DONE_KEY = "chatdjt_onboarding_done";

const FEATURE_OF_DAY = [
  { emoji: "🏛️", title: "The Arena", sub: "Watch 28 AI personas debate live news — and award points!", route: "/arena", color: "#D4A420" },
  { emoji: "🛋️", title: "Trump Therapy", sub: "Trump-themed therapists help you work through it. Bigly.", route: "/therapy", color: "#a855f7" },
  { emoji: "💰", title: "Financial Face-Off", sub: "Debate stocks, crypto & real estate with AI billionaires.", route: "/faceoff", color: "#22c55e" },
  { emoji: "🏈", title: "Trump's Sports Book", sub: "AI persona picks, live commentary & trash talk.", route: "/sports", color: "#3b82f6" },
  { emoji: "🔮", title: "Fortune Parlor", sub: "Trump predicts your future. Might even be accurate.", route: "/fortune", color: "#f97316" },
  { emoji: "🗞️", title: "Cabinet Hot Seat", sub: "Grill the cabinet. Watch them sweat under pressure.", route: "/cabinet", color: "#ef4444" },
  { emoji: "🎤", title: "1-on-1 Interview", sub: "You're the reporter. Get exclusive quotes from any persona.", route: "/interview", color: "#06b6d4" },
  { emoji: "🥊", title: "1-on-1 Debate", sub: "Two personas, one moderator, zero mercy. Cut mics if things get ugly.", route: "/debate-stage", color: "#f43f5e" },
  { emoji: "🏆", title: "Trump Billionaires", sub: "Make ethical choices to reach $1 billion. Trump coaches you.", route: "/billionaires", color: "#FFD700" },
];

const ONBOARDING_STEPS = [
  { emoji: "👋", title: "Welcome to The Arena", body: "The most tremendous AI chat app ever built. Voice-cloned personas, live debates, and zero filter. Believe me." },
  { emoji: "🏛️", title: "The Arena", body: "Pick up to 28 AI personas and watch them debate live news headlines. Award points, trigger breaking news, and declare a winner." },
  { emoji: "🛋️", title: "Trump Therapy", body: "Choose from 5 therapist personas — each with a unique style. Deep sessions, PHQ-9 assessments, and shareable diagnosis plans." },
  { emoji: "🪙", title: "D.C. Lightning Tokens", body: "Premium features cost tokens. Earn free ones via daily streaks, the Mystery Box, and the Arena. You can always buy more." },
  { emoji: "🎁", title: "Daily Mystery Box", body: "Open your free Mystery Box every 24 hours for rewards: roasts, collectible cards, persona unlocks, and more." },
];

function getDailyFeature() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return FEATURE_OF_DAY[dayOfYear % FEATURE_OF_DAY.length];
}

const MYSTERY_BOX_KEY = "chatdjt_mystery_box";

const MYSTERY_REWARDS = [
  { label: "Free Roast", icon: "flame", description: "Trump will personally roast you — for FREE. No D.C. tokens needed." },
  { label: "Double Fortune", icon: "crystal-ball", description: "Your next Fortune Parlor reading is DOUBLED. Twice the prophecy!" },
  { label: "Dynamic Stock Tip", icon: "trending-up", description: "An exclusive AI-generated stock hot take from the Don himself." },
  { label: "Property Discount", icon: "home", description: "VIP access to Dynamic Realty's top pick of the day. TREMENDOUS." },
  { label: "Cabinet Roast", icon: "people", description: "Unlock a bonus Cabinet Hot Seat roast. Savage and FREE." },
  { label: "Golden Tweet", icon: "logo-twitter", description: "Generate a viral Trump tweet on ANY topic. Pure gold." },
  { label: "Therapy Session", icon: "medical", description: "A free therapy session with Trump Therapy. Healing through WINNING." },
  { label: "VIP Fortune", icon: "star", description: "A rare PREMIUM fortune reading. Only winners get this." },
  { label: "Collectible Card", icon: "cards", description: "A DJT Collectible card has been added to your collection!" },
  { label: "Collectible Card", icon: "cards", description: "A DJT Collectible card has been added to your collection!" },
  { label: "Arena Persona Unlock", icon: "person-add", description: "A mystery arena debater has been unlocked! Check The Arena." },
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
        colors={["rgba(10, 8, 4, 0.4)", "rgba(15, 12, 6, 0.35)"]}
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
  const header = `The Arena - ${conv.title}\n${new Date(conv.createdAt).toLocaleString()}\n${"─".repeat(40)}\n\n`;
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

function TrophyNewPip({ testID }: { testID?: string }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 540 }),
        withTiming(1, { duration: 540 }),
      ),
      -1,
      true,
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[trophyNewPipStyles.pip, animStyle]}
      testID={testID}
    />
  );
}

const trophyNewPipStyles = StyleSheet.create({
  pip: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFD700",
    borderWidth: 1.5,
    borderColor: "#0a0a0a",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 10,
  },
});

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
  const [factOfDay, setFactOfDay] = useState<{ educatorId: string; educatorName: string; courseTitle: string; fact: string } | null>(null);
  const [hotTakeLoading, setHotTakeLoading] = useState(false);

  const [dailyChallenge, setDailyChallenge] = useState<string | null>(null);
  const [mysteryTimeLeft, setMysteryTimeLeft] = useState(0);
  const [mysteryReady, setMysteryReady] = useState(false);
  const [mysteryPrize, setMysteryPrize] = useState<typeof MYSTERY_REWARDS[0] | null>(null);
  const [mysteryPrizeSharing, setMysteryPrizeSharing] = useState(false);
  const referralUrlCacheRef = useRef<{ url: string; nativeUrl?: string } | null>(null);
  const [mysteryRevealing, setMysteryRevealing] = useState(false);
  const [mysteryTeaser, setMysteryTeaser] = useState<{ palette: MysteryTeaserPalette; step: number; total: number } | null>(null);
  const [unlockedPersonaId, setUnlockedPersonaId] = useState<string | null>(null);
  const [unlockedPersonaCount, setUnlockedPersonaCount] = useState(0);
  const [unseenMysteryCount, refreshUnseenMysteryCount] = useUnseenMysteryCount();
  const [inviteSuccess, setInviteSuccess] = useState<{
    newReferrals: number;
    tokensEarned: number;
    grants: { id: string; grantedAt: string; friendName?: string | null }[];
  } | null>(null);
  const inviteSuccessCheckedRef = useRef(false);
  const [leaderboardData, setLeaderboardData] = useState<{ name: string; score: number; avatar: string; isYou?: boolean }[]>([]);
  const [fearGreed, setFearGreed] = useState<{ value: number; label: string; trumpComment: string } | null>(null);
  const [activityFeed, setActivityFeed] = useState<string[]>([]);
  const [badges, setBadges] = useState<{ id: string; label: string; emoji: string; desc: string; earned: boolean }[]>([]);
  const [weeklyCountdown, setWeeklyCountdown] = useState({ days: 0, hours: 0, minutes: 0, isLive: false });
  const [weeklyReminder, setWeeklyReminder] = useState(false);
  const [electionDays, setElectionDays] = useState(0);
  const [collectionCount, setCollectionCount] = useState({ owned: 0, total: 24 });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  // Simplified home screen: the full mode list and the daily-extras rail
  // (trophy room, fact of the day, countdowns, leaderboard, badges, etc.)
  // are collapsed by default so a first-time visitor sees a short, clear
  // path (hero card + a handful of primary modes) instead of a wall of
  // ~20 buttons and a dozen stacked widgets. Everything is still one tap
  // away — nothing was removed, just deferred behind an explicit toggle.
  const [showMoreModes, setShowMoreModes] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const dailyFeature = useMemo(() => getDailyFeature(), []);
  const { deviceId, hasTokens, balance, linkedUser, authToken, openSaveModal, refreshBalance } = useTokens();
  const { streak, awardBadge } = useEngagement();
  const { events: liveEvents, logEvent } = useLiveActivity();
  const { playClick, playTransition, playWhoosh, playPersonaSting } = useSoundEffects();
  const { soundEnabled } = useSound();
  const playMysteryRewardChime = useCallback(() => {
    if (soundEnabled) playRewardChime();
  }, [soundEnabled]);
  useScreenTracker("main_menu");
  const trackEvent = useTrackEvent();

  useEffect(() => { logEvent("visit"); }, []);
  useEffect(() => {
    (async () => {
      try {
        const res = await globalThis.fetch(new URL("/api/dc-university/fact-of-day", getApiUrl()).toString());
        if (res.ok) setFactOfDay(await res.json());
      } catch {}
    })();
  }, []);

  // ── Fact of the Day, spoken aloud in the educator's own voice ────────────
  // Starts ~10s after the fact loads (so it doesn't compete with entry
  // animations/sounds), and goes silent the instant the user leaves this
  // screen for any category. Opt-out persists across sessions.
  const FACT_VOICE_KEY = "chatdjt_fact_of_day_voice_enabled";
  const [factVoiceEnabled, setFactVoiceEnabled] = useState(true);
  const factVoiceSoundRef = useRef<Audio.Sound | null>(null);
  const factVoiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const factVoicePlayedRef = useRef(false);

  const stopFactVoice = useCallback(() => {
    if (factVoiceTimerRef.current) {
      clearTimeout(factVoiceTimerRef.current);
      factVoiceTimerRef.current = null;
    }
    const snd = factVoiceSoundRef.current;
    factVoiceSoundRef.current = null;
    if (snd) {
      snd.stopAsync().catch(() => {});
      snd.unloadAsync().catch(() => {});
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(FACT_VOICE_KEY).then((val) => {
      if (val === "false") setFactVoiceEnabled(false);
    }).catch(() => {});
  }, []);

  const toggleFactVoice = useCallback(() => {
    Haptics.selectionAsync();
    setFactVoiceEnabled((prev) => {
      const next = !prev;
      AsyncStorage.setItem(FACT_VOICE_KEY, String(next)).catch(() => {});
      if (!next) stopFactVoice();
      return next;
    });
  }, [stopFactVoice]);

  useEffect(() => {
    if (!factOfDay || !factVoiceEnabled || factVoicePlayedRef.current) return;
    factVoiceTimerRef.current = setTimeout(async () => {
      factVoiceTimerRef.current = null;
      if (!factVoiceEnabled || factVoicePlayedRef.current) return;
      factVoicePlayedRef.current = true;
      try {
        const sound = await playTTS("/api/persona-speak", { text: factOfDay.fact, personaId: factOfDay.educatorId });
        factVoiceSoundRef.current = sound;
      } catch {}
    }, 10000);
    return () => {
      if (factVoiceTimerRef.current) {
        clearTimeout(factVoiceTimerRef.current);
        factVoiceTimerRef.current = null;
      }
    };
  }, [factOfDay, factVoiceEnabled]);

  // Go silent the instant the user navigates away to any category.
  useFocusEffect(
    useCallback(() => {
      return () => { stopFactVoice(); };
    }, [stopFactVoice])
  );

  const mainScrollRef = useRef<ScrollView>(null);

  const refreshCollectionCount = useCallback(async () => {
    const col = await getCollection();
    const stats = getCollectionStats(col);
    setCollectionCount({ owned: stats.owned, total: stats.total });
  }, []);

  const pulseScale = useSharedValue(1);
  const pulseGlow = useSharedValue(0.4);
  const arenaPulseScale = useSharedValue(1);
  const arenaPulseGlow = useSharedValue(0.3);
  const arenaBorderGlow = useSharedValue(0.4);
  const sportsPulseScale = useSharedValue(1);
  const sportsPulseGlow = useSharedValue(0.5);

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
    arenaPulseScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1200 }),
        withTiming(0.98, { duration: 1200 })
      ),
      -1,
      true
    );
    arenaPulseGlow.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
    arenaBorderGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0.4, { duration: 1500 })
      ),
      -1,
      true
    );
    sportsPulseScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
    sportsPulseGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.5, { duration: 1000 })
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

  const sportsPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sportsPulseScale.value }],
    shadowColor: "#4CAF50",
    shadowOpacity: sportsPulseGlow.value,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  }));

  const arenaFeaturedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: arenaPulseScale.value }],
    shadowColor: "#ff4d4d",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    shadowOpacity: arenaPulseGlow.value,
    elevation: 10,
  }));

  function handleSecretTap() {
    secretTapCount.current += 1;
    if (secretTapTimer.current) clearTimeout(secretTapTimer.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (secretTapCount.current >= 5) {
      secretTapCount.current = 0;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      playTransition();
      setPasscodeInput("");
      setPasscodeError(false);
      setPasscodeVisible(true);
    } else {
      secretTapTimer.current = setTimeout(() => {
        secretTapCount.current = 0;
      }, 3500);
    }
  }

  function handlePasscodeSubmit() {
    if (passcodeInput === ADMIN_PASSCODE) {
      playClick();
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

  const refreshUnlockedPersonaCount = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(ARENA_MYSTERY_UNLOCK_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      const validIds = ARENA_MYSTERY_PERSONA_IDS as readonly string[];
      const safe = Array.isArray(parsed)
        ? parsed.filter(
            (id: unknown): id is string =>
              typeof id === "string" && validIds.includes(id),
          )
        : [];
      setUnlockedPersonaCount(safe.length);
    } catch {
      setUnlockedPersonaCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
      checkFeedbackPrompt();
      fetchDailyChallenge();
      initMysteryBox();
      fetchLeaderboard();
      fetchFearGreed();
      loadBadges();
      checkWeeklyReminder();
      refreshCollectionCount();
      refreshUnlockedPersonaCount();
      AsyncStorage.getItem(ONBOARDING_DONE_KEY).then((done) => {
        if (!done) setShowOnboarding(true);
      });
    }, [deviceId, authToken])
  );

  // TokenProvider loads both values asynchronously. Guarantee a sync when the
  // verified session becomes available without requiring a navigation refocus.
  useEffect(() => {
    if (deviceId && authToken) initMysteryBox();
  }, [deviceId, authToken]);

  // Check once per app open whether a friend's referral converted, so the
  // sharer gets a success moment tied to the Mystery Box entry point.
  useEffect(() => {
    if (deviceId && !inviteSuccessCheckedRef.current) {
      inviteSuccessCheckedRef.current = true;
      checkReferralNotifications();
    }
  }, [deviceId]);

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
    const electionDate = new Date("2026-11-03T00:00:00");
    const diffE = electionDate.getTime() - Date.now();
    setElectionDays(Math.max(0, Math.ceil(diffE / 86400000)));
    const iv = setInterval(updateCountdown, 60000);
    return () => clearInterval(iv);
  }, []);

  const welcomeSoundRef = useRef<Audio.Sound | null>(null);
  const welcomePlayedRef = useRef(false);

  const playWelcomeOnInteraction = useCallback(async () => {
    if (welcomePlayedRef.current) return;
    welcomePlayedRef.current = true;
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const url = `${baseUrl}/api/nav-speak?text=${encodeURIComponent("Welcome to The Arena. A complete interactive immersive experience.")}`;
      if (Platform.OS === "web") {
        const audio = new window.Audio(url);
        audio.volume = 0.9;
        audio.play().catch(() => {});
      } else {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, volume: 0.9 }
        );
        welcomeSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            sound.unloadAsync();
            welcomeSoundRef.current = null;
          }
        });
      }
    } catch (e: any) {
      welcomePlayedRef.current = false;
      console.warn("Audio playback skipped:", e?.message || String(e));
    }
  }, []);

  const navSoundRef = useRef<Audio.Sound | null>(null);
  const playNavVoice = useCallback(async (text: string) => {
    try {
      if (navSoundRef.current) {
        await navSoundRef.current.unloadAsync().catch(() => {});
        navSoundRef.current = null;
      }
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const url = `${baseUrl}/api/nav-speak?text=${encodeURIComponent(text)}`;
      if (Platform.OS === "web") {
        const audio = new window.Audio(url);
        audio.volume = 0.8;
        audio.play().catch(() => {});
      } else {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, volume: 0.8 }
        );
        navSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            sound.unloadAsync();
            navSoundRef.current = null;
          }
        });
      }
    } catch {}
  }, []);

  const MENU_TRACKS = [
    { src: "/server/assets/menu-prowling-dragon.mp3", name: "Prowling Dragon" },
    { src: "/server/assets/menu-allure.mp3", name: "Allure" },
    { src: "/server/assets/menu-swagg-attack.mp3", name: "Swagg Attack" },
    { src: "/server/assets/menu-zdragon.mp3", name: "Zdragon" },
    { src: "/server/assets/menu-journey-through-stars.mp3", name: "Journey Through Stars" },
    { src: "/server/assets/menu-numbers.mp3", name: "Numbers" },
    { src: "/server/assets/menu-caleb-asher-latest.mp3", name: "Caleb Asher" },
  ];
  const [menuMusicPlaying, setMenuMusicPlaying] = useState(false);
  const [menuTrackName, setMenuTrackName] = useState("");
  const menuAudioRef = useRef<Audio.Sound | null>(null);
  const menuTrackOrderRef = useRef<number[]>([]);
  const menuTrackIdxRef = useRef(0);

  const shuffleMenuTracks = useCallback(() => {
    const order = MENU_TRACKS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    menuTrackOrderRef.current = order;
    menuTrackIdxRef.current = 0;
  }, []);

  const playMenuTrack = useCallback(async () => {
    try {
      if (menuTrackIdxRef.current >= menuTrackOrderRef.current.length) {
        shuffleMenuTracks();
      }
      const track = MENU_TRACKS[menuTrackOrderRef.current[menuTrackIdxRef.current]];
      if (menuAudioRef.current) {
        await menuAudioRef.current.unloadAsync().catch(() => {});
        menuAudioRef.current = null;
      }
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const uri = `${baseUrl}${track.src}`;
      if (Platform.OS === "web") {
        const audio = new window.Audio(uri);
        audio.volume = 0.3;
        audio.play().catch(() => {});
        setMenuTrackName(track.name);
        audio.onended = () => {
          menuTrackIdxRef.current++;
          playMenuTrack();
        };
        (menuAudioRef as any).current = { unloadAsync: () => { audio.pause(); audio.src = ""; return Promise.resolve(); } } as any;
      } else {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, volume: 0.3 }
        );
        menuAudioRef.current = sound;
        setMenuTrackName(track.name);
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            menuTrackIdxRef.current++;
            playMenuTrack();
          }
        });
      }
    } catch (e) {
      console.warn("Menu music error:", e);
    }
  }, [shuffleMenuTracks]);

  const toggleMenuMusic = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (menuMusicPlaying) {
      if (menuAudioRef.current) {
        await menuAudioRef.current.unloadAsync().catch(() => {});
        menuAudioRef.current = null;
      }
      setMenuMusicPlaying(false);
      setMenuTrackName("");
    } else {
      if (menuTrackOrderRef.current.length === 0) shuffleMenuTracks();
      setMenuMusicPlaying(true);
      playMenuTrack();
    }
  }, [menuMusicPlaying, shuffleMenuTracks, playMenuTrack]);

  const skipMenuTrack = useCallback(async () => {
    if (!menuMusicPlaying) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    menuTrackIdxRef.current++;
    playMenuTrack();
  }, [menuMusicPlaying, playMenuTrack]);

  const menuMusicWasPlayingRef = useRef(false);
  const menuMusicPlayingRef = useRef(false);
  useEffect(() => { menuMusicPlayingRef.current = menuMusicPlaying; }, [menuMusicPlaying]);

  useFocusEffect(
    useCallback(() => {
      if (menuMusicWasPlayingRef.current) {
        menuMusicWasPlayingRef.current = false;
        setMenuMusicPlaying(true);
        playMenuTrack();
      }
      return () => {
        if (menuMusicPlayingRef.current) {
          menuMusicWasPlayingRef.current = true;
          if (menuAudioRef.current) {
            menuAudioRef.current.unloadAsync().catch(() => {});
            menuAudioRef.current = null;
          }
        }
      };
    }, [playMenuTrack])
  );

  useEffect(() => {
    return () => {
      if (menuAudioRef.current) {
        menuAudioRef.current.unloadAsync().catch(() => {});
      }
    };
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
    // Eligibility is decided server-side (keyed by device / linked account)
    // so clearing app storage or switching devices can't replay the reward.
    // The AsyncStorage cache below is only a fast, offline-friendly mirror
    // of the last known server state — the server is always the source of
    // truth when reachable.
    try {
      const cached = await AsyncStorage.getItem(MYSTERY_BOX_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        if (typeof data.ready === "boolean") {
          setMysteryReady(data.ready);
          setMysteryTimeLeft(typeof data.secondsRemaining === "number" ? data.secondsRemaining : 0);
        }
      }
    } catch {}

    if (!deviceId || !authToken) return;
    try {
      const res = await fetch(new URL("/api/mystery-box/status", getApiUrl()).toString(), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMysteryReady(!!data.ready);
      setMysteryTimeLeft(data.ready ? 0 : Math.max(0, data.secondsRemaining || 0));
      await AsyncStorage.setItem(
        MYSTERY_BOX_KEY,
        JSON.stringify({ ready: !!data.ready, secondsRemaining: data.secondsRemaining || 0 }),
      );
      const unlockedFromServer: string[] = Array.isArray(data.unlockedPersonaIds) ? data.unlockedPersonaIds : [];
      if (unlockedFromServer.length > 0) {
        // Reconcile server-persisted unlocks into the local persona-unlock
        // cache so the arena picker reflects reinstall/cross-device state.
        const stored = await AsyncStorage.getItem(ARENA_MYSTERY_UNLOCK_KEY);
        const local: string[] = stored ? JSON.parse(stored) : [];
        const merged = Array.from(new Set([...local, ...unlockedFromServer]));
        if (merged.length !== local.length) {
          await AsyncStorage.setItem(ARENA_MYSTERY_UNLOCK_KEY, JSON.stringify(merged));
          refreshUnlockedPersonaCount();
        }
      }
      const ownedFromServer: string[] = Array.isArray(data.ownedCardIds) ? data.ownedCardIds : [];
      if (ownedFromServer.length > 0) {
        // Reconcile server-persisted collectible cards (earned from the
        // Mystery Box) into the local collectibles store so a reinstall or
        // new device shows cards the account already owns.
        let addedAny = false;
        for (const cardId of ownedFromServer) {
          const newlyOwned = await addCard(cardId);
          if (newlyOwned) addedAny = true;
        }
        if (addedAny) refreshCollectionCount();
      }
    } catch {
      // Offline / server unreachable — fall back to whatever was cached above.
    }
  }

  const activityFromLive = useMemo(() => {
    return liveEvents.slice(0, 8).map((ev) => ({
      message: ev.message,
      icon: ev.icon,
      color: ev.color,
      type: ev.type,
    }));
  }, [liveEvents]);

  const activityShakeX = useSharedValue(0);
  const activityShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activityShakeX.value }],
  }));

  const triggerActivityShake = useCallback((isPurchase = false) => {
    if (isPurchase) {
      activityShakeX.value = withSequence(
        withTiming(-6, { duration: 40 }),
        withTiming(6, { duration: 40 }),
        withTiming(-5, { duration: 35 }),
        withTiming(5, { duration: 35 }),
        withTiming(-3, { duration: 30 }),
        withTiming(3, { duration: 30 }),
        withTiming(-1, { duration: 25 }),
        withTiming(0, { duration: 25 }),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 150);
    } else {
      activityShakeX.value = withSequence(
        withTiming(-4, { duration: 50 }),
        withTiming(4, { duration: 50 }),
        withTiming(-3, { duration: 40 }),
        withTiming(3, { duration: 40 }),
        withTiming(-2, { duration: 30 }),
        withTiming(0, { duration: 30 }),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  useEffect(() => {
    setActivityFeed(activityFromLive.map((a) => a.message));
  }, [activityFromLive]);

  useEffect(() => {
    if (mysteryReady || mysteryTimeLeft <= 0) return;
    const interval = setInterval(() => {
      setMysteryTimeLeft((prev) => {
        if (prev <= 60) {
          setMysteryReady(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 60;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [mysteryReady]);

  async function openMysteryBox() {
    if (!linkedUser || !authToken) {
      Alert.alert(
        "Verify your email",
        "Verify your email once to protect Mystery Box rewards and keep them across devices.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Verify Email", onPress: openSaveModal },
        ],
      );
      return;
    }
    if (!mysteryReady || mysteryRevealing || !deviceId) return;
    setMysteryRevealing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((r) => setTimeout(r, 1200));

    // The claim — including which reward is granted — is decided and
    // recorded server-side so it can't be replayed by clearing AsyncStorage
    // or reinstalling the app. The reveal animation below is purely
    // presentational; the server has already committed the reward.
    let claim: any = null;
    try {
      const res = await fetch(new URL("/api/mystery-box/claim", getApiUrl()).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.status === 409) {
        // Another request (or another device on a linked account) already
        // claimed today's box — resync local state instead of granting
        // a phantom local-only reward.
        const data = await res.json().catch(() => ({}));
        setMysteryRevealing(false);
        setMysteryReady(false);
        setMysteryTimeLeft(Math.max(0, data.secondsRemaining || 86400));
        await AsyncStorage.setItem(
          MYSTERY_BOX_KEY,
          JSON.stringify({ ready: false, secondsRemaining: Math.max(0, data.secondsRemaining || 86400) }),
        );
        return;
      }
      if (!res.ok) throw new Error("claim failed");
      claim = await res.json();
    } catch {
      // Server unreachable — fail safe by not granting a reward rather than
      // falling back to a client-only pick, which is exactly the replay
      // vector this fix closes.
      setMysteryRevealing(false);
      Alert.alert("Mystery Box", "Couldn't reach the server to open your box. Please try again.");
      return;
    }

    const reward = claim.reward as { label: string; icon: string; description: string; detail: any };
    const prizeBase = MYSTERY_REWARDS.find((r) => r.label === reward.label) || MYSTERY_REWARDS[0];
    trackEvent("mystery_box", "claimed", { reward: reward.label });

    if (reward.label === "Arena Persona Unlock" && reward.detail?.personaId) {
      const personaId: string = reward.detail.personaId;
      try {
        const alreadyUnlocked = await getLocalUnlockedPersonas();
        const locked = ARENA_MYSTERY_PERSONA_IDS.filter((id) => !alreadyUnlocked.includes(id));
        const teaserSeq = getMysteryTeaserPalettes(personaId, locked, 3);
        const decoyMs = 440;
        const finalMs = Math.max(560, 1100 - decoyMs * (teaserSeq.length - 1));
        for (let i = 0; i < teaserSeq.length; i++) {
          setMysteryTeaser({ palette: teaserSeq[i], step: i, total: teaserSeq.length });
          try { Haptics.selectionAsync(); } catch {}
          playWhoosh();
          const isFinal = i === teaserSeq.length - 1;
          await new Promise((r) => setTimeout(r, isFinal ? finalMs : decoyMs));
        }
        setMysteryTeaser(null);
        await AsyncStorage.setItem(
          ARENA_MYSTERY_UNLOCK_KEY,
          JSON.stringify(Array.from(new Set([...alreadyUnlocked, personaId]))),
        );
      } catch {}
      refreshUnlockedPersonaCount();
      refreshUnseenMysteryCount();
      if (PERSONA_UNLOCKS[personaId]) {
        playPersonaSting(personaId);
        setUnlockedPersonaId(personaId);
      } else {
        playMysteryRewardChime();
        setMysteryPrize({
          ...prizeBase,
          label: `Persona Unlocked: ${ARENA_MYSTERY_PERSONA_NAMES[personaId] || personaId}`,
          description: `${ARENA_MYSTERY_PERSONA_NAMES[personaId] || personaId} has joined The Arena! Head in to debate them.`,
        });
      }
    } else if (reward.detail?.cardId) {
      // Server confirmed this is a new card and already recorded ownership.
      const card = getCardById(reward.detail.cardId);
      if (card) {
        await addCard(card.id);
        refreshCollectionCount();
        playMysteryRewardChime();
        setMysteryPrize({
          ...prizeBase,
          label: `${card.rarity} Card: ${card.name}`,
          description: reward.detail.allPersonasUnlocked
            ? `All personas unlocked! Bonus card: ${card.description}`
            : `${card.description} (${card.rarity.toUpperCase()} collectible added!)`,
        });
      } else {
        playMysteryRewardChime();
        setMysteryPrize(prizeBase);
      }
    } else if (reward.detail?.duplicateCardId) {
      // Server rolled a card already owned by this account — no local write.
      const card = getCardById(reward.detail.duplicateCardId);
      if (card) {
        playMysteryRewardChime();
        setMysteryPrize({
          ...prizeBase,
          label: `Duplicate: ${card.name}`,
          description: "You already own this card. Keep opening boxes for more!",
        });
      } else {
        playMysteryRewardChime();
        setMysteryPrize(prizeBase);
      }
    } else if (reward.detail?.allPersonasUnlocked) {
      playMysteryRewardChime();
      setMysteryPrize({ ...prizeBase, label: "All Personas Unlocked!", description: "You've already unlocked every mystery persona. Champion status!" });
    } else {
      playMysteryRewardChime();
      setMysteryPrize({ ...prizeBase, label: reward.label, description: reward.description });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMysteryRevealing(false);
    setMysteryReady(false);
    const secondsUntilNext = claim.secondsUntilNextClaim || 86400;
    setMysteryTimeLeft(secondsUntilNext);
    await AsyncStorage.setItem(MYSTERY_BOX_KEY, JSON.stringify({ ready: false, secondsRemaining: secondsUntilNext }));
    await AsyncStorage.setItem("chatdjt_mystery_opened", "true").catch(() => {});
  }

  async function getLocalUnlockedPersonas(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(ARENA_MYSTERY_UNLOCK_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /** Checks whether a friend's referral has converted since this device last acknowledged one. */
  async function checkReferralNotifications() {
    if (!deviceId) return;
    try {
      const res = await fetch(new URL("/api/referral/notifications", getApiUrl()).toString(), {
        headers: { "x-device-id": deviceId },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.hasNewReferral) {
        setInviteSuccess({
          newReferrals: data.newReferrals,
          tokensEarned: data.tokensEarned,
          grants: Array.isArray(data.grants) ? data.grants : [],
        });
        refreshBalance?.();
      }
    } catch (err) {
      console.warn("[referral] notification check failed:", err);
    }
  }

  /** Dismisses the invite-success banner and tells the server it's been seen. */
  async function dismissInviteSuccess() {
    if (!deviceId) return;
    setInviteSuccess(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await fetch(new URL("/api/referral/notifications/ack", getApiUrl()).toString(), {
        method: "POST",
        headers: { "x-device-id": deviceId },
      });
    } catch (err) {
      console.warn("[referral] failed to acknowledge notification:", err);
    }
  }

  function dismissMysteryPrize() {
    setMysteryPrize(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  /** Fetch (or return cached) referral URL for this device, used to attribute Mystery Box shares. */
  async function fetchMysteryReferralUrl(): Promise<{ url: string; nativeUrl?: string }> {
    if (referralUrlCacheRef.current) return referralUrlCacheRef.current;
    const headers: Record<string, string> = {};
    if (deviceId) headers["x-device-id"] = deviceId;
    const res = await fetch(new URL("/api/referral/generate", getApiUrl()).toString(), { headers });
    if (!res.ok) throw new Error("Failed to generate referral code");
    const data = await res.json();
    referralUrlCacheRef.current = { url: data.url, nativeUrl: data.nativeUrl };
    return referralUrlCacheRef.current;
  }

  async function shareMysteryPrize() {
    if (!mysteryPrize || mysteryPrizeSharing) return;
    setMysteryPrizeSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { url, nativeUrl } = await fetchMysteryReferralUrl();
      const shareLink = Platform.OS === "web" ? url : nativeUrl || url;
      const message =
        `🎁 I just won "${mysteryPrize.label}" from today's Mystery Box on The Arena!\n` +
        `Open your own free box and we BOTH score bonus tokens 👉 ${shareLink}`;
      await Share.share(
        Platform.OS === "web" ? { message, url } : { message },
      );
      trackAnalyticsEvent("mystery_box_share", {
        reward_label: mysteryPrize.label,
        reward_icon: mysteryPrize.icon,
      });
    } catch (err) {
      console.warn("[mystery-box] share failed:", err);
      Alert.alert("Share failed", "Couldn't share your win right now. Please try again.");
    } finally {
      setMysteryPrizeSharing(false);
    }
  }

  function dismissPersonaUnlock() {
    setUnlockedPersonaId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      trackAnalyticsEvent("feedback_submitted", { rating: feedbackRating });
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
    playClick();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const conv = await createConversation("New Chat");
    router.push({ pathname: "/chat/[id]", params: { id: conv.id } });
  }

  async function handleDailyChallenge() {
    if (!dailyChallenge) return;
    playClick();
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
      <ArenaSetupBackdrop />
      <LinearGradient
        colors={["rgba(10, 10, 10, 0.15)", "rgba(10, 10, 10, 0.0)", "rgba(10, 10, 10, 0.25)"]}
        style={styles.backgroundOverlay}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      <Animated.View
        entering={FadeInUp.duration(600)}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => {
              playTransition();
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
        <Pressable
          onPress={handleSecretTap}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityLabel="Dynamic Creations"
          testID="dynamic-creations-brand"
          style={({ pressed }) => [styles.headerBrandButton, pressed && styles.headerBrandPressed]}
        >
          <Text style={styles.headerBrandBy}>by</Text>
          <Image
            source={require("@/assets/images/dynamic-creations.jpg")}
            style={styles.headerBrandLogo}
            resizeMode="contain"
          />
        </Pressable>
        <View style={{ flexDirection: "row" as const, alignItems: "center" as const, gap: 5 }}>
          {!welcomePlayedRef.current && (
            <Pressable
              onPress={playWelcomeOnInteraction}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(212,164,32,0.2)", alignItems: "center" as const, justifyContent: "center" as const }}
            >
              <Ionicons name="volume-high" size={16} color="#D4A420" />
            </Pressable>
          )}
          {balance && (
            <Pressable onPress={() => router.push("/subscribe")} style={{ flexDirection: "row" as const, alignItems: "center" as const, gap: 3, backgroundColor: "rgba(212,164,32,0.15)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(212,164,32,0.3)" }}>
              <Image source={require("@/assets/images/dc-lightning-token.jpeg")} style={{ width: 14, height: 14, borderRadius: 7 }} />
              <Text style={{ fontSize: 11, fontWeight: "800" as const, color: Colors.gold }}>{balance.totalAvailable}</Text>
            </Pressable>
          )}
          <ShareAppButton variant="icon" />
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/settings"); }}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(212,164,32,0.15)", alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 1, borderColor: "rgba(212,164,32,0.3)" }}
            testID="settings-button"
          >
            <Ionicons name="settings-outline" size={16} color={Colors.gold} />
          </Pressable>
        </View>
      </Animated.View>

      <ScrollView
        ref={mainScrollRef}
        style={styles.centerScroll}
        contentContainerStyle={styles.centerContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        bounces={true}
        decelerationRate="normal"
      >
        <View style={{ width: "100%" }}>
          <ProposedHomeEntry
            onSetup={() => {
              playNavVoice("The Arena. Where minds clash and reputations are made.");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/arena");
            }}
            onInterview={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/interview");
            }}
            onTherapy={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              playNavVoice("Trump Therapy. Confront your issues with the man himself.");
              router.push("/therapy");
            }}
            onFortune={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              playNavVoice("Fortune Parlor. The cards know what you don't.");
              router.push("/fortune");
            }}
            onSports={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              playNavVoice("Sports Book. Live picks. Live games. The action is real.");
              router.push("/sports");
            }}
          />
        </View>
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={() => { playNavVoice("Roast Me. You sure you can handle this?"); handleRoastMode(); }}
            style={({ pressed }) => [styles.modeButton, styles.roastButton, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="fire" size={18} color="#FF4444" />
            <Text style={styles.modeButtonText}>ROAST ME</Text>
          </Pressable>
          <Pressable
            onPress={() => { playNavVoice("Debate Mode. Step into the ring."); handleDebateMode(); }}
            style={({ pressed }) => [styles.modeButton, styles.debateButton, pressed && { opacity: 0.7 }]}
            testID="debate-me-button"
          >
            <MaterialCommunityIcons name="podium" size={18} color={Colors.gold} />
            <Text style={styles.modeButtonText}>DEBATE ME</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(450).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={() => { playNavVoice("Live News. Breaking news, Trump's take."); handleLiveNewsMode(); }}
            style={({ pressed }) => [styles.modeButton, styles.liveNewsButton, pressed && { opacity: 0.7 }]}
            testID="livenews-button"
          >
            <View style={styles.liveDot} />
            <Text style={styles.modeButtonText}>LIVE NEWS</Text>
          </Pressable>
          <Pressable
            onPress={() => { playNavVoice("Predict. Trumpadamus sees the future."); handleNostradamusMode(); }}
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
        <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={() => { playNavVoice("Truth Social. Time to post the truth."); handleTruthSocialMode(); }}
            style={({ pressed }) => [styles.modeButton, styles.truthSocialButton, pressed && { opacity: 0.7 }]}
            testID="truthsocial-button"
          >
            <Ionicons name="megaphone" size={16} color="#4A90D9" />
            <Text style={styles.modeButtonText}>TRUTH SOCIAL</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              playNavVoice("Cabinet Hot Seat. Someone's getting fired.");
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
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowMoreModes((v) => !v);
          }}
          style={({ pressed }) => [styles.showMoreModesBtn, pressed && { opacity: 0.7 }]}
          testID="home-more-explore"
          accessibilityRole="button"
          accessibilityLabel={showMoreModes ? "Show fewer modes" : "More to explore"}
          accessibilityState={{ expanded: showMoreModes }}
        >
          <Text style={styles.showMoreModesText}>{showMoreModes ? "SHOW FEWER MODES" : "MORE TO EXPLORE"}</Text>
          <Ionicons name={showMoreModes ? "chevron-up" : "chevron-down"} size={14} color={Colors.gold} />
        </Pressable>

        {showMoreModes && (
        <>
        <Animated.View entering={FadeInDown.delay(550).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={() => {
              playNavVoice("Dashboard. The full picture. Every number.");
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
              playNavVoice("Rate Trump. Go ahead, I can take it.");
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
        <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={() => {
              playNavVoice("Realty. Premier properties. Real opportunities.");
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
              playNavVoice("Billionaires Game. Let's make some money.");
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
        <Animated.View entering={FadeInDown.delay(650).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={() => {
              playNavVoice("Financial Faceoff. Who's the smartest with money?");
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
              playNavVoice("Debate Arena. Winner takes all.");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/debate");
            }}
            style={({ pressed }) => [styles.modeButton, styles.debateButton, pressed && { opacity: 0.7 }]}
            testID="debate-arena-button"
          >
            <Ionicons name="flash" size={16} color="#FF4D4D" />
            <Text style={styles.modeButtonText}>DEBATE ARENA</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(750).duration(500)} style={styles.modeButtons}>
          <Pressable
            onPress={() => {
              playNavVoice("News World Report. Live. Biased. Unhinged.");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/news-report");
            }}
            style={({ pressed }) => [styles.modeButton, styles.newsReportButton, pressed && { opacity: 0.7 }]}
            testID="news-report-button"
          >
            <MaterialCommunityIcons name="broadcast" size={16} color="#FF4444" />
            <Text style={styles.modeButtonText}>NEWS REPORT</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              playNavVoice("Collectibles. Rare. Historic. Yours to own.");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push("/collectibles");
            }}
            style={({ pressed }) => [styles.modeButton, styles.collectiblesButton, pressed && { opacity: 0.7 }]}
            testID="collectibles-button"
          >
            <MaterialCommunityIcons name="cards" size={16} color="#FFD700" />
            <Text style={styles.modeButtonText}>COLLECTIBLES</Text>
            {collectionCount.owned > 0 && (
              <View style={styles.collectiblesBadge}>
                <Text style={styles.collectiblesBadgeText}>{collectionCount.owned}/{collectionCount.total}</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
        </>
        )}

        {streak > 0 && (
          <Animated.View entering={FadeIn.delay(800).duration(500)} style={styles.streakRow}>
            <View style={styles.streakBadge}>
              <MaterialCommunityIcons name="fire" size={16} color="#FF6B35" />
              <Text style={styles.streakText}>{streak} day streak</Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const msg = `I've used The Arena for ${streak} days in a row! \uD83D\uDD25 Can you beat my streak? thearena.rip`;
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

        {inviteSuccess && (
          <Animated.View entering={FadeInDown.duration(400)} exiting={FadeOutUp.duration(250)}>
            <Pressable
              onPress={dismissInviteSuccess}
              style={styles.inviteSuccessBanner}
              testID="invite-success-banner"
            >
              <Text style={styles.inviteSuccessEmoji}>🎉</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteSuccessTitle}>
                  Your invite worked! +{inviteSuccess.tokensEarned} tokens
                </Text>
                <Text style={styles.inviteSuccessSub}>
                  {formatInviteSuccessDetail(inviteSuccess)}
                </Text>
              </View>
              <Feather name="x" size={16} color="rgba(10,10,10,0.6)" />
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(850).duration(500)}>
          <Pressable
            onPress={openMysteryBox}
            disabled={mysteryRevealing}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <LinearGradient
              colors={mysteryReady ? ["#FFD700", "#b8860b", "#FFD700"] : ["#1a1a2e", "#16213e", "#1a1a2e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mysteryBoxCard}
            >
              <View style={styles.mysteryBoxHeader}>
                <View style={{ position: "relative" as const }}>
                  <Text style={styles.mysteryBoxEmoji}>{mysteryReady ? "\uD83C\uDF81" : "\uD83D\uDD12"}</Text>
                  {!!inviteSuccess && <TrophyNewPip testID="mystery-box-invite-pip" />}
                </View>
                <View>
                  <Text style={[styles.mysteryBoxTitle, mysteryReady && { color: "#0a0a0a" }]}>MYSTERY BOX</Text>
                  <Text style={[styles.mysteryBoxSub, mysteryReady && { color: "#0a0a0a" }]}>
                    {mysteryRevealing
                      ? "REVEALING..."
                      : !linkedUser
                        ? "VERIFY EMAIL TO OPEN"
                        : mysteryReady
                          ? "TAP TO OPEN!"
                          : `Opens in: ${Math.floor(mysteryTimeLeft / 3600)}h ${Math.floor((mysteryTimeLeft % 3600) / 60)}m`}
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

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowExtras((v) => !v);
          }}
          style={({ pressed }) => [styles.showMoreModesBtn, pressed && { opacity: 0.7 }]}
          testID="show-extras-toggle"
        >
          <Text style={styles.showMoreModesText}>{showExtras ? "HIDE MORE TO EXPLORE" : "MORE TO EXPLORE"}</Text>
          <Ionicons name={showExtras ? "chevron-up" : "chevron-down"} size={14} color={Colors.gold} />
        </Pressable>

        {showExtras && (
        <>
        <Animated.View entering={FadeInDown.delay(900).duration(400)}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/personas");
            }}
            style={({ pressed }) => [styles.personasTrophyEntry, pressed && { opacity: 0.85 }]}
            testID="personas-trophy-entry"
          >
            <View style={styles.personasTrophyIconWrap}>
              <MaterialCommunityIcons name="trophy" size={18} color="#FFD700" />
              {unseenMysteryCount > 0 && <TrophyNewPip testID="personas-trophy-new-pip" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.personasTrophyTitle}>PERSONAS TROPHY ROOM</Text>
              <Text style={styles.personasTrophySub}>
                {unlockedPersonaCount}/{ARENA_MYSTERY_PERSONA_IDS.length} mystery debaters unlocked
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.gold} />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/tiktok-live");
            }}
            style={({ pressed }) => [styles.personasTrophyEntry, { borderColor: "rgba(255,68,68,0.35)", borderTopWidth: 1, borderTopColor: "rgba(255,68,68,0.35)" }, pressed && { opacity: 0.85 }]}
            testID="tiktok-live-entry"
          >
            <View style={[styles.personasTrophyIconWrap, { backgroundColor: "rgba(255,68,68,0.12)" }]}>
              <Ionicons name="logo-tiktok" size={18} color="#ff4d4d" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.personasTrophyTitle, { color: "#ff4d4d" }]}>TIKTOK LIVE POLLS</Text>
              <Text style={styles.personasTrophySub}>Viral debate polls for your live streams</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#ff4d4d" />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/dc-university");
            }}
            style={({ pressed }) => [styles.personasTrophyEntry, { borderColor: "rgba(255,215,0,0.35)", borderTopWidth: 1, borderTopColor: "rgba(255,215,0,0.35)" }, pressed && { opacity: 0.85 }]}
            testID="dc-university-entry"
          >
            <View style={[styles.personasTrophyIconWrap, { backgroundColor: "rgba(255,215,0,0.12)" }]}>
              <Image source={require("@/assets/images/dc-university-crest.png")} style={{ width: 26, height: 26 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.personasTrophyTitle, { color: "#FFD700" }]}>DC UNIVERSITY</Text>
              <Text style={styles.personasTrophySub}>Private lectures from real-world scholars</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#FFD700" />
          </Pressable>
        </Animated.View>

        {factOfDay && (
          <Animated.View entering={FadeInDown.delay(870).duration(500)}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/dc-university");
              }}
              style={({ pressed }) => [styles.factOfDayCard, pressed && { opacity: 0.85 }]}
              testID="fact-of-day-widget"
            >
              <View style={styles.factOfDayHeader}>
                <Image source={require("@/assets/images/dc-university-crest.png")} style={{ width: 16, height: 16 }} resizeMode="contain" />
                <Text style={styles.factOfDayLabel}>DC UNIVERSITY FACT OF THE DAY · {factOfDay.educatorName.toUpperCase()}</Text>
                <Pressable
                  onPress={(e) => { e.stopPropagation?.(); toggleFactVoice(); }}
                  hitSlop={8}
                  testID="fact-of-day-voice-toggle"
                  accessibilityLabel={factVoiceEnabled ? "Turn off spoken fact of the day" : "Turn on spoken fact of the day"}
                >
                  <Ionicons name={factVoiceEnabled ? "volume-high" : "volume-mute"} size={15} color={factVoiceEnabled ? "#FFD700" : "rgba(255,255,255,0.4)"} />
                </Pressable>
              </View>
              <Text style={styles.factOfDayText} numberOfLines={3}>{factOfDay.fact}</Text>
            </Pressable>
          </Animated.View>
        )}

        {hotTake && (
          <Animated.View entering={FadeIn.delay(900).duration(600)} style={styles.hotTakeBubble}>
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

        {activityFromLive.length > 0 && (
          <Animated.View entering={FadeInDown.delay(950).duration(400)}>
            <Animated.View style={[styles.activityWall, activityShakeStyle]}>
              <View style={styles.activityHeader}>
                <Ionicons name="flash" size={14} color="#ff4d4d" />
                <Text style={styles.activityTitle}>LIVE ACTIVITY</Text>
                <View style={styles.activityPulse} />
              </View>
              {activityFromLive.map((activity, i) => {
                const isBoosted = activity.boosted;
                const itemColor = activity.color;
                const isNewest = i === 0;
                return (
                <Animated.View
                  key={`act-${i}-${activity.message}`}
                  entering={FadeIn.duration(400)}
                  style={[
                    styles.activityItem,
                    isNewest && styles.activityItemNew,
                    isBoosted && { borderLeftWidth: 2, borderLeftColor: "#FFD70040", paddingLeft: 6, backgroundColor: "rgba(255,215,0,0.04)" },
                  ]}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: (isBoosted ? "#FFD700" : itemColor) + "20", justifyContent: "center", alignItems: "center", marginRight: 6 }}>
                    <Ionicons name={activity.icon as any} size={10} color={isBoosted ? "#FFD700" : itemColor} />
                  </View>
                  <Text style={[
                    styles.activityText,
                    isNewest && styles.activityTextNew,
                    { color: isNewest ? itemColor : isBoosted ? "rgba(255,215,0,0.7)" : "rgba(255,255,255,0.5)" },
                    isBoosted && { fontWeight: "600" as const },
                  ]} numberOfLines={1}>{activity.message}</Text>
                </Animated.View>
                );
              })}
            </Animated.View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(990).duration(500)}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(dailyFeature.route as any);
            }}
            style={({ pressed }) => [styles.featureOfDayCard, pressed && { opacity: 0.85 }]}
          >
            <View style={[styles.featureOfDayAccent, { backgroundColor: dailyFeature.color + "30" }]} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[styles.featureOfDayIconWrap, { backgroundColor: dailyFeature.color + "22" }]}>
                <Text style={{ fontSize: 22 }}>{dailyFeature.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <Text style={styles.featureOfDayLabel}>🔥 TODAY'S HOT FEATURE</Text>
                </View>
                <Text style={[styles.featureOfDayTitle, { color: dailyFeature.color }]}>{dailyFeature.title}</Text>
                <Text style={styles.featureOfDaySub} numberOfLines={2}>{dailyFeature.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={dailyFeature.color} />
            </View>
          </Pressable>
        </Animated.View>

        {dailyChallenge && (
          <Animated.View entering={FadeInDown.delay(1000).duration(500)}>
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

        <Animated.View entering={FadeInDown.delay(1050).duration(500)} style={styles.weeklyCard}>
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

        {electionDays > 0 && (
          <Animated.View entering={FadeInDown.delay(1100).duration(500)} style={styles.electionCard}>
            <View style={styles.electionHeader}>
              <Text style={styles.electionIcon}>{"\uD83D\uDDF3\uFE0F"}</Text>
              <Text style={styles.electionLabel}>NEXT ELECTION</Text>
            </View>
            <View style={styles.electionDaysRow}>
              <Text style={styles.electionDaysNum}>{electionDays}</Text>
              <Text style={styles.electionDaysSuffix}> days</Text>
            </View>
            <Text style={styles.electionDate}>November 3, 2026 — Midterms</Text>
            <Text style={styles.electionQuote}>
              "{electionDays > 200
                ? "We're going to win SO big, it'll make your head spin. Believe me!"
                : electionDays > 100
                ? "They're getting nervous, folks. They know what's coming. TREMENDOUS victory incoming!"
                : electionDays > 30
                ? "It's almost here, and let me tell you — the other side is PANICKING. We're gonna crush it!"
                : "Days away from the BIGGEST victory in history. Nobody's ever seen anything like it!"}"
            </Text>
          </Animated.View>
        )}

        {fearGreed && (
          <Animated.View entering={FadeInDown.delay(1750).duration(500)} style={styles.fearGreedCard}>
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
          <Animated.View entering={FadeInDown.delay(1800).duration(500)} style={styles.leaderboardCard}>
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
                playClick();
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
          <Animated.View entering={FadeInDown.delay(1900).duration(500)} style={styles.badgesCard}>
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
        </>
        )}

        <CashAppDonate />

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

      <View style={[styles.musicWidget, { bottom: Platform.OS === "web" ? 34 + 24 : insets.bottom + 16 }]}>
        <Pressable onPress={toggleMenuMusic} style={[styles.musicToggleBtn, menuMusicPlaying && styles.musicTogglePlaying]}>
          <Ionicons name={menuMusicPlaying ? "pause" : "musical-notes"} size={20} color={menuMusicPlaying ? "#000" : "#D4A420"} />
        </Pressable>
        <View style={styles.musicInfoCol}>
          <Text style={styles.musicLabel}>{menuMusicPlaying ? "Now Playing" : "Music Off"}</Text>
          {!!menuTrackName && <Text style={styles.musicTrackName} numberOfLines={1}>{menuTrackName}</Text>}
        </View>
        {menuMusicPlaying && (
          <Pressable onPress={skipMenuTrack} style={styles.musicSkipBtn}>
            <Ionicons name="play-skip-forward" size={16} color="#aaa" />
          </Pressable>
        )}
      </View>

      <Modal visible={showOnboarding} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.onboardingOverlay}>
          <Animated.View entering={ZoomIn.duration(400)} style={styles.onboardingCard}>
            <View style={styles.onboardingEmojiWrap}>
              <Text style={{ fontSize: 48 }}>{ONBOARDING_STEPS[onboardingStep].emoji}</Text>
            </View>
            <Text style={styles.onboardingTitle}>{ONBOARDING_STEPS[onboardingStep].title}</Text>
            <Text style={styles.onboardingBody}>{ONBOARDING_STEPS[onboardingStep].body}</Text>
            <View style={styles.onboardingDots}>
              {ONBOARDING_STEPS.map((_, i) => (
                <View key={i} style={[styles.onboardingDot, i === onboardingStep && styles.onboardingDotActive]} />
              ))}
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (onboardingStep < ONBOARDING_STEPS.length - 1) {
                  setOnboardingStep(onboardingStep + 1);
                } else {
                  AsyncStorage.setItem(ONBOARDING_DONE_KEY, "1");
                  setShowOnboarding(false);
                  setOnboardingStep(0);
                }
              }}
              style={styles.onboardingNextBtn}
            >
              <Text style={styles.onboardingNextText}>
                {onboardingStep < ONBOARDING_STEPS.length - 1 ? "Next →" : "Let's Go!"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                AsyncStorage.setItem(ONBOARDING_DONE_KEY, "1");
                setShowOnboarding(false);
                setOnboardingStep(0);
              }}
              style={styles.onboardingSkip}
            >
              <Text style={styles.onboardingSkipText}>Skip</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

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
                <Text style={styles.feedbackTitle}>Rate The Arena</Text>
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

      <MysteryPersonaTeaser state={mysteryTeaser} />
      <PersonaUnlockModal personaId={unlockedPersonaId} onDismiss={dismissPersonaUnlock} />

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
              <Pressable
                onPress={shareMysteryPrize}
                disabled={mysteryPrizeSharing}
                style={[styles.mysteryPrizeShare, mysteryPrizeSharing && { opacity: 0.6 }]}
                testID="mystery-prize-share"
              >
                {mysteryPrizeSharing ? (
                  <ActivityIndicator size="small" color="#0a0a0a" />
                ) : (
                  <Ionicons name="share-social" size={16} color="#0a0a0a" />
                )}
                <Text style={styles.mysteryPrizeShareText}>SHARE YOUR PULL</Text>
              </Pressable>
              <Pressable onPress={dismissMysteryPrize} style={styles.mysteryPrizeDismiss}>
                <Text style={styles.mysteryPrizeDismissText}>CLAIM & CLOSE</Text>
              </Pressable>
              <Text style={styles.mysteryPrizeTimer}>Next box in 24 hours</Text>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
      <SoundToggle />
      <SuggestionBox />
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
    fontSize: 10,
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
    color: "rgba(212, 164, 32, 1)",
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212, 164, 32, 0.15)",
  },
  brandByText: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.65)",
    fontStyle: "italic",
  },
  brandLogo: {
    width: 100,
    height: 24,
  },
  parodyFooter: {
    fontSize: 11,
    color: "#999999",
    textAlign: "center",
    paddingVertical: 6,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    letterSpacing: 0.5,
  },
  bottomBarContainer: {
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  tickerContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
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
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    maxWidth: 1240,
    alignSelf: "center",
    width: "100%",
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  headerBrandButton: {
    flex: 1,
    minWidth: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginHorizontal: 2,
    paddingHorizontal: 2,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
  },
  headerBrandPressed: {
    backgroundColor: "rgba(255,215,0,0.12)",
  },
  headerBrandBy: {
    fontSize: 11,
    color: "rgba(255, 215, 0, 0.85)",
    fontStyle: "italic",
    fontWeight: "600" as const,
    textShadowColor: "rgba(255, 215, 0, 0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  headerBrandLogo: {
    width: 104,
    height: 27,
    maxWidth: "78%",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
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
  activityPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ff4d4d",
    marginLeft: "auto" as any,
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
    color: "rgba(255,255,255,0.65)",
  },
  activityText: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  activityTextNew: {
    color: "#ff4d4d",
    fontWeight: "600" as const,
  },
  glossyHeaderBtn: {
    alignItems: "center",
    gap: 2,
  },
  glossyHeaderCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 8,
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
    paddingVertical: 10,
    paddingHorizontal: 2,
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
  factOfDayCard: {
    backgroundColor: "rgba(255,215,0,0.07)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
  },
  factOfDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  factOfDayLabel: {
    fontSize: 9.5,
    fontWeight: "800" as const,
    color: Colors.gold,
    letterSpacing: 0.8,
    flex: 1,
  },
  factOfDayText: {
    fontSize: 12.5,
    color: Colors.white,
    lineHeight: 18,
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
  showMoreModesBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(212,164,32,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.25)",
    borderStyle: "dashed" as const,
  },
  showMoreModesText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
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
  newsReportButton: {
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    borderColor: "rgba(255, 68, 68, 0.35)",
    flex: 1,
  },
  collectiblesButton: {
    backgroundColor: "rgba(255, 215, 0, 0.12)",
    borderColor: "rgba(255, 215, 0, 0.35)",
    flex: 1,
  },
  collectiblesBadge: {
    position: "absolute",
    top: 4,
    right: 6,
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
  },
  collectiblesBadgeText: {
    fontSize: 8,
    fontWeight: "800" as const,
    color: "#FFD700",
    letterSpacing: 0.5,
  },
  arenaFeaturedCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "rgba(255, 77, 77, 0.5)",
    overflow: "hidden" as const,
    position: "relative" as const,
  },
  arenaFeaturedBorderGlow: {
    position: "absolute" as const,
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255, 77, 77, 0.3)",
  },
  arenaFeaturedHeader: {
    alignItems: "center" as const,
    gap: 6,
  },
  arenaFeaturedLive: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    backgroundColor: "rgba(255, 77, 77, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.4)",
  },
  arenaFeaturedLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ff4d4d",
  },
  arenaFeaturedLiveText: {
    fontSize: 10,
    fontWeight: "900" as const,
    color: "#ff4d4d",
    letterSpacing: 1.5,
  },
  arenaFeaturedTitle: {
    fontSize: 22,
    fontWeight: "900" as const,
    color: "#fff",
    letterSpacing: 3,
    textAlign: "center" as const,
  },
  arenaFeaturedSubtitle: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center" as const,
    letterSpacing: 0.5,
  },
  arenaFeaturedPersonas: {
    alignItems: "center" as const,
    marginTop: 10,
  },
  arenaFeaturedEmojis: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.45)",
    letterSpacing: 1,
    textAlign: "center" as const,
    fontWeight: "600" as const,
  },
  arenaFeaturedCta: {
    alignItems: "center" as const,
    marginTop: 14,
  },
  arenaFeaturedCtaGradient: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 25,
  },
  arenaFeaturedCtaText: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#fff",
    letterSpacing: 1.5,
  },
  sportsButton: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    borderColor: "rgba(76, 175, 80, 0.4)",
  },
  sportsTopButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(76,175,80,0.6)",
    overflow: "hidden" as const,
  },
  sportsTopButtonText: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: "#4CAF50",
    letterSpacing: 3,
  },
  sportsLiveBadge: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(76,175,80,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sportsLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#4CAF50",
  },
  sportsLiveBadgeText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "#4CAF50",
    letterSpacing: 1.5,
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
    fontSize: 11,
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
    color: "rgba(255,255,255,0.7)",
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
  inviteSuccessBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    marginHorizontal: 24,
    marginTop: 12,
    maxWidth: 380,
    alignSelf: "center" as const,
    width: "100%" as any,
    backgroundColor: "#FFD700",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  inviteSuccessEmoji: {
    fontSize: 22,
  },
  inviteSuccessTitle: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "#0a0a0a",
  },
  inviteSuccessSub: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "rgba(10,10,10,0.7)",
    marginTop: 2,
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
  mysteryPrizeShare: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    backgroundColor: "rgba(10,10,10,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(10,10,10,0.35)",
    paddingHorizontal: 30,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 10,
    minWidth: 220,
  },
  mysteryPrizeShareText: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "#0a0a0a",
    letterSpacing: 1.2,
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
  personasTrophyEntry: {
    marginTop: 8,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255, 215, 0, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.25)",
  },
  personasTrophyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 215, 0, 0.12)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  personasTrophyTitle: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: Colors.gold,
    letterSpacing: 1.4,
  },
  personasTrophySub: {
    fontSize: 11,
    color: Colors.whiteMuted,
    marginTop: 2,
  },
  electionCard: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.2)",
    alignItems: "center" as const,
  },
  electionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  electionIcon: {
    fontSize: 16,
  },
  electionLabel: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "#ff4d4d",
    letterSpacing: 1.5,
  },
  electionDaysRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  electionDaysNum: {
    fontSize: 36,
    fontWeight: "900" as const,
    color: Colors.gold,
  },
  electionDaysSuffix: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "rgba(255,215,0,0.6)",
  },
  electionDate: {
    fontSize: 10,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  electionQuote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontStyle: "italic" as const,
    textAlign: "center" as const,
    lineHeight: 18,
    paddingHorizontal: 8,
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
    fontSize: 10,
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
    color: "rgba(255,255,255,0.65)",
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
    color: "rgba(255,255,255,0.7)",
    textAlign: "center" as const,
    marginBottom: 2,
  },
  badgeLabelEarned: {
    color: Colors.gold,
  },
  badgeDesc: {
    fontSize: 10,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center" as const,
  },
  legalDisclaimer: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center" as const,
    lineHeight: 14,
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  featureOfDayCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "rgba(13,13,20,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
    padding: 14,
    overflow: "hidden" as const,
  },
  featureOfDayAccent: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  featureOfDayIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  featureOfDayLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "rgba(255,165,0,0.8)",
    letterSpacing: 1,
  },
  featureOfDayTitle: {
    fontSize: 16,
    fontWeight: "800" as const,
    marginBottom: 2,
  },
  featureOfDaySub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 16,
  },
  onboardingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 24,
  },
  onboardingCard: {
    backgroundColor: "#0D0D12",
    borderRadius: 24,
    padding: 28,
    width: "100%" as any,
    maxWidth: 380,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
  },
  onboardingEmojiWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(212,164,32,0.1)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 20,
  },
  onboardingTitle: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: "#FFD700",
    textAlign: "center" as const,
    marginBottom: 12,
  },
  onboardingBody: {
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center" as const,
    lineHeight: 22,
    marginBottom: 24,
  },
  onboardingDots: {
    flexDirection: "row" as const,
    gap: 8,
    marginBottom: 24,
  },
  onboardingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  onboardingDotActive: {
    backgroundColor: "#FFD700",
    width: 20,
  },
  onboardingNextBtn: {
    width: "100%" as any,
    backgroundColor: "#D4A420",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center" as const,
    marginBottom: 12,
  },
  onboardingNextText: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: "#000",
  },
  onboardingSkip: {
    paddingVertical: 8,
  },
  onboardingSkipText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.35)",
  },
  musicWidget: {
    position: "absolute",
    right: 14,
    zIndex: 9999,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: "rgba(13,13,18,0.95)",
    borderWidth: 2,
    borderColor: "#D4A420",
    borderRadius: 30,
    paddingVertical: 7,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 20,
  },
  musicToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(212,164,32,0.2)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  musicTogglePlaying: {
    backgroundColor: "#D4A420",
  },
  musicInfoCol: {
    flexDirection: "column" as const,
    maxWidth: 120,
  },
  musicLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
  },
  musicTrackName: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#D4A420",
  },
  musicSkipBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
});
