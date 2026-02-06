import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
  MaterialIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getAllConversations, clearAllConversations } from "@/lib/chat-storage";

interface StatCardProps {
  icon: string;
  iconSet: "ionicons" | "material" | "feather" | "materialCommunity";
  title: string;
  value: string;
  subtitle: string;
  delay: number;
}

function StatCard({ icon, iconSet, title, value, subtitle, delay }: StatCardProps) {
  const IconComponent = {
    ionicons: Ionicons,
    material: MaterialIcons,
    feather: Feather,
    materialCommunity: MaterialCommunityIcons,
  }[iconSet] as any;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={styles.statCard}>
      <View style={styles.statIconRow}>
        <IconComponent name={icon} size={20} color={Colors.gold} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </Animated.View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [totalChats, setTotalChats] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const convs = await getAllConversations();
    setTotalChats(convs.length);
    const msgs = convs.reduce((acc, c) => acc + c.messages.length, 0);
    setTotalMessages(msgs);
  }

  const REVENUE_LINKS = [
    {
      title: "RevenueCat Dashboard",
      subtitle: "Manage subscriptions, view analytics, and track revenue",
      icon: "trending-up" as const,
      url: "https://app.revenuecat.com",
    },
    {
      title: "Apple App Store Connect",
      subtitle: "Manage iOS subscribers and in-app purchases",
      icon: "logo-apple" as const,
      url: "https://appstoreconnect.apple.com",
    },
    {
      title: "Google Play Console",
      subtitle: "Manage Android subscribers and billing",
      icon: "logo-google" as const,
      url: "https://play.google.com/console",
    },
    {
      title: "Stripe Dashboard",
      subtitle: "Web payments, invoices, and payouts",
      icon: "card" as const,
      url: "https://dashboard.stripe.com",
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient
        colors={["rgba(212, 164, 32, 0.12)", Colors.background]}
        style={styles.bgGradient}
      />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="shield-crown" size={24} color={Colors.gold} />
          <Text style={styles.headerTitle}>Back Office</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
          testID="close-admin"
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
        <Animated.View entering={FadeInUp.duration(500)}>
          <Text style={styles.sectionTitle}>Platform Stats</Text>
          <Text style={styles.sectionSubtitle}>The numbers are HUGE, believe me!</Text>
        </Animated.View>

        <View style={styles.statsGrid}>
          <StatCard
            icon="chatbubbles"
            iconSet="ionicons"
            title="Total Chats"
            value={totalChats.toString()}
            subtitle="Conversations"
            delay={100}
          />
          <StatCard
            icon="text"
            iconSet="ionicons"
            title="Messages"
            value={totalMessages.toString()}
            subtitle="Total sent"
            delay={200}
          />
          <StatCard
            icon="cash"
            iconSet="ionicons"
            title="Price"
            value="$2.99"
            subtitle="Per month"
            delay={300}
          />
          <StatCard
            icon="star"
            iconSet="ionicons"
            title="Status"
            value="Active"
            subtitle="Ready to launch"
            delay={400}
          />
        </View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Revenue Collection</Text>
          <Text style={styles.sectionSubtitle}>
            All the ways to collect your tremendous money!
          </Text>
        </Animated.View>

        <View style={styles.revenueLinks}>
          {REVENUE_LINKS.map((link, index) => (
            <Animated.View
              key={link.title}
              entering={FadeInDown.delay(600 + index * 80).duration(400)}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.revenueCard,
                  pressed && styles.revenueCardPressed,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Linking.openURL(link.url);
                }}
              >
                <View style={styles.revenueIconContainer}>
                  <Ionicons name={link.icon} size={22} color={Colors.gold} />
                </View>
                <View style={styles.revenueText}>
                  <Text style={styles.revenueLinkTitle}>{link.title}</Text>
                  <Text style={styles.revenueLinkSubtitle}>{link.subtitle}</Text>
                </View>
                <Feather name="external-link" size={16} color={Colors.whiteMuted} />
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(1000).duration(400)}>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Setup Guide</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(1100).duration(400)}
          style={styles.setupCard}
        >
          <Text style={styles.setupTitle}>RevenueCat Integration</Text>
          <Text style={styles.setupDescription}>
            RevenueCat handles all subscription payments across iOS, Android, and web.
            It manages Apple Pay, Google Pay, credit cards, and more.
          </Text>
          <View style={styles.setupSteps}>
            {[
              "Create a RevenueCat account at revenuecat.com",
              "Set up your $2.99/mo product in App Store Connect & Google Play",
              "Add your RevenueCat API keys to the app",
              "Revenue flows directly to your bank account",
            ].map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(1200).duration(400)}>
          <Pressable
            style={({ pressed }) => [
              styles.dangerButton,
              pressed && styles.dangerButtonPressed,
            ]}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await clearAllConversations();
              await loadStats();
            }}
          >
            <Feather name="trash-2" size={18} color={Colors.redLight} />
            <Text style={styles.dangerButtonText}>Clear All Chat Data</Text>
          </Pressable>
        </Animated.View>
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
    height: 300,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.gold,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.whiteMuted,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "48%",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexGrow: 1,
    flexBasis: "45%",
  },
  statIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  statTitle: {
    fontSize: 12,
    color: Colors.whiteMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.white,
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 12,
    color: Colors.whiteDim,
  },
  revenueLinks: {
    gap: 10,
  },
  revenueCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  revenueCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  revenueIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(212, 164, 32, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  revenueText: {
    flex: 1,
  },
  revenueLinkTitle: {
    fontSize: 15,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.white,
    marginBottom: 2,
  },
  revenueLinkSubtitle: {
    fontSize: 12,
    color: Colors.whiteDim,
    lineHeight: 16,
  },
  setupCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  setupTitle: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
    marginBottom: 8,
  },
  setupDescription: {
    fontSize: 13,
    color: Colors.whiteDim,
    lineHeight: 20,
    marginBottom: 16,
  },
  setupSteps: {
    gap: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(212, 164, 32, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 12,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: Colors.whiteDim,
    lineHeight: 20,
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(204, 51, 51, 0.1)",
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(204, 51, 51, 0.3)",
    marginBottom: 20,
  },
  dangerButtonPressed: {
    opacity: 0.7,
  },
  dangerButtonText: {
    fontSize: 15,
    color: Colors.redLight,
    fontWeight: "600" as const,
  },
});
