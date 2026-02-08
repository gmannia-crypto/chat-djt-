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

const FEATURES = [
  {
    icon: "flash" as const,
    title: "Unlimited Chats",
    description: "Talk to DJT as much as you want, believe me!",
  },
  {
    icon: "star" as const,
    title: "Premium Responses",
    description: "The best, most tremendous AI responses. Nobody does it better.",
  },
  {
    icon: "shield-checkmark" as const,
    title: "Priority Access",
    description: "Skip the line. You're a VIP. Very Important Person.",
  },
  {
    icon: "rocket" as const,
    title: "Faster Responses",
    description: "Speed like you've never seen before. Incredible speed!",
  },
];

export default function SubscribeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ success?: string; canceled?: string }>();
  const [isSubscribing, setIsSubscribing] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

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

  const monthlyPrice = productsData?.data?.[0]?.prices?.find(
    (p) => p.recurring?.interval === "month"
  );

  useEffect(() => {
    if (params.success === "true") {
      const msg = "Welcome to Chat DJT Premium! You're going to love it, believe me!";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Subscription Active!", msg, [
          { text: "Tremendous!", style: "default", onPress: () => router.back() },
        ]);
      }
    } else if (params.canceled === "true") {
      const msg = "No problem! You can subscribe anytime. We'll be here!";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Subscription Canceled", msg, [
          { text: "OK", style: "default" },
        ]);
      }
    }
  }, [params.success, params.canceled]);

  async function handleSubscribe() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSubscribing(true);

    try {
      const priceId = monthlyPrice?.id;
      if (!priceId) {
        throw new Error("No subscription plan available");
      }

      const res = await apiRequest("POST", "/api/stripe/checkout", { priceId });
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
      setIsSubscribing(false);
    }
  }

  const displayPrice = monthlyPrice?.unit_amount
    ? (monthlyPrice.unit_amount / 100).toFixed(2)
    : "2.99";
  const dollars = displayPrice.split(".")[0];
  const cents = "." + displayPrice.split(".")[1];

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
          onPress={() => router.back()}
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
          <View style={styles.crownCircle}>
            <MaterialCommunityIcons
              name="crown"
              size={40}
              color={Colors.gold}
            />
          </View>
          <Text style={styles.heroTitle}>Go Premium</Text>
          <Text style={styles.heroSubtitle}>
            Your 3 free questions are up! Unlock unlimited access to keep the conversation going.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          style={styles.priceCard}
        >
          <LinearGradient
            colors={["rgba(212, 164, 32, 0.15)", "rgba(212, 164, 32, 0.05)"]}
            style={styles.priceCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.priceLabel}>Monthly</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceCurrency}>$</Text>
              <Text style={styles.priceAmount}>{dollars}</Text>
              <Text style={styles.priceCents}>{cents}</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
            <Text style={styles.priceNote}>Cancel anytime. No questions asked.</Text>
          </LinearGradient>
        </Animated.View>

        <View style={styles.featuresSection}>
          {FEATURES.map((feature, index) => (
            <Animated.View
              key={feature.title}
              entering={FadeInDown.delay(300 + index * 80).duration(400)}
              style={styles.featureRow}
            >
              <View style={styles.featureIconContainer}>
                <Ionicons
                  name={feature.icon}
                  size={22}
                  color={Colors.gold}
                />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(700).duration(400)}>
          <Pressable
            onPress={handleSubscribe}
            disabled={isSubscribing}
            style={({ pressed }) => [
              styles.subscribeButton,
              pressed && styles.subscribeButtonPressed,
              isSubscribing && styles.subscribeButtonDisabled,
            ]}
            testID="subscribe-action-button"
          >
            <LinearGradient
              colors={[Colors.goldLight, Colors.gold, Colors.goldDark]}
              style={styles.subscribeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isSubscribing ? (
                <ActivityIndicator color={Colors.black} />
              ) : (
                <Text style={styles.subscribeText}>Subscribe Now</Text>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(800).duration(400)}
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
    marginBottom: 32,
    gap: 12,
  },
  crownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(212, 164, 32, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(212, 164, 32, 0.3)",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.gold,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.whiteDim,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  priceCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.3)",
  },
  priceCardGradient: {
    padding: 24,
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: "600" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  priceCurrency: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    marginTop: 6,
  },
  priceAmount: {
    fontSize: 56,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.white,
    lineHeight: 60,
  },
  priceCents: {
    fontSize: 24,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    marginTop: 6,
  },
  pricePeriod: {
    fontSize: 16,
    color: Colors.whiteMuted,
    marginTop: 30,
    marginLeft: 4,
  },
  priceNote: {
    fontSize: 13,
    color: Colors.whiteMuted,
  },
  featuresSection: {
    marginBottom: 28,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(212, 164, 32, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: Colors.whiteDim,
    lineHeight: 18,
  },
  subscribeButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  subscribeButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  subscribeButtonDisabled: {
    opacity: 0.7,
  },
  subscribeGradient: {
    paddingVertical: 18,
    alignItems: "center",
  },
  subscribeText: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.black,
    letterSpacing: 0.5,
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
