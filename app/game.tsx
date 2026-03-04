import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Image,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { shareContent } from "@/lib/track-share";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface GameProperty {
  id: string;
  name: string;
  location: string;
  price: number;
  rent: number;
  emoji: string;
  tier: "starter" | "mid" | "luxury" | "mega";
  appreciation: number;
}

interface OwnedProperty extends GameProperty {
  purchasedAt: number;
  turnsOwned: number;
}

interface GameEvent {
  id: string;
  text: string;
  effect: "positive" | "negative" | "neutral";
  cashChange?: number;
  propertyEffect?: number;
}

const PROPERTIES: GameProperty[] = [
  { id: "hotdog", name: "Hot Dog Stand", location: "Coney Island, NY", price: 50000, rent: 2000, emoji: "\uD83C\uDF2D", tier: "starter", appreciation: 0.02 },
  { id: "laundry", name: "Laundromat", location: "Queens, NY", price: 120000, rent: 4500, emoji: "\uD83E\uDDFA", tier: "starter", appreciation: 0.03 },
  { id: "diner", name: "Trump Diner", location: "Brooklyn, NY", price: 250000, rent: 8000, emoji: "\uD83C\uDF54", tier: "starter", appreciation: 0.04 },
  { id: "apartment", name: "Luxury Apartment", location: "Manhattan, NY", price: 500000, rent: 15000, emoji: "\uD83C\uDFE2", tier: "mid", appreciation: 0.05 },
  { id: "hotel", name: "Boutique Hotel", location: "Miami Beach, FL", price: 1200000, rent: 35000, emoji: "\uD83C\uDFE8", tier: "mid", appreciation: 0.06 },
  { id: "casino", name: "Trump Casino", location: "Atlantic City, NJ", price: 2500000, rent: 75000, emoji: "\uD83C\uDFB0", tier: "luxury", appreciation: 0.07 },
  { id: "tower", name: "Trump Tower", location: "5th Ave, NYC", price: 5000000, rent: 150000, emoji: "\uD83C\uDFD7\uFE0F", tier: "luxury", appreciation: 0.08 },
  { id: "resort", name: "Mar-a-Lago Resort", location: "Palm Beach, FL", price: 10000000, rent: 300000, emoji: "\uD83C\uDFF0", tier: "mega", appreciation: 0.10 },
  { id: "golf", name: "Trump Golf Course", location: "Scotland", price: 15000000, rent: 500000, emoji: "\u26F3", tier: "mega", appreciation: 0.09 },
  { id: "skyscraper", name: "World's Tallest Building", location: "Dubai", price: 50000000, rent: 1500000, emoji: "\uD83C\uDFD9\uFE0F", tier: "mega", appreciation: 0.12 },
];

const GAME_EVENTS: GameEvent[] = [
  { id: "e1", text: "Fake news says your properties are overvalued. WRONG! They're UNDERVALUED!", effect: "negative", cashChange: -25000 },
  { id: "e2", text: "You made a TREMENDOUS deal. The best deal. Maybe ever.", effect: "positive", cashChange: 50000 },
  { id: "e3", text: "Your tenant is a real winner. Pays rent early. Beautiful.", effect: "positive", cashChange: 30000 },
  { id: "e4", text: "Property tax? More like THEFT tax. Very unfair!", effect: "negative", cashChange: -40000 },
  { id: "e5", text: "A celebrity moved into your building. Values going UP!", effect: "positive", propertyEffect: 10 },
  { id: "e6", text: "China is manipulating the market. But you're still winning!", effect: "neutral", cashChange: 10000 },
  { id: "e7", text: "Your golf course just hosted a PGA event. HUGE ratings!", effect: "positive", cashChange: 100000 },
  { id: "e8", text: "Someone tried to sue you. Very sad! Lawyers cost money.", effect: "negative", cashChange: -60000 },
  { id: "e9", text: "Tax season! But smart people like us find deductions. Legal ones.", effect: "negative", cashChange: -35000 },
  { id: "e10", text: "Real estate market is BOOMING. Thanks to great leadership!", effect: "positive", propertyEffect: 15 },
  { id: "e11", text: "A hurricane threatened your resort. False alarm! Insurance payout!", effect: "positive", cashChange: 75000 },
  { id: "e12", text: "Interest rates went up. Democrats, probably.", effect: "negative", cashChange: -20000 },
  { id: "e13", text: "Your brand name alone increased property value. Very classy!", effect: "positive", propertyEffect: 8 },
  { id: "e14", text: "Renovation complete! Gold fixtures everywhere. TREMENDOUS!", effect: "positive", propertyEffect: 12 },
  { id: "e15", text: "Tenant threw a party. Damage deposit covers it. Barely.", effect: "negative", cashChange: -15000 },
];

