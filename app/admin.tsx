import React, { useState, useEffect, createContext, useContext } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
  Linking,
  ActivityIndicator,
  TextInput,
  Alert,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const AdminKeyContext = createContext<string>("");

function adminHeaders(adminKey: string, extra?: Record<string, string>): Record<string, string> {
  return { "x-admin-key": adminKey, ...extra };
}

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

interface ShareStats {
  totalShares: number;
  byFeature: { feature: string; count: number }[];
  daily: { day: string; count: number }[];
  recent: { feature: string; preview: string; platform: string; createdAt: string }[];
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

const FEATURE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  chat_message: { label: "Chat Messages", icon: "chatbubble", color: Colors.gold },
  report_card: { label: "Report Cards", icon: "school", color: "#4ADE80" },
  weather_commentary: { label: "Weather Takes", icon: "cloudy", color: "#6CB4EE" },
  stock_pick: { label: "Stock Picks", icon: "trending-up", color: "#F59E0B" },
};

const SPLIT_PRESETS = [
  { label: "100% Budget", budgetPct: 100, icon: "leaf" as const, color: "#4ADE80" },
  { label: "70/30", budgetPct: 70, icon: "scale-balance" as const, color: "#60A5FA" },
  { label: "50/50", budgetPct: 50, icon: "equal" as const, color: "#FBBF24" },
  { label: "30/70", budgetPct: 30, icon: "diamond-stone" as const, color: "#C084FC" },
  { label: "100% Premium", budgetPct: 0, icon: "star" as const, color: "#FFD700" },
];

function ModelQuickToggle({ modelData, onSwitch }: { modelData: any; onSwitch: () => void }) {
  const [switching, setSwitching] = useState(false);

  async function quickSwitch(mode: string, splitPct?: number) {
    setSwitching(true);
    try {
      const body: any = mode === "split" ? { mode: "split", splitPercent: splitPct } : { mode };
      const res = await fetch(new URL("/api/model-settings", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSwitch();
      }
    } catch (e) {
      console.error("Quick switch error:", e);
    } finally {
      setSwitching(false);
    }
  }

  const currentMode = modelData?.activeMode || "premium";
  const splitPct = modelData?.splitPercentBudget || 70;
  const costEst = modelData?.estimatedCostPer1k || "$8.00";

  let modeLabel = "GPT-5.2";
  let modeColor = "#FFD700";
  if (currentMode === "budget") {
    modeLabel = "DeepSeek";
    modeColor = "#4ADE80";
  } else if (currentMode === "split") {
    modeLabel = `Split ${splitPct}/${100 - splitPct}`;
    modeColor = "#60A5FA";
  }

  return (
    <View style={toggleStyles.container}>
      <View style={toggleStyles.statusRow}>
        <View style={toggleStyles.statusLeft}>
          <View style={[toggleStyles.statusDot, { backgroundColor: modeColor }]} />
          <Text style={[toggleStyles.statusLabel, { color: modeColor }]}>{modeLabel}</Text>
        </View>
        <View style={toggleStyles.costBadge}>
          <Text style={toggleStyles.costText}>{costEst}/1K</Text>
        </View>
      </View>
      <View style={toggleStyles.buttonRow}>
        <Pressable
          onPress={() => quickSwitch("premium")}
          disabled={switching}
          style={[toggleStyles.modeBtn, currentMode === "premium" && { borderColor: "#FFD700", backgroundColor: "rgba(255,215,0,0.12)" }]}
        >
          <MaterialCommunityIcons name="star" size={14} color={currentMode === "premium" ? "#FFD700" : "#666"} />
          <Text style={[toggleStyles.modeBtnText, currentMode === "premium" && { color: "#FFD700" }]}>PREMIUM</Text>
        </Pressable>
        <Pressable
          onPress={() => quickSwitch("split", splitPct)}
          disabled={switching || !modelData?.models?.budget?.available}
          style={[toggleStyles.modeBtn, currentMode === "split" && { borderColor: "#60A5FA", backgroundColor: "rgba(96,165,250,0.12)" }]}
        >
          <MaterialCommunityIcons name="scale-balance" size={14} color={currentMode === "split" ? "#60A5FA" : "#666"} />
          <Text style={[toggleStyles.modeBtnText, currentMode === "split" && { color: "#60A5FA" }]}>SPLIT</Text>
        </Pressable>
        <Pressable
          onPress={() => quickSwitch("budget")}
          disabled={switching || !modelData?.models?.budget?.available}
          style={[toggleStyles.modeBtn, currentMode === "budget" && { borderColor: "#4ADE80", backgroundColor: "rgba(74,222,128,0.12)" }]}
        >
          <MaterialCommunityIcons name="leaf" size={14} color={currentMode === "budget" ? "#4ADE80" : "#666"} />
          <Text style={[toggleStyles.modeBtnText, currentMode === "budget" && { color: "#4ADE80" }]}>BUDGET</Text>
        </Pressable>
      </View>
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.15)",
    padding: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
  costBadge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  costText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.5)",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  modeBtnText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "#666",
    letterSpacing: 0.5,
  },
});

// ── Token Economics Section ────────────────────────────────────────────────────

interface HostingTier {
  id: string; label: string; vm: string; vmCost: number; total: number; mauRange: string; recommended: boolean;
}
interface Projection {
  mau: number; tokensConsumed: number; payingUsers: number;
  revenue: number; apiCost: number; hosting: number; hostingTier: string;
  egressCost: number; totalCost: number; profit: number; marginPct: number; breakEvenUsers: number;
}
interface TokenEconomicsData {
  activeMode: string;
  activeTier: string;
  liveStripeConnected: boolean;
  costModel: {
    fishAudio: { ratePerKChars: number; avgCharsPerCall: number; costPerCall: number };
    llm: {
      premium: { model: string; inputPer1k: number; outputPer1k: number; avgIn: number; avgOut: number; costPerDCToken: number };
      budget:  { model: string; inputPer1k: number; outputPer1k: number; avgIn: number; avgOut: number; costPerDCToken: number };
    };
    totalPerDCToken: { premium: number; budget: number };
  };
  actuals: {
    mau: number; totalUsers: number; activeSubs: number; vipSubs: number; standardSubs: number;
    tokensConsumed30d: number; usageEvents30d: number; newSubs30d: number; newPacks30d: number;
    avgTokensPerMAU: number; conversionRate: number;
    revenue30d: number; apiCost30d: number; hosting30d: number; egressCost30d: number;
    totalCost30d: number; profit30d: number;
  };
  hosting: {
    corePlanMonthly: number; egressRatePerGB: number; egressFreeGB: number; tiers: HostingTier[];
  };
  projections: Projection[];
  packs: {
    id: string; name: string; tokens: number; price: number; priceDisplay: string;
    liveStripePriceCents: number | null; liveStripePriceDisplay: string | null;
    revenuePerToken: number; costPerTokenPremium: number; costPerTokenBudget: number;
    profitPerTokenPremium: number; profitPerTokenBudget: number;
    marginPctPremium: number; marginPctBudget: number;
  }[];
  subscriptions: {
    name: string; tokensPerMonth: number; priceMonthly: number; priceDisplay: string;
    revenuePerToken: number; marginPctPremium: number; marginPctBudget: number;
  }[];
}

