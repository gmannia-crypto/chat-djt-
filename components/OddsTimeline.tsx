import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { OddsShift } from "@/lib/arena-recordings";

const ODDS_LABEL_COLORS: Record<string, string> = {
  FAVORITE: "#4ADE80",
  "CO-FAVORITE": "#86EFAC",
  CONTENDER: "#FBBF24",
  UNDERDOG: "#F87171",
};

/** Compact odds-shift timeline. `duration` is in seconds. */
export function OddsTimeline({ shifts, duration }: { shifts: OddsShift[]; duration: number }) {
  if (shifts.length === 0) return null;
  return (
    <View style={ot.container}>
      <View style={ot.titleRow}>
        <Ionicons name="trending-up" size={14} color="#D4A420" />
        <Text style={ot.title}>Odds Timeline</Text>
      </View>
      {shifts.map((shift, i) => {
        const fromColor = ODDS_LABEL_COLORS[shift.fromLabel] ?? "#888";
        const toColor = ODDS_LABEL_COLORS[shift.toLabel] ?? "#888";
        const pct = duration > 0 ? Math.min(1, shift.atTime / (duration * 1000)) : 0;
        const atMin = Math.floor(shift.atTime / 60000);
        const atSec = Math.floor((shift.atTime % 60000) / 1000);
        const timeLabel = `${atMin}:${atSec.toString().padStart(2, "0")}`;
        return (
          <Animated.View key={i} entering={FadeIn.delay(i * 60).duration(350)} style={ot.row}>
            {/* mini track marker */}
            <View style={ot.trackWrap}>
              <View style={ot.track}>
                <View style={[ot.trackFill, { width: `${pct * 100}%` as any }]} />
                <View style={[ot.trackDot, { left: `${pct * 100}%` as any, backgroundColor: toColor }]} />
              </View>
            </View>
            <View style={ot.textWrap}>
              <Text style={ot.personaName}>{shift.personaName}</Text>
              <View style={ot.labelRow}>
                <Text style={[ot.labelBadge, { color: fromColor, borderColor: fromColor + "50" }]}>{shift.fromLabel}</Text>
                <Ionicons name="arrow-forward" size={10} color="rgba(255,255,255,0.4)" />
                <Text style={[ot.labelBadge, { color: toColor, borderColor: toColor + "50" }]}>{shift.toLabel}</Text>
              </View>
            </View>
            <Text style={ot.timeLabel}>{timeLabel}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const ot = StyleSheet.create({
  container: {
    marginHorizontal: 0,
    marginBottom: 12,
    backgroundColor: "rgba(212,164,32,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.15)",
    padding: 12,
    gap: 10,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  title: { color: "#D4A420", fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  trackWrap: { flex: 1 },
  track: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "visible",
  },
  trackFill: { height: 3, backgroundColor: "rgba(212,164,32,0.4)", borderRadius: 2 },
  trackDot: {
    position: "absolute",
    top: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    marginLeft: -4,
  },
  textWrap: { width: 170, gap: 2 },
  personaName: { color: "#fff", fontSize: 12, fontWeight: "700" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  labelBadge: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  timeLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, minWidth: 34, textAlign: "right" },
});
