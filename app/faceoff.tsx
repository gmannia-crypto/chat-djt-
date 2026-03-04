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
  {
    id: "mansa",
    name: "Mansa Musa",
    fullName: "Mansa Musa I",
    color: "#D4AF37",
    advice: {
      crypto: "Digital gold? In my empire, we had REAL gold. So much it crashed Egypt\u2019s economy. But I see the vision.",
      stock: "Owning pieces of great enterprises? That is how empires are built. I owned entire trade routes.",
      property: "LAND. Land is the foundation of all wealth. I owned more land than any man alive. Buy land, build legacy.",
      commodity: "Gold is the ONLY true money. I gave away so much gold in Cairo, I collapsed their currency for a decade!",
      etf: "Diversification across many assets? Wise. I diversified across salt, gold, ivory, and entire kingdoms.",
      default: "True wealth is not what you hoard \u2014 it\u2019s what you build. I built Timbuktu into the center of the world.",
    },
    catchphrases: ["I once crashed an entire economy with my generosity.", "Wealth without knowledge is like a kingdom without walls.", "Build institutions, not just fortunes.", "The richest man who ever lived \u2014 literally."],
    affiliate: { apmex: "https://www.apmex.com/?tag=trumpbot-20" },
  },
  {
    id: "jordan",
    name: "MJ",
    fullName: "Michael Jordan",
    color: "#CE1141",
    advice: {
      crypto: "I\u2019ve missed more than 9,000 shots in my career. Crypto? That\u2019s just another shot. You miss 100% of the ones you don\u2019t take. But size your bet like a champion.",
      stock: "I didn\u2019t become a billionaire by playing it safe. Nike deal, Charlotte Hornets \u2014 I bet on myself. Find companies with that killer instinct.",
      property: "Location is like a jump shot \u2014 it\u2019s all about position. I own golf courses, I own the Hornets. Real estate? It\u2019s about owning the court.",
      commodity: "Gold is steady. I respect steady. But championships come from taking risks. Gold is your defensive play \u2014 solid fundamentals.",
      etf: "Index funds are the fundamentals. You gotta nail your free throws before you try the fadeaway. Start with the basics.",
      default: "I\u2019ve failed over and over in my life. And THAT is why I succeed. Same with investing \u2014 take the shot.",
    },
    catchphrases: ["I took that personally.", "Just do it \u2014 wait, wrong brand. Just WIN it.", "Champions are made when nobody\u2019s watching.", "The ceiling is the roof!"],
    affiliate: { nike: "https://www.nike.com/jordan?tag=trumpbot-20" },
  },
  {
    id: "bernie",
    name: "Bernie Mac",
    fullName: "Bernie Mac",
    color: "#9B59B6",
    advice: {
      crypto: "Listen here, America. I ain\u2019t puttin\u2019 my money in no INVISIBLE money! You can\u2019t hold it, you can\u2019t fold it, you can\u2019t put it under your mattress. I\u2019m scared of it!",
      stock: "The stock market? Baby, that\u2019s a rollercoaster. And I don\u2019t DO rollercoasters. But if you\u2019re gonna ride, ride something SOLID. Blue chips, baby!",
      property: "A HOUSE? Now THAT\u2019S an investment! You can live in it, hide in it, lock the door and tell everybody to GET OUT! That\u2019s value, America!",
      commodity: "Gold? My grandmama had gold teeth, and she was the richest woman I knew. Spiritually AND financially. Get you some gold, baby.",
      etf: "ETFs? That\u2019s like a buffet for your money! A little bit of everything! I LIKE buffets, America! You know I do!",
      default: "I ain\u2019t scared of being broke \u2014 I\u2019ve BEEN broke! But I\u2019m scared of STAYING broke. So invest smart, America!",
    },
    catchphrases: ["I ain\u2019t scared of you!", "Listen here, America!", "You don\u2019t understand \u2014 I\u2019m not playing!", "I\u2019m gonna bust your head til the white meat shows!"],
    affiliate: { audible: "https://www.amazon.com/audible?tag=trumpbot-20" },
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
    case "mansa": return "Richest Man in History";
    case "jordan": return "6x NBA Champion & Billionaire";
    case "bernie": return "King of Comedy";
    default: return "";
  }
}

interface BattleQuestion {
  id: string;
  text: string;
  category: string;
  emoji: string;
}