const TRUMP_BUY_QUOTES = [
  "Buy that property! It's HUGE! The best location!",
  "Smart move. Very smart. I would've bought it myself.",
  "That's what winners do. They BUY. They don't RENT.",
  "You remind me of a young Donald Trump. Very handsome. Great instincts.",
  "TREMENDOUS purchase. The best. Maybe in history.",
  "This property is going to be worth TEN TIMES this. Believe me.",
  "You're building an empire! Like me! Well, smaller. But still!",
];

const TRUMP_SELL_QUOTES = [
  "Selling? Are you CRAZY? This is prime real estate!",
  "Fine. Sell. But you'll regret it. I never sell. Almost never.",
  "Smart timing. Buy low, sell high. That's what I do. The best.",
  "Profit is profit. Even I can't argue with profit. Well, I could...",
  "You're locking in gains. Very strategic. Very Trump-like.",
];

const TRUMP_BROKE_QUOTES = [
  "You're down? Sad! Very low energy! But I've been there. Once. Briefly.",
  "Bankruptcy? I prefer the term 'strategic financial restructuring.' Very classy.",
  "Every great empire has setbacks. Mine didn't. But yours can.",
  "Time to rebuild! I've rebuilt six times. Or four. Depends who's counting.",
];

const TRUMP_RICH_QUOTES = [
  "You're WINNING so much! Like me! LIKE ME!",
  "Now THIS is what I call tremendous wealth. Very beautiful.",
  "You're almost at MY level. Almost. Give it 50 more years.",
  "The deals you're making... incredible. I'm almost impressed.",
];

