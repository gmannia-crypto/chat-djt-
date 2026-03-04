import React, { useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { shareContent } from "@/lib/track-share";

interface Persona {
  id: string;
  name: string;
  fullName: string;
  color: string;
  advice: Record<string, string>;
  catchphrases: string[];
  affiliate: Record<string, string | null>;
}

interface Topic {
  id: string;
  name: string;
  emoji: string;
  category: string;
  volatility: string;
  description: string;
}

const PERSONAS: Persona[] = [
  {
    id: "trump",
    name: "Trump",
    fullName: "Donald J. Trump",
    color: "#ff4d4d",
    advice: {
      crypto: "Buy Bitcoin! It's going to the moon! The best investment ever! Use my link!",
      stock: "My stocks are the BEST stocks. Everyone says so. Buy what I buy!",
      property: "I know real estate. I wrote the book. Buy property NOW!",
      commodity: "Gold? I have gold. Beautiful gold. But Trump coin is better!",
      etf: "Index funds? Boring. But smart. Very smart. Like me.",
      default: "The best investment? Anything with my name on it!",
    },
    catchphrases: ["Tremendous!", "Believe me!", "Everyone says so!", "The best!", "You're going to win so much!"],
    affiliate: { coinbase: "https://coinbase.com/join/trump", binance: "https://binance.com/trump" },
  },
  {
    id: "buffett",
    name: "Buffett",
    fullName: "Warren Buffett",
    color: "#4d4dff",
    advice: {
      crypto: "I don't understand Bitcoin. I stick with what I know - productive assets.",
      stock: "Index funds. Low fees. Long term. Here's Vanguard.",
      property: "Real estate can be fine, but focus on businesses you understand.",
      commodity: "Gold doesn't produce anything. Buy businesses, not rocks.",
      etf: "A low-cost S&P 500 index fund is the best investment most people can make.",
      default: "Never lose money. Rule number one. Rule number two: never forget rule one.",
    },
    catchphrases: ["Be fearful when others are greedy...", "Our favorite holding period is forever.", "Price is what you pay. Value is what you get.", "Someone's sitting in the shade today..."],
    affiliate: { vanguard: "https://vanguard.com/buffett" },
  },
  {
    id: "musk",
    name: "Elon",
    fullName: "Elon Musk",
    color: "#00ccff",
    advice: {
      crypto: "Dogecoin! To the moon! Literally! Much wow!",
      stock: "Tesla stock is undervalued. Seriously. But I'm biased.",
      property: "I sold all my houses. Own nothing, be happy. Or buy a Cybertruck.",
      commodity: "Gold is for people who don't believe in the future. I'm building the future.",
      etf: "ETFs are fine if you want average returns. I don't do average.",
      default: "The future should be exciting. If it's not, you're doing it wrong.",
    },
    catchphrases: ["To the moon!", "Literally.", "I'm not saying it's gonna be easy, I'm saying it's gonna be worth it.", "When something is important enough..."],
    affiliate: { binance: "https://binance.com/elon", coinbase: "https://coinbase.com/elon" },
  },
  {
    id: "suze",
    name: "Suze",
    fullName: "Suze Orman",
    color: "#ff99cc",
    advice: {
      crypto: "People are going to get hurt. You hear me? HURT. Don't gamble.",
      stock: "Index funds are fine, but do you have an emergency fund FIRST?",
      property: "Can you REALLY afford this payment? Be honest with yourself.",
      commodity: "Gold doesn't pay dividends. I want income in retirement.",
      etf: "Low-cost index funds after you have 8 months of expenses saved.",
      default: "You are not your credit score. But you NEED to protect it.",
    },
    catchphrases: ["DENIED!", "You are worthy!", "First, secure your own mask.", "People first, then money, then things."],
    affiliate: { vanguard: "https://vanguard.com/suze" },
  },
  {
    id: "dave",
    name: "Dave",
    fullName: "Dave Ramsey",
    color: "#ffaa00",
    advice: {
      crypto: "DEBT IS DUMB! Crypto is gambling! BABY STEPS!",
      stock: "Invest 15% for retirement. Good mutual funds with good track records.",
      property: "Rent is dumb! Buy when you're debt-free with 3-6 months saved!",
      commodity: "Gold? AFTER you're debt-free and investing 15%. Then MAYBE.",
      etf: "I prefer good growth stock mutual funds over ETFs. But get out of debt first!",
      default: "If you're dumb enough to ask, you're dumb enough to do the opposite!",
    },
    catchphrases: ["DEBT IS DUMB!", "Live like no one else so you can LIVE like no one else!", "Gazelle intensity!", "If you live like no one else..."],
    affiliate: { ramsey: "https://ramseysolutions.com" },
  },
  {
    id: "grandma",
    name: "Grandma",
    fullName: "Your Grandma",
    color: "#ffffff",
    advice: {
      crypto: "Oh honey, is that like internet money? Sounds scary. Save your pennies.",
      stock: "Your grandpa loved AT&T. Paid dividends for 50 years. Solid company.",
      property: "Buy a nice little house you can afford. Don't stretch yourself.",
      commodity: "I have a gold bracelet your grandpa gave me. That's real gold, honey.",
      etf: "What's an ETF? Just put it in the bank, sweetie.",
      default: "Save a little every month. It adds up. And call your mother.",
    },
    catchphrases: ["Bless your heart.", "That's nice, dear.", "Have you eaten?", "When I was your age..."],
    affiliate: { treasury: "https://treasurydirect.gov" },
  },
  {
    id: "robot",
    name: "ROBOT",
    fullName: "AI Financial Advisor",
    color: "#00ff00",
    advice: {
      crypto: "ANALYZING... BITCOIN VOLATILITY: 67%. SUGGEST 2-5% PORTFOLIO ALLOCATION.",
      stock: "S&P 500 HISTORICAL RETURN: 10.2%. RECOMMEND LOW-COST INDEX FUND.",
      property: "CURRENT MARKET: BALANCED. CONSIDER LOCAL MARKET CONDITIONS.",
      commodity: "GOLD CORRELATION TO INFLATION: 0.47. CONSIDER AS HEDGE.",
      etf: "VTI EXPENSE RATIO: 0.03%. OPTIMAL FOR PASSIVE INVESTORS.",
      default: "CALCULATING OPTIMAL STRATEGY BASED ON YOUR RISK PROFILE...",
    },
    catchphrases: ["CALCULATING...", "PROCESSING...", "ANALYSIS COMPLETE.", "ERROR: HUMAN EMOTION DETECTED."],
    affiliate: { vanguard: "https://vanguard.com", betterment: "https://betterment.com" },
  },
];

const TOPICS: Topic[] = [
  { id: "bitcoin", name: "Bitcoin", emoji: "\u20BF", category: "crypto", volatility: "High", description: "The original cryptocurrency" },
  { id: "dogecoin", name: "Dogecoin", emoji: "\uD83D\uDC15", category: "crypto", volatility: "Extreme", description: "Meme coin, literally to the moon" },
  { id: "ethereum", name: "Ethereum", emoji: "\u039E", category: "crypto", volatility: "High", description: "Smart contract platform" },
  { id: "tesla", name: "Tesla", emoji: "\uD83D\uDE97", category: "stock", volatility: "High", description: "Elon's electric car company" },
  { id: "apple", name: "Apple", emoji: "\uD83C\uDF4E", category: "stock", volatility: "Medium", description: "Tech giant, iPhone maker" },
  { id: "vti", name: "VTI", emoji: "\uD83D\uDCCA", category: "etf", volatility: "Low", description: "Total stock market index fund" },
  { id: "gold", name: "Gold", emoji: "\uD83E\uDE99", category: "commodity", volatility: "Medium", description: "Precious metal, store of value" },
  { id: "realestate", name: "Real Estate", emoji: "\uD83C\uDFE0", category: "property", volatility: "Low", description: "Physical property investment" },
];

function getTitle(personaId: string): string {
  switch (personaId) {
    case "trump": return "45th & 47th President";
    case "buffett": return "Oracle of Omaha";
    case "musk": return "CEO of Tesla & SpaceX";
    case "suze": return "Personal Finance Expert";
    case "dave": return "Financial Peace University";
    case "grandma": return "Voice of Experience";
    case "robot": return "Algorithmic Analysis";
    default: return "";
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function PersonaCard({ persona, selected, onPress }: { persona: Persona; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        cardStyles.personaCard,
        { borderColor: selected ? persona.color : "rgba(255,255,255,0.1)" },
        selected && { backgroundColor: `${persona.color}15` },
      ]}
    >
      <View style={[cardStyles.personaAvatar, { borderColor: persona.color }]}>
        <Text style={[cardStyles.personaInitial, { color: persona.color }]}>{persona.name[0]}</Text>
      </View>
      <Text style={[cardStyles.personaName, selected && { color: persona.color }]}>{persona.name}</Text>
    </Pressable>
  );
}

function ContenderCard({ persona, topic, onVote, voteCount, totalVotes }: { persona: Persona; topic: Topic; onVote: () => void; voteCount: number; totalVotes: number }) {
  const advice = persona.advice[topic.category] || persona.advice.default;
  const catchphrase = pickRandom(persona.catchphrases);
  const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 50;

  return (
    <View style={[contenderStyles.card, { borderColor: `${persona.color}40` }]}>
      <View style={contenderStyles.header}>
        <View style={[contenderStyles.avatar, { borderColor: persona.color }]}>
          <Text style={[contenderStyles.avatarText, { color: persona.color }]}>{persona.name[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[contenderStyles.name, { color: persona.color }]}>{persona.fullName}</Text>
          <Text style={contenderStyles.title}>{getTitle(persona.id)}</Text>
        </View>
      </View>
      <View style={[contenderStyles.adviceBox, { borderLeftColor: persona.color }]}>
        <Text style={contenderStyles.adviceText}>"{advice}"</Text>
      </View>
      <Text style={contenderStyles.catchphrase}>
        <Text style={{ color: persona.color }}>{"\uD83D\uDCAD"} </Text>{catchphrase}
      </Text>
      <Pressable
        onPress={onVote}
        style={({ pressed }) => [contenderStyles.voteBtn, { backgroundColor: persona.color }, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
      >
        <Text style={contenderStyles.voteBtnText}>VOTE {persona.name.toUpperCase()}</Text>
      </Pressable>
      <Text style={contenderStyles.voteCount}>{voteCount} votes ({pct}%)</Text>
    </View>
  );
}

function VoteBar({ persona1, persona2, votes1, votes2 }: { persona1: Persona; persona2: Persona; votes1: number; votes2: number }) {
  const total = votes1 + votes2 || 1;
  const pct1 = (votes1 / total) * 100;

  const barWidth = useSharedValue(50);
  React.useEffect(() => {
    barWidth.value = withTiming(pct1, { duration: 600 });
  }, [pct1]);

  const bar1Style = useAnimatedStyle(() => ({
    width: `${barWidth.value}%` as any,
  }));

  return (
    <View style={voteBarStyles.container}>
      <View style={voteBarStyles.labels}>
        <Text style={[voteBarStyles.label, { color: persona1.color }]}>{persona1.name} {votes1}</Text>
        <Text style={[voteBarStyles.label, { color: persona2.color }]}>{persona2.name} {votes2}</Text>
      </View>
      <View style={voteBarStyles.bar}>
        <Animated.View style={[voteBarStyles.fill1, { backgroundColor: persona1.color }, bar1Style]} />
      </View>
    </View>
  );
}

export default function FaceoffScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const scrollRef = useRef<ScrollView>(null);

  const [selectedTopic, setSelectedTopic] = useState<Topic>(TOPICS[0]);
  const [contender1, setContender1] = useState<Persona>(PERSONAS[0]);
  const [contender2, setContender2] = useState<Persona>(PERSONAS[1]);
  const [debateStarted, setDebateStarted] = useState(false);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [debateId, setDebateId] = useState<string | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);

  const ENCOURAGEMENTS = [
    "Keep voting! The winner gets bragging rights!",
    "Your vote matters in this financial showdown!",
    "Who do YOU trust with your money?",
    "Share this debate with your friends!",
  ];

  const handleStartDebate = useCallback(() => {
    if (contender1.id === contender2.id) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const id = `${contender1.id}_${contender2.id}_${selectedTopic.id}_${Date.now()}`;
    setDebateId(id);
    setVotes({ [contender1.id]: 0, [contender2.id]: 0 });
    setDebateStarted(true);

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      globalThis.fetch(`${baseUrl}/api/track-viral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "debate_started", asset: selectedTopic.id, persona1: contender1.id, persona2: contender2.id }),
      }).catch(() => {});
    } catch {}

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 400);
  }, [contender1, contender2, selectedTopic]);

  const handleVote = useCallback(async (personaId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVotes(prev => ({ ...prev, [personaId]: (prev[personaId] || 0) + 1 }));

    setToastText(pickRandom(ENCOURAGEMENTS));
    setTimeout(() => setToastText(null), 2500);

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await globalThis.fetch(`${baseUrl}/api/faceoff/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debateId,
          asset: selectedTopic.id,
          persona1: contender1.id,
          persona2: contender2.id,
          votedFor: personaId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.votes) {
          setVotes(data.votes);
        }
      }
    } catch {}

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      globalThis.fetch(`${baseUrl}/api/track-viral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "vote_cast", debateId, votedFor: personaId }),
      }).catch(() => {});
    } catch {}
  }, [debateId, contender1, contender2, selectedTopic]);

  const handleShare = useCallback(() => {
    const v1 = votes[contender1.id] || 0;
    const v2 = votes[contender2.id] || 0;
    const shareText = `FINANCIAL FACEOFF: ${contender1.name} vs ${contender2.name} on ${selectedTopic.name}!\n\nCurrent vote: ${v1}-${v2}\n\n${contender1.name}: "${contender1.advice[selectedTopic.category] || contender1.advice.default}"\n\n${contender2.name}: "${contender2.advice[selectedTopic.category] || contender2.advice.default}"\n\nWho's right? Play at chat-djt.replit.app`;
    shareContent({ text: shareText, feature: "faceoff" });

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      globalThis.fetch(`${baseUrl}/api/track-viral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "debate_shared", debateId }),
      }).catch(() => {});
    } catch {}
  }, [contender1, contender2, selectedTopic, votes, debateId]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDebateStarted(false);
    setVotes({});
    setDebateId(null);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient
        colors={["#0a0a14", "#0a0a0a", "#140a0a"]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>FINANCIAL FACEOFF</Text>
        </View>
        {debateStarted ? (
          <Pressable onPress={handleShare} style={styles.shareBtn}>
            <Ionicons name="share-outline" size={20} color={Colors.gold} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.sectionLabel}>PICK AN ASSET</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicScroll} contentContainerStyle={styles.topicScrollContent}>
            {TOPICS.map((topic) => {
              const isSelected = selectedTopic.id === topic.id;
              return (
                <Pressable
                  key={topic.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedTopic(topic);
                    if (debateStarted) handleReset();
                  }}
                  style={[
                    styles.topicPill,
                    isSelected && styles.topicPillSelected,
                  ]}
                >
                  <Text style={styles.topicEmoji}>{topic.emoji}</Text>
                  <Text style={[styles.topicName, isSelected && styles.topicNameSelected]}>{topic.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={styles.sectionLabel}>CONTENDER 1</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.personaScroll} contentContainerStyle={styles.personaScrollContent}>
            {PERSONAS.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={contender1.id === p.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setContender1(p);
                  if (debateStarted) handleReset();
                }}
              />
            ))}
          </ScrollView>
        </Animated.View>

        <View style={styles.vsContainer}>
          <View style={styles.vsLine} />
          <View style={styles.vsBadge}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <View style={styles.vsLine} />
        </View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text style={styles.sectionLabel}>CONTENDER 2</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.personaScroll} contentContainerStyle={styles.personaScrollContent}>
            {PERSONAS.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={contender2.id === p.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setContender2(p);
                  if (debateStarted) handleReset();
                }}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {!debateStarted && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <Pressable
              onPress={handleStartDebate}
              style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
            >
              <LinearGradient
                colors={[Colors.gold, Colors.goldDark]}
                style={styles.startBtnGradient}
              >
                <MaterialCommunityIcons name="sword-cross" size={22} color="#0a0a0a" />
                <Text style={styles.startBtnText}>START DEBATE</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {debateStarted && (
          <>
            <Animated.View entering={FadeInDown.delay(100).duration(500)}>
              <View style={styles.debateHeader}>
                <Text style={styles.debateHeaderText}>
                  {selectedTopic.emoji} {selectedTopic.name} - Who's Right?
                </Text>
                <Text style={styles.debateLive}>LIVE DEBATE</Text>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <ContenderCard
                persona={contender1}
                topic={selectedTopic}
                onVote={() => handleVote(contender1.id)}
                voteCount={votes[contender1.id] || 0}
                totalVotes={(votes[contender1.id] || 0) + (votes[contender2.id] || 0)}
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(300).duration(500)}>
              <ContenderCard
                persona={contender2}
                topic={selectedTopic}
                onVote={() => handleVote(contender2.id)}
                voteCount={votes[contender2.id] || 0}
                totalVotes={(votes[contender1.id] || 0) + (votes[contender2.id] || 0)}
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400).duration(500)}>
              <VoteBar
                persona1={contender1}
                persona2={contender2}
                votes1={votes[contender1.id] || 0}
                votes2={votes[contender2.id] || 0}
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(500).duration(400)}>
              <View style={styles.shareRow}>
                <Pressable onPress={handleShare} style={({ pressed }) => [styles.shareActionBtn, pressed && { opacity: 0.7 }]}>
                  <Ionicons name="share-social" size={18} color={Colors.gold} />
                  <Text style={styles.shareActionText}>SHARE DEBATE</Text>
                </Pressable>
                <Pressable onPress={handleReset} style={({ pressed }) => [styles.newDebateBtn, pressed && { opacity: 0.7 }]}>
                  <Ionicons name="refresh" size={18} color={Colors.whiteDim} />
                  <Text style={styles.newDebateText}>NEW DEBATE</Text>
                </Pressable>
              </View>
            </Animated.View>
          </>
        )}

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/game");
          }}
          style={({ pressed }) => [styles.crossPromoBtn, pressed && { opacity: 0.7 }]}
        >
          <LinearGradient colors={["#1a1a08", "#0a0a04"]} style={styles.crossPromoBtnInner}>
            <MaterialCommunityIcons name="gamepad-variant" size={24} color="#FBBF24" />
            <View style={{ flex: 1 }}>
              <Text style={styles.crossPromoTitle}>TRY TRUMP BILLIONAIRES</Text>
              <Text style={styles.crossPromoSub}>Build a real estate empire</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FBBF24" />
          </LinearGradient>
        </Pressable>

        <Text style={styles.legalDisclaimer}>
          Not affiliated with any financial persona depicted. For entertainment purposes only. Not financial advice. Affiliate links generate commissions.
        </Text>
      </ScrollView>

      {toastText && (
        <Animated.View entering={FadeInUp.duration(300)} style={styles.toast}>
          <Text style={styles.toastText}>{toastText}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  personaCard: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.03)",
    marginRight: 10,
    minWidth: 72,
  },
  personaAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 6,
  },
  personaInitial: {
    fontSize: 18,
    fontWeight: "900" as const,
  },
  personaName: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center" as const,
  },
});

const contenderStyles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "900" as const,
  },
  name: {
    fontSize: 16,
    fontWeight: "800" as const,
  },
  title: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "600" as const,
  },
  adviceBox: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 10,
  },
  adviceText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
    fontStyle: "italic",
  },
  catchphrase: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 12,
  },
  voteBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 6,
  },
  voteBtnText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 1,
  },
  voteCount: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center" as const,
  },
});

const voteBarStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "700" as const,
  },
  bar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    flexDirection: "row",
  },
  fill1: {
    height: "100%",
    borderRadius: 5,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    ...Platform.select({
      web: {
        height: "100vh" as any,
        maxHeight: "100vh" as any,
        overflow: "hidden" as any,
        display: "flex" as any,
        flexDirection: "column" as any,
      },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(212,164,32,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: Colors.gold,
    letterSpacing: 2,
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(212,164,32,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
    ...Platform.select({
      web: {
        overflow: "auto" as any,
        minHeight: 0 as any,
      },
    }),
  },
  scrollContent: {
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        maxWidth: 600,
        alignSelf: "center" as any,
        width: "100%" as any,
      },
    }),
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 16,
  },
  topicScroll: {
    marginBottom: 4,
  },
  topicScrollContent: {
    gap: 8,
    paddingRight: 20,
  },
  topicPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  topicPillSelected: {
    borderColor: Colors.gold,
    backgroundColor: "rgba(212,164,32,0.12)",
  },
  topicEmoji: {
    fontSize: 16,
  },
  topicName: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.6)",
  },
  topicNameSelected: {
    color: Colors.gold,
  },
  personaScroll: {
    marginBottom: 4,
  },
  personaScrollContent: {
    paddingRight: 20,
  },
  vsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    gap: 12,
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(212,164,32,0.15)",
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: Colors.gold,
    letterSpacing: 1,
  },
  startBtn: {
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  startBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  startBtnText: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: "#0a0a0a",
    letterSpacing: 2,
  },
  debateHeader: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  debateHeaderText: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.gold,
    textAlign: "center" as const,
  },
  debateLive: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#ff4d4d",
    letterSpacing: 2,
    marginTop: 4,
  },
  shareRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  shareActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
    backgroundColor: "rgba(212,164,32,0.08)",
  },
  shareActionText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.gold,
    letterSpacing: 1,
  },
  newDebateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  newDebateText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.whiteDim,
    letterSpacing: 1,
  },
  crossPromoBtn: {
    marginTop: 20,
    borderRadius: 14,
    overflow: "hidden",
  },
  crossPromoBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.2)",
  },
  crossPromoTitle: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: Colors.white,
    letterSpacing: 1,
  },
  crossPromoSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
  legalDisclaimer: {
    fontSize: 9,
    color: "rgba(255,255,255,0.15)",
    textAlign: "center" as const,
    lineHeight: 14,
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  toast: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "#ff4d4d",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    ...Platform.select({
      web: {
        maxWidth: 400,
        alignSelf: "center" as any,
      },
    }),
  },
  toastText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#fff",
    textAlign: "center" as const,
  },
});
