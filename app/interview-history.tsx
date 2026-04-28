import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, Image, Platform, Modal, TextInput, Alert, ScrollView,
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
  userLieCount?: number;
  messageCount: number;
  startedAt: number;
  endedAt: number;
  title?: string | null;
  tags?: string[];
};

type DeletedHistoryItem = HistoryItem & { deletedAt: number };

const RESTORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function formatRemaining(deletedAt: number): string {
  const expiresAt = deletedAt + RESTORE_WINDOW_MS;
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return "removing soon";
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  if (remaining >= dayMs) {
    const days = Math.round(remaining / dayMs);
    return `${days} day${days === 1 ? "" : "s"} left`;
  }
  if (remaining >= hourMs) {
    const hours = Math.max(1, Math.round(remaining / hourMs));
    return `${hours} hour${hours === 1 ? "" : "s"} left`;
  }
  const minutes = Math.max(1, Math.round(remaining / (60 * 1000)));
  return `${minutes} min left`;
}

const MAX_TAGS_PER_INTERVIEW = 8;
const MAX_TAG_LENGTH = 24;

function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
}

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
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagsItem, setTagsItem] = useState<HistoryItem | null>(null);
  const [tagsDraft, setTagsDraft] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedItems, setDeletedItems] = useState<DeletedHistoryItem[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedRefreshing, setDeletedRefreshing] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<DeletedHistoryItem | null>(null);
  const longPressedRef = React.useRef(false);

  const allTags = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const it of items) {
      const tags = Array.isArray(it.tags) ? it.tags : [];
      for (const t of tags) {
        if (typeof t !== "string") continue;
        const cleaned = normalizeTag(t);
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        const existing = counts.get(key);
        if (existing) existing.count += 1;
        else counts.set(key, { label: cleaned, count: 1 });
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!selectedTag) return items;
    const key = selectedTag.toLowerCase();
    return items.filter((it) =>
      Array.isArray(it.tags) && it.tags.some((t) => typeof t === "string" && t.toLowerCase() === key),
    );
  }, [items, selectedTag]);

  useEffect(() => {
    if (selectedTag && !allTags.some((t) => t.label.toLowerCase() === selectedTag.toLowerCase())) {
      setSelectedTag(null);
    }
  }, [allTags, selectedTag]);

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

  const startEditTags = (it: HistoryItem) => {
    setActionItem(null);
    const initial = Array.isArray(it.tags)
      ? it.tags.map(normalizeTag).filter((t) => t.length > 0)
      : [];
    setTagsDraft(initial);
    setTagInput("");
    setTagsItem(it);
  };

  const addDraftTag = (raw: string) => {
    const cleaned = normalizeTag(raw);
    if (!cleaned) return;
    setTagsDraft((prev) => {
      if (prev.length >= MAX_TAGS_PER_INTERVIEW) return prev;
      const key = cleaned.toLowerCase();
      if (prev.some((t) => t.toLowerCase() === key)) return prev;
      return [...prev, cleaned];
    });
    setTagInput("");
  };

  const removeDraftTag = (tag: string) => {
    const key = tag.toLowerCase();
    setTagsDraft((prev) => prev.filter((t) => t.toLowerCase() !== key));
  };

  const submitTags = async () => {
    if (!tagsItem || !deviceId) return;
    setSavingTags(true);
    let nextTags = [...tagsDraft];
    const pending = normalizeTag(tagInput);
    if (pending && nextTags.length < MAX_TAGS_PER_INTERVIEW) {
      const key = pending.toLowerCase();
      if (!nextTags.some((t) => t.toLowerCase() === key)) {
        nextTags.push(pending);
      }
    }
    try {
      const res = await fetch(new URL(`/api/arena/interview-history/${tagsItem.id}`, getApiUrl()).toString(), {
        method: "PATCH",
        headers: { "x-device-id": deviceId, "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (res.ok) {
        let savedTags: string[] = nextTags;
        try {
          const j = await res.json();
          if (Array.isArray(j?.tags)) savedTags = j.tags;
        } catch {}
        const targetId = tagsItem.id;
        setItems((prev) => prev.map((x) => x.id === targetId ? { ...x, tags: savedTags } : x));
        setTagsItem(null);
        setTagInput("");
      } else {
        setErrorMsg("Couldn't update tags. Please try again.");
      }
    } catch {
      setErrorMsg("Couldn't update tags. Please try again.");
    } finally {
      setSavingTags(false);
    }
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

  const loadDeleted = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (!deviceId) return;
    if (mode === "initial") setDeletedLoading(true);
    else setDeletedRefreshing(true);
    try {
      const res = await fetch(new URL("/api/arena/interview-history/deleted", getApiUrl()).toString(), {
        headers: { "x-device-id": deviceId },
      });
      if (res.ok) {
        const data = await res.json();
        setDeletedItems(Array.isArray(data.items) ? data.items : []);
      } else {
        setErrorMsg("Couldn't load recently deleted interviews.");
      }
    } catch {
      setErrorMsg("Couldn't load recently deleted interviews.");
    } finally {
      setDeletedLoading(false);
      setDeletedRefreshing(false);
    }
  }, [deviceId]);

  const openDeletedSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setShowDeleted(true);
    loadDeleted("initial");
  }, [loadDeleted]);

  const restoreFromTrash = async (it: DeletedHistoryItem) => {
    if (!deviceId || restoringId) return;
    setRestoringId(it.id);
    try {
      const res = await fetch(new URL(`/api/arena/interview-history/${it.id}/restore`, getApiUrl()).toString(), {
        method: "POST",
        headers: { "x-device-id": deviceId },
      });
      if (res.ok) {
        setDeletedItems((prev) => prev.filter((x) => x.id !== it.id));
        setItems((prev) => {
          if (prev.some((x) => x.id === it.id)) return prev;
          const { deletedAt: _ignored, ...restored } = it;
          const next = [...prev, restored];
          next.sort((a, b) => b.endedAt - a.endedAt);
          return next;
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        setErrorMsg("Couldn't restore interview. Please try again.");
      }
    } catch {
      setErrorMsg("Couldn't restore interview. Please try again.");
    } finally {
      setRestoringId(null);
    }
  };

  const purgeFromTrash = async (it: DeletedHistoryItem) => {
    if (!deviceId || purgingId) return;
    setPurgingId(it.id);
    try {
      const res = await fetch(new URL(`/api/arena/interview-history/${it.id}/permanent`, getApiUrl()).toString(), {
        method: "DELETE",
        headers: { "x-device-id": deviceId },
      });
      if (res.ok) {
        setDeletedItems((prev) => prev.filter((x) => x.id !== it.id));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        setErrorMsg("Couldn't delete interview. Please try again.");
      }
    } catch {
      setErrorMsg("Couldn't delete interview. Please try again.");
    } finally {
      setPurgingId(null);
      setConfirmPurge(null);
    }
  };

  const startPurge = (it: DeletedHistoryItem) => {
    if (Platform.OS === "web") {
      setConfirmPurge(it);
    } else {
      Alert.alert(
        "Delete forever?",
        `"${it.title || defaultTitle(it)}" will be removed immediately and can't be restored.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete forever", style: "destructive", onPress: () => purgeFromTrash(it) },
        ],
      );
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
          <Text style={s.headerSub}>
            {selectedTag
              ? `${filteredItems.length} of ${items.length} · #${selectedTag}`
              : `${items.length} saved · re-read the show`}
          </Text>
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

      <View style={s.deletedPillRow}>
        <Pressable
          onPress={openDeletedSheet}
          style={s.deletedPill}
          testID="open-recently-deleted"
          accessibilityLabel="View recently deleted interviews"
        >
          <Ionicons name="trash-bin-outline" size={13} color="rgba(255,215,0,0.85)" />
          <Text style={s.deletedPillText}>Recently deleted</Text>
          <Ionicons name="chevron-forward" size={13} color="rgba(255,215,0,0.6)" />
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
          data={filteredItems}
          ListHeaderComponent={
            allTags.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.filterRow}
                style={s.filterRowOuter}
                testID="history-filter-row"
              >
                <Pressable
                  onPress={() => setSelectedTag(null)}
                  style={[s.filterPill, !selectedTag && s.filterPillActive]}
                  testID="history-filter-all"
                >
                  <Text style={[s.filterPillText, !selectedTag && s.filterPillTextActive]}>
                    All · {items.length}
                  </Text>
                </Pressable>
                {allTags.map((t) => {
                  const active = !!selectedTag && selectedTag.toLowerCase() === t.label.toLowerCase();
                  return (
                    <Pressable
                      key={t.label.toLowerCase()}
                      onPress={() => setSelectedTag(active ? null : t.label)}
                      style={[s.filterPill, active && s.filterPillActive]}
                      testID={`history-filter-tag-${t.label.toLowerCase()}`}
                    >
                      <Text style={[s.filterPillText, active && s.filterPillTextActive]}>
                        #{t.label} · {t.count}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null
          }
          ListEmptyComponent={
            selectedTag ? (
              <View style={s.filterEmpty}>
                <Text style={s.filterEmptyTitle}>No interviews tagged #{selectedTag}</Text>
                <Pressable onPress={() => setSelectedTag(null)} style={s.filterEmptyBtn}>
                  <Text style={s.filterEmptyBtnText}>Clear filter</Text>
                </Pressable>
              </View>
            ) : null
          }
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
                    {(item.userLieCount ?? 0) > 0 ? (
                      <View
                        style={[s.metaPill, s.viewerPill]}
                        testID={`history-viewer-reports-${item.id}`}
                        accessibilityLabel={`${item.userLieCount} viewer report${item.userLieCount === 1 ? "" : "s"}`}
                      >
                        <Ionicons name="flag" size={11} color="#60a5fa" />
                        <Text style={[s.metaText, s.viewerPillText]}>
                          {item.userLieCount} viewer report{item.userLieCount === 1 ? "" : "s"}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {Array.isArray(item.tags) && item.tags.length > 0 ? (
                    <View style={s.tagsRow}>
                      {item.tags.slice(0, 4).map((t) => {
                        const active = !!selectedTag && selectedTag.toLowerCase() === t.toLowerCase();
                        return (
                          <View key={t.toLowerCase()} style={[s.rowTagChip, active && s.rowTagChipActive]}>
                            <Text style={[s.rowTagChipText, active && s.rowTagChipTextActive]}>#{t}</Text>
                          </View>
                        );
                      })}
                      {item.tags.length > 4 ? (
                        <Text style={s.rowTagsMore}>+{item.tags.length - 4}</Text>
                      ) : null}
                    </View>
                  ) : null}
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
              onPress={() => actionItem && startEditTags(actionItem)}
              testID="history-action-tags"
            >
              <Ionicons name="pricetags-outline" size={20} color="#FFD700" />
              <Text style={s.sheetActionText}>
                {actionItem && Array.isArray(actionItem.tags) && actionItem.tags.length > 0
                  ? `Edit tags (${actionItem.tags.length})`
                  : "Add tags"}
              </Text>
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

      <Modal visible={!!tagsItem} transparent animationType="fade" onRequestClose={() => setTagsItem(null)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTagsItem(null)} />
          <View style={s.sheet} testID="history-tags-sheet">
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Tag this interview</Text>
            <Text style={s.sheetSub}>
              Add up to {MAX_TAGS_PER_INTERVIEW} short tags (e.g. favorites, for the show, spicy).
            </Text>

            {tagsDraft.length > 0 ? (
              <View style={s.draftTagsRow}>
                {tagsDraft.map((t) => (
                  <Pressable
                    key={t.toLowerCase()}
                    onPress={() => removeDraftTag(t)}
                    style={s.draftTagChip}
                    testID={`history-tag-draft-${t.toLowerCase()}`}
                  >
                    <Text style={s.draftTagChipText}>#{t}</Text>
                    <Ionicons name="close" size={12} color="#000" />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={s.tagsHint}>No tags yet — type one below or pick from your set.</Text>
            )}

            <View style={s.tagInputRow}>
              <TextInput
                value={tagInput}
                onChangeText={(v) => setTagInput(v.slice(0, MAX_TAG_LENGTH))}
                placeholder="New tag"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                maxLength={MAX_TAG_LENGTH}
                onSubmitEditing={() => addDraftTag(tagInput)}
                returnKeyType="done"
                blurOnSubmit={false}
                editable={tagsDraft.length < MAX_TAGS_PER_INTERVIEW}
                testID="history-tags-input"
              />
              <Pressable
                onPress={() => addDraftTag(tagInput)}
                disabled={!normalizeTag(tagInput) || tagsDraft.length >= MAX_TAGS_PER_INTERVIEW}
                style={[
                  s.tagAddBtn,
                  (!normalizeTag(tagInput) || tagsDraft.length >= MAX_TAGS_PER_INTERVIEW) && { opacity: 0.4 },
                ]}
                testID="history-tags-add"
              >
                <Ionicons name="add" size={20} color="#000" />
              </Pressable>
            </View>

            {allTags.length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={s.tagsSectionLabel}>Your tags</Text>
                <View style={s.suggestionRow}>
                  {allTags.map((t) => {
                    const inDraft = tagsDraft.some((d) => d.toLowerCase() === t.label.toLowerCase());
                    return (
                      <Pressable
                        key={t.label.toLowerCase()}
                        onPress={() => {
                          if (inDraft) removeDraftTag(t.label);
                          else addDraftTag(t.label);
                        }}
                        style={[s.suggestionChip, inDraft && s.suggestionChipActive]}
                        testID={`history-tag-suggest-${t.label.toLowerCase()}`}
                      >
                        <Text style={[s.suggestionChipText, inDraft && s.suggestionChipTextActive]}>
                          #{t.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={[s.sheetActions, { marginTop: 18 }]}>
              <Pressable style={[s.sheetBtn, s.sheetBtnGhost]} onPress={() => setTagsItem(null)}>
                <Text style={s.sheetBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.sheetBtn, s.sheetBtnPrimary]}
                onPress={submitTags}
                disabled={savingTags}
                testID="history-tags-save"
              >
                {savingTags ? (
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

      <Modal
        visible={showDeleted}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeleted(false)}
      >
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDeleted(false)} />
          <View style={s.deletedSheet} testID="recently-deleted-sheet">
            <View style={s.handle} />
            <View style={s.deletedHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitle}>Recently deleted</Text>
                <Text style={s.sheetSub}>
                  Interviews you removed in the last 7 days. Restore one or remove it for good.
                </Text>
              </View>
              <Pressable
                onPress={() => loadDeleted("refresh")}
                hitSlop={10}
                style={s.iconBtnSmall}
                testID="recently-deleted-refresh"
                accessibilityLabel="Refresh recently deleted"
              >
                {deletedRefreshing ? (
                  <ActivityIndicator color="#FFD700" size="small" />
                ) : (
                  <Ionicons name="refresh" size={16} color="#FFD700" />
                )}
              </Pressable>
            </View>

            {deletedLoading ? (
              <View style={s.deletedEmpty}>
                <ActivityIndicator color="#FFD700" />
              </View>
            ) : deletedItems.length === 0 ? (
              <View style={s.deletedEmpty}>
                <Ionicons name="trash-outline" size={36} color="rgba(255,215,0,0.4)" />
                <Text style={s.deletedEmptyTitle}>Nothing recently deleted</Text>
                <Text style={s.deletedEmptySub}>
                  Interviews you delete will appear here for 7 days, then be removed for good.
                </Text>
              </View>
            ) : (
              <FlatList
                data={deletedItems}
                keyExtractor={(it) => it.id}
                style={s.deletedList}
                contentContainerStyle={{ paddingBottom: 8 }}
                refreshControl={
                  <RefreshControl
                    refreshing={deletedRefreshing}
                    onRefresh={() => loadDeleted("refresh")}
                    tintColor="#FFD700"
                  />
                }
                renderItem={({ item }) => {
                  const ip = PERSONA_PORTRAITS[item.interviewerId];
                  const ep = PERSONA_PORTRAITS[item.intervieweeId];
                  const displayTitle = item.title || defaultTitle(item);
                  const isRestoring = restoringId === item.id;
                  const isPurging = purgingId === item.id;
                  const busy = isRestoring || isPurging;
                  return (
                    <View
                      style={[s.deletedRow, busy && { opacity: 0.6 }]}
                      testID={`deleted-row-${item.id}`}
                    >
                      <View style={s.portraits}>
                        {ip ? <Image source={ip} style={s.portrait} /> : <View style={[s.portrait, s.portraitFallback]}><Ionicons name="person" size={18} color="#666" /></View>}
                        {ep ? <Image source={ep} style={[s.portrait, s.portraitOverlap]} /> : <View style={[s.portrait, s.portraitOverlap, s.portraitFallback]}><Ionicons name="person" size={18} color="#666" /></View>}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.rowTitle} numberOfLines={1}>{displayTitle}</Text>
                        <Text style={s.rowDate} numberOfLines={1}>
                          Deleted {formatDate(item.deletedAt)}
                        </Text>
                        <View style={s.deletedMetaRow}>
                          <View style={s.remainingPill}>
                            <Ionicons name="hourglass-outline" size={11} color="#FFD700" />
                            <Text style={s.remainingText}>{formatRemaining(item.deletedAt)}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={s.deletedActions}>
                        <Pressable
                          onPress={() => restoreFromTrash(item)}
                          disabled={busy}
                          style={s.restoreBtn}
                          testID={`deleted-restore-${item.id}`}
                          accessibilityLabel={`Restore ${displayTitle}`}
                        >
                          {isRestoring ? (
                            <ActivityIndicator color="#000" size="small" />
                          ) : (
                            <>
                              <Ionicons name="arrow-undo" size={14} color="#000" />
                              <Text style={s.restoreBtnText}>Restore</Text>
                            </>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => startPurge(item)}
                          disabled={busy}
                          hitSlop={6}
                          style={s.purgeBtn}
                          testID={`deleted-purge-${item.id}`}
                          accessibilityLabel={`Delete ${displayTitle} forever`}
                        >
                          {isPurging ? (
                            <ActivityIndicator color="#ff4d4d" size="small" />
                          ) : (
                            <Ionicons name="trash" size={16} color="#ff4d4d" />
                          )}
                        </Pressable>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            <Pressable
              style={s.sheetCancel}
              onPress={() => setShowDeleted(false)}
              testID="recently-deleted-close"
            >
              <Text style={s.sheetCancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!confirmPurge} transparent animationType="fade" onRequestClose={() => setConfirmPurge(null)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirmPurge(null)} />
          <View style={s.sheet} testID="recently-deleted-confirm-purge">
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Delete forever?</Text>
            <Text style={s.sheetSub}>
              "{confirmPurge ? (confirmPurge.title || defaultTitle(confirmPurge)) : ""}" will be removed immediately and can't be restored.
            </Text>
            <View style={s.sheetActions}>
              <Pressable
                style={[s.sheetBtn, s.sheetBtnGhost]}
                onPress={() => setConfirmPurge(null)}
              >
                <Text style={s.sheetBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.sheetBtn, s.sheetBtnDanger]}
                onPress={() => confirmPurge && purgeFromTrash(confirmPurge)}
                testID="recently-deleted-confirm-purge-yes"
              >
                <Text style={s.sheetBtnDangerText}>Delete forever</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
  viewerPill: { backgroundColor: "rgba(96,165,250,0.12)", borderColor: "rgba(96,165,250,0.4)" },
  viewerPillText: { color: "#60a5fa" },
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

  filterRowOuter: { marginBottom: 8 },
  filterRow: { flexDirection: "row", gap: 6, paddingVertical: 2, paddingRight: 4 },
  filterPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  filterPillActive: { backgroundColor: "rgba(255,215,0,0.18)", borderColor: "rgba(255,215,0,0.7)" },
  filterPillText: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  filterPillTextActive: { color: "#FFD700" },
  filterEmpty: { alignItems: "center", paddingVertical: 28, gap: 10 },
  filterEmptyTitle: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700" },
  filterEmptyBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: "rgba(255,215,0,0.16)", borderWidth: 1, borderColor: "rgba(255,215,0,0.5)" },
  filterEmptyBtnText: { color: "#FFD700", fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6, alignItems: "center" },
  rowTagChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: "rgba(255,215,0,0.08)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  rowTagChipActive: { backgroundColor: "rgba(255,215,0,0.24)", borderColor: "rgba(255,215,0,0.75)" },
  rowTagChipText: { color: "rgba(255,215,0,0.85)", fontSize: 10, fontWeight: "800" },
  rowTagChipTextActive: { color: "#FFD700" },
  rowTagsMore: { color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: "700", marginLeft: 2 },

  draftTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  draftTagChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "#FFD700" },
  draftTagChipText: { color: "#000", fontSize: 12, fontWeight: "900" },
  tagsHint: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 12, fontWeight: "600" },
  tagInputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  tagAddBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center" },
  tagsSectionLabel: { color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestionChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  suggestionChipActive: { backgroundColor: "rgba(255,215,0,0.18)", borderColor: "rgba(255,215,0,0.7)" },
  suggestionChipText: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" },
  suggestionChipTextActive: { color: "#FFD700", fontWeight: "900" },

  deletedPillRow: { flexDirection: "row", paddingHorizontal: 14, marginTop: 8, marginBottom: 8, zIndex: 5 },
  deletedPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: "rgba(255,215,0,0.18)", borderWidth: 1, borderColor: "rgba(255,215,0,0.5)" },
  deletedPillText: { color: "#FFD700", fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },

  deletedSheet: { backgroundColor: "#0F0F12", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 12, paddingBottom: Platform.OS === "web" ? 34 : 24, borderTopWidth: 1, borderColor: "rgba(255,215,0,0.2)", maxHeight: "85%" },
  deletedHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 6 },
  iconBtnSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.25)" },
  deletedList: { marginTop: 6 },
  deletedRow: { flexDirection: "row", alignItems: "center", padding: 10, marginBottom: 8, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", gap: 10 },
  deletedMetaRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  remainingPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: "rgba(255,215,0,0.1)", borderWidth: 1, borderColor: "rgba(255,215,0,0.35)" },
  remainingText: { color: "#FFD700", fontSize: 10, fontWeight: "800" },
  deletedActions: { alignItems: "flex-end", gap: 6 },
  restoreBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "#FFD700", minWidth: 84, justifyContent: "center" },
  restoreBtnText: { color: "#000", fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  purgeBtn: { width: 32, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,77,77,0.1)", borderWidth: 1, borderColor: "rgba(255,77,77,0.35)" },
  deletedEmpty: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 36, gap: 8 },
  deletedEmptyTitle: { color: "#fff", fontSize: 14, fontWeight: "800", marginTop: 4 },
  deletedEmptySub: { color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center" },
});
