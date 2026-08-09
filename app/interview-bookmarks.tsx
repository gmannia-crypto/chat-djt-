import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, Image, Platform, Modal, Share, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";

const SHARE_URL = "https://thearena.rip";

type Bookmark = {
  id: string;
  interviewId: string;
  msgId: string;
  speakerId?: string | null;
  speakerName?: string | null;
  text: string;
  isCallIn?: boolean;
  isInterruption?: boolean;
  interviewerId?: string | null;
  interviewerName?: string | null;
  intervieweeId?: string | null;
  intervieweeName?: string | null;
  interviewTitle?: string | null;
  createdAt: number;
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
  pastormanning: require("@/assets/images/persona-pastormanning.jpg"),
  shahidbolson: require("@/assets/images/persona-shahid.png"),
  mlk: require("@/assets/images/persona-mlk.jpg"),
  malcolmx: require("@/assets/images/persona-malcolmx.jpg"),
  samjackson: require("@/assets/images/persona-samjackson.jpg"),
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

function interviewLabel(b: Bookmark) {
  if (b.interviewTitle) return b.interviewTitle;
  const a = b.interviewerName || "Interviewer";
  const c = b.intervieweeName || "Guest";
  return `${a} × ${c}`;
}

function buildShareText(b: Bookmark) {
  const speaker = b.isCallIn ? `${b.speakerName} (caller)` : b.speakerName;
  return `"${b.text}"\n— ${speaker}\n\nFrom ${interviewLabel(b)} on The Arena\n${SHARE_URL}`;
}

export default function InterviewBookmarksScreen() {
  const insets = useSafeAreaInsets();
  const { deviceId } = useTokens();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionItem, setActionItem] = useState<Bookmark | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const longPressedRef = React.useRef(false);

  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 3000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  const load = useCallback(async () => {
    if (!deviceId) return;
    try {
      const res = await fetch(new URL("/api/arena/interview-bookmarks", getApiUrl()).toString(), {
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

  const handleCopy = async (b: Bookmark) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await Clipboard.setStringAsync(buildShareText(b));
      setCopiedId(b.id);
      setTimeout(() => setCopiedId((c) => (c === b.id ? null : c)), 1400);
    } catch {}
  };

  const handleShare = async (b: Bookmark) => {
    const text = buildShareText(b);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (Platform.OS === "web") {
        const nav: (Navigator & { share?: (data: { text?: string; url?: string; title?: string }) => Promise<void> }) | undefined =
          typeof navigator !== "undefined" ? navigator : undefined;
        if (nav && typeof nav.share === "function") {
          await nav.share({ text, url: SHARE_URL });
          setActionItem(null);
          return;
        }
        await Clipboard.setStringAsync(text);
        setCopiedId(b.id);
        setTimeout(() => { setCopiedId((c) => (c === b.id ? null : c)); setActionItem(null); }, 1200);
        return;
      }
      await Share.share({ message: text, url: SHARE_URL });
      setActionItem(null);
    } catch {}
  };

  const confirmDelete = (b: Bookmark) => {
    setActionItem(null);
    if (Platform.OS === "web") {
      doDelete(b);
    } else {
      Alert.alert(
        "Remove bookmark?",
        `"${b.text.slice(0, 80)}${b.text.length > 80 ? "…" : ""}" will be removed from your favorites.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: () => doDelete(b) },
        ],
      );
    }
  };

  const doDelete = async (b: Bookmark) => {
    if (!deviceId) return;
    setBusyId(b.id);
    try {
      const res = await fetch(new URL(`/api/arena/interview-bookmarks/${b.id}`, getApiUrl()).toString(), {
        method: "DELETE",
        headers: { "x-device-id": deviceId },
      });
      if (res.ok || res.status === 404) {
        setItems((prev) => prev.filter((x) => x.id !== b.id));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        setErrorMsg("Couldn't remove bookmark. Please try again.");
      }
    } catch {
      setErrorMsg("Couldn't remove bookmark. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top + webTop }]}>
      <LinearGradient colors={["rgba(255,215,0,0.12)", "rgba(0,0,0,0)", "#0a0a0a"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.iconBtn} testID="bookmarks-back">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>FAVORITE MOMENTS</Text>
          <Text style={s.headerSub}>{items.length} saved · re-share anytime</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={s.empty}>
          <ActivityIndicator color="#FFD700" />
        </View>
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="bookmark-outline" size={48} color="rgba(255,215,0,0.4)" />
          <Text style={s.emptyTitle}>No bookmarks yet</Text>
          <Text style={s.emptySub}>Tap a bubble in any past interview, then choose Save to favorites.</Text>
          <Pressable onPress={() => router.replace("/interview-history")} style={s.emptyBtn}>
            <Text style={s.emptyBtnText}>OPEN PAST INTERVIEWS</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + webBottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
          renderItem={({ item }) => {
            const portrait = item.speakerId ? PERSONA_PORTRAITS[item.speakerId] : null;
            const isBusy = busyId === item.id;
            return (
              <Pressable
                onPress={() => {
                  if (longPressedRef.current) {
                    longPressedRef.current = false;
                    return;
                  }
                  if (item.interviewId) router.push(`/interview-history/${item.interviewId}`);
                }}
                onLongPress={() => {
                  longPressedRef.current = true;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setActionItem(item);
                }}
                delayLongPress={350}
                style={[s.row, isBusy && { opacity: 0.5 }]}
                testID={`bookmark-row-${item.id}`}
              >
                <View style={s.rowHeader}>
                  {portrait ? (
                    <Image source={portrait} style={s.portrait} />
                  ) : (
                    <View style={[s.portrait, s.portraitFallback]}>
                      <Ionicons name="person" size={16} color="#666" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.speaker} numberOfLines={1}>
                      {item.speakerName || "Unknown"}
                      {item.isCallIn ? " · CALL-IN" : ""}
                      {item.isInterruption ? " · INTERRUPTS" : ""}
                    </Text>
                    <Text style={s.interview} numberOfLines={1}>
                      {interviewLabel(item)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => { setActionItem(item); }}
                    hitSlop={12}
                    style={s.menuBtn}
                    testID={`bookmark-menu-${item.id}`}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,215,0,0.85)" />
                  </Pressable>
                </View>
                <Text style={s.quote} numberOfLines={6}>"{item.text}"</Text>
                <View style={s.rowFooter}>
                  <Text style={s.dateText}>{formatDate(item.createdAt)}</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable
                      onPress={() => handleCopy(item)}
                      style={[s.quickBtn, s.quickBtnGhost]}
                      hitSlop={6}
                      testID={`bookmark-copy-${item.id}`}
                    >
                      <Ionicons name={copiedId === item.id ? "checkmark" : "copy-outline"} size={13} color="#FFD700" />
                      <Text style={s.quickBtnGhostText}>{copiedId === item.id ? "Copied" : "Copy"}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleShare(item)}
                      style={[s.quickBtn, s.quickBtnPrimary]}
                      hitSlop={6}
                      testID={`bookmark-share-${item.id}`}
                    >
                      <Ionicons name="share-outline" size={13} color="#000" />
                      <Text style={s.quickBtnPrimaryText}>Share</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={!!actionItem} transparent animationType="fade" onRequestClose={() => setActionItem(null)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActionItem(null)} />
          <View style={s.sheet} testID="bookmark-action-sheet">
            <View style={s.handle} />
            <Text style={s.sheetTitle} numberOfLines={1}>
              {actionItem ? interviewLabel(actionItem) : ""}
            </Text>
            {actionItem ? (
              <Text style={s.sheetSub} numberOfLines={3}>"{actionItem.text}"</Text>
            ) : null}
            <Pressable
              style={s.sheetAction}
              onPress={() => actionItem && handleShare(actionItem)}
              testID="bookmark-action-share"
            >
              <Ionicons name="share-outline" size={20} color="#FFD700" />
              <Text style={s.sheetActionText}>Share</Text>
            </Pressable>
            <Pressable
              style={s.sheetAction}
              onPress={() => actionItem && handleCopy(actionItem)}
              testID="bookmark-action-copy"
            >
              <Ionicons name="copy-outline" size={20} color="#FFD700" />
              <Text style={s.sheetActionText}>Copy text</Text>
            </Pressable>
            <Pressable
              style={s.sheetAction}
              onPress={() => {
                if (actionItem?.interviewId) {
                  setActionItem(null);
                  router.push(`/interview-history/${actionItem.interviewId}`);
                }
              }}
              testID="bookmark-action-open"
            >
              <Ionicons name="document-text-outline" size={20} color="#FFD700" />
              <Text style={s.sheetActionText}>Open interview</Text>
            </Pressable>
            <Pressable
              style={s.sheetAction}
              onPress={() => actionItem && confirmDelete(actionItem)}
              testID="bookmark-action-delete"
            >
              <Ionicons name="trash-outline" size={20} color="#ff4d4d" />
              <Text style={[s.sheetActionText, { color: "#ff4d4d" }]}>Remove bookmark</Text>
            </Pressable>
            <Pressable style={s.sheetCancel} onPress={() => setActionItem(null)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {errorMsg ? (
        <View style={s.toast} pointerEvents="none" testID="bookmarks-error-toast">
          <Ionicons name="alert-circle" size={16} color="#ff4d4d" />
          <Text style={s.toastText}>{errorMsg}</Text>
        </View>
      ) : null}
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

  row: { padding: 12, marginBottom: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,215,0,0.18)" },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  portrait: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "rgba(255,215,0,0.4)" },
  portraitFallback: { backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
  speaker: { color: "#FFD700", fontSize: 12, fontWeight: "900", letterSpacing: 0.4 },
  interview: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1, fontWeight: "600" },
  menuBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  quote: { color: "#fff", fontSize: 13, lineHeight: 18, fontStyle: "italic" as const, marginBottom: 10 },
  rowFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateText: { color: "rgba(255,215,0,0.6)", fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  quickBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  quickBtnGhost: { backgroundColor: "rgba(255,215,0,0.1)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  quickBtnGhostText: { color: "#FFD700", fontSize: 11, fontWeight: "800" as const },
  quickBtnPrimary: { backgroundColor: "#FFD700" },
  quickBtnPrimaryText: { color: "#000", fontSize: 11, fontWeight: "900" as const },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F0F12", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderTopWidth: 1, borderColor: "rgba(255,215,0,0.2)", paddingBottom: Platform.OS === "web" ? 34 : 24 },
  handle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 12 },
  sheetTitle: { color: "#fff", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  sheetSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginBottom: 14, fontStyle: "italic" as const },
  sheetAction: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  sheetActionText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sheetCancel: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
  sheetCancelText: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" },

  toast: { position: "absolute", left: 16, right: 16, bottom: 24, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(20,20,24,0.96)", borderWidth: 1, borderColor: "rgba(255,77,77,0.5)" },
  toastText: { flex: 1, color: "#fff", fontSize: 13, fontWeight: "700" },
});
