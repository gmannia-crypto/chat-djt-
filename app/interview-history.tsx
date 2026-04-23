import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, Image, Platform, Modal, TextInput, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";
import * as Haptics from "expo-haptics";
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
  title?: string | null;
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

function defaultTitle(it: HistoryItem) {
  return `${it.interviewerName} × ${it.intervieweeName}`;
}

export default function InterviewHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { deviceId } = useTokens();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionItem, setActionItem] = useState<HistoryItem | null>(null);
  const [renameItem, setRenameItem] = useState<HistoryItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HistoryItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [undoItem, setUndoItem] = useState<HistoryItem | null>(null);
  const [restoring, setRestoring] = useState(false);
  const longPressedRef = React.useRef(false);

  React.useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 3000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  React.useEffect(() => {
    if (!undoItem) return;
    const t = setTimeout(() => setUndoItem(null), 5000);
    return () => clearTimeout(t);
  }, [undoItem]);

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

  const openActions = (it: HistoryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActionItem(it);
  };

  const startRename = (it: HistoryItem) => {
    setActionItem(null);
    setRenameValue(it.title || "");
    setRenameItem(it);
  };

  const submitRename = async () => {
    if (!renameItem || !deviceId) return;
    setSavingRename(true);
    const trimmed = renameValue.trim().slice(0, 80);
    const newTitle = trimmed.length === 0 ? null : trimmed;
    try {
      const res = await fetch(new URL(`/api/arena/interview-history/${renameItem.id}`, getApiUrl()).toString(), {
        method: "PATCH",
        headers: { "x-device-id": deviceId, "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((x) => x.id === renameItem.id ? { ...x, title: newTitle } : x));
        setRenameItem(null);
      } else {
        setErrorMsg("Couldn't rename interview. Please try again.");
      }
    } catch {
      setErrorMsg("Couldn't rename interview. Please try again.");
    } finally {
      setSavingRename(false);
    }
  };

  const startDelete = (it: HistoryItem) => {
    setActionItem(null);
    if (Platform.OS === "web") {
      setConfirmDelete(it);
    } else {
      Alert.alert(
        "Delete interview?",
        `"${it.title || defaultTitle(it)}" will disappear from your history. You can undo right after, or it's removed for good after 7 days.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => doDelete(it) },
        ],
      );
    }
  };

  const doDelete = async (it: HistoryItem) => {
    if (!deviceId) return;
    setDeletingId(it.id);
    try {
      const res = await fetch(new URL(`/api/arena/interview-history/${it.id}`, getApiUrl()).toString(), {
        method: "DELETE",
        headers: { "x-device-id": deviceId },
      });
      if (res.ok) {
        setItems((prev) => prev.filter((x) => x.id !== it.id));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setErrorMsg(null);
        setUndoItem(it);
      } else {
        setErrorMsg("Couldn't delete interview. Please try again.");
      }
    } catch {
      setErrorMsg("Couldn't delete interview. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const restoreDeleted = async () => {
    if (!undoItem || !deviceId || restoring) return;
    const it = undoItem;
    setRestoring(true);
    try {
      const res = await fetch(new URL(`/api/arena/interview-history/${it.id}/restore`, getApiUrl()).toString(), {
        method: "POST",
        headers: { "x-device-id": deviceId },
      });
      if (res.ok) {
        setItems((prev) => {
          if (prev.some((x) => x.id === it.id)) return prev;
          const next = [...prev, it];
          next.sort((a, b) => b.endedAt - a.endedAt);
          return next;
        });
        setUndoItem(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        setErrorMsg("Couldn't restore interview. Please try again.");
        setUndoItem(null);
      }
    } catch {
      setErrorMsg("Couldn't restore interview. Please try again.");
      setUndoItem(null);
    } finally {
      setRestoring(false);
    }
  };

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
        <Pressable
          onPress={() => router.push("/interview-bookmarks")}
          style={s.iconBtn}
          testID="open-bookmarks"
          accessibilityLabel="Open favorite moments"
        >
          <Ionicons name="bookmark" size={18} color="#FFD700" />
        </Pressable>
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
            const displayTitle = item.title || defaultTitle(item);
            const isDeleting = deletingId === item.id;
            return (
              <Pressable
                onPress={() => {
                  if (longPressedRef.current) {
                    longPressedRef.current = false;
                    return;
                  }
                  router.push(`/interview-history/${item.id}`);
                }}
                onLongPress={() => {
                  longPressedRef.current = true;
                  openActions(item);
                }}
                delayLongPress={350}
                style={[s.row, isDeleting && { opacity: 0.5 }]}
                testID={`history-row-${item.id}`}
              >
                <View style={s.portraits}>
                  {ip ? <Image source={ip} style={s.portrait} /> : <View style={[s.portrait, s.portraitFallback]}><Ionicons name="person" size={18} color="#666" /></View>}
                  {ep ? <Image source={ep} style={[s.portrait, s.portraitOverlap]} /> : <View style={[s.portrait, s.portraitOverlap, s.portraitFallback]}><Ionicons name="person" size={18} color="#666" /></View>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {item.title ? item.title : (
                      <>
                        {item.interviewerName} <Text style={{ color: "rgba(255,255,255,0.4)" }}>×</Text> {item.intervieweeName}
                      </>
                    )}
                  </Text>
                  {item.title ? (
                    <Text style={s.rowSubtitle} numberOfLines={1}>{defaultTitle(item)}</Text>
                  ) : null}
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
                <Pressable
                  onPress={() => openActions(item)}
                  hitSlop={12}
                  style={s.menuBtn}
                  testID={`history-menu-${item.id}`}
                  accessibilityLabel={`More options for ${displayTitle}`}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,215,0,0.85)" />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={!!actionItem} transparent animationType="fade" onRequestClose={() => setActionItem(null)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActionItem(null)} />
          <View style={s.sheet} testID="history-action-sheet">
            <View style={s.handle} />
            <Text style={s.sheetTitle} numberOfLines={1}>
              {actionItem ? (actionItem.title || defaultTitle(actionItem)) : ""}
            </Text>
            <Pressable
              style={s.sheetAction}
              onPress={() => actionItem && startRename(actionItem)}
              testID="history-action-rename"
            >
              <Ionicons name="create-outline" size={20} color="#FFD700" />
              <Text style={s.sheetActionText}>{actionItem?.title ? "Edit title" : "Rename"}</Text>
            </Pressable>
            <Pressable
              style={s.sheetAction}
              onPress={() => actionItem && startDelete(actionItem)}
              testID="history-action-delete"
            >
              <Ionicons name="trash-outline" size={20} color="#ff4d4d" />
              <Text style={[s.sheetActionText, { color: "#ff4d4d" }]}>Delete interview</Text>
            </Pressable>
            <Pressable style={s.sheetCancel} onPress={() => setActionItem(null)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!renameItem} transparent animationType="fade" onRequestClose={() => setRenameItem(null)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenameItem(null)} />
          <View style={s.sheet} testID="history-rename-sheet">
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Rename interview</Text>
            <Text style={s.sheetSub}>
              {renameItem ? defaultTitle(renameItem) : ""}
            </Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Custom title (leave blank to clear)"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={s.input}
              maxLength={80}
              autoFocus
              testID="history-rename-input"
            />
            <View style={s.sheetActions}>
              <Pressable
                style={[s.sheetBtn, s.sheetBtnGhost]}
                onPress={() => setRenameItem(null)}
              >
                <Text style={s.sheetBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.sheetBtn, s.sheetBtnPrimary]}
                onPress={submitRename}
                disabled={savingRename}
                testID="history-rename-save"
              >
                {savingRename ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={s.sheetBtnPrimaryText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {errorMsg ? (
        <View style={s.toast} pointerEvents="none" testID="history-error-toast">
          <Ionicons name="alert-circle" size={16} color="#ff4d4d" />
          <Text style={s.toastText}>{errorMsg}</Text>
        </View>
      ) : null}

      {undoItem ? (
        <View style={s.undoToast} testID="history-undo-toast">
          <Ionicons name="trash" size={16} color="rgba(255,255,255,0.85)" />
          <Text style={s.toastText} numberOfLines={1}>
            Deleted "{undoItem.title || defaultTitle(undoItem)}"
          </Text>
          <Pressable
            onPress={restoreDeleted}
            disabled={restoring}
            hitSlop={10}
            style={s.undoBtn}
            testID="history-undo-restore"
            accessibilityLabel="Undo delete"
          >
            {restoring ? (
              <ActivityIndicator color="#FFD700" />
            ) : (
              <Text style={s.undoBtnText}>UNDO</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => setUndoItem(null)}
            hitSlop={10}
            style={s.undoClose}
            testID="history-undo-dismiss"
            accessibilityLabel="Dismiss undo"
          >
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>
      ) : null}

      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirmDelete(null)} />
          <View style={s.sheet} testID="history-confirm-delete">
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Delete interview?</Text>
            <Text style={s.sheetSub}>
              "{confirmDelete ? (confirmDelete.title || defaultTitle(confirmDelete)) : ""}" will disappear from your history. You can undo right after, or it's removed for good after 7 days.
            </Text>
            <View style={s.sheetActions}>
              <Pressable
                style={[s.sheetBtn, s.sheetBtnGhost]}
                onPress={() => setConfirmDelete(null)}
              >
                <Text style={s.sheetBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.sheetBtn, s.sheetBtnDanger]}
                onPress={() => confirmDelete && doDelete(confirmDelete)}
                testID="history-confirm-delete-yes"
              >
                <Text style={s.sheetBtnDangerText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  rowSubtitle: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 1, fontWeight: "600" },
  rowDate: { color: "rgba(255,215,0,0.7)", fontSize: 11, marginTop: 2, fontWeight: "700" },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  metaText: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700" },
  menuBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F0F12", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderTopWidth: 1, borderColor: "rgba(255,215,0,0.2)", paddingBottom: Platform.OS === "web" ? 34 : 24 },
  handle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 12 },
  sheetTitle: { color: "#fff", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  sheetSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginBottom: 14 },
  sheetAction: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  sheetActionText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sheetCancel: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
  sheetCancelText: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" },
  input: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 12 : 8, color: "#fff", fontSize: 14, marginBottom: 14 },
  sheetActions: { flexDirection: "row", gap: 8 },
  sheetBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12 },
  sheetBtnGhost: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  sheetBtnGhostText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  sheetBtnPrimary: { backgroundColor: "#FFD700" },
  sheetBtnPrimaryText: { color: "#000", fontSize: 13, fontWeight: "900" },
  sheetBtnDanger: { backgroundColor: "#ff4d4d" },
  sheetBtnDangerText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  toast: { position: "absolute", left: 16, right: 16, bottom: 24, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(20,20,24,0.96)", borderWidth: 1, borderColor: "rgba(255,77,77,0.5)" },
  toastText: { flex: 1, color: "#fff", fontSize: 13, fontWeight: "700" },
  undoToast: { position: "absolute", left: 16, right: 16, bottom: 24 + (Platform.OS === "web" ? 34 : 0), flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14, paddingRight: 6, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(20,20,24,0.98)", borderWidth: 1, borderColor: "rgba(255,215,0,0.45)" },
  undoBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(255,215,0,0.14)", borderWidth: 1, borderColor: "rgba(255,215,0,0.55)" },
  undoBtnText: { color: "#FFD700", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  undoClose: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14 },
});
