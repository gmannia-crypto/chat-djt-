import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
  Linking,
  ActivityIndicator,
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
import { getApiUrl } from "@/lib/query-client";

interface AdminStats {
  users: {
    total: number;
    activeSubscribers: number;
    stripeCustomers: number;
    totalTokensHeld: number;
    totalFreePromptsUsed: number;
  };
  transactions: {
    total: number;
    subscriptions: number;
    tokenPacks: number;
    totalTokensGranted: number;
  };
  revenue: {
    total: string;
    subscriptions: string;
    tokenPacks: string;
  };
  apiUsage?: {
    sinceRestart: string;
    endpoints: Record<string, { calls: number; estimatedCost: string }>;
    totalEstimatedCost: string;
    estimatedProfit: string;
  };
  recentTransactions: {
    type: string;
    amount: number;
    description: string;
    createdAt: string;
    deviceId: string;
  }[];
}

interface StatCardProps {
  icon: string;
  iconSet: "ionicons" | "material" | "feather" | "materialCommunity";
  title: string;
  value: string;
  subtitle: string;
  delay: number;
  accent?: string;
}

function StatCard({ icon, iconSet, title, value, subtitle, delay, accent }: StatCardProps) {
  const IconComponent = {
    ionicons: Ionicons,
    material: MaterialIcons,
    feather: Feather,
    materialCommunity: MaterialCommunityIcons,
  }[iconSet] as any;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={styles.statCard}>
      <View style={styles.statIconRow}>
        <IconComponent name={icon} size={20} color={accent || Colors.gold} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, accent ? { color: accent } : undefined]}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </Animated.View>
  );
}

