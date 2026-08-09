import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Alert,
  ScrollView,
  Linking,
  ActivityIndicator,
  Image,
} from "react-native";
import { TokenWinVideo } from "@/components/TokenWinVideo";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
  FontAwesome5,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useQuery } from "@tanstack/react-query";
import { useTokens } from "@/lib/token-context";

const TOKEN_PACKS = [
  { id: "pack_15", tokens: 15, price: "$2.99", badge: null },
  { id: "pack_35", tokens: 35, price: "$4.99", badge: "POPULAR" },
  { id: "pack_80", tokens: 80, price: "$9.99", badge: "BEST VALUE" },
];

export default function SubscribeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ success?: string; canceled?: string; session_id?: string }>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"plans" | "tokens">("tokens");
  const [fulfilled, setFulfilled] = useState(false);
  const [winVideoVisible, setWinVideoVisible] = useState(false);
  const [winVideoAmount, setWinVideoAmount] = useState<number | undefined>();
  const [winVideoSource, setWinVideoSource] = useState<string | undefined>();
  const { deviceId, balance, refreshBalance } = useTokens();

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  function getWebParams() {
    if (Platform.OS !== "web" || typeof window === "undefined") return null;
    const urlParams = new URLSearchParams(window.location.search);
    return {
      success: urlParams.get("success"),
      session_id: urlParams.get("session_id"),
      canceled: urlParams.get("canceled"),
    };
  }

  const { data: productsData } = useQuery<{
    data: Array<{
      id: string;
      name: string;
      description: string | null;
      prices: Array<{
        id: string;
        unit_amount: number | null;
        currency: string;
        recurring: { interval: string } | null;
      }>;
      metadata?: Record<string, string>;
    }>;
  }>({
    queryKey: ["/api/stripe/products"],
    staleTime: 60000,
  });

  const standardProduct = productsData?.data?.find(
    (p) => p.name === "The Arena Standard"
  );
  const vipProduct = productsData?.data?.find(
    (p) => p.name === "The Arena VIP"
  );

  const standardPrice = standardProduct?.prices?.find((p) => p.recurring?.interval === "month");
  const vipPrice = vipProduct?.prices?.find((p) => p.recurring?.interval === "month");

  const tokenPackProducts = productsData?.data?.filter(
    (p) => p.name.includes("Tokens") && !p.name.includes("The Arena") && !p.name.includes("Chat DJT")
  );

  useEffect(() => {
    if (fulfilled) return;

    const webParams = getWebParams();
    const success = params.success || webParams?.success;
    const sessionId = params.session_id || webParams?.session_id;
    const canceled = params.canceled || webParams?.canceled;

    if (success === "true" && sessionId && deviceId) {
      fulfillOrder(sessionId);
    } else if (canceled === "true") {
      const msg = "No problem! You can get tokens anytime. We'll be here!";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Canceled", msg, [{ text: "OK", style: "default" }]);
      }
    }
  }, [params.success, params.canceled, params.session_id, deviceId, fulfilled]);

  async function fulfillOrder(sessionId: string) {
    try {
      setIsProcessing(true);
      setFulfilled(true);
      const res = await apiRequest("POST", "/api/stripe/fulfill", {
        sessionId,
        deviceId,
      });
      const data = await res.json();
      await refreshBalance();

      if (Platform.OS === "web" && typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("success");
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.pathname);
      }

      let tokenAmount: number | undefined;
      let tokenSource: string | undefined;
      if (data.type === "subscription" && data.tier === "vip") {
        tokenAmount = 150;
        tokenSource = "VIP Subscription";
      } else if (data.type === "subscription") {
        tokenAmount = 50;
        tokenSource = "Standard Subscription";
      } else {
        tokenAmount = data.tokens || undefined;
        tokenSource = "Token Pack";
      }

      setWinVideoAmount(tokenAmount);
      setWinVideoSource(tokenSource);
      setWinVideoVisible(true);
    } catch (error) {
      console.error("Fulfill error:", error);
      const msg = "There was an issue adding your tokens. Please try again or contact support.";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSubscribe(tier: "standard" | "vip") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsProcessing(true);

    try {
      const priceId = tier === "vip" ? vipPrice?.id : standardPrice?.id;
      if (!priceId) {
        throw new Error("No subscription plan available");
      }

      const res = await apiRequest("POST", "/api/stripe/checkout", {
        priceId,
        mode: "subscription",
        deviceId,
        tier,
      });
      const { url } = await res.json();

      if (url) {
        if (Platform.OS === "web") {
          window.location.href = url;
        } else {
          await Linking.openURL(url);
        }
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      const msg = "Something went wrong. Try again later!";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleBuyPack(packId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);

    try {
      const packSizes: Record<string, string> = { pack_15: "15", pack_35: "35", pack_80: "80" };
      const size = packSizes[packId] || "15";
      const packProduct = tokenPackProducts?.find(
        (p) => p.name.includes(size)
      );
      const priceId = packProduct?.prices?.[0]?.id;

      if (!priceId) throw new Error("Token pack not available");

      const res = await apiRequest("POST", "/api/stripe/checkout", {
        priceId,
        mode: "payment",
        packId,
        deviceId,
      });
      const { url } = await res.json();

      if (url) {
        if (Platform.OS === "web") {
          window.location.href = url;
        } else {
          await Linking.openURL(url);
        }
      }
    } catch (error: any) {
      console.error("Purchase error:", error);
      const msg = "Something went wrong. Try again later!";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setIsProcessing(false);
    }
  }

  const standardDisplayPrice = standardPrice?.unit_amount
    ? (standardPrice.unit_amount / 100).toFixed(2)
    : "4.99";
  const vipDisplayPrice = vipPrice?.unit_amount
    ? (vipPrice.unit_amount / 100).toFixed(2)
    : "9.99";

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient
        colors={[
          "rgba(212, 164, 32, 0.25)",
          "rgba(212, 164, 32, 0.08)",
          Colors.background,
        ]}
        style={styles.bgGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
          style={styles.closeButton}
          testID="close-subscribe"
        >
          <Ionicons name="close" size={24} color={Colors.whiteDim} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + webBottomInset + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInUp.duration(600)}
          style={styles.heroSection}
        >
          <View style={styles.tokenCircle}>
            <Image source={require("@/assets/images/dc-lightning-token.jpeg")} style={{ width: 40, height: 40, borderRadius: 20 }} />
          </View>
          <Text style={styles.heroTitle}>D.C. Tokens</Text>
          <Text style={styles.heroSubtitle}>
            Power your conversations with DJT. Each prompt costs 1 token.
          </Text>
        </Animated.View>

        {balance && (
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            style={styles.balanceCard}
          >
            <LinearGradient
              colors={["rgba(212, 164, 32, 0.2)", "rgba(212, 164, 32, 0.05)"]}
              style={styles.balanceGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.balanceLabel}>YOUR BALANCE</Text>
              <View style={styles.balanceRow}>
                <Image source={require("@/assets/images/dc-lightning-token.jpeg")} style={{ width: 28, height: 28, borderRadius: 14 }} />
                <Text style={styles.balanceAmount}>{balance.totalAvailable}</Text>
                <Text style={styles.balanceUnit}>D.C. tokens</Text>
              </View>
              {balance.freeRemaining > 0 && (
                <Text style={styles.balanceDetail}>
                  {balance.freeRemaining} free + {balance.tokens} purchased
                </Text>
              )}
              {balance.isSubscribed && (
                <View style={styles.subscribedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                  <Text style={styles.subscribedText}>
                    {balance.subscriptionTier === "vip" ? "VIP Active" : "Standard Active"}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={styles.tabRow}
        >
          <Pressable
            onPress={() => setSelectedTab("tokens")}
            style={[styles.tab, selectedTab === "tokens" && styles.tabActive]}
          >
            <FontAwesome5
              name="coins"
              size={14}
              color={selectedTab === "tokens" ? Colors.gold : Colors.whiteMuted}
            />
            <Text style={[styles.tabText, selectedTab === "tokens" && styles.tabTextActive]}>
              Buy Tokens
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSelectedTab("plans")}
            style={[styles.tab, selectedTab === "plans" && styles.tabActive]}
          >
            <MaterialCommunityIcons
              name="crown"
              size={18}
              color={selectedTab === "plans" ? Colors.gold : Colors.whiteMuted}
            />
            <Text style={[styles.tabText, selectedTab === "plans" && styles.tabTextActive]}>
              Monthly Plans
            </Text>
          </Pressable>
        </Animated.View>

        {selectedTab === "plans" ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.plansContainer}>
            <View style={styles.planCard}>
              <LinearGradient
                colors={["rgba(212, 164, 32, 0.12)", "rgba(212, 164, 32, 0.03)"]}
                style={styles.planGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.planHeader}>
                  <MaterialCommunityIcons name="crown" size={24} color={Colors.gold} />
                  <Text style={styles.planTitle}>Standard</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceCurrency}>$</Text>
                  <Text style={styles.priceAmount}>{standardDisplayPrice.split(".")[0]}</Text>
                  <Text style={styles.priceCents}>.{standardDisplayPrice.split(".")[1]}</Text>
                  <Text style={styles.pricePeriod}>/month</Text>
                </View>
                <View style={styles.planFeatures}>
                  <View style={styles.featureRow}>
                    <FontAwesome5 name="coins" size={13} color={Colors.gold} />
                    <Text style={styles.featureText}>50 Dynamic Tokens every month</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="refresh" size={15} color={Colors.gold} />
                    <Text style={styles.featureText}>Auto-refills monthly</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="star" size={15} color={Colors.gold} />
                    <Text style={styles.featureText}>~$0.10 per chat</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleSubscribe("standard")}
                  disabled={isProcessing}
                  style={({ pressed }) => [
                    styles.planButton,
                    pressed && styles.planButtonPressed,
                    isProcessing && styles.planButtonDisabled,
                  ]}
                  testID="standard-subscribe-button"
                >
                  <LinearGradient
                    colors={["rgba(212, 164, 32, 0.6)", "rgba(212, 164, 32, 0.3)"]}
                    style={styles.planButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <Text style={styles.planButtonText}>
                        {balance?.isSubscribed && balance?.subscriptionTier !== "vip" ? "Manage" : "Get Standard"}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </LinearGradient>
            </View>

            <View style={[styles.planCard, styles.vipCard]}>
              <View style={styles.vipBadge}>
                <Text style={styles.vipBadgeText}>BEST VALUE</Text>
              </View>
              <LinearGradient
                colors={["rgba(212, 164, 32, 0.22)", "rgba(212, 164, 32, 0.06)"]}
                style={styles.planGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.planHeader}>
                  <MaterialCommunityIcons name="diamond-stone" size={24} color="#E8D5A0" />
                  <Text style={[styles.planTitle, { color: "#E8D5A0" }]}>VIP</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceCurrency}>$</Text>
                  <Text style={styles.priceAmount}>{vipDisplayPrice.split(".")[0]}</Text>
                  <Text style={styles.priceCents}>.{vipDisplayPrice.split(".")[1]}</Text>
                  <Text style={styles.pricePeriod}>/month</Text>
                </View>
                <View style={styles.planFeatures}>
                  <View style={styles.featureRow}>
                    <FontAwesome5 name="coins" size={13} color="#E8D5A0" />
                    <Text style={styles.featureText}>150 Dynamic Tokens every month</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="refresh" size={15} color="#E8D5A0" />
                    <Text style={styles.featureText}>Auto-refills monthly</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="flash" size={15} color="#E8D5A0" />
                    <Text style={styles.featureText}>3x more tokens than Standard</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="star" size={15} color="#E8D5A0" />
                    <Text style={styles.featureText}>~$0.07 per chat — lowest price</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleSubscribe("vip")}
                  disabled={isProcessing}
                  style={({ pressed }) => [
                    styles.planButton,
                    styles.vipButton,
                    pressed && styles.planButtonPressed,
                    isProcessing && styles.planButtonDisabled,
                  ]}
                  testID="vip-subscribe-button"
                >
                  <LinearGradient
                    colors={[Colors.goldLight, Colors.gold, Colors.goldDark]}
                    style={styles.planButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color={Colors.black} size="small" />
                    ) : (
                      <Text style={[styles.planButtonText, styles.vipButtonText]}>
                        {balance?.isSubscribed && balance?.subscriptionTier === "vip" ? "Manage VIP" : "Go VIP"}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </LinearGradient>
            </View>

            <Text style={styles.planNote}>Cancel anytime. No questions asked.</Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.packsSection}>
            <Text style={styles.packsTitle}>Need more tokens? Grab a pack!</Text>
            {TOKEN_PACKS.map((pack) => (
              <Pressable
                key={pack.id}
                onPress={() => handleBuyPack(pack.id)}
                disabled={isProcessing}
                style={({ pressed }) => [
                  styles.packCard,
                  pressed && styles.packCardPressed,
                  pack.badge === "BEST VALUE" && styles.packCardHighlighted,
                ]}
              >
                <View style={styles.packLeft}>
                  <View style={styles.packIconContainer}>
                    <FontAwesome5 name="coins" size={20} color={Colors.gold} />
                  </View>
                  <View>
                    <View style={styles.packNameRow}>
                      <Text style={styles.packTokens}>{pack.tokens}</Text>
                      <Text style={styles.packLabel}>Tokens</Text>
                    </View>
                    {pack.badge && (
                      <View style={[
                        styles.packBadge,
                        pack.badge === "BEST VALUE" && styles.packBadgeBest,
                      ]}>
                        <Text style={styles.packBadgeText}>{pack.badge}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.packRight}>
                  <Text style={styles.packPrice}>{pack.price}</Text>
                  <Text style={styles.packPerToken}>
                    ${(parseFloat(pack.price.replace("$", "")) / pack.tokens).toFixed(2)}/ea
                  </Text>
                </View>
              </Pressable>
            ))}
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(500).duration(400)}
          style={styles.paymentMethods}
        >
          <Text style={styles.paymentLabel}>Secure Payment via Stripe</Text>
          <View style={styles.paymentIcons}>
            <View style={styles.paymentBadge}>
              <Feather name="credit-card" size={18} color={Colors.whiteDim} />
              <Text style={styles.paymentBadgeText}>Card</Text>
            </View>
            <View style={styles.paymentBadge}>
              <Ionicons name="logo-apple" size={18} color={Colors.whiteDim} />
              <Text style={styles.paymentBadgeText}>Apple Pay</Text>
            </View>
            <View style={styles.paymentBadge}>
              <Ionicons name="logo-google" size={18} color={Colors.whiteDim} />
              <Text style={styles.paymentBadgeText}>Google Pay</Text>
            </View>
          </View>
        </Animated.View>

        <Text style={styles.legalText}>
          Subscriptions auto-renew monthly. Cancel anytime from your Stripe account.
          Token packs are one-time purchases and do not expire.
        </Text>
      </ScrollView>
      <TokenWinVideo
        visible={winVideoVisible}
        onClose={() => setWinVideoVisible(false)}
        amount={winVideoAmount}
        source={winVideoSource}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  bgGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 20,
    gap: 10,
  },
  tokenCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(212, 164, 32, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(212, 164, 32, 0.3)",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 30,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.gold,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.whiteDim,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  balanceCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.25)",
  },
  balanceGradient: {
    padding: 18,
    alignItems: "center",
    gap: 6,
  },
  balanceLabel: {
    fontSize: 11,
    color: Colors.whiteMuted,
    letterSpacing: 2,
    fontWeight: "600" as const,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  balanceAmount: {
    fontSize: 42,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.white,
    lineHeight: 48,
  },
  balanceUnit: {
    fontSize: 16,
    color: Colors.whiteDim,
    marginTop: 8,
  },
  balanceDetail: {
    fontSize: 12,
    color: Colors.whiteMuted,
  },
  subscribedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subscribedText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "600" as const,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "rgba(212, 164, 32, 0.15)",
  },
  tabText: {
    fontSize: 14,
    color: Colors.whiteMuted,
    fontWeight: "600" as const,
  },
  tabTextActive: {
    color: Colors.gold,
  },
  plansContainer: {
    gap: 16,
  },
  planCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.2)",
  },
  vipCard: {
    borderColor: Colors.gold,
    borderWidth: 2,
  },
  vipBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
    zIndex: 1,
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: Colors.black,
    letterSpacing: 1,
  },
  planGradient: {
    padding: 20,
    gap: 14,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  planTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  priceCurrency: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    marginTop: 4,
  },
  priceAmount: {
    fontSize: 42,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.white,
    lineHeight: 46,
  },
  priceCents: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    marginTop: 4,
  },
  pricePeriod: {
    fontSize: 14,
    color: Colors.whiteMuted,
    marginTop: 20,
    marginLeft: 4,
  },
  planFeatures: {
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 13,
    color: Colors.whiteDim,
  },
  planButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 4,
  },
  vipButton: {
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  planButtonGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  planButtonText: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
  },
  vipButtonText: {
    color: Colors.black,
  },
  planButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  planButtonDisabled: {
    opacity: 0.5,
  },
  planNote: {
    fontSize: 12,
    color: Colors.whiteMuted,
    textAlign: "center",
  },
  packsSection: {
    gap: 12,
  },
  packsTitle: {
    fontSize: 15,
    color: Colors.whiteDim,
    textAlign: "center",
    marginBottom: 4,
  },
  packCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  packCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  packCardHighlighted: {
    borderColor: Colors.gold,
    borderWidth: 2,
  },
  packLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  packIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(212, 164, 32, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  packNameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  packTokens: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.white,
  },
  packLabel: {
    fontSize: 13,
    color: Colors.whiteDim,
    fontWeight: "500" as const,
  },
  packBadge: {
    backgroundColor: "rgba(212, 164, 32, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  packBadgeBest: {
    backgroundColor: "rgba(212, 164, 32, 0.25)",
  },
  packBadgeText: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  packRight: {
    alignItems: "flex-end",
  },
  packPrice: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.gold,
  },
  packPerToken: {
    fontSize: 11,
    color: Colors.whiteMuted,
    marginTop: 2,
  },
  paymentMethods: {
    alignItems: "center",
    marginTop: 24,
    gap: 10,
  },
  paymentLabel: {
    fontSize: 12,
    color: Colors.whiteMuted,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  paymentIcons: {
    flexDirection: "row",
    gap: 12,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentBadgeText: {
    fontSize: 11,
    color: Colors.whiteDim,
  },
  legalText: {
    fontSize: 10,
    color: Colors.whiteMuted,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 16,
    marginBottom: 16,
  },
});
