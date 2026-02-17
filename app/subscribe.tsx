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
} from "react-native";
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
  { id: "pack_10", tokens: 10, price: "$1.99", badge: null },
  { id: "pack_25", tokens: 25, price: "$3.99", badge: "POPULAR" },
  { id: "pack_50", tokens: 50, price: "$6.99", badge: "BEST VALUE" },
];

export default function SubscribeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ success?: string; canceled?: string; session_id?: string }>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"subscribe" | "tokens">("subscribe");
  const [fulfilled, setFulfilled] = useState(false);
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
    }>;
  }>({
    queryKey: ["/api/stripe/products"],
    staleTime: 60000,
  });

  const monthlyPrice = productsData?.data?.find(
    (p) => p.name === "Chat DJT Premium"
  )?.prices?.find((p) => p.recurring?.interval === "month");

  const tokenPackProducts = productsData?.data?.filter(
    (p) => p.name.includes("Trump Tokens")
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

      const msg = data.type === "subscription"
        ? "Welcome to the club! 30 Trump Tokens loaded. The best deal, believe me!"
        : "Trump Tokens added to your account! Now get back in there!";

      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Tokens Added!", msg, [
          { text: "Tremendous!", style: "default", onPress: () => router.back() },
        ]);
      }
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

  async function handleSubscribe() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsProcessing(true);

    try {
      const priceId = monthlyPrice?.id;
      if (!priceId) {
        throw new Error("No subscription plan available");
      }

      const res = await apiRequest("POST", "/api/stripe/checkout", {
        priceId,
        mode: "subscription",
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
      const packProduct = tokenPackProducts?.find(
        (p) => p.name.includes(packId.replace("pack_", ""))
      );
      const priceId = packProduct?.prices?.[0]?.id;

      if (!priceId) {
        const packSizes: Record<string, string> = { pack_10: "10", pack_25: "25", pack_50: "50" };
        const size = packSizes[packId] || "10";
        const searchProduct = tokenPackProducts?.find(p => p.name.includes(size));
        const searchPrice = searchProduct?.prices?.[0]?.id;
        if (!searchPrice) throw new Error("Token pack not available");

        const res = await apiRequest("POST", "/api/stripe/checkout", {
          priceId: searchPrice,
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
        return;
      }

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

  const displayPrice = monthlyPrice?.unit_amount
    ? (monthlyPrice.unit_amount / 100).toFixed(2)
    : "2.99";

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
            <FontAwesome5 name="coins" size={32} color={Colors.gold} />
          </View>
          <Text style={styles.heroTitle}>Trump Tokens</Text>
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
                <FontAwesome5 name="coins" size={24} color={Colors.gold} />
                <Text style={styles.balanceAmount}>{balance.totalAvailable}</Text>
                <Text style={styles.balanceUnit}>tokens</Text>
              </View>
              {balance.freeRemaining > 0 && (
                <Text style={styles.balanceDetail}>
                  {balance.freeRemaining} free + {balance.tokens} purchased
                </Text>
              )}
              {balance.isSubscribed && (
                <View style={styles.subscribedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                  <Text style={styles.subscribedText}>Premium Active</Text>
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
            onPress={() => setSelectedTab("subscribe")}
            style={[styles.tab, selectedTab === "subscribe" && styles.tabActive]}
          >
            <MaterialCommunityIcons
              name="crown"
              size={18}
              color={selectedTab === "subscribe" ? Colors.gold : Colors.whiteMuted}
            />
            <Text style={[styles.tabText, selectedTab === "subscribe" && styles.tabTextActive]}>
              Monthly Plan
            </Text>
          </Pressable>
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
        </Animated.View>

        {selectedTab === "subscribe" ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <View style={styles.planCard}>
              <LinearGradient
                colors={["rgba(212, 164, 32, 0.15)", "rgba(212, 164, 32, 0.05)"]}
                style={styles.planGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.planHeader}>
                  <MaterialCommunityIcons name="crown" size={28} color={Colors.gold} />
                  <Text style={styles.planTitle}>Premium</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceCurrency}>$</Text>
                  <Text style={styles.priceAmount}>{displayPrice.split(".")[0]}</Text>
                  <Text style={styles.priceCents}>.{displayPrice.split(".")[1]}</Text>
                  <Text style={styles.pricePeriod}>/month</Text>
                </View>
                <View style={styles.planFeatures}>
                  <View style={styles.featureRow}>
                    <FontAwesome5 name="coins" size={14} color={Colors.gold} />
                    <Text style={styles.featureText}>30 Trump Tokens every month</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="refresh" size={16} color={Colors.gold} />
                    <Text style={styles.featureText}>Auto-refills monthly</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="flash" size={16} color={Colors.gold} />
                    <Text style={styles.featureText}>Priority responses</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="star" size={16} color={Colors.gold} />
                    <Text style={styles.featureText}>Only ~$0.10 per chat</Text>
                  </View>
                </View>
                <Text style={styles.planNote}>Cancel anytime. No questions asked.</Text>
              </LinearGradient>
            </View>

            <Pressable
              onPress={handleSubscribe}
              disabled={isProcessing}
              style={({ pressed }) => [
                styles.mainButton,
                pressed && styles.mainButtonPressed,
                isProcessing && styles.mainButtonDisabled,
              ]}
              testID="subscribe-action-button"
            >
              <LinearGradient
                colors={[Colors.goldLight, Colors.gold, Colors.goldDark]}
                style={styles.mainButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isProcessing ? (
                  <ActivityIndicator color={Colors.black} />
                ) : (
                  <Text style={styles.mainButtonText}>
                    {balance?.isSubscribed ? "Manage Subscription" : "Subscribe Now"}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.packsSection}>
            <Text style={styles.packsTitle}>Need more tokens? Grab a pack!</Text>
            {TOKEN_PACKS.map((pack, index) => (
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
          Subscription auto-renews monthly. Cancel anytime from your Stripe account.
          Token packs are one-time purchases and do not expire.
        </Text>
      </ScrollView>
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
  planCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.3)",
  },
  planGradient: {
    padding: 24,
    gap: 16,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  planTitle: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  priceCurrency: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    marginTop: 4,
  },
  priceAmount: {
    fontSize: 48,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.white,
    lineHeight: 52,
  },
  priceCents: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    marginTop: 4,
  },
  pricePeriod: {
    fontSize: 15,
    color: Colors.whiteMuted,
    marginTop: 24,
    marginLeft: 4,
  },
  planFeatures: {
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: Colors.whiteDim,
  },
  planNote: {
    fontSize: 12,
    color: Colors.whiteMuted,
    textAlign: "center",
  },
  mainButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  mainButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  mainButtonDisabled: {
    opacity: 0.7,
  },
  mainButtonGradient: {
    paddingVertical: 18,
    alignItems: "center",
  },
  mainButtonText: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.black,
    letterSpacing: 0.5,
  },
  packsSection: {
    gap: 12,
    marginBottom: 20,
  },
  packsTitle: {
    fontSize: 14,
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
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  packCardHighlighted: {
    borderColor: Colors.gold,
    backgroundColor: "rgba(212, 164, 32, 0.08)",
  },
  packLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  packIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
    fontSize: 20,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
  },
  packLabel: {
    fontSize: 14,
    color: Colors.whiteDim,
  },
  packBadge: {
    backgroundColor: "rgba(212, 164, 32, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  packBadgeBest: {
    backgroundColor: "rgba(212, 164, 32, 0.3)",
  },
  packBadgeText: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: Colors.gold,
    letterSpacing: 1,
  },
  packRight: {
    alignItems: "flex-end",
  },
  packPrice: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
  },
  packPerToken: {
    fontSize: 11,
    color: Colors.whiteMuted,
    marginTop: 2,
  },
  paymentMethods: {
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  paymentLabel: {
    fontSize: 13,
    color: Colors.whiteMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
  },
  paymentIcons: {
    flexDirection: "row",
    gap: 12,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentBadgeText: {
    fontSize: 12,
    color: Colors.whiteDim,
  },
  legalText: {
    fontSize: 11,
    color: Colors.whiteMuted,
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 16,
  },
});