function formatMoney(n: number): string {
  if (n >= 1000000000) return `$${(n / 1000000000).toFixed(1)}B`;
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTier(netWorth: number): { label: string; color: string; emoji: string } {
  if (netWorth >= 50000000) return { label: "MEGA MOGUL", color: "#FFD700", emoji: "\uD83D\uDC51" };
  if (netWorth >= 10000000) return { label: "BILLIONAIRE", color: "#FF6B35", emoji: "\uD83D\uDCB0" };
  if (netWorth >= 5000000) return { label: "REAL ESTATE KING", color: "#9333EA", emoji: "\uD83C\uDFF0" };
  if (netWorth >= 1000000) return { label: "MILLIONAIRE", color: "#22C55E", emoji: "\uD83D\uDCB5" };
  if (netWorth >= 500000) return { label: "INVESTOR", color: "#60A5FA", emoji: "\uD83D\uDCC8" };
  return { label: "STARTER", color: "#94A3B8", emoji: "\uD83C\uDFE0" };
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const scrollRef = useRef<ScrollView>(null);

  const [cash, setCash] = useState(1000000);
  const [turn, setTurn] = useState(1);
  const [ownedProperties, setOwnedProperties] = useState<OwnedProperty[]>([]);
  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null);
  const [trumpQuote, setTrumpQuote] = useState("Welcome to Trump Billionaires! You start with $1M. Make it GREAT!");
  const [showEvent, setShowEvent] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);

  const netWorth = cash + ownedProperties.reduce((sum, p) => sum + p.price * (1 + p.appreciation * p.turnsOwned), 0);
  const monthlyRent = ownedProperties.reduce((sum, p) => sum + p.rent, 0);
  const tier = getTier(netWorth);

  const pulseAnim = useSharedValue(1);
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const handleBuy = useCallback((property: GameProperty) => {
    if (cash < property.price) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTrumpQuote(`You can't afford ${property.name}?! That's SAD! You need ${formatMoney(property.price - cash)} more.`);
      return;
    }

    const alreadyOwned = ownedProperties.find(p => p.id === property.id);
    if (alreadyOwned) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTrumpQuote(`You already own ${property.name}! Diversify! That's what smart people do. And you're smart. I think.`);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCash(prev => prev - property.price);
    setOwnedProperties(prev => [...prev, { ...property, purchasedAt: property.price, turnsOwned: 0 }]);
    setTrumpQuote(pickRandom(TRUMP_BUY_QUOTES));
    setLastAction(`Bought ${property.name} for ${formatMoney(property.price)}`);
    advanceTurn();
  }, [cash, ownedProperties]);

  const handleSell = useCallback((property: OwnedProperty) => {
    const currentValue = Math.round(property.price * (1 + property.appreciation * property.turnsOwned));
    const profit = currentValue - property.purchasedAt;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCash(prev => prev + currentValue);
    setOwnedProperties(prev => prev.filter(p => p.id !== property.id));
    setTrumpQuote(
      profit > 0
        ? `SOLD for ${formatMoney(currentValue)}! Profit: ${formatMoney(profit)}! ${pickRandom(TRUMP_SELL_QUOTES)}`
        : `Sold at a loss of ${formatMoney(Math.abs(profit))}. Very sad. But sometimes you gotta cut your losses.`
    );
    setLastAction(`Sold ${property.name} for ${formatMoney(currentValue)}`);
    advanceTurn();
  }, []);

  const handleCollectRent = useCallback(() => {
    if (ownedProperties.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTrumpQuote("You have NO properties! Buy something first! What are you, a renter? SAD!");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCash(prev => prev + monthlyRent);
    setOwnedProperties(prev => prev.map(p => ({ ...p, turnsOwned: p.turnsOwned + 1 })));
    setTrumpQuote(`Collected ${formatMoney(monthlyRent)} in rent! Beautiful passive income. I invented passive income.`);
    setLastAction(`Collected ${formatMoney(monthlyRent)} rent`);
    advanceTurn();
  }, [ownedProperties, monthlyRent]);

  const advanceTurn = useCallback(() => {
    setTurn(prev => prev + 1);

    if (Math.random() < 0.4) {
      const event = pickRandom(GAME_EVENTS);
      setCurrentEvent(event);
      setShowEvent(true);

      if (event.cashChange) {
        setCash(prev => Math.max(0, prev + event.cashChange!));
      }
      if (event.propertyEffect) {
        setOwnedProperties(prev =>
          prev.map(p => ({
            ...p,
            price: Math.round(p.price * (1 + event.propertyEffect! / 100)),
          }))
        );
      }

      setTimeout(() => setShowEvent(false), 4000);
    }
  }, []);

  const handleShare = useCallback(() => {
    const shareText = `\uD83C\uDFAE TRUMP BILLIONAIRES \uD83C\uDFAE\n\n${tier.emoji} ${tier.label}\n\uD83D\uDCB0 Net Worth: ${formatMoney(netWorth)}\n\uD83C\uDFE0 Properties: ${ownedProperties.length}\n\uD83D\uDCC8 Turn: ${turn}\n\nTrump says: "${trumpQuote}"\n\n\uD83D\uDC49 Play at chat-djt.replit.app`;
    shareContent({ text: shareText, feature: "game" });
  }, [tier, netWorth, ownedProperties.length, turn, trumpQuote]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCash(1000000);
    setTurn(1);
    setOwnedProperties([]);
    setCurrentEvent(null);
    setTrumpQuote("NEW GAME! $1M fresh start. This time, make it GREAT!");
    setShowEvent(false);
    setLastAction(null);
    setGameOver(false);
  }, []);

  useEffect(() => {
    if (cash <= 0 && ownedProperties.length === 0 && turn > 1) {
      setGameOver(true);
      setTrumpQuote(pickRandom(TRUMP_BROKE_QUOTES));
    }
    if (netWorth >= 100000000) {
      setTrumpQuote("$100M NET WORTH! You're a WINNER! The biggest winner! Almost as big as me. ALMOST.");
    }
  }, [cash, ownedProperties.length, netWorth, turn]);

  const availableProperties = PROPERTIES.filter(p => !ownedProperties.find(o => o.id === p.id));

  const tierColors: Record<string, string[]> = {
    starter: ["#1a2a1a", "#0a1a0a"],
    mid: ["#1a1a2a", "#0a0a1a"],
    luxury: ["#2a1a2a", "#1a0a1a"],
    mega: ["#2a2a0a", "#1a1a00"],
  };

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
          <Text style={styles.headerTitle}>TRUMP BILLIONAIRES</Text>
          <Text style={styles.turnText}>Turn {turn}</Text>
        </View>
        <Pressable onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={20} color={Colors.gold} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <LinearGradient colors={["#1a1408", "#2a1a08"]} style={styles.netWorthCard}>
            <View style={styles.netWorthRow}>
              <View>
                <Text style={styles.netWorthLabel}>{tier.emoji} {tier.label}</Text>
                <Animated.Text style={[styles.netWorthValue, pulseStyle]}>
                  {formatMoney(netWorth)}
                </Animated.Text>
              </View>
              <View style={styles.statsCol}>
                <View style={styles.statRow}>
                  <MaterialCommunityIcons name="cash" size={16} color="#22C55E" />
                  <Text style={styles.statText}>{formatMoney(cash)}</Text>
                </View>
                <View style={styles.statRow}>
                  <MaterialCommunityIcons name="home-group" size={16} color="#60A5FA" />
                  <Text style={styles.statText}>{ownedProperties.length} properties</Text>
                </View>
                <View style={styles.statRow}>
                  <MaterialCommunityIcons name="cash-multiple" size={16} color={Colors.gold} />
                  <Text style={styles.statText}>{formatMoney(monthlyRent)}/mo</Text>
                </View>
              </View>
            </View>

            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBg}>
                <LinearGradient
                  colors={[tier.color, Colors.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${Math.min(100, (netWorth / 100000000) * 100)}%` as any }]}
                />
              </View>
              <Text style={styles.progressText}>Goal: $100M</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.trumpQuoteCard}>
            <Image
              source={require("@/assets/images/trump-avatar.jpg")}
              style={styles.trumpAvatar}
            />
            <View style={styles.trumpQuoteBubble}>
              <Text style={styles.trumpQuoteText}>"{trumpQuote}"</Text>
            </View>
          </View>
        </Animated.View>

        {showEvent && currentEvent && (
          <Animated.View entering={FadeInUp.duration(300)}>
            <LinearGradient
              colors={currentEvent.effect === "positive" ? ["#0a2a0a", "#0a1a0a"] : currentEvent.effect === "negative" ? ["#2a0a0a", "#1a0a0a"] : ["#1a1a0a", "#0a0a0a"]}
              style={styles.eventCard}
            >
              <Text style={styles.eventEmoji}>
                {currentEvent.effect === "positive" ? "\uD83D\uDCC8" : currentEvent.effect === "negative" ? "\uD83D\uDCC9" : "\uD83D\uDCF0"}
              </Text>
              <Text style={styles.eventText}>{currentEvent.text}</Text>
              {currentEvent.cashChange && (
                <Text style={[styles.eventEffect, { color: currentEvent.cashChange > 0 ? "#22C55E" : "#EF4444" }]}>
                  {currentEvent.cashChange > 0 ? "+" : ""}{formatMoney(currentEvent.cashChange)}
                </Text>
              )}
            </LinearGradient>
          </Animated.View>
        )}

        <View style={styles.actionRow}>
          <Pressable
            onPress={handleCollectRent}
            style={({ pressed }) => [styles.actionBtn, styles.rentBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
          >
            <MaterialCommunityIcons name="cash-register" size={20} color="#22C55E" />
            <Text style={styles.actionBtnText}>COLLECT RENT</Text>
            {monthlyRent > 0 && <Text style={styles.actionBtnSub}>+{formatMoney(monthlyRent)}</Text>}
          </Pressable>
        </View>

        {gameOver && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <LinearGradient colors={["#2a0a0a", "#1a0808"]} style={styles.gameOverCard}>
              <Text style={styles.gameOverTitle}>GAME OVER</Text>
              <Text style={styles.gameOverText}>You went BROKE! Very sad! Very low energy!</Text>
              <View style={styles.gameOverButtons}>
                <Pressable onPress={handleReset} style={({ pressed }) => [styles.restartBtn, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.restartBtnText}>PLAY AGAIN</Text>
                </Pressable>
                <Pressable onPress={handleShare} style={({ pressed }) => [styles.shareGameBtn, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.shareGameBtnText}>SHARE SCORE</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {ownedProperties.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <Text style={styles.sectionTitle}>YOUR EMPIRE</Text>
            {ownedProperties.map((property) => {
              const currentValue = Math.round(property.price * (1 + property.appreciation * property.turnsOwned));
              const profit = currentValue - property.purchasedAt;
              const profitPercent = ((profit / property.purchasedAt) * 100).toFixed(1);
              return (
                <LinearGradient
                  key={property.id}
                  colors={tierColors[property.tier] || ["#1a1a1a", "#0a0a0a"]}
                  style={styles.ownedCard}
                >
                  <View style={styles.ownedHeader}>
                    <Text style={styles.ownedEmoji}>{property.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ownedName}>{property.name}</Text>
                      <Text style={styles.ownedLocation}>{property.location}</Text>
                    </View>
                    <Pressable
                      onPress={() => handleSell(property)}
                      style={({ pressed }) => [styles.sellBtn, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={styles.sellBtnText}>SELL</Text>
                    </Pressable>
                  </View>
                  <View style={styles.ownedStats}>
                    <View style={styles.ownedStat}>
                      <Text style={styles.ownedStatLabel}>Value</Text>
                      <Text style={styles.ownedStatValue}>{formatMoney(currentValue)}</Text>
                    </View>
                    <View style={styles.ownedStat}>
                      <Text style={styles.ownedStatLabel}>Profit</Text>
                      <Text style={[styles.ownedStatValue, { color: profit >= 0 ? "#22C55E" : "#EF4444" }]}>
                        {profit >= 0 ? "+" : ""}{formatMoney(profit)} ({profitPercent}%)
                      </Text>
                    </View>
                    <View style={styles.ownedStat}>
                      <Text style={styles.ownedStatLabel}>Rent</Text>
                      <Text style={[styles.ownedStatValue, { color: Colors.gold }]}>{formatMoney(property.rent)}/mo</Text>
                    </View>
                  </View>
                </LinearGradient>
              );
            })}
          </Animated.View>
        )}

        <Text style={styles.sectionTitle}>PROPERTIES FOR SALE</Text>
        {availableProperties.map((property, index) => {
          const canAfford = cash >= property.price;
          return (
            <Animated.View key={property.id} entering={FadeInDown.delay(400 + index * 50).duration(300)}>
              <LinearGradient
                colors={tierColors[property.tier] || ["#1a1a1a", "#0a0a0a"]}
                style={[styles.propertyCard, !canAfford && { opacity: 0.5 }]}
              >
                <View style={styles.propertyHeader}>
                  <Text style={styles.propertyEmoji}>{property.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.propertyNameRow}>
                      <Text style={styles.propertyName}>{property.name}</Text>
                      <View style={[styles.tierBadge, { backgroundColor: getTier(property.price).color + "30", borderColor: getTier(property.price).color + "60" }]}>
                        <Text style={[styles.tierBadgeText, { color: getTier(property.price).color }]}>
                          {property.tier.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.propertyLocation}>{property.location}</Text>
                  </View>
                </View>
                <View style={styles.propertyDetails}>
                  <View style={styles.propertyDetail}>
                    <Text style={styles.propertyDetailLabel}>Price</Text>
                    <Text style={styles.propertyDetailValue}>{formatMoney(property.price)}</Text>
                  </View>
                  <View style={styles.propertyDetail}>
                    <Text style={styles.propertyDetailLabel}>Rent</Text>
                    <Text style={[styles.propertyDetailValue, { color: "#22C55E" }]}>{formatMoney(property.rent)}/mo</Text>
                  </View>
                  <View style={styles.propertyDetail}>
                    <Text style={styles.propertyDetailLabel}>Growth</Text>
                    <Text style={[styles.propertyDetailValue, { color: Colors.gold }]}>+{(property.appreciation * 100).toFixed(0)}%/turn</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleBuy(property)}
                  disabled={!canAfford}
                  style={({ pressed }) => [styles.buyBtn, pressed && canAfford && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
                >
                  <LinearGradient
                    colors={canAfford ? [Colors.gold, Colors.goldDark] : ["#333", "#222"]}
                    style={styles.buyBtnGradient}
                  >
                    <Text style={[styles.buyBtnText, !canAfford && { color: "#666" }]}>
                      {canAfford ? `BUY FOR ${formatMoney(property.price)}` : `NEED ${formatMoney(property.price - cash)} MORE`}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </LinearGradient>
            </Animated.View>
          );
        })}

        <View style={styles.crossPromoSection}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/real-estate");
            }}
            style={({ pressed }) => [styles.crossPromoBtn, pressed && { opacity: 0.7 }]}
          >
            <LinearGradient colors={["#0a2a0a", "#0a1a0a"]} style={styles.crossPromoBtnInner}>
              <MaterialCommunityIcons name="office-building" size={24} color="#4ADE80" />
              <View style={{ flex: 1 }}>
                <Text style={styles.crossPromoTitle}>FIND REAL PROPERTIES</Text>
                <Text style={styles.crossPromoSub}>Browse Trump-approved real listings</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#4ADE80" />
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/dashboard");
            }}
            style={({ pressed }) => [styles.crossPromoBtn, pressed && { opacity: 0.7 }]}
          >
            <LinearGradient colors={["#0a0a2a", "#0a0a1a"]} style={styles.crossPromoBtnInner}>
              <MaterialCommunityIcons name="chart-line" size={24} color="#60A5FA" />
              <View style={{ flex: 1 }}>
                <Text style={styles.crossPromoTitle}>TRUMP'S MARKET PICKS</Text>
                <Text style={styles.crossPromoSub}>See live stock tips & hot takes</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#60A5FA" />
            </LinearGradient>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    ...Platform.select({
      web: {
        height: "100vh" as any,
        maxHeight: "100vh" as any,
        overflow: "hidden" as any,
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
  turnText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "600" as const,
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
        maxHeight: "100%" as any,
      },
    }),
  },
  scrollContent: {
    paddingHorizontal: 16,
    ...Platform.select({
      web: {
        maxWidth: 600,
        alignSelf: "center" as any,
        width: "100%" as any,
      },
    }),
  },
  netWorthCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
    marginBottom: 12,
  },
  netWorthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  netWorthLabel: {
    fontSize: 12,
    fontWeight: "800" as const,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 4,
  },
  netWorthValue: {
    fontSize: 32,
    fontWeight: "900" as const,
    color: Colors.gold,
  },
  statsCol: {
    gap: 4,
    alignItems: "flex-end",
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.7)",
  },
  progressBarContainer: {
    marginTop: 14,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    textAlign: "right" as const,
    marginTop: 4,
  },
  trumpQuoteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "rgba(212,164,32,0.06)",
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.gold,
  },
  trumpAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  trumpQuoteBubble: {
    flex: 1,
  },
  trumpQuoteText: {
    fontSize: 14,
    color: "#fff",
    fontStyle: "italic",
    lineHeight: 20,
  },
  eventCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  eventEmoji: {
    fontSize: 24,
  },
  eventText: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 18,
  },
  eventEffect: {
    fontSize: 15,
    fontWeight: "800" as const,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  rentBtn: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#22C55E",
    letterSpacing: 0.5,
  },
  actionBtnSub: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "rgba(34,197,94,0.6)",
  },
  gameOverCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    marginBottom: 16,
  },
  gameOverTitle: {
    fontSize: 28,
    fontWeight: "900" as const,
    color: "#EF4444",
    letterSpacing: 3,
    marginBottom: 8,
  },
  gameOverText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center" as const,
    marginBottom: 20,
  },
  gameOverButtons: {
    flexDirection: "row",
    gap: 12,
  },
  restartBtn: {
    backgroundColor: Colors.gold,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  restartBtnText: {
    fontSize: 14,
    fontWeight: "900" as const,
    color: "#000",
    letterSpacing: 1,
  },
  shareGameBtn: {
    borderWidth: 1,
    borderColor: Colors.gold,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  shareGameBtnText: {
    fontSize: 14,
    fontWeight: "900" as const,
    color: Colors.gold,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 4,
  },
  ownedCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  ownedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  ownedEmoji: {
    fontSize: 28,
  },
  ownedName: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: "#fff",
  },
  ownedLocation: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  sellBtn: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sellBtnText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#EF4444",
    letterSpacing: 0.5,
  },
  ownedStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ownedStat: {
    flex: 1,
  },
  ownedStatLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ownedStatValue: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#fff",
  },
  propertyCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  propertyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  propertyEmoji: {
    fontSize: 28,
  },
  propertyNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  propertyName: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: "#fff",
  },
  propertyLocation: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
  propertyDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  propertyDetail: {},
  propertyDetailLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  propertyDetailValue: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#fff",
  },
  buyBtn: {
    borderRadius: 10,
    overflow: "hidden",
  },
  buyBtnGradient: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  buyBtnText: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#000",
    letterSpacing: 0.5,
  },
  crossPromoSection: {
    marginTop: 20,
    gap: 10,
  },
  crossPromoBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  crossPromoBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  crossPromoTitle: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 0.5,
  },
  crossPromoSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
});