function TokenEconomicsSection({ adminKey }: { adminKey: string }) {
  const [data, setData] = useState<TokenEconomicsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchEconomics() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        new URL("/api/admin/token-economics", getApiUrl()).toString(),
        { headers: adminHeaders(adminKey) }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchEconomics(); }, []);

  const fmt2  = (n: number) => `$${n.toFixed(2)}`;
  const fmt4  = (n: number) => `$${n.toFixed(4)}`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const fmtK  = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  const tierLabel = data?.activeTier === "budget" ? "DeepSeek" : data?.activeTier === "split" ? "Split" : "GPT-5.2";
  const tierColor = data?.activeTier === "budget" ? "#4ADE80" : data?.activeTier === "split" ? "#60A5FA" : "#FFD700";

  const profitColor = (v: number) => v >= 0 ? "#4ADE80" : "#EF4444";
  const marginColor = (v: number) => v > 70 ? "#4ADE80" : v > 40 ? "#F59E0B" : "#EF4444";

  return (
    <Animated.View entering={FadeInDown.delay(175).duration(400)} style={ecoStyles.container}>
      {/* ── Header ── */}
      <View style={ecoStyles.header}>
        <View style={ecoStyles.headerLeft}>
          <MaterialCommunityIcons name="lightning-bolt" size={18} color={Colors.gold} />
          <Text style={ecoStyles.title}>Full Cost Breakdown</Text>
        </View>
        <View style={ecoStyles.headerRight}>
          {data && (
            <View style={[ecoStyles.badge, { backgroundColor: tierColor + "22", borderColor: tierColor + "55" }]}>
              <Text style={[ecoStyles.badgeText, { color: tierColor }]}>{tierLabel}</Text>
            </View>
          )}
          <Pressable onPress={fetchEconomics} disabled={loading} style={ecoStyles.refreshBtn}>
            {loading ? <ActivityIndicator size="small" color={Colors.gold} /> : <Feather name="refresh-cw" size={14} color={Colors.gold} />}
          </Pressable>
        </View>
      </View>

      {error && <Text style={ecoStyles.error}>{error}</Text>}

      {data && (
        <>
          {/* ── Status row ── */}
          <View style={ecoStyles.statusRow}>
            <View style={ecoStyles.statusItem}>
              <View style={[ecoStyles.dot, { backgroundColor: data.liveStripeConnected ? "#4ADE80" : "#F59E0B" }]} />
              <Text style={ecoStyles.statusText}>{data.liveStripeConnected ? "Live Stripe" : "Static prices"}</Text>
            </View>
            <View style={ecoStyles.statusItem}>
              <View style={[ecoStyles.dot, { backgroundColor: "#60A5FA" }]} />
              <Text style={ecoStyles.statusText}>{data.actuals.mau} MAU · {data.actuals.totalUsers} total users</Text>
            </View>
            <View style={ecoStyles.statusItem}>
              <View style={[ecoStyles.dot, { backgroundColor: "#A78BFA" }]} />
              <Text style={ecoStyles.statusText}>{data.actuals.conversionRate}% paid</Text>
            </View>
          </View>

          {/* ── 30-Day Actuals P&L ── */}
          <Text style={ecoStyles.subhead}>30-Day Actuals</Text>
          <View style={ecoStyles.plBox}>
            <View style={ecoStyles.plRow}>
              <Text style={ecoStyles.plLabel}>Revenue (subs + packs)</Text>
              <Text style={[ecoStyles.plVal, { color: Colors.gold }]}>{fmt2(data.actuals.revenue30d)}</Text>
            </View>
            <View style={[ecoStyles.plRow, ecoStyles.plRowBorder]}>
              <Text style={ecoStyles.plLabel}>  API costs (LLM + TTS)</Text>
              <Text style={[ecoStyles.plVal, { color: "#EF4444" }]}>–{fmt4(data.actuals.apiCost30d)}</Text>
            </View>
            <View style={[ecoStyles.plRow, ecoStyles.plRowBorder]}>
              <Text style={ecoStyles.plLabel}>  Replit hosting (Dev tier)</Text>
              <Text style={[ecoStyles.plVal, { color: "#EF4444" }]}>–${data.actuals.hosting30d.toFixed(2)}</Text>
            </View>
            <View style={[ecoStyles.plRow, ecoStyles.plRowBorder]}>
              <Text style={ecoStyles.plLabel}>  Egress ({data.actuals.mau > 0 ? ((data.actuals.mau * 10) / 1024).toFixed(1) : "0"} GB)</Text>
              <Text style={[ecoStyles.plVal, { color: "#EF4444" }]}>–{fmt4(data.actuals.egressCost30d)}</Text>
            </View>
            <View style={[ecoStyles.plRow, ecoStyles.plRowBorder, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
              <Text style={[ecoStyles.plLabel, { fontWeight: "700" as const, color: "#ddd" }]}>Net Profit / Loss</Text>
              <Text style={[ecoStyles.plVal, { color: profitColor(data.actuals.profit30d), fontWeight: "800" as const }]}>
                {data.actuals.profit30d >= 0 ? "+" : ""}{fmt2(data.actuals.profit30d)}
              </Text>
            </View>
            <View style={ecoStyles.plMeta}>
              <Text style={ecoStyles.plMetaText}>{data.actuals.tokensConsumed30d} tokens consumed · {data.actuals.usageEvents30d} usage events · {data.actuals.avgTokensPerMAU} avg/user</Text>
            </View>
          </View>

          {/* ── API Cost Per DC Token ── */}
          <Text style={ecoStyles.subhead}>API Cost Per DC Token</Text>
          <View style={ecoStyles.costBox}>
            <View style={ecoStyles.costRow}>
              <View style={ecoStyles.costLabelRow}>
                <MaterialCommunityIcons name="microphone" size={13} color="#60A5FA" />
                <Text style={ecoStyles.costLabel}>Fish Audio TTS</Text>
              </View>
              <Text style={ecoStyles.costVal}>{fmt4(data.costModel.fishAudio.costPerCall)}</Text>
              <Text style={ecoStyles.costNote}>{data.costModel.fishAudio.avgCharsPerCall} chars @ ${data.costModel.fishAudio.ratePerKChars}/K</Text>
            </View>
            <View style={[ecoStyles.costRow, ecoStyles.costRowBorder]}>
              <View style={ecoStyles.costLabelRow}>
                <MaterialCommunityIcons name="star" size={13} color="#FFD700" />
                <Text style={ecoStyles.costLabel}>LLM Premium (GPT-5.2)</Text>
              </View>
              <Text style={ecoStyles.costVal}>{fmt4(data.costModel.llm.premium.costPerDCToken)}</Text>
              <Text style={ecoStyles.costNote}>${data.costModel.llm.premium.inputPer1k}/K in · ${data.costModel.llm.premium.outputPer1k}/K out</Text>
            </View>
            <View style={[ecoStyles.costRow, ecoStyles.costRowBorder]}>
              <View style={ecoStyles.costLabelRow}>
                <MaterialCommunityIcons name="leaf" size={13} color="#4ADE80" />
                <Text style={ecoStyles.costLabel}>LLM Budget (DeepSeek V3)</Text>
              </View>
              <Text style={ecoStyles.costVal}>{fmt4(data.costModel.llm.budget.costPerDCToken)}</Text>
              <Text style={ecoStyles.costNote}>${data.costModel.llm.budget.inputPer1k}/K in · ${data.costModel.llm.budget.outputPer1k}/K out</Text>
            </View>
            <View style={[ecoStyles.costRow, ecoStyles.costRowBorder, { backgroundColor: "rgba(255,255,255,0.02)" }]}>
              <View style={ecoStyles.costLabelRow}>
                <MaterialCommunityIcons name="sigma" size={13} color="#FFD700" />
                <Text style={[ecoStyles.costLabel, { color: "#ddd" }]}>Total (Premium mode)</Text>
              </View>
              <Text style={[ecoStyles.costVal, { color: "#F59E0B" }]}>{fmt4(data.costModel.totalPerDCToken.premium)}</Text>
              <Text style={ecoStyles.costNote}> </Text>
            </View>
            <View style={[ecoStyles.costRow, ecoStyles.costRowBorder, { backgroundColor: "rgba(255,255,255,0.02)" }]}>
              <View style={ecoStyles.costLabelRow}>
                <MaterialCommunityIcons name="sigma" size={13} color="#4ADE80" />
                <Text style={[ecoStyles.costLabel, { color: "#ddd" }]}>Total (Budget mode)</Text>
              </View>
              <Text style={[ecoStyles.costVal, { color: "#4ADE80" }]}>{fmt4(data.costModel.totalPerDCToken.budget)}</Text>
              <Text style={ecoStyles.costNote}> </Text>
            </View>
          </View>

          {/* ── Replit Hosting Tiers ── */}
          <Text style={ecoStyles.subhead}>Replit Hosting Tiers</Text>
          <View style={ecoStyles.tierNote}>
            <MaterialCommunityIcons name="information-outline" size={12} color="#666" />
            <Text style={ecoStyles.tierNoteText}>Core plan ${data.hosting.corePlanMonthly}/mo included in all tiers · Egress free up to {data.hosting.egressFreeGB} GB then ${data.hosting.egressRatePerGB}/GB</Text>
          </View>
          <View style={ecoStyles.tiersGrid}>
            {data.hosting.tiers.map(tier => (
              <View key={tier.id} style={[ecoStyles.tierCard, tier.recommended && ecoStyles.tierCardActive]}>
                <View style={ecoStyles.tierCardTop}>
                  <Text style={[ecoStyles.tierLabel, tier.recommended && { color: Colors.gold }]}>{tier.label}</Text>
                  {tier.recommended && (
                    <View style={ecoStyles.currentBadge}><Text style={ecoStyles.currentBadgeText}>NOW</Text></View>
                  )}
                </View>
                <Text style={ecoStyles.tierPrice}>${tier.total}<Text style={ecoStyles.tierPriceMo}>/mo</Text></Text>
                <Text style={ecoStyles.tierVm}>{tier.vm}</Text>
                <Text style={ecoStyles.tierRange}>{tier.mauRange} MAU</Text>
              </View>
            ))}
          </View>

          {/* ── Scale Projections ── */}
          <Text style={ecoStyles.subhead}>Projected P&L at Scale</Text>
          <View style={ecoStyles.projNote}>
            <Text style={ecoStyles.projNoteText}>Based on {data.actuals.avgTokensPerMAU} tokens/user/mo · {data.actuals.conversionRate}% paid conversion · ${(3.74).toFixed(2)} avg rev/paying user</Text>
          </View>

          {/* Header row */}
          <View style={ecoStyles.projTable}>
            <View style={ecoStyles.projHeader}>
              <Text style={[ecoStyles.projCell, ecoStyles.projCellMAU, ecoStyles.projHeaderText]}>MAU</Text>
              <Text style={[ecoStyles.projCell, ecoStyles.projCellNum, ecoStyles.projHeaderText]}>Rev</Text>
              <Text style={[ecoStyles.projCell, ecoStyles.projCellNum, ecoStyles.projHeaderText]}>API</Text>
              <Text style={[ecoStyles.projCell, ecoStyles.projCellNum, ecoStyles.projHeaderText]}>Host</Text>
              <Text style={[ecoStyles.projCell, ecoStyles.projCellNum, ecoStyles.projHeaderText]}>Profit</Text>
              <Text style={[ecoStyles.projCell, ecoStyles.projCellPct, ecoStyles.projHeaderText]}>Margin</Text>
            </View>
            {data.projections.map((p, i) => {
              const mc = marginColor(p.marginPct);
              const pc = profitColor(p.profit);
              return (
                <View key={p.mau} style={[ecoStyles.projRow, i % 2 === 0 && ecoStyles.projRowAlt]}>
                  <Text style={[ecoStyles.projCell, ecoStyles.projCellMAU, ecoStyles.projMAUText]}>{fmtK(p.mau)}</Text>
                  <Text style={[ecoStyles.projCell, ecoStyles.projCellNum, { color: Colors.gold }]}>{fmt2(p.revenue)}</Text>
                  <Text style={[ecoStyles.projCell, ecoStyles.projCellNum, { color: "#EF4444" }]}>{fmt2(p.apiCost)}</Text>
                  <Text style={[ecoStyles.projCell, ecoStyles.projCellNum, { color: "#EF4444" }]}>${p.hosting}</Text>
                  <Text style={[ecoStyles.projCell, ecoStyles.projCellNum, { color: pc, fontWeight: "700" as const }]}>
                    {p.profit >= 0 ? "+" : ""}{fmt2(p.profit)}
                  </Text>
                  <Text style={[ecoStyles.projCell, ecoStyles.projCellPct, { color: mc, fontWeight: "800" as const }]}>{fmtPct(p.marginPct)}</Text>
                </View>
              );
            })}
          </View>

          {/* ── Pack margins ── */}
          <Text style={[ecoStyles.subhead, { marginTop: 16 }]}>Token Packs — Margin</Text>
          {data.packs.map((pack, i) => {
            const isBudget = data.activeTier === "budget";
            const margin = isBudget ? pack.marginPctBudget : pack.marginPctPremium;
            const profit = isBudget ? pack.profitPerTokenBudget : pack.profitPerTokenPremium;
            return (
              <View key={pack.id} style={ecoStyles.packCard}>
                <View style={ecoStyles.packTop}>
                  <Text style={ecoStyles.packName}>{pack.tokens} DC Tokens</Text>
                  <View style={ecoStyles.packPriceRow}>
                    {pack.liveStripePriceDisplay && (
                      <View style={ecoStyles.liveBadge}><Text style={ecoStyles.liveBadgeText}>LIVE</Text></View>
                    )}
                    <Text style={ecoStyles.packPrice}>{pack.liveStripePriceDisplay || pack.priceDisplay}</Text>
                  </View>
                </View>
                <View style={ecoStyles.packMetrics}>
                  <View style={ecoStyles.packMetric}>
                    <Text style={ecoStyles.packMetricLabel}>Rev/token</Text>
                    <Text style={[ecoStyles.packMetricVal, { color: Colors.gold }]}>{fmt4(pack.revenuePerToken)}</Text>
                  </View>
                  <View style={ecoStyles.packMetric}>
                    <Text style={ecoStyles.packMetricLabel}>Cost/token</Text>
                    <Text style={[ecoStyles.packMetricVal, { color: "#EF4444" }]}>{fmt4(isBudget ? pack.costPerTokenBudget : pack.costPerTokenPremium)}</Text>
                  </View>
                  <View style={ecoStyles.packMetric}>
                    <Text style={ecoStyles.packMetricLabel}>Profit/token</Text>
                    <Text style={[ecoStyles.packMetricVal, { color: "#4ADE80" }]}>{fmt4(profit)}</Text>
                  </View>
                  <View style={ecoStyles.packMetric}>
                    <Text style={ecoStyles.packMetricLabel}>Margin</Text>
                    <Text style={[ecoStyles.packMetricVal, { color: marginColor(margin), fontWeight: "800" as const }]}>{fmtPct(margin)}</Text>
                  </View>
                </View>
                <View style={ecoStyles.modeRow}>
                  <Text style={[ecoStyles.modeText, { color: "#FFD700" }]}>GPT: {fmtPct(pack.marginPctPremium)}</Text>
                  <Text style={ecoStyles.modeSep}> · </Text>
                  <Text style={[ecoStyles.modeText, { color: "#4ADE80" }]}>DeepSeek: {fmtPct(pack.marginPctBudget)}</Text>
                </View>
              </View>
            );
          })}

          {/* ── Subscription margins ── */}
          <Text style={ecoStyles.subhead}>Subscriptions — Margin</Text>
          {data.subscriptions.map((sub) => {
            const isBudget = data.activeTier === "budget";
            const margin = isBudget ? sub.marginPctBudget : sub.marginPctPremium;
            return (
              <View key={sub.name} style={ecoStyles.packCard}>
                <View style={ecoStyles.packTop}>
                  <Text style={ecoStyles.packName}>{sub.name} — {sub.tokensPerMonth} tokens/mo</Text>
                  <Text style={ecoStyles.packPrice}>{sub.priceDisplay}</Text>
                </View>
                <View style={ecoStyles.packMetrics}>
                  <View style={ecoStyles.packMetric}>
                    <Text style={ecoStyles.packMetricLabel}>Rev/token</Text>
                    <Text style={[ecoStyles.packMetricVal, { color: Colors.gold }]}>{fmt4(sub.revenuePerToken)}</Text>
                  </View>
                  <View style={ecoStyles.packMetric}>
                    <Text style={ecoStyles.packMetricLabel}>Margin</Text>
                    <Text style={[ecoStyles.packMetricVal, { color: marginColor(margin), fontWeight: "800" as const }]}>{fmtPct(margin)}</Text>
                  </View>
                </View>
                <View style={ecoStyles.modeRow}>
                  <Text style={[ecoStyles.modeText, { color: "#FFD700" }]}>GPT: {fmtPct(sub.marginPctPremium)}</Text>
                  <Text style={ecoStyles.modeSep}> · </Text>
                  <Text style={[ecoStyles.modeText, { color: "#4ADE80" }]}>DeepSeek: {fmtPct(sub.marginPctBudget)}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}
    </Animated.View>
  );
}

const ecoStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(212,164,32,0.18)", padding: 14,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontWeight: "700" as const, color: Colors.gold, letterSpacing: 0.3 },
  badge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "800" as const, letterSpacing: 0.5 },
  refreshBtn: { padding: 4 },
  error: { color: "#EF4444", fontSize: 12, marginBottom: 8 },

  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  statusItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 11, color: "#999" },

  subhead: { fontSize: 11, fontWeight: "700" as const, color: "#888", letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 8, marginTop: 4 },

  // 30-day P&L
  plBox: { backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 14, overflow: "hidden" as const },
  plRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, paddingHorizontal: 12 },
  plRowBorder: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  plLabel: { fontSize: 12, color: "#999", flex: 1 },
  plVal: { fontSize: 13, fontWeight: "700" as const },
  plMeta: { paddingVertical: 7, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  plMetaText: { fontSize: 10, color: "#555", textAlign: "center" as const },

  // API cost table
  costBox: { backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 14, overflow: "hidden" as const },
  costRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9, paddingHorizontal: 12, gap: 6 },
  costRowBorder: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  costLabelRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  costLabel: { fontSize: 12, color: "#ccc" },
  costVal: { fontSize: 12, fontWeight: "700" as const, color: "#EF4444", width: 68, textAlign: "right" as const },
  costNote: { fontSize: 10, color: "#555", width: 128, textAlign: "right" as const },

  // Hosting tiers
  tierNote: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginBottom: 8 },
  tierNoteText: { fontSize: 10, color: "#666", flex: 1, lineHeight: 15 },
  tiersGrid: { flexDirection: "row", gap: 6, marginBottom: 14, flexWrap: "wrap" as const },
  tierCard: {
    flex: 1, minWidth: "44%" as any,
    backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", padding: 10,
  },
  tierCardActive: { borderColor: "rgba(212,164,32,0.4)", backgroundColor: "rgba(212,164,32,0.06)" },
  tierCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  tierLabel: { fontSize: 12, fontWeight: "700" as const, color: "#bbb" },
  tierPrice: { fontSize: 18, fontWeight: "800" as const, color: "#fff", marginBottom: 2 },
  tierPriceMo: { fontSize: 11, fontWeight: "400" as const, color: "#777" },
  tierVm: { fontSize: 10, color: "#666", marginBottom: 2 },
  tierRange: { fontSize: 10, color: "#4ADE80" },
  currentBadge: { backgroundColor: "rgba(212,164,32,0.2)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  currentBadgeText: { fontSize: 8, fontWeight: "800" as const, color: Colors.gold, letterSpacing: 0.5 },

  // Projections table
  projNote: { marginBottom: 8 },
  projNoteText: { fontSize: 10, color: "#666" },
  projTable: { backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 14, overflow: "hidden" as const },
  projHeader: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, backgroundColor: "rgba(255,255,255,0.04)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  projHeaderText: { fontSize: 9, fontWeight: "800" as const, color: "#777", textTransform: "uppercase" as const, letterSpacing: 0.5 },
  projRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 8 },
  projRowAlt: { backgroundColor: "rgba(255,255,255,0.015)" },
  projCell: { textAlign: "center" as const, fontSize: 11 },
  projCellMAU: { flex: 1.1, textAlign: "left" as const },
  projCellNum: { flex: 1.4 },
  projCellPct: { flex: 1.1, textAlign: "right" as const },
  projMAUText: { color: "#ccc", fontWeight: "600" as const },

  // Pack / sub cards
  packCard: { backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", padding: 12, marginBottom: 8 },
  packTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  packName: { fontSize: 13, fontWeight: "700" as const, color: "#ddd" },
  packPriceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  packPrice: { fontSize: 13, fontWeight: "800" as const, color: Colors.gold },
  liveBadge: { backgroundColor: "#4ADE8022", borderRadius: 4, borderWidth: 1, borderColor: "#4ADE8055", paddingHorizontal: 5, paddingVertical: 2 },
  liveBadgeText: { fontSize: 9, fontWeight: "800" as const, color: "#4ADE80", letterSpacing: 0.5 },
  packMetrics: { flexDirection: "row" },
  packMetric: { flex: 1, alignItems: "center" as const },
  packMetricLabel: { fontSize: 9, color: "#666", marginBottom: 2, textAlign: "center" as const },
  packMetricVal: { fontSize: 12, fontWeight: "700" as const, textAlign: "center" as const },
  modeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8 },
  modeText: { fontSize: 10 },
  modeSep: { fontSize: 10, color: "#555" },
});


