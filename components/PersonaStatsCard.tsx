/**
 * PersonaStatsCard
 * A styled off-screen view captured by react-native-view-shot and shared as an image.
 * Rendered with position absolute / left -9999 so it's off-screen but still mounted.
 */
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export type PersonaStatsCardData = {
  personaId: string;
  name: string;
  rank: number;
  winPct: number;
  wins: number;
  losses: number;
  /** Optional local require() image source */
  portrait?: any;
  rivalName?: string | null;
  bestRivalWins?: number;
};

type Props = {
  data: PersonaStatsCardData;
};

function rankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function rankColor(rank: number): string {
  if (rank === 1) return "#FFD700";
  if (rank === 2) return "#C0C0C0";
  if (rank === 3) return "#CD7F32";
  return "rgba(255,255,255,0.5)";
}

export const PersonaStatsCard = React.forwardRef<View, Props>(({ data }, ref) => {
  const rc = rankColor(data.rank);
  const medal = rankLabel(data.rank);
  const isTop3 = data.rank <= 3;

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      <LinearGradient
        colors={["#12101c", "#0a0812", "#06050f"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Gold top accent bar */}
      <View style={[styles.topBar, { backgroundColor: rc }]} />

      {/* Header — trophy + "DEBATE HALL OF FAME" */}
      <View style={styles.header}>
        <Text style={styles.trophyEmoji}>🏆</Text>
        <View>
          <Text style={styles.hofLabel}>DEBATE HALL OF FAME</Text>
          <Text style={styles.siteLabel}>TrumpBot.rip</Text>
        </View>
      </View>

      {/* Portrait */}
      <View style={[styles.portraitRing, { borderColor: rc }]}>
        {data.portrait ? (
          <Image source={data.portrait} style={styles.portrait} />
        ) : (
          <View style={[styles.portraitFallback, { backgroundColor: rc + "33" }]}>
            <Text style={[styles.portraitInitial, { color: rc }]}>
              {data.name.charAt(0)}
            </Text>
          </View>
        )}
      </View>

      {/* Rank badge */}
      <View style={[styles.rankBadge, { borderColor: rc, backgroundColor: rc + "22" }]}>
        <Text style={[styles.rankText, { color: isTop3 ? rc : "rgba(255,255,255,0.7)" }]}>
          {medal}
        </Text>
      </View>

      {/* Name */}
      <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
        {data.name}
      </Text>

      {/* Win % (hero stat) */}
      <Text style={[styles.winPct, { color: isTop3 ? "#FFD700" : "#fff" }]}>
        {data.winPct}%
      </Text>
      <Text style={styles.winPctLabel}>WIN RATE</Text>

      {/* W/L divider row */}
      <View style={styles.recordRow}>
        <View style={styles.recordPill}>
          <Text style={styles.recordW}>{data.wins}W</Text>
          <Text style={styles.recordSep}> – </Text>
          <Text style={styles.recordL}>{data.losses}L</Text>
        </View>
      </View>

      {/* Rival dominance callout (optional) */}
      {data.rivalName && data.bestRivalWins ? (
        <Text style={styles.rivalLine}>
          💪 Dominates {data.rivalName.split(" ")[0]} ({data.bestRivalWins}× wins)
        </Text>
      ) : null}

      {/* Bottom branding */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>trumpbot.rip/arena  ·  Come debate them</Text>
      </View>
    </View>
  );
});

PersonaStatsCard.displayName = "PersonaStatsCard";

const CARD_W = 360;

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: "#0a0812",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255,215,0,0.35)",
    overflow: "hidden",
    alignItems: "center",
    paddingBottom: 20,
  },
  topBar: {
    width: "100%",
    height: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 24,
  },
  trophyEmoji: { fontSize: 22 },
  hofLabel: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  siteLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 1,
  },
  portraitRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    overflow: "hidden",
    marginBottom: 16,
  },
  portrait: {
    width: "100%",
    height: "100%",
  },
  portraitFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  portraitInitial: {
    fontSize: 52,
    fontWeight: "900",
  },
  rankBadge: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  rankText: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  name: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0.4,
    marginBottom: 20,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  winPct: {
    fontSize: 64,
    fontWeight: "900",
    lineHeight: 68,
    letterSpacing: -1,
  },
  winPctLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 2,
    marginBottom: 16,
  },
  recordRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
  },
  recordPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  recordW: {
    color: "#4ADE80",
    fontSize: 20,
    fontWeight: "900",
  },
  recordSep: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 18,
    fontWeight: "700",
  },
  recordL: {
    color: "#f87171",
    fontSize: 20,
    fontWeight: "900",
  },
  rivalLine: {
    color: "rgba(96,165,250,0.85)",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  footer: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,215,0,0.15)",
    width: "100%",
    alignItems: "center",
  },
  footerText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