const BATTLE_QUESTIONS: BattleQuestion[] = [
  { id: "bitcoin", text: "Should I buy Bitcoin?", category: "crypto", emoji: "\u20BF" },
  { id: "savings", text: "Should I invest or save?", category: "default", emoji: "\uD83D\uDCB0" },
  { id: "house", text: "Should I buy a house?", category: "property", emoji: "\uD83C\uDFE0" },
  { id: "gold", text: "Is gold a good investment?", category: "commodity", emoji: "\uD83E\uDE99" },
  { id: "stocks", text: "Should I buy stocks right now?", category: "stock", emoji: "\uD83D\uDCC8" },
  { id: "etf", text: "Are index funds the best bet?", category: "etf", emoji: "\uD83D\uDCCA" },
  { id: "doge", text: "Is Dogecoin actually worth buying?", category: "crypto", emoji: "\uD83D\uDC15" },
  { id: "retire", text: "How should I save for retirement?", category: "default", emoji: "\uD83C\uDFD6\uFE0F" },
];

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

function ContenderCard({ persona, topic, onVote, voteCount, totalVotes, hasVoted, isVotedFor }: { persona: Persona; topic: Topic; onVote: () => void; voteCount: number; totalVotes: number; hasVoted: boolean; isVotedFor: boolean }) {
  const advice = persona.advice[topic.category] || persona.advice.default;
  const catchphrase = pickRandom(persona.catchphrases);
  const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 50;

  return (
    <View style={[contenderStyles.card, { borderColor: `${persona.color}40` }, hasVoted && !isVotedFor && { opacity: 0.6 }, isVotedFor && { borderColor: persona.color, borderWidth: 2 }]}>
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
      {!hasVoted ? (
        <Pressable
          onPress={onVote}
          style={({ pressed }) => [contenderStyles.voteBtn, { backgroundColor: persona.color }, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
        >
          <Text style={contenderStyles.voteBtnText}>VOTE {persona.name.toUpperCase()}</Text>
        </Pressable>
      ) : (
        <View style={[contenderStyles.voteBtn, { backgroundColor: isVotedFor ? persona.color : "rgba(255,255,255,0.1)" }]}>
          <Text style={contenderStyles.voteBtnText}>{isVotedFor ? "\u2705 VOTED" : persona.name.toUpperCase()}</Text>
        </View>
      )}
      <Text style={contenderStyles.voteCount}>{voteCount} votes ({pct}%)</Text>
    </View>
  );
}

function BattleFighterCard({ persona, category, voteCount, totalVotes, onVote, hasVoted, isWinner }: { persona: Persona; category: string; voteCount: number; totalVotes: number; onVote: () => void; hasVoted: boolean; isWinner: boolean }) {
  const advice = persona.advice[category] || persona.advice.default;
  const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

  return (
    <View style={[
      battleStyles.card,
      { borderColor: hasVoted ? (isWinner ? persona.color : "rgba(255,255,255,0.05)") : `${persona.color}30` },
      hasVoted && !isWinner && { opacity: 0.5 },
      isWinner && { borderWidth: 2 },
    ]}>
      <View style={battleStyles.cardHeader}>
        <View style={[battleStyles.cardAvatar, { borderColor: persona.color }]}>
          <Text style={[battleStyles.cardAvatarText, { color: persona.color }]}>{persona.name[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[battleStyles.cardName, { color: persona.color }]}>{persona.name}</Text>
          <Text style={battleStyles.cardTitle}>{getTitle(persona.id)}</Text>
        </View>
      </View>
      <View style={[battleStyles.adviceBox, { borderLeftColor: persona.color }]}>
        <Text style={battleStyles.adviceText}>"{advice}"</Text>
      </View>
      <View style={battleStyles.voteBarOuter}>
        <View style={[battleStyles.voteBarFill, { width: `${pct}%` as any, backgroundColor: persona.color }]} />
      </View>
      <Text style={battleStyles.voteCountText}>{voteCount} votes ({pct}%)</Text>
      {!hasVoted && (
        <Pressable
          onPress={onVote}
          style={({ pressed }) => [battleStyles.voteBtn, { backgroundColor: persona.color }, pressed && { opacity: 0.8 }]}
        >
          <Text style={battleStyles.voteBtnText}>VOTE</Text>
        </Pressable>
      )}
    </View>
  );
}

function MashupCard({ persona1, persona2, topic, viralScore, onShare }: { persona1: Persona; persona2: Persona; topic: Topic; viralScore: number; onShare: () => void }) {
  const advice1 = persona1.advice[topic.category] || persona1.advice.default;
  const advice2 = persona2.advice[topic.category] || persona2.advice.default;

  const barWidth = useSharedValue(0);
  React.useEffect(() => {
    barWidth.value = withTiming(viralScore, { duration: 1500 });
  }, [viralScore]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%` as any,
  }));

  return (
    <View style={mashupStyles.card}>
      <View style={mashupStyles.topStripe} />
      <View style={mashupStyles.header}>
        <Text style={mashupStyles.label}>PERSONA MASHUP</Text>
        <Text style={mashupStyles.title}>{persona1.name} {"\u00D7"} {persona2.name}</Text>
      </View>
      <View style={mashupStyles.quoteBox}>
        <Text style={mashupStyles.quoteText}>"{advice1}"</Text>
        <View style={mashupStyles.butWaitContainer}>
          <LinearGradient
            colors={["#ff4d4d", "#FFD700"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={mashupStyles.butWaitBadge}
          >
            <Text style={mashupStyles.butWaitText}>...BUT WAIT...</Text>
          </LinearGradient>
        </View>
        <Text style={mashupStyles.quoteText}>"{advice2}" {"\uD83E\uDD2F"}</Text>
      </View>
      <View style={mashupStyles.viralRow}>
        <Text style={mashupStyles.viralLabel}>{"\uD83D\uDD25"} VIRAL SCORE</Text>
        <View style={mashupStyles.viralBar}>
          <Animated.View style={[mashupStyles.viralFill, barStyle]} />
        </View>
        <Text style={mashupStyles.viralPct}>{viralScore}%</Text>
      </View>
      <Pressable
        onPress={onShare}
        style={({ pressed }) => [mashupStyles.shareBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
      >
        <LinearGradient
          colors={[Colors.gold, "#ff8c00"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={mashupStyles.shareBtnGradient}
        >
          <Text style={mashupStyles.shareBtnText}>{"\uD83D\uDCE3"} SHARE THIS MASHUP</Text>
        </LinearGradient>
      </Pressable>
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

  const [mode, setMode] = useState<"1v1" | "battle">("1v1");
  const [selectedTopic, setSelectedTopic] = useState<Topic>(TOPICS[0]);
  const [contender1, setContender1] = useState<Persona>(PERSONAS[0]);
  const [contender2, setContender2] = useState<Persona>(PERSONAS[1]);
  const [debateStarted, setDebateStarted] = useState(false);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [debateId, setDebateId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [mashupViralScore, setMashupViralScore] = useState(0);
  const [toastText, setToastText] = useState<string | null>(null);

  const [battleQuestion, setBattleQuestion] = useState<BattleQuestion>(BATTLE_QUESTIONS[0]);
  const [battleStarted, setBattleStarted] = useState(false);
  const [battleVotes, setBattleVotes] = useState<Record<string, number>>({});
  const [battleId, setBattleId] = useState<string | null>(null);
  const [battleHasVoted, setBattleHasVoted] = useState(false);
  const [battleVotedFor, setBattleVotedFor] = useState<string | null>(null);

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
    setHasVoted(false);
    setVotedFor(null);
    setMashupViralScore(Math.floor(Math.random() * 30) + 70);
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
    if (hasVoted) return;
    setHasVoted(true);
    setVotedFor(personaId);
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
  }, [debateId, contender1, contender2, selectedTopic, hasVoted]);

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

  const handleMashupShare = useCallback(() => {
    const a1 = contender1.advice[selectedTopic.category] || contender1.advice.default;
    const a2 = contender2.advice[selectedTopic.category] || contender2.advice.default;
    const shareText = `PERSONA MASHUP: ${contender1.name} \u00D7 ${contender2.name} on ${selectedTopic.name}!\n\n${contender1.name}: "${a1}"\n\n...BUT WAIT...\n\n${contender2.name}: "${a2}" \uD83E\uDD2F\n\nViral Score: ${mashupViralScore}%\nCreate your own mashup at chat-djt.replit.app`;
    shareContent({ text: shareText, feature: "mashup" });

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      globalThis.fetch(`${baseUrl}/api/track-viral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "mashup_shared", data: { p1: contender1.id, p2: contender2.id, topic: selectedTopic.id }, timestamp: Date.now() }),
      }).catch(() => {});
    } catch {}
  }, [contender1, contender2, selectedTopic, mashupViralScore]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDebateStarted(false);
    setVotes({});
    setDebateId(null);
    setHasVoted(false);
    setVotedFor(null);
  }, []);

  const handleStartBattle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const id = `battle_${battleQuestion.id}_${Date.now()}`;
    setBattleId(id);
    const initialVotes: Record<string, number> = {};
    PERSONAS.forEach((p) => { initialVotes[p.id] = 0; });
    setBattleVotes(initialVotes);
    setBattleStarted(true);
    setBattleHasVoted(false);
    setBattleVotedFor(null);

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      globalThis.fetch(`${baseUrl}/api/track-viral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "battle_royale_started", data: { question: battleQuestion.id }, timestamp: Date.now() }),
      }).catch(() => {});
    } catch {}

    setTimeout(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, 400);
  }, [battleQuestion]);

  const handleBattleVote = useCallback(async (personaId: string) => {
    if (battleHasVoted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBattleHasVoted(true);
    setBattleVotedFor(personaId);
    setBattleVotes(prev => ({ ...prev, [personaId]: (prev[personaId] || 0) + 1 }));

    setToastText(pickRandom(ENCOURAGEMENTS));
    setTimeout(() => setToastText(null), 2500);

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const res = await globalThis.fetch(`${baseUrl}/api/faceoff/battle-vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId, votedFor: personaId, question: battleQuestion.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.votes) setBattleVotes(data.votes);
      }
    } catch {}

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      globalThis.fetch(`${baseUrl}/api/track-viral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "battle_vote_cast", data: { battleId, votedFor: personaId }, timestamp: Date.now() }),
      }).catch(() => {});
    } catch {}
  }, [battleHasVoted, battleId, battleQuestion]);

  const handleBattleShare = useCallback(() => {
    const totalVotes = Object.values(battleVotes).reduce((s, v) => s + v, 0);
    const sorted = [...PERSONAS].sort((a, b) => (battleVotes[b.id] || 0) - (battleVotes[a.id] || 0));
    const leader = sorted[0];
    const shareText = `PERSONA BATTLE ROYALE: "${battleQuestion.text}"\n\n${totalVotes} votes so far!\nLeading: ${leader.name} with ${battleVotes[leader.id] || 0} votes\n\n10 personas. 1 question. Who wins?\nPlay at chat-djt.replit.app`;
    shareContent({ text: shareText, feature: "battle-royale" });
  }, [battleVotes, battleQuestion]);

  const handleBattleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBattleStarted(false);
    setBattleVotes({});
    setBattleId(null);
    setBattleHasVoted(false);
    setBattleVotedFor(null);
  }, []);

  const battleTotalVotes = Object.values(battleVotes).reduce((s, v) => s + v, 0);

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
        {(debateStarted || battleStarted) ? (
          <Pressable onPress={mode === "1v1" ? handleShare : handleBattleShare} style={styles.shareBtn}>
            <Ionicons name="share-outline" size={20} color={Colors.gold} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <View style={styles.modeTabs}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode("1v1"); }}
          style={[styles.modeTab, mode === "1v1" && styles.modeTabActive]}
        >
          <Text style={[styles.modeTabText, mode === "1v1" && styles.modeTabTextActive]}>{"\u2694\uFE0F"} 1v1 DEBATE</Text>
        </Pressable>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode("battle"); }}
          style={[styles.modeTab, mode === "battle" && styles.modeTabActive]}
        >
          <Text style={[styles.modeTabText, mode === "battle" && styles.modeTabTextActive]}>{"\uD83C\uDFC6"} BATTLE ROYALE</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        {mode === "1v1" ? (
        <>
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
                hasVoted={hasVoted}
                isVotedFor={votedFor === contender1.id}
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(300).duration(500)}>
              <ContenderCard
                persona={contender2}
                topic={selectedTopic}
                onVote={() => handleVote(contender2.id)}
                voteCount={votes[contender2.id] || 0}
                totalVotes={(votes[contender1.id] || 0) + (votes[contender2.id] || 0)}
                hasVoted={hasVoted}
                isVotedFor={votedFor === contender2.id}
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

            <Animated.View entering={FadeInUp.delay(500).duration(600)}>
              <MashupCard
                persona1={contender1}
                persona2={contender2}
                topic={selectedTopic}
                viralScore={mashupViralScore}
                onShare={handleMashupShare}
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(600).duration(400)}>
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
        </>
        ) : (
        <>
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View style={battleStyles.questionBox}>
              <Text style={battleStyles.questionTitle}>{"\u2694\uFE0F"} PERSONA BATTLE ROYALE</Text>
              <Text style={battleStyles.questionText}>{battleQuestion.text}</Text>
              <Text style={battleStyles.questionSub}>10 personas. 1 question. Who wins?</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text style={styles.sectionLabel}>PICK THE QUESTION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicScroll} contentContainerStyle={styles.topicScrollContent}>
              {BATTLE_QUESTIONS.map((q) => {
                const isSelected = battleQuestion.id === q.id;
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setBattleQuestion(q);
                      if (battleStarted) handleBattleReset();
                    }}
                    style={[styles.topicPill, isSelected && styles.topicPillSelected]}
                  >
                    <Text style={styles.topicEmoji}>{q.emoji}</Text>
                    <Text style={[styles.topicName, isSelected && styles.topicNameSelected]}>{q.text}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          {!battleStarted && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <Pressable
                onPress={handleStartBattle}
                style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
              >
                <LinearGradient
                  colors={["#ff4d4d", "#FFD700"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startBtnGradient}
                >
                  <MaterialCommunityIcons name="trophy" size={22} color="#fff" />
                  <Text style={[styles.startBtnText, { color: "#fff" }]}>LET THEM ALL ANSWER!</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}

          {battleStarted && (
            <>
              <View style={battleStyles.totalBox}>
                <Text style={battleStyles.totalText}>{"\uD83C\uDFC6"} <Text style={{ color: Colors.gold, fontWeight: "900" as const }}>{battleTotalVotes}</Text> total votes</Text>
              </View>

              {PERSONAS.map((persona, index) => (
                <Animated.View key={persona.id} entering={FadeInDown.delay(100 + index * 50).duration(400)}>
                  <BattleFighterCard
                    persona={persona}
                    category={battleQuestion.category}
                    voteCount={battleVotes[persona.id] || 0}
                    totalVotes={battleTotalVotes}
                    onVote={() => handleBattleVote(persona.id)}
                    hasVoted={battleHasVoted}
                    isWinner={battleVotedFor === persona.id}
                  />
                </Animated.View>
              ))}

              <Animated.View entering={FadeInUp.delay(600).duration(400)}>
                <View style={styles.shareRow}>
                  <Pressable onPress={handleBattleShare} style={({ pressed }) => [styles.shareActionBtn, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="share-social" size={18} color={Colors.gold} />
                    <Text style={styles.shareActionText}>SHARE BATTLE</Text>
                  </Pressable>
                  <Pressable onPress={handleBattleReset} style={({ pressed }) => [styles.newDebateBtn, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="refresh" size={18} color={Colors.whiteDim} />
                    <Text style={styles.newDebateText}>NEW BATTLE</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </>
          )}
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
  modeTabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    marginBottom: 8,
    ...Platform.select({
      web: {
        maxWidth: 560,
        alignSelf: "center" as any,
        width: "100%" as any,
      },
    }),
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  modeTabActive: {
    backgroundColor: "rgba(255,215,0,0.15)",
    borderBottomWidth: 2,
    borderBottomColor: Colors.gold,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1,
  },
  modeTabTextActive: {
    color: Colors.gold,
  },
});

const battleStyles = StyleSheet.create({
  questionBox: {
    alignItems: "center",
    padding: 20,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    backgroundColor: "rgba(255,215,0,0.08)",
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: "900" as const,
    color: Colors.gold,
    letterSpacing: 1,
    marginBottom: 6,
  },
  questionText: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: "#fff",
    textAlign: "center" as const,
  },
  questionSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginTop: 6,
  },
  totalBox: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  totalText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600" as const,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  cardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  cardAvatarText: {
    fontSize: 16,
    fontWeight: "900" as const,
  },
  cardName: {
    fontSize: 14,
    fontWeight: "800" as const,
  },
  cardTitle: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "600" as const,
  },
  adviceBox: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 10,
  },
  adviceText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 18,
    fontStyle: "italic",
  },
  voteBarOuter: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginBottom: 4,
  },
  voteBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  voteCountText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    textAlign: "right" as const,
    marginBottom: 4,
  },
  voteBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 4,
  },
  voteBtnText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 1,
  },
});

const mashupStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: "rgba(26,26,8,0.9)",
    padding: 20,
    marginBottom: 16,
    overflow: "hidden",
  },
  topStripe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.gold,
  },
  header: {
    alignItems: "center",
    marginBottom: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: Colors.gold,
    letterSpacing: 3,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: "#fff",
  },
  quoteBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    alignItems: "center",
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.85)",
    fontStyle: "italic",
    textAlign: "center" as const,
  },
  butWaitContainer: {
    marginVertical: 10,
    alignItems: "center",
  },
  butWaitBadge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 6,
  },
  butWaitText: {
    fontSize: 11,
    fontWeight: "900" as const,
    color: "#000",
    letterSpacing: 1,
  },
  viralRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  viralLabel: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1,
  },
  viralBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  viralFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  viralPct: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: Colors.gold,
    minWidth: 36,
    textAlign: "right" as const,
  },
  shareBtn: {
    borderRadius: 25,
    overflow: "hidden",
  },
  shareBtnGradient: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 25,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#000",
    letterSpacing: 1,
  },
});