function ModelSettingsSection({ onModelChange }: { onModelChange?: () => void }) {
  const [modelData, setModelData] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [switching, setSwitching] = useState(false);
  const [testing, setTesting] = useState(false);
  const [splitValue, setSplitValue] = useState(70);

  useEffect(() => {
    fetchModelSettings();
  }, []);

  async function fetchModelSettings() {
    try {
      const res = await fetch(new URL("/api/model-settings", getApiUrl()).toString());
      if (res.ok) {
        const data = await res.json();
        setModelData(data);
        if (data.splitPercentBudget !== undefined) setSplitValue(data.splitPercentBudget);
      }
    } catch (e) {
      console.error("Model settings error:", e);
    }
  }

  async function switchMode(mode: string, splitPercent?: number) {
    setSwitching(true);
    try {
      const body: any = mode === "split" ? { mode: "split", splitPercent } : { mode };
      const res = await fetch(new URL("/api/model-settings", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await fetchModelSettings();
        onModelChange?.();
      }
    } catch (e) {
      console.error("Switch mode error:", e);
    } finally {
      setSwitching(false);
    }
  }

  async function runModelTest() {
    setTesting(true);
    setTestResults(null);
    try {
      const res = await fetch(new URL("/api/model-test", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Give a one-sentence sports prediction in Trump's voice." }),
      });
      if (res.ok) setTestResults(await res.json());
    } catch (e) {
      console.error("Model test error:", e);
    } finally {
      setTesting(false);
    }
  }

  if (!modelData) return null;

  const premium = modelData.models.premium;
  const budget = modelData.models.budget;
  const currentMode = modelData.activeMode || "premium";

  return (
    <Animated.View entering={FadeInDown.delay(1200).duration(400)}>
      <View style={modelStyles.container}>
        <View style={modelStyles.header}>
          <MaterialCommunityIcons name="brain" size={20} color={Colors.gold} />
          <Text style={modelStyles.title}>AI Model Control</Text>
        </View>

        <View style={modelStyles.tierRow}>
          <Pressable
            onPress={() => switchMode("premium")}
            disabled={switching}
            style={({ pressed }) => [
              modelStyles.tierCard,
              currentMode === "premium" && modelStyles.tierCardActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <MaterialCommunityIcons name="star" size={22} color={currentMode === "premium" ? "#FFD700" : "#666"} />
            <Text style={[modelStyles.tierName, currentMode === "premium" && { color: "#FFD700" }]}>Premium</Text>
            <Text style={modelStyles.tierModel}>{premium.chat}</Text>
            <Text style={modelStyles.tierCost}>~$8.00/1K requests</Text>
            {currentMode === "premium" && <Text style={modelStyles.activeLabel}>ACTIVE</Text>}
          </Pressable>
          <Pressable
            onPress={() => switchMode("budget")}
            disabled={switching || !budget.available}
            style={({ pressed }) => [
              modelStyles.tierCard,
              currentMode === "budget" && modelStyles.tierCardActive,
              !budget.available && { opacity: 0.4 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <MaterialCommunityIcons name="leaf" size={22} color={currentMode === "budget" ? "#4ADE80" : "#666"} />
            <Text style={[modelStyles.tierName, currentMode === "budget" && { color: "#4ADE80" }]}>Budget</Text>
            <Text style={modelStyles.tierModel}>{budget.chat}</Text>
            <Text style={modelStyles.tierCost}>~$0.08/1K requests</Text>
            {currentMode === "budget" && <Text style={[modelStyles.activeLabel, { color: "#4ADE80" }]}>ACTIVE</Text>}
            {!budget.available && <Text style={modelStyles.unavailableLabel}>Add DEEPSEEK_API_KEY</Text>}
          </Pressable>
        </View>

        {budget.available && (
          <View style={modelStyles.splitSection}>
            <View style={modelStyles.splitHeader}>
              <MaterialCommunityIcons name="scale-balance" size={16} color="#60A5FA" />
              <Text style={modelStyles.splitTitle}>Cost Split Mode</Text>
              {currentMode === "split" && (
                <View style={modelStyles.splitActiveBadge}>
                  <Text style={modelStyles.splitActiveText}>ACTIVE</Text>
                </View>
              )}
            </View>
            <Text style={modelStyles.splitDesc}>Route a % of requests to DeepSeek to reduce costs while keeping premium quality for the rest.</Text>
            <View style={modelStyles.splitPresets}>
              {SPLIT_PRESETS.map((preset) => {
                const isActive = currentMode === "split" && splitValue === preset.budgetPct;
                const isFullMode = (preset.budgetPct === 100 && currentMode === "budget") || (preset.budgetPct === 0 && currentMode === "premium");
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => {
                      if (preset.budgetPct === 0) {
                        switchMode("premium");
                      } else if (preset.budgetPct === 100) {
                        switchMode("budget");
                      } else {
                        setSplitValue(preset.budgetPct);
                        switchMode("split", preset.budgetPct);
                      }
                    }}
                    disabled={switching}
                    style={[
                      modelStyles.splitPresetBtn,
                      (isActive || isFullMode) && { borderColor: preset.color, backgroundColor: `${preset.color}15` },
                    ]}
                  >
                    <MaterialCommunityIcons name={preset.icon} size={14} color={(isActive || isFullMode) ? preset.color : "#555"} />
                    <Text style={[modelStyles.splitPresetLabel, (isActive || isFullMode) && { color: preset.color }]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {currentMode === "split" && (
              <View style={modelStyles.splitBar}>
                <View style={[modelStyles.splitBarBudget, { width: `${splitValue}%` }]}>
                  <Text style={modelStyles.splitBarText}>{splitValue}% DeepSeek</Text>
                </View>
                <View style={[modelStyles.splitBarPremium, { width: `${100 - splitValue}%` }]}>
                  <Text style={modelStyles.splitBarText}>{100 - splitValue}% GPT-5.2</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {modelData.estimatedCostPer1k && (
          <View style={modelStyles.savingsBox}>
            <MaterialCommunityIcons name="cash-fast" size={16} color="#4ADE80" />
            <Text style={modelStyles.savingsText}>Est. cost: {modelData.estimatedCostPer1k} per 1K requests</Text>
          </View>
        )}

        <Pressable
          onPress={runModelTest}
          disabled={testing}
          style={({ pressed }) => [modelStyles.testBtn, pressed && { opacity: 0.8 }]}
        >
          {testing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <MaterialCommunityIcons name="flask" size={18} color="#000" />
              <Text style={modelStyles.testBtnText}>Run Side-by-Side Test</Text>
            </>
          )}
        </Pressable>

        {testResults && (
          <View style={modelStyles.testResultsContainer}>
            <Text style={modelStyles.testResultsTitle}>Test Results</Text>
            {Object.entries(testResults.results).map(([tier, result]: [string, any]) => (
              <View key={tier} style={modelStyles.testResultCard}>
                <View style={modelStyles.testResultHeader}>
                  <Text style={[modelStyles.testResultTier, { color: tier === "premium" ? "#FFD700" : "#4ADE80" }]}>
                    {tier.toUpperCase()} ({result.model})
                  </Text>
                  <Text style={modelStyles.testLatency}>{result.latencyMs}ms</Text>
                </View>
                {result.error ? (
                  <Text style={modelStyles.testError}>{result.error}</Text>
                ) : (
                  <Text style={modelStyles.testResponse}>{result.response}</Text>
                )}
              </View>
            ))}
            <View style={modelStyles.costBox}>
              <Text style={modelStyles.costTitle}>Cost per 1K Requests</Text>
              <Text style={modelStyles.costLine}>Premium: {testResults.costComparison.premiumPer1kRequests}</Text>
              <Text style={modelStyles.costLine}>Budget: {testResults.costComparison.budgetPer1kRequests}</Text>
              <Text style={[modelStyles.costLine, { color: "#4ADE80", fontWeight: "700" as const }]}>
                Savings: {testResults.costComparison.savingsPercent}
              </Text>
            </View>
            <Text style={modelStyles.recommendation}>{testResults.recommendation}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const modelStyles = StyleSheet.create({
  container: {
    marginTop: 24,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.15)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.gold,
  },
  tierRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  tierCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 6,
  },
  tierCardActive: {
    borderColor: "rgba(212,164,32,0.4)",
    backgroundColor: "rgba(212,164,32,0.06)",
  },
  tierName: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#fff",
  },
  tierModel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  tierCost: {
    fontSize: 9,
    color: "rgba(255,255,255,0.35)",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  activeLabel: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "#FFD700",
    backgroundColor: "rgba(255,215,0,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 2,
  },
  unavailableLabel: {
    fontSize: 9,
    color: "#F87171",
    marginTop: 2,
  },
  savingsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(74,222,128,0.08)",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  savingsText: {
    fontSize: 11,
    color: "#4ADE80",
    flex: 1,
  },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    paddingVertical: 12,
    borderRadius: 10,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#000",
  },
  testResultsContainer: {
    marginTop: 14,
    gap: 10,
  },
  testResultsTitle: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#fff",
  },
  testResultCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  testResultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  testResultTier: {
    fontSize: 11,
    fontWeight: "800" as const,
  },
  testLatency: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  testResponse: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
  },
  testError: {
    fontSize: 12,
    color: "#F87171",
  },
  costBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  costTitle: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#fff",
    marginBottom: 4,
  },
  costLine: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
  recommendation: {
    fontSize: 11,
    color: "rgba(255,215,0,0.6)",
    fontStyle: "italic",
    lineHeight: 16,
  },
  splitSection: {
    backgroundColor: "rgba(96,165,250,0.04)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.12)",
    marginBottom: 12,
  },
  splitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  splitTitle: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#60A5FA",
  },
  splitActiveBadge: {
    backgroundColor: "rgba(96,165,250,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: "auto",
  },
  splitActiveText: {
    fontSize: 8,
    fontWeight: "800" as const,
    color: "#60A5FA",
    letterSpacing: 0.5,
  },
  splitDesc: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    lineHeight: 14,
    marginBottom: 10,
  },
  splitPresets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  splitPresetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  splitPresetLabel: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: "#555",
  },
  splitBar: {
    flexDirection: "row",
    borderRadius: 6,
    overflow: "hidden",
    height: 22,
  },
  splitBarBudget: {
    backgroundColor: "rgba(74,222,128,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  splitBarPremium: {
    backgroundColor: "rgba(255,215,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  splitBarText: {
    fontSize: 8,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.6)",
  },
});

const ADMIN_KEY_STORAGE = "trumpbot-admin-key";
const DEVICE_ID_KEY = "chatdjt_device_id";

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [keyChecking, setKeyChecking] = useState(true);
  const [keyError, setKeyError] = useState("");
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  useEffect(() => {
    AsyncStorage.getItem(ADMIN_KEY_STORAGE).then((saved) => {
      if (saved) setAdminKey(saved);
      setKeyChecking(false);
    }).catch(() => setKeyChecking(false));
    AsyncStorage.getItem(DEVICE_ID_KEY).then((id) => {
      if (id) setMyDeviceId(id);
    }).catch(() => {});
  }, []);

  async function tryLogin() {
    if (!keyInput.trim()) return;
    setKeyChecking(true);
    setKeyError("");
    try {
      const checkRes = await fetch(new URL("/api/admin/auth-check", getApiUrl()).toString(), {
        headers: { "x-admin-key": keyInput.trim() },
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (!checkData.secretConfigured) {
          setKeyError("Admin passcode not configured on server");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setKeyChecking(false);
          return;
        }
        if (checkData.valid) {
          await AsyncStorage.setItem(ADMIN_KEY_STORAGE, keyInput.trim());
          setAdminKey(keyInput.trim());
        } else {
          setKeyError("Invalid passcode");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else {
        setKeyError("Server error");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setKeyError("Connection error");
    }
    setKeyChecking(false);
  }

  function logout() {
    AsyncStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey(null);
    setKeyInput("");
  }

  if (keyChecking && !adminKey) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  if (!adminKey) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <LinearGradient colors={["rgba(212, 164, 32, 0.12)", Colors.background]} style={styles.bgGradient} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
          <MaterialCommunityIcons name="shield-lock" size={48} color={Colors.gold} />
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" as const, marginTop: 16, marginBottom: 8 }}>Admin Access</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", marginBottom: 24 }}>Enter your admin passcode to continue</Text>
          <TextInput
            value={keyInput}
            onChangeText={setKeyInput}
            placeholder="Admin passcode"
            placeholderTextColor="#555"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={tryLogin}
            style={{ width: "100%", backgroundColor: "#1a1a2e", color: "#fff", fontSize: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: keyError ? "#FF4D4D" : "rgba(212,164,32,0.3)", textAlign: "center", marginBottom: 12 }}
          />
          {keyError ? <Text style={{ color: "#FF4D4D", fontSize: 13, marginBottom: 12 }}>{keyError}</Text> : null}
          <Pressable onPress={tryLogin} disabled={keyChecking} style={({ pressed }) => ({ backgroundColor: Colors.gold, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, opacity: pressed ? 0.7 : 1, width: "100%" })}>
            {keyChecking ? <ActivityIndicator color="#0a0a0a" /> : <Text style={{ color: "#0a0a0a", fontSize: 16, fontWeight: "800" as const, textAlign: "center" }}>UNLOCK</Text>}
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Go Back</Text>
          </Pressable>
          {myDeviceId && (
            <Pressable
              onPress={() => {
                if (Platform.OS === "web") {
                  try { navigator.clipboard.writeText(myDeviceId); } catch {}
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Device ID Copied", myDeviceId);
              }}
              style={{ marginTop: 32, padding: 12, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", width: "100%" }}
            >
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "700" as const, textAlign: "center", letterSpacing: 1, marginBottom: 4 }}>YOUR DEVICE ID (tap to copy)</Text>
              <Text style={{ color: Colors.gold, fontSize: 11, fontWeight: "600" as const, textAlign: "center" }} selectable>{myDeviceId}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <AdminKeyContext.Provider value={adminKey}>
      <AdminDashboard adminKey={adminKey} onLogout={logout} />
    </AdminKeyContext.Provider>
  );
}

function AdminDashboard({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [shareStats, setShareStats] = useState<ShareStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickModelData, setQuickModelData] = useState<any>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  async function fetchQuickModelData() {
    try {
      const res = await fetch(new URL("/api/model-settings", getApiUrl()).toString());
      if (res.ok) setQuickModelData(await res.json());
    } catch (e) {}
  }

  useEffect(() => {
    fetchStats();
    fetchQuickModelData();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      setError(null);
      const hdrs = adminHeaders(adminKey);
      const [statsRes, sharesRes] = await Promise.all([
        fetch(new URL("/api/admin/stats", getApiUrl()).toString(), { headers: hdrs }),
        fetch(new URL("/api/admin/shares", getApiUrl()).toString(), { headers: hdrs }),
      ]);
      if (!statsRes.ok) throw new Error("Failed to fetch stats");
      const data = await statsRes.json();
      setStats(data);
      if (sharesRes.ok) {
        setShareStats(await sharesRes.json());
      }
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
              onLogout();
            }}
            style={[styles.refreshButton, { marginRight: 4 }]}
          >
            <Ionicons name="log-out-outline" size={18} color="#FF4D4D" />
          </Pressable>
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

      {quickModelData && (
        <ModelQuickToggle modelData={quickModelData} onSwitch={fetchQuickModelData} />
      )}

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

            <TokenEconomicsSection adminKey={adminKey} />

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
                title="D.C. Tokens Granted"
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

            {shareStats && (
              <>
                <Animated.View entering={FadeInDown.delay(850).duration(400)}>
                  <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Viral Shares</Text>
                  <Text style={styles.sectionSubtitle}>Users spreading the word, tremendous!</Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(900).duration(400)} style={styles.shareHero}>
                  <Ionicons name="share-social" size={28} color={Colors.gold} />
                  <Text style={styles.shareHeroCount}>{shareStats.totalShares}</Text>
                  <Text style={styles.shareHeroLabel}>Total Shares</Text>
                </Animated.View>

                {shareStats.byFeature.length > 0 && (
                  <Animated.View entering={FadeInDown.delay(950).duration(400)} style={styles.shareByFeature}>
                    {shareStats.byFeature.map((item) => {
                      const config = FEATURE_LABELS[item.feature] || { label: item.feature, icon: "share", color: Colors.whiteDim };
                      return (
                        <View key={item.feature} style={styles.shareFeatureRow}>
                          <View style={[styles.shareFeatureIcon, { backgroundColor: config.color + "18" }]}>
                            <Ionicons name={config.icon as any} size={16} color={config.color} />
                          </View>
                          <Text style={styles.shareFeatureLabel}>{config.label}</Text>
                          <Text style={[styles.shareFeatureCount, { color: config.color }]}>{item.count}</Text>
                        </View>
                      );
                    })}
                  </Animated.View>
                )}

                {shareStats.daily.length > 0 && (
                  <Animated.View entering={FadeInDown.delay(1000).duration(400)} style={styles.shareDailyChart}>
                    <Text style={styles.shareDailyTitle}>Last 7 Days</Text>
                    <View style={styles.shareDailyBars}>
                      {shareStats.daily.map((d) => {
                        const maxCount = Math.max(...shareStats.daily.map(x => x.count), 1);
                        const height = Math.max((d.count / maxCount) * 60, 4);
                        const dayLabel = new Date(d.day).toLocaleDateString(undefined, { weekday: "short" });
                        return (
                          <View key={d.day} style={styles.shareDayColumn}>
                            <Text style={styles.shareDayCount}>{d.count}</Text>
                            <View style={[styles.shareDayBar, { height, backgroundColor: Colors.gold }]} />
                            <Text style={styles.shareDayLabel}>{dayLabel}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </Animated.View>
                )}
              </>
            )}

            <Animated.View entering={FadeInDown.delay(1050).duration(400)}>
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

            <ModelSettingsSection onModelChange={fetchQuickModelData} />

            <GrantCreditsSection />

            <PushNotificationSection />

            <ArenaResetSection />

            <LiveActivityStatsSection />

            <TimeTrackingSection />

            <AnalyticsDashboard />
            <SuggestionsViewer />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function LiveActivityStatsSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(new URL("/api/live-activity/stats", getApiUrl()).toString());
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  return (
    <Animated.View entering={FadeInDown.delay(150).duration(400)} style={timeStyles.container}>
      <Pressable onPress={() => setExpanded(!expanded)} style={timeStyles.header}>
        <View style={timeStyles.headerLeft}>
          <Ionicons name="pulse-outline" size={22} color="#4ADE80" />
          <Text style={timeStyles.headerTitle}>Live Activity</Text>
        </View>
        <View style={timeStyles.headerRight}>
          {data?.last5min && (
            <Text style={[timeStyles.headerBadge, { backgroundColor: "rgba(74,222,128,0.15)", color: "#4ADE80" }]}>
              {data.last5min.real} real / {data.last5min.simulated} sim
            </Text>
          )}
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={Colors.whiteMuted} />
        </View>
      </Pressable>
      {expanded && (
        <View style={timeStyles.content}>
          {loading && <ActivityIndicator color="#4ADE80" />}
          {data?.last5min && (
            <View style={timeStyles.summaryRow}>
              <View style={timeStyles.summaryCard}>
                <Text style={timeStyles.summaryValue}>{data.last5min.total}</Text>
                <Text style={timeStyles.summaryLabel}>Total (5min)</Text>
              </View>
              <View style={timeStyles.summaryCard}>
                <Text style={[timeStyles.summaryValue, { color: "#4ADE80" }]}>{data.last5min.real}</Text>
                <Text style={timeStyles.summaryLabel}>Real Events</Text>
              </View>
              <View style={timeStyles.summaryCard}>
                <Text style={[timeStyles.summaryValue, { color: "#aaa" }]}>{data.last5min.simulated}</Text>
                <Text style={timeStyles.summaryLabel}>Simulated</Text>
              </View>
              <View style={timeStyles.summaryCard}>
                <Text style={timeStyles.summaryValue}>{data.bufferSize}</Text>
                <Text style={timeStyles.summaryLabel}>Buffer Size</Text>
              </View>
            </View>
          )}
          {data?.last5min?.realByType && Object.keys(data.last5min.realByType).length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={[timeStyles.listTitle, { marginBottom: 8 }]}>Real Events by Type</Text>
              {Object.entries(data.last5min.realByType).sort(([,a]: any, [,b]: any) => b - a).map(([type, count]: any) => (
                <View key={type} style={timeStyles.userRow}>
                  <Text style={[timeStyles.userId, { flex: 1 }]}>{type}</Text>
                  <Text style={[timeStyles.userTime, { color: "#4ADE80" }]}>{count}</Text>
                </View>
              ))}
            </View>
          )}
          <Pressable onPress={fetchStats} style={timeStyles.refreshBtn}>
            <Ionicons name="refresh" size={16} color="#4ADE80" />
            <Text style={[timeStyles.refreshText, { color: "#4ADE80" }]}>Refresh</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

function TimeTrackingSection() {
  const adminKey = useContext(AdminKeyContext);
  const [timeData, setTimeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchTimeStats = async () => {
    setLoading(true);
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL("/api/admin/time-stats", baseUrl).toString(), { headers: adminHeaders(adminKey) });
      if (res.ok) {
        const data = await res.json();
        setTimeData(data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchTimeStats();
  }, []);

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400)} style={timeStyles.container}>
      <Pressable onPress={() => setExpanded(!expanded)} style={timeStyles.header}>
        <View style={timeStyles.headerLeft}>
          <Ionicons name="time-outline" size={22} color={Colors.gold} />
          <Text style={timeStyles.headerTitle}>Time On App</Text>
        </View>
        <View style={timeStyles.headerRight}>
          {timeData?.summary && (
            <Text style={timeStyles.headerBadge}>
              {timeData.summary.active1h} active now
            </Text>
          )}
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={Colors.whiteMuted} />
        </View>
      </Pressable>
      {expanded && (
        <View style={timeStyles.content}>
          {loading && <ActivityIndicator color={Colors.gold} />}
          {timeData?.summary && (
            <View style={timeStyles.summaryRow}>
              <View style={timeStyles.summaryCard}>
                <Text style={timeStyles.summaryValue}>{formatDuration(timeData.summary.totalTimeAll)}</Text>
                <Text style={timeStyles.summaryLabel}>Total Time</Text>
              </View>
              <View style={timeStyles.summaryCard}>
                <Text style={timeStyles.summaryValue}>{formatDuration(timeData.summary.avgTimeSeconds)}</Text>
                <Text style={timeStyles.summaryLabel}>Avg / User</Text>
              </View>
              <View style={timeStyles.summaryCard}>
                <Text style={timeStyles.summaryValue}>{timeData.summary.active24h}</Text>
                <Text style={timeStyles.summaryLabel}>Active 24h</Text>
              </View>
              <View style={timeStyles.summaryCard}>
                <Text style={timeStyles.summaryValue}>{formatDuration(timeData.summary.maxTimeSeconds)}</Text>
                <Text style={timeStyles.summaryLabel}>Top User</Text>
              </View>
            </View>
          )}
          {timeData?.users?.length > 0 && (
            <View style={timeStyles.userList}>
              <Text style={timeStyles.listTitle}>Top Users by Time</Text>
              {timeData.users.slice(0, 15).map((u: any, i: number) => (
                <View key={i} style={timeStyles.userRow}>
                  <Text style={timeStyles.userRank}>#{i + 1}</Text>
                  <Text style={timeStyles.userId}>{u.deviceId}</Text>
                  <Text style={timeStyles.userTime}>{formatDuration(u.totalSeconds)}</Text>
                  <View style={timeStyles.userBadges}>
                    {u.isSubscriber && <Text style={timeStyles.subBadge}>VIP</Text>}
                    {u.tokens > 0 && <Text style={timeStyles.tokenBadge}>{u.tokens}⚡</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}
          <Pressable onPress={fetchTimeStats} style={timeStyles.refreshBtn}>
            <Ionicons name="refresh" size={16} color={Colors.gold} />
            <Text style={timeStyles.refreshText}>Refresh</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

const timeStyles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.2)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBadge: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "rgba(212,175,55,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    minWidth: 70,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  summaryValue: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: "700",
  },
  summaryLabel: {
    color: Colors.whiteMuted,
    fontSize: 10,
    marginTop: 2,
  },
  userList: {
    marginTop: 4,
  },
  listTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    gap: 8,
  },
  userRank: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: "700",
    width: 24,
  },
  userId: {
    color: Colors.whiteMuted,
    fontSize: 11,
    flex: 1,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  userTime: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    width: 50,
    textAlign: "right",
  },
  userBadges: {
    flexDirection: "row",
    gap: 4,
    width: 60,
    justifyContent: "flex-end",
  },
  subBadge: {
    color: Colors.gold,
    fontSize: 9,
    fontWeight: "700",
    backgroundColor: "rgba(212,175,55,0.2)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tokenBadge: {
    color: "#4fc3f7",
    fontSize: 9,
    fontWeight: "600",
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(212,175,55,0.1)",
  },
  refreshText: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: "600",
  },
});

function GrantCreditsSection() {
  const adminKey = useContext(AdminKeyContext);
  const [deviceId, setDeviceId] = useState("");
  const [myId, setMyId] = useState<string | null>(null);
  const [amount, setAmount] = useState("500");
  const [resetFree, setResetFree] = useState(true);
  const [granting, setGranting] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; granted?: number; balance?: any } | null>(null);
  const [lookupResult, setLookupResult] = useState<any>(null);

  useEffect(() => {
    AsyncStorage.getItem(DEVICE_ID_KEY).then((id) => {
      if (id) { setMyId(id); setDeviceId(id); }
    }).catch(() => {});
  }, []);

  const handleGrant = async () => {
    if (!deviceId.trim()) {
      Alert.alert("Missing Device ID", "Enter a device ID to grant credits to.");
      return;
    }
    setGranting(true);
    setResult(null);
    try {
      const res = await fetch(new URL("/api/admin/grant-credits", getApiUrl()).toString(), {
        method: "POST",
        headers: adminHeaders(adminKey, { "Content-Type": "application/json" }),
        body: JSON.stringify({ deviceId: deviceId.trim(), amount: parseInt(amount) || 500, resetFree }),
      });
      const data = await res.json();
      setResult(data);
      Haptics.notificationAsync(data.success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    } catch {
      setResult({ error: "Network error" });
    }
    setGranting(false);
  };

  const handleLookup = async () => {
    if (!deviceId.trim()) return;
    try {
      const res = await fetch(new URL(`/api/admin/lookup-account?deviceId=${encodeURIComponent(deviceId.trim())}`, getApiUrl()).toString(), {
        headers: adminHeaders(adminKey),
      });
      if (res.ok) setLookupResult(await res.json());
    } catch {}
  };

  return (
    <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginTop: 16, backgroundColor: "rgba(74,222,128,0.08)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(74,222,128,0.2)" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Ionicons name="gift" size={20} color="#4ADE80" />
        <Text style={{ color: "#4ADE80", fontSize: 14, fontWeight: "800" as const }}>Grant Credits</Text>
      </View>
      {myId && (
        <Pressable
          onPress={() => {
            setDeviceId(myId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Your Device ID", myId);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,215,0,0.08)", borderRadius: 8, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,215,0,0.25)" }}
        >
          <Ionicons name="person-circle" size={14} color={Colors.gold} />
          <Text style={{ color: Colors.gold, fontSize: 11, fontWeight: "700" as const }}>YOUR ID: </Text>
          <Text style={{ color: Colors.gold, fontSize: 11, flex: 1 }} numberOfLines={1}>{myId}</Text>
          <Ionicons name="copy-outline" size={13} color={Colors.gold} />
        </Pressable>
      )}
      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 10 }}>
        Your ID is pre-filled below. Change it to grant tokens to another device instead.
      </Text>
      <TextInput
        value={deviceId}
        onChangeText={setDeviceId}
        placeholder="device-123456789-abc"
        placeholderTextColor="#555"
        autoCapitalize="none"
        autoCorrect={false}
        style={{ backgroundColor: "#1a1a2e", color: "#fff", fontSize: 13, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(74,222,128,0.2)", marginBottom: 8 }}
      />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="500"
          placeholderTextColor="#555"
          keyboardType="numeric"
          style={{ flex: 1, backgroundColor: "#1a1a2e", color: "#fff", fontSize: 13, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(74,222,128,0.2)" }}
        />
        <Pressable
          onPress={() => setResetFree(!resetFree)}
          style={{ backgroundColor: resetFree ? "rgba(74,222,128,0.2)" : "#1a1a2e", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(74,222,128,0.2)", justifyContent: "center" }}
        >
          <Text style={{ color: resetFree ? "#4ADE80" : "#555", fontSize: 11, fontWeight: "700" as const }}>+ Reset Free</Text>
        </Pressable>
        <Pressable
          onPress={handleLookup}
          style={{ backgroundColor: "#1a1a2e", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(212,164,32,0.2)", justifyContent: "center" }}
        >
          <Ionicons name="search" size={16} color={Colors.gold} />
        </Pressable>
      </View>
      <Pressable
        onPress={handleGrant}
        disabled={granting}
        style={({ pressed }) => ({
          backgroundColor: granting ? "rgba(74,222,128,0.3)" : "#4ADE80",
          paddingVertical: 10,
          borderRadius: 10,
          alignItems: "center" as const,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {granting ? (
          <ActivityIndicator size="small" color="#0a0a0a" />
        ) : (
          <Text style={{ color: "#0a0a0a", fontWeight: "800" as const, fontSize: 13 }}>Grant {amount || "500"} Tokens</Text>
        )}
      </Pressable>
      {result?.success && (
        <Text style={{ color: "#4ADE80", fontSize: 11, marginTop: 8, textAlign: "center" }}>
          Granted {result.granted} tokens. New balance: {result.balance?.totalAvailable ?? "?"} total
        </Text>
      )}
      {result?.error && (
        <Text style={{ color: "#FF4D4D", fontSize: 11, marginTop: 8, textAlign: "center" }}>{result.error}</Text>
      )}
      {lookupResult && (
        <View style={{ marginTop: 8, backgroundColor: "rgba(212,164,32,0.08)", borderRadius: 8, padding: 10 }}>
          <Text style={{ color: Colors.gold, fontSize: 11, fontWeight: "700" as const }}>Account Lookup</Text>
          <Text style={{ color: "#ccc", fontSize: 11, marginTop: 4 }}>Tokens: {lookupResult.tokens} | Free left: {lookupResult.freeRemaining} | Total: {lookupResult.totalAvailable}</Text>
          <Text style={{ color: "#888", fontSize: 10, marginTop: 2 }}>Subscribed: {lookupResult.isSubscribed ? "Yes" : "No"}{lookupResult.subscriptionTier ? ` (${lookupResult.subscriptionTier})` : ""}</Text>
        </View>
      )}
    </Animated.View>
  );
}

function ArenaResetSection() {
  const adminKey = useContext(AdminKeyContext);
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState("");

  const handleReset = async () => {
    setResetting(true);
    setResult("");
    try {
      const res = await fetch(new URL("/api/admin/reset-arena", getApiUrl()).toString(), {
        method: "POST",
        headers: adminHeaders(adminKey),
      });
      const data = await res.json();
      setResult(data.success ? "Arena access reset for all users" : (data.error || "Failed"));
      Haptics.notificationAsync(data.success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    } catch {
      setResult("Network error");
    }
    setResetting(false);
  };

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginTop: 16, backgroundColor: "rgba(255,77,77,0.08)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,77,77,0.2)" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Ionicons name="refresh-circle" size={20} color="#FF4D4D" />
        <Text style={{ color: "#FF4D4D", fontSize: 14, fontWeight: "800" }}>Arena Access Reset</Text>
      </View>
      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 10 }}>
        Resets free prompt counters and session data for all users.
      </Text>
      <Pressable
        onPress={handleReset}
        disabled={resetting}
        style={({ pressed }) => ({
          backgroundColor: resetting ? "rgba(255,77,77,0.3)" : "#FF4D4D",
          paddingVertical: 10,
          borderRadius: 10,
          alignItems: "center" as const,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {resetting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Reset All Arena Access</Text>
        )}
      </Pressable>
      {result ? (
        <Text style={{ color: result.includes("reset") ? "#4ADE80" : "#FF4D4D", fontSize: 11, marginTop: 8, textAlign: "center" }}>{result}</Text>
      ) : null}
    </Animated.View>
  );
}

function PushNotificationSection() {
  const adminKey = useContext(AdminKeyContext);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetchTokenCount();
  }, []);

  async function fetchTokenCount() {
    try {
      const res = await fetch(new URL("/api/admin/push-token-count", getApiUrl()).toString(), { headers: adminHeaders(adminKey) });
      if (res.ok) {
        const data = await res.json();
        setTokenCount(data.count);
      }
    } catch {}
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Missing Fields", "Please enter both a title and message.");
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const payload: Record<string, string> = { title: title.trim(), body: body.trim() };
      if (adminPassword.trim()) {
        payload.adminPassword = adminPassword.trim();
      }
      const res = await fetch(new URL("/api/admin/send-notification", getApiUrl()).toString(), {
        method: "POST",
        headers: adminHeaders(adminKey, { "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        Haptics.notificationAsync(
          data.failed > 0
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success
        );
        if (data.sent > 0) {
          setTitle("");
          setBody("");
        }
      } else {
        const err = await res.json();
        setResult({ sent: 0, failed: 0, errors: [err.error || "Failed to send"] });
      }
    } catch (e: any) {
      setResult({ sent: 0, failed: 0, errors: [e.message || "Network error"] });
    } finally {
      setSending(false);
    }
  }

  return (
    <Animated.View entering={FadeInDown.delay(1400).duration(400)}>
      <View style={pushStyles.container}>
        <View style={pushStyles.header}>
          <Ionicons name="notifications" size={20} color={Colors.gold} />
          <Text style={pushStyles.title}>Push Notifications</Text>
          {tokenCount !== null && (
            <View style={pushStyles.tokenBadge}>
              <Text style={pushStyles.tokenBadgeText}>{tokenCount} devices</Text>
            </View>
          )}
        </View>

        <TextInput
          style={pushStyles.input}
          placeholder="Notification title..."
          placeholderTextColor="#666"
          value={title}
          onChangeText={setTitle}
          testID="push-title-input"
        />
        <TextInput
          style={[pushStyles.input, pushStyles.bodyInput]}
          placeholder="Notification message..."
          placeholderTextColor="#666"
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          testID="push-body-input"
        />
        <TextInput
          style={pushStyles.input}
          placeholder="Admin password (if required)..."
          placeholderTextColor="#555"
          value={adminPassword}
          onChangeText={setAdminPassword}
          secureTextEntry
          testID="push-admin-password"
        />

        <Pressable
          onPress={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          style={({ pressed }) => [
            pushStyles.sendBtn,
            pressed && { opacity: 0.8 },
            (sending || !title.trim() || !body.trim()) && { opacity: 0.5 },
          ]}
          testID="push-send-btn"
        >
          {sending ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="send" size={16} color="#000" />
              <Text style={pushStyles.sendBtnText}>Send to All Devices</Text>
            </>
          )}
        </Pressable>

        {result && (
          <View style={[pushStyles.resultBox, result.failed > 0 && pushStyles.resultBoxError]}>
            <Text style={pushStyles.resultText}>
              {result.sent > 0 ? `Sent to ${result.sent} device${result.sent !== 1 ? "s" : ""}` : ""}
              {result.sent > 0 && result.failed > 0 ? " · " : ""}
              {result.failed > 0 ? `${result.failed} failed` : ""}
              {result.sent === 0 && result.failed === 0 && result.errors.length > 0 ? result.errors[0] : ""}
            </Text>
            {result.errors.length > 0 && result.sent > 0 && (
              <Text style={pushStyles.errorDetail}>{result.errors[0]}</Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const pushStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.15)",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    flex: 1,
  },
  tokenBadge: {
    backgroundColor: "rgba(212,164,32,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tokenBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gold,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
    fontSize: 14,
    color: "#FFFFFF",
    marginBottom: 10,
  },
  bodyInput: {
    minHeight: 70,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#000",
    letterSpacing: 0.5,
  },
  resultBox: {
    marginTop: 12,
    backgroundColor: "rgba(74,222,128,0.12)",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#4ADE80",
  },
  resultBoxError: {
    backgroundColor: "rgba(248,113,113,0.12)",
    borderLeftColor: "#F87171",
  },
  resultText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  errorDetail: {
    fontSize: 11,
    color: "#F87171",
    marginTop: 4,
  },
});

function AnalyticsDashboard() {
  const adminKey = useContext(AdminKeyContext);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const res = await fetch(new URL(`/api/admin/analytics?days=${days}`, getApiUrl()).toString(), { headers: adminHeaders(adminKey) });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  if (loading) return (
    <View style={analyticsStyles.section}>
      <Text style={analyticsStyles.sectionTitle}>User Analytics</Text>
      <ActivityIndicator color={Colors.gold} style={{ marginTop: 20 }} />
    </View>
  );

  if (!data) return null;

  return (
    <View style={analyticsStyles.section}>
      <View style={analyticsStyles.headerRow}>
        <Text style={analyticsStyles.sectionTitle}>User Analytics</Text>
        <View style={analyticsStyles.periodRow}>
          {[7, 30, 90].map((d) => (
            <Pressable
              key={d}
              onPress={() => setDays(d)}
              style={[analyticsStyles.periodBtn, days === d && analyticsStyles.periodBtnActive]}
            >
              <Text style={[analyticsStyles.periodText, days === d && analyticsStyles.periodTextActive]}>
                {d}d
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={analyticsStyles.statsRow}>
        <View style={analyticsStyles.statBox}>
          <Text style={analyticsStyles.statNum}>{data.uniqueVisitors}</Text>
          <Text style={analyticsStyles.statLabel}>Unique Visitors</Text>
        </View>
        <View style={analyticsStyles.statBox}>
          <Text style={analyticsStyles.statNum}>{data.totalPageViews}</Text>
          <Text style={analyticsStyles.statLabel}>Page Views</Text>
        </View>
        <View style={analyticsStyles.statBox}>
          <Text style={[analyticsStyles.statNum, { color: "#FF5252" }]}>{data.suggestions?.unread || 0}</Text>
          <Text style={analyticsStyles.statLabel}>New Suggestions</Text>
        </View>
      </View>

      {data.topScreens?.length > 0 && (
        <View style={analyticsStyles.card}>
          <Text style={analyticsStyles.cardTitle}>Most Popular Screens</Text>
          {data.topScreens.map((s: any, i: number) => {
            const maxViews = data.topScreens[0]?.views || 1;
            return (
              <View key={s.screen} style={analyticsStyles.barRow}>
                <Text style={analyticsStyles.barLabel} numberOfLines={1}>{s.screen}</Text>
                <View style={analyticsStyles.barTrack}>
                  <View style={[analyticsStyles.barFill, { width: `${Math.max(5, (s.views / maxViews) * 100)}%` }]} />
                </View>
                <Text style={analyticsStyles.barValue}>{s.views}</Text>
                <Text style={analyticsStyles.barAvg}>avg {s.avgDuration}s</Text>
              </View>
            );
          })}
        </View>
      )}

      {data.topFeatures?.length > 0 && (
        <View style={analyticsStyles.card}>
          <Text style={analyticsStyles.cardTitle}>Top Feature Events</Text>
          {data.topFeatures.slice(0, 10).map((f: any, i: number) => (
            <View key={`${f.feature}-${f.action}`} style={analyticsStyles.featureRow}>
              <View style={{ flex: 1 }}>
                <Text style={analyticsStyles.featureName}>{f.feature}</Text>
                <Text style={analyticsStyles.featureAction}>{f.action}</Text>
              </View>
              <Text style={analyticsStyles.featureCount}>{f.count}x</Text>
              <Text style={analyticsStyles.featureUsers}>{f.uniqueUsers} users</Text>
            </View>
          ))}
        </View>
      )}

      {data.dailyVisitors?.length > 0 && (
        <View style={analyticsStyles.card}>
          <Text style={analyticsStyles.cardTitle}>Daily Visitors (last {days} days)</Text>
          {data.dailyVisitors.slice(0, 14).map((d: any) => {
            const maxV = Math.max(...data.dailyVisitors.map((x: any) => x.visitors), 1);
            const dayStr = new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
            return (
              <View key={d.day} style={analyticsStyles.barRow}>
                <Text style={[analyticsStyles.barLabel, { width: 50 }]}>{dayStr}</Text>
                <View style={analyticsStyles.barTrack}>
                  <View style={[analyticsStyles.barFill, { width: `${Math.max(3, (d.visitors / maxV) * 100)}%`, backgroundColor: "#4ADE80" }]} />
                </View>
                <Text style={analyticsStyles.barValue}>{d.visitors}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SuggestionsViewer() {
  const adminKey = useContext(AdminKeyContext);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  async function fetchSuggestions() {
    setLoading(true);
    try {
      const res = await fetch(new URL("/api/admin/suggestions", getApiUrl()).toString(), { headers: adminHeaders(adminKey) });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch {}
    setLoading(false);
  }

  async function markStatus(id: number, status: string) {
    await fetch(new URL(`/api/admin/suggestions/${id}/status`, getApiUrl()).toString(), {
      method: "POST",
      headers: adminHeaders(adminKey, { "Content-Type": "application/json" }),
      body: JSON.stringify({ status }),
    });
    fetchSuggestions();
  }

  return (
    <View style={analyticsStyles.section}>
      <Text style={analyticsStyles.sectionTitle}>Suggestion Box</Text>
      {loading ? (
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 20 }} />
      ) : suggestions.length === 0 ? (
        <View style={analyticsStyles.card}>
          <Text style={{ color: "#888", textAlign: "center", padding: 20 }}>No suggestions yet</Text>
        </View>
      ) : (
        suggestions.map((s) => {
          const statusColors: Record<string, string> = {
            new: "#FF5252",
            reviewed: "#FFC107",
            implemented: "#4ADE80",
            declined: "#888",
          };
          return (
            <View key={s.id} style={analyticsStyles.suggestionCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "700" as const, fontSize: 15 }}>{s.name}</Text>
                <View style={[analyticsStyles.statusBadge, { backgroundColor: (statusColors[s.status] || "#888") + "22" }]}>
                  <Text style={[analyticsStyles.statusText, { color: statusColors[s.status] || "#888" }]}>{s.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={{ color: "#ccc", fontSize: 14, lineHeight: 20, marginBottom: 8 }}>{s.message}</Text>
              <Text style={{ color: "#666", fontSize: 11 }}>
                {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </Text>
              {s.status === "new" && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <Pressable onPress={() => markStatus(s.id, "reviewed")} style={[analyticsStyles.actionBtn, { backgroundColor: "#FFC10722" }]}>
                    <Text style={{ color: "#FFC107", fontSize: 12, fontWeight: "700" as const }}>Mark Reviewed</Text>
                  </Pressable>
                  <Pressable onPress={() => markStatus(s.id, "implemented")} style={[analyticsStyles.actionBtn, { backgroundColor: "#4ADE8022" }]}>
                    <Text style={{ color: "#4ADE80", fontSize: 12, fontWeight: "700" as const }}>Implemented</Text>
                  </Pressable>
                  <Pressable onPress={() => markStatus(s.id, "declined")} style={[analyticsStyles.actionBtn, { backgroundColor: "#88888822" }]}>
                    <Text style={{ color: "#888", fontSize: 12, fontWeight: "700" as const }}>Decline</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const analyticsStyles = StyleSheet.create({
  section: { marginTop: 24, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 20, fontWeight: "800" as const, color: "#fff", marginBottom: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  periodRow: { flexDirection: "row", gap: 6 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#1a1a2e" },
  periodBtnActive: { backgroundColor: Colors.gold },
  periodText: { color: "#888", fontSize: 12, fontWeight: "700" as const },
  periodTextActive: { color: "#0a0a0a" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: "#1a1a2e", borderRadius: 12, padding: 16, alignItems: "center" },
  statNum: { fontSize: 28, fontWeight: "800" as const, color: Colors.gold },
  statLabel: { fontSize: 11, color: "#888", marginTop: 4, fontWeight: "600" as const, textTransform: "uppercase" as const },
  card: { backgroundColor: "#1a1a2e", borderRadius: 14, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700" as const, color: "#fff", marginBottom: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  barLabel: { width: 80, fontSize: 12, color: "#aaa", fontWeight: "600" as const },
  barTrack: { flex: 1, height: 8, backgroundColor: "#0d0d1a", borderRadius: 4, overflow: "hidden" as const },
  barFill: { height: "100%", backgroundColor: Colors.gold, borderRadius: 4 },
  barValue: { width: 36, fontSize: 12, color: "#fff", fontWeight: "700" as const, textAlign: "right" as const },
  barAvg: { width: 52, fontSize: 10, color: "#888", textAlign: "right" as const },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#ffffff08" },
  featureName: { fontSize: 13, color: "#fff", fontWeight: "600" as const },
  featureAction: { fontSize: 11, color: "#888" },
  featureCount: { fontSize: 13, color: Colors.gold, fontWeight: "700" as const, width: 40, textAlign: "right" as const },
  featureUsers: { fontSize: 11, color: "#888", width: 55, textAlign: "right" as const },
  suggestionCard: { backgroundColor: "#1a1a2e", borderRadius: 14, padding: 16, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: Colors.gold },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: "800" as const, letterSpacing: 0.5 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
});

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
  shareHero: {
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.2)",
    gap: 6,
  },
  shareHeroCount: {
    fontSize: 48,
    fontFamily: "PlayfairDisplay_900Black",
    color: Colors.gold,
    lineHeight: 52,
  },
  shareHeroLabel: {
    fontSize: 13,
    color: Colors.whiteDim,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  shareByFeature: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  shareFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shareFeatureIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  shareFeatureLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.white,
  },
  shareFeatureCount: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  shareDailyChart: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareDailyTitle: {
    fontSize: 12,
    color: Colors.whiteDim,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 14,
  },
  shareDailyBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    gap: 8,
  },
  shareDayColumn: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  shareDayCount: {
    fontSize: 11,
    color: Colors.gold,
    fontWeight: "700",
  },
  shareDayBar: {
    width: "80%",
    borderRadius: 4,
  },
  shareDayLabel: {
    fontSize: 10,
    color: Colors.whiteMuted,
  },
});
