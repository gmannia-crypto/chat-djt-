import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, Image, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";

type HistoryItem = {
  id: string;
  interviewerId: string;
  interviewerName: string;
  intervieweeId: string;
  intervieweeName: string;
  durationMinutes: number;
  lieCount: number;
  messageCount: number;
  startedAt: number;
  endedAt: number;
};

const PERSONA_PORTRAITS: Record<string, any> = {
  trump: require("@/assets/images/persona-trump.png"),
  netanyahu: require("@/assets/images/persona-netanyahu.png"),
  ruckus: require("@/assets/images/persona-ruckus.png"),
  galloway: require("@/assets/images/persona-galloway.png"),
  mcconnell: require("@/assets/images/persona-mcconnell.png"),
  carville: require("@/assets/images/persona-carville.png"),
  maddow: require("@/assets/images/persona-maddow.png"),
  omar: require("@/assets/images/persona-omar.png"),
  biden: require("@/assets/images/persona-biden.png"),
  rosie: require("@/assets/images/persona-rosie.png"),
  berniemc: require("@/assets/images/persona-bernie.png"),
  elon: require("@/assets/images/persona-musk.png"),
  graham: require("@/assets/images/persona-graham.png"),
  megynkelly: require("@/assets/images/persona-megynkelly.png"),
  pambondi: require("@/assets/images/persona-pambondi.png"),
  candace: require("@/assets/images/persona-candace.png"),
  joyreid: require("@/assets/images/persona-joyreid.png"),
  miller: require("@/assets/images/persona-miller.png"),
  jimjordan: require("@/assets/images/persona-jimjordan.png"),
  schumer: require("@/assets/images/persona-schumer.png"),
  alexjones: require("@/assets/images/persona-alexjones.png"),
  obama: require("@/assets/images/persona-obama.png"),
  melania: require("@/assets/images/persona-melania.png"),
  odonnell: require("@/assets/images/persona-odonnell.png"),
  kamala: require("@/assets/images/persona-kamala.png"),
  mtg: require("@/assets/images/persona-mtg.png"),
  rfk: require("@/assets/images/persona-rfk.png"),
};

const webTop = Platform.OS === "web" ? 67 : 0;
const webBottom = Platform.OS === "web" ? 34 : 0;

function formatDate(ms: number) {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (isYesterday) return `Yesterday · ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) + " · " + time;
}

export default function InterviewHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { deviceId } = useTokens();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!deviceId) return;
    try {
      const res = await fetch(new URL("/api/arena/interview-history", getApiUrl()).toString(), {
        headers: { "x-device-id": deviceId },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <View style={[s.container, { paddingTop: insets.top + webTop }]}>
      <LinearGradient colors={["rgba(255,215,0,0.12)", "rgba(0,0,0,0)", "#0a0a0a"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.iconBtn} testID="history-back">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>PAST INTERVIEWS</Text>
          <Text style={s.headerSub}>{items.length} saved · re-read the show</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={s.empty}>
          <ActivityIndicator color="#FFD700" />
        </View>
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="document-text-outline" size={48} color="rgba(255,215,0,0.4)" />
          <Text style={s.emptyTitle}>No past interviews yet</Text>
          <Text style={s.emptySub}>Finish an interview and the transcript will appear here.</Text>
          <Pressable onPress={() => router.replace("/interview")} style={s.emptyBtn}>
            <Text style={s.emptyBtnText}>BOOK AN INTERVIEW</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + webBottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
          renderItem={({ item }) => {
            const ip = PERSONA_PORTRAITS[item.interviewerId];
            const ep = PERSONA_PORTRAITS[item.intervieweeId];
            return (
              <Pressable
                onPress={() => router.push(`/interview-history/${item.id}`)}
                style={s.row}
                testID={`history-row-${item.id}`}
              >
                <View style={s.portraits}>
                  {ip ? <Image source={ip} style={s.portrait} /> : <View style={[s.portrait, s.portraitFallback]}><Ionicons name="person" size={18} color="#666" /></View>}
                  {ep ? <Image source={ep} style={[s.portrait, s.portraitOverlap]} /> : <View style={[s.portrait, s.portraitOverlap, s.portraitFallback]}><Ionicons name="person" size={18} color="#666" /></View>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {item.interviewerName} <Text style={{ color: "rgba(255,255,255,0.4)" }}>×</Text> {item.intervieweeName}
                  </Text>
                  <Text style={s.rowDate}>{formatDate(item.endedAt)}</Text>
                  <View style={s.metaRow}>
                    <View style={s.metaPill}>
                      <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.6)" />
                      <Text style={s.metaText}>{item.durationMinutes} min</Text>
                    </View>
                    <View style={s.metaPill}>
                      <Ionicons name="chatbubbles-outline" size={11} color="rgba(255,255,255,0.6)" />
                      <Text style={s.metaText}>{item.messageCount} msgs</Text>
                    </View>
                    <View style={[s.metaPill, item.lieCount > 0 && { backgroundColor: "rgba(255,77,77,0.12)", borderColor: "rgba(255,77,77,0.4)" }]}>
                      <Ionicons name="flash" size={11} color={item.lieCount > 0 ? "#ff4d4d" : "rgba(255,255,255,0.6)"} />
                      <Text style={[s.metaText, item.lieCount > 0 && { color: "#ff4d4d" }]}>{item.lieCount} lies</Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,215,0,0.7)" />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.2)" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#FFD700", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  headerSub: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, gap: 8 },
  emptyTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: 8 },
  emptySub: { color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center" },
  emptyBtn: { marginTop: 18, backgroundColor: "#FFD700", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "center", padding: 12, marginBottom: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,215,0,0.18)", gap: 10 },
  portraits: { flexDirection: "row", width: 64, height: 44, alignItems: "center" },
  portrait: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: "#0a0a0a" },
  portraitOverlap: { marginLeft: -14 },
  portraitFallback: { backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
  rowTitle: { color: "#fff", fontSize: 14, fontWeight: "800" },
  rowDate: { color: "rgba(255,215,0,0.7)", fontSize: 11, marginTop: 2, fontWeight: "700" },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  metaText: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700" },
});