function TransactionRow({ tx, index }: { tx: AdminStats["recentTransactions"][0]; index: number }) {
  const isSubscription = tx.type === "subscription";
  const icon = isSubscription ? "card" : "cube";
  const color = isSubscription ? "#4ADE80" : Colors.gold;
  const timeStr = new Date(tx.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Animated.View entering={FadeInDown.delay(600 + index * 50).duration(300)}>
      <View style={styles.txRow}>
        <View style={[styles.txIcon, { backgroundColor: color + "18" }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <View style={styles.txContent}>
          <Text style={styles.txDescription} numberOfLines={1}>{tx.description || tx.type}</Text>
          <Text style={styles.txMeta}>{tx.deviceId} — {timeStr}</Text>
        </View>
        <View style={styles.txAmount}>
          <Text style={[styles.txTokens, { color }]}>+{tx.amount}</Text>
          <Text style={styles.txTokenLabel}>tokens</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      setError(null);
      const url = new URL("/api/admin/stats", getApiUrl());
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      console.error("Admin stats error:", err);
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

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
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              fetchStats();
            }}
            style={styles.refreshButton}
            testID="refresh-admin"
          >
            <Feather name="refresh-cw" size={18} color={Colors.gold} />
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={styles.closeButton}
            testID="close-admin"
          >
            <Ionicons name="close" size={24} color={Colors.whiteDim} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + webBottomInset + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading && !stats ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.loadingText}>Loading stats...</Text>
          </View>
        ) : error && !stats ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="alert-circle" size={40} color="#F87171" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={fetchStats} style={styles.retryButton}>
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        ) : stats ? (
          <>
            <Animated.View entering={FadeInUp.duration(500)}>
              <Text style={styles.sectionTitle}>Revenue</Text>
              <Text style={styles.sectionSubtitle}>The money is flowing, believe me!</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.revenueHero}>
              <Text style={styles.revenueLabel}>TOTAL REVENUE</Text>
              <Text style={styles.revenueAmount}>${stats.revenue.total}</Text>
              <View style={styles.revenueBreakdown}>
                <View style={styles.revenueBreakdownItem}>
                  <View style={[styles.revenueBreakdownDot, { backgroundColor: "#4ADE80" }]} />
                  <Text style={styles.revenueBreakdownText}>Subscriptions: ${stats.revenue.subscriptions}</Text>
                </View>
                <View style={styles.revenueBreakdownItem}>
                  <View style={[styles.revenueBreakdownDot, { backgroundColor: Colors.gold }]} />
                  <Text style={styles.revenueBreakdownText}>Token Packs: ${stats.revenue.tokenPacks}</Text>
                </View>
              </View>
            </Animated.View>

            {stats.apiUsage && (
              <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.apiUsageSection}>
                <Text style={styles.sectionTitle}>API Costs (Since Restart)</Text>
                <View style={styles.profitRow}>
                  <View style={styles.profitItem}>
                    <Text style={styles.profitLabel}>Est. API Cost</Text>
                    <Text style={[styles.profitValue, { color: "#EF4444" }]}>{stats.apiUsage.totalEstimatedCost}</Text>
                  </View>
                  <View style={styles.profitItem}>
                    <Text style={styles.profitLabel}>Est. Profit</Text>
                    <Text style={[styles.profitValue, { color: "#4ADE80" }]}>{stats.apiUsage.estimatedProfit}</Text>
                  </View>
                </View>
                {Object.entries(stats.apiUsage.endpoints).map(([key, val]) => (
                  <View key={key} style={styles.apiRow}>
                    <Text style={styles.apiEndpoint}>{key}</Text>
                    <Text style={styles.apiCalls}>{val.calls} calls</Text>
                    <Text style={styles.apiCost}>{val.estimatedCost}</Text>
                  </View>
                ))}
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Users</Text>
            </Animated.View>

            <View style={styles.statsGrid}>
              <StatCard
                icon="people"
                iconSet="ionicons"
                title="Total Users"
                value={stats.users.total.toString()}
                subtitle="All registered devices"
                delay={250}
              />
              <StatCard
                icon="card"
                iconSet="ionicons"
                title="Subscribers"
                value={stats.users.activeSubscribers.toString()}
                subtitle="Active $2.99/mo"
                delay={300}
                accent="#4ADE80"
              />
              <StatCard
                icon="logo-usd"
                iconSet="ionicons"
                title="Stripe Customers"
                value={stats.users.stripeCustomers.toString()}
                subtitle="With payment info"
                delay={350}
              />
              <StatCard
                icon="flash"
                iconSet="ionicons"
                title="Free Prompts"
                value={stats.users.totalFreePromptsUsed.toString()}
                subtitle="Used across users"
                delay={400}
              />
            </View>

            <Animated.View entering={FadeInDown.delay(450).duration(400)}>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Transactions</Text>
            </Animated.View>

            <View style={styles.statsGrid}>
              <StatCard
                icon="receipt"
                iconSet="material"
                title="Total"
                value={stats.transactions.total.toString()}
                subtitle="All transactions"
                delay={500}
              />
              <StatCard
                icon="autorenew"
                iconSet="material"
                title="Subscriptions"
                value={stats.transactions.subscriptions.toString()}
                subtitle="Subscription txns"
                delay={550}
                accent="#4ADE80"
              />
              <StatCard
                icon="cube"
                iconSet="ionicons"
                title="Token Packs"
                value={stats.transactions.tokenPacks.toString()}
                subtitle="Pack purchases"
                delay={600}
              />
              <StatCard
                icon="diamond"
                iconSet="materialCommunity"
                title="Tokens Granted"
                value={stats.transactions.totalTokensGranted.toString()}
                subtitle="Total distributed"
                delay={650}
              />
            </View>

            {stats.recentTransactions.length > 0 && (
              <>
                <Animated.View entering={FadeInDown.delay(700).duration(400)}>
                  <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Activity</Text>
                  <Text style={styles.sectionSubtitle}>Latest customer purchases</Text>
                </Animated.View>

                <View style={styles.txList}>
                  {stats.recentTransactions.map((tx, i) => (
                    <TransactionRow key={`${tx.createdAt}-${i}`} tx={tx} index={i} />
                  ))}
                </View>
              </>
            )}

            <Animated.View entering={FadeInDown.delay(900).duration(400)}>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Manage Payments</Text>
              <Text style={styles.sectionSubtitle}>
                Go to Stripe to manage customers, refunds, and payouts
              </Text>
            </Animated.View>

            <View style={styles.revenueLinks}>
              {[
                {
                  title: "Stripe Dashboard",
                  subtitle: "Customers, payments, refunds, and payouts",
                  icon: "card" as const,
                  url: "https://dashboard.stripe.com",
                },
                {
                  title: "Stripe Customers",
                  subtitle: "View all customers and their payment history",
                  icon: "people" as const,
                  url: "https://dashboard.stripe.com/customers",
                },
                {
                  title: "Stripe Payments",
                  subtitle: "View all payments and process refunds",
                  icon: "cash" as const,
                  url: "https://dashboard.stripe.com/payments",
                },
                {
                  title: "Stripe Subscriptions",
                  subtitle: "Manage active and cancelled subscriptions",
                  icon: "repeat" as const,
                  url: "https://dashboard.stripe.com/subscriptions",
                },
              ].map((link, index) => (
                <Animated.View
                  key={link.title}
                  entering={FadeInDown.delay(1000 + index * 80).duration(400)}
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
          </>
        ) : null}
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.gold,
  },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(212, 164, 32, 0.1)",
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
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.whiteMuted,
  },
  errorText: {
    fontSize: 14,
    color: "#F87171",
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(212, 164, 32, 0.15)",
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  retryText: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: "600" as const,
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
  revenueHero: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.3)",
    alignItems: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(212, 164, 32, 0.1)",
      },
      default: {},
    }),
  },
  revenueLabel: {
    fontSize: 11,
    color: Colors.whiteMuted,
    fontWeight: "700" as const,
    letterSpacing: 2,
    marginBottom: 8,
  },
  revenueAmount: {
    fontSize: 44,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.gold,
    marginBottom: 16,
  },
  revenueBreakdown: {
    flexDirection: "row",
    gap: 20,
  },
  revenueBreakdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  revenueBreakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  revenueBreakdownText: {
    fontSize: 12,
    color: Colors.whiteDim,
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
  txList: {
    gap: 8,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  txContent: {
    flex: 1,
  },
  txDescription: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  txMeta: {
    fontSize: 11,
    color: Colors.whiteMuted,
  },
  txAmount: {
    alignItems: "flex-end",
  },
  txTokens: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  txTokenLabel: {
    fontSize: 9,
    color: Colors.whiteMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  revenueLinks: {
    gap: 10,
    marginBottom: 20,
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
  apiUsageSection: {
    marginTop: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profitRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    marginTop: 8,
  },
  profitItem: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  profitLabel: {
    fontSize: 11,
    color: Colors.whiteDim,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  profitValue: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_900Black",
  },
  apiRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  apiEndpoint: {
    flex: 1,
    fontSize: 12,
    color: Colors.white,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  apiCalls: {
    fontSize: 12,
    color: Colors.whiteMuted,
    marginRight: 12,
  },
  apiCost: {
    fontSize: 12,
    color: Colors.gold,
    fontFamily: "PlayfairDisplay_700Bold",
    minWidth: 60,
    textAlign: "right" as const,
  },
});
