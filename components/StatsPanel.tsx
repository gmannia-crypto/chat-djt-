import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

interface StatEntry {
  label: string;
  value: string | number;
  icon?: string;
}

interface StatsPanelProps {
  title: string;
  emoji: string;
  stats: StatEntry[];
  accentColor?: string;
  onShare?: () => void;
  onChallenge?: () => void;
}

export function StatsPanel({ title, emoji, stats, accentColor = "#ff4d4d", onShare, onChallenge }: StatsPanelProps) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={s.container}>
      <Text style={s.title}>{emoji} {title}</Text>
      {stats.map((stat, i) => (
        <View key={i} style={s.row}>
          <Text style={s.label}>{stat.label}</Text>
          <Text style={[s.value, { color: accentColor }]}>{stat.value}</Text>
        </View>
      ))}
      <View style={s.btnRow}>
        {onShare && (
          <Pressable onPress={onShare} style={({ pressed }) => [s.actionBtn, { backgroundColor: accentColor }, pressed && { opacity: 0.8 }]}>
            <Ionicons name="share-outline" size={14} color="#fff" />
            <Text style={s.actionBtnText}>Share Stats</Text>
          </Pressable>
        )}
        {onChallenge && (
          <Pressable onPress={onChallenge} style={({ pressed }) => [s.actionBtn, { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: accentColor }, pressed && { opacity: 0.8 }]}>
            <Ionicons name="people-outline" size={14} color={accentColor} />
            <Text style={[s.actionBtnText, { color: accentColor }]}>Challenge</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.3)",
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 12,
    marginVertical: 8,
  },
  title: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  value: {
    fontSize: 13,
    fontWeight: "700",
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
