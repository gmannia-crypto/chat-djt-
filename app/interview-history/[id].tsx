import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator,
  Image, Platform, Modal, ScrollView, Share, TextInput,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";
import { getRecordings } from "@/lib/arena-recordings";
import { buildSmartTagSuggestions } from "@/lib/smart-tags";
import TagEditorModal, {
  MAX_TAGS_PER_INTERVIEW,
  normalizeTag,
} from "@/components/TagEditorModal";

const SHARE_URL = "https://thearena.rip";

type Msg = { id: string; speakerId: string; speakerName: string; text: string; ts: number; isInterruption?: boolean; isCallIn?: boolean; callerName?: string; isPartingShot?: boolean };
type LieEntry = { id: string; speakerId: string; speakerName: string; text: string; score: number; reason: string; fact: string; ts: number; userFlagged?: boolean };

type Detail = {
  id: string;
  interviewerId: string;
  interviewerName: string;
  intervieweeId: string;
  intervieweeName: string;
  durationMinutes: number;
  lieCount: number;
  messageCount: number;
  messages: Msg[];
  lies: LieEntry[];
  topics: { id: string; title: string; description: string; era: string }[];
  startedAt: number;
  endedAt: number;
  title?: string | null;
  tags?: string[];
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
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function InterviewTranscriptScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { deviceId } = useTokens();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liesOpen, setLiesOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState<Msg | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Record<string, string>>({});
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [bookmarkJustAdded, setBookmarkJustAdded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [allUserTags, setAllUserTags] = useState<{ label: string; count: number }[]>([]);
  const [replayId, setReplayId] = useState<string | null>(null);

  const tags = useMemo(() => {
    if (!data || !Array.isArray(data.tags)) return [] as string[];
    return data.tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => normalizeTag(t))
      .filter((t) => t.length > 0);
  }, [data]);

  const smartSuggestions = useMemo(() => {
    if (!data) return [] as string[];
    return buildSmartTagSuggestions(
      {
        interviewerId: data.interviewerId,
        intervieweeId: data.intervieweeId,
        interviewerName: data.interviewerName,
        intervieweeName: data.intervieweeName,
        lieCount: data.lieCount,
        userLieCount: (data.lies || []).reduce((n, l) => n + (l.userFlagged ? 1 : 0), 0),
        messageCount: data.messageCount,
        durationMinutes: data.durationMinutes,
        topics: data.topics,
      },
      tags,
      5,
    );
  }, [data, tags]);

  const defaultTitle = data ? `${data.interviewerName} × ${data.intervieweeName}` : "TRANSCRIPT";
  const displayTitle = (data?.title && data.title.trim().length > 0) ? data.title : defaultTitle;

  const openRename = () => {
    setRenameValue(data?.title || "");
    setRenameError(null);
    setRenameOpen(true);
  };

  const fetchAllUserTags = async () => {
    if (!deviceId) return;
    try {
      const res = await fetch(new URL("/api/arena/interview-history", getApiUrl()).toString(), {
        headers: { "x-device-id": deviceId },
      });
      if (!res.ok) return;
      const json = await res.json();
      const items: Array<{ id?: string; tags?: unknown }> = Array.isArray(json?.items) ? json.items : [];
      const counts = new Map<string, { label: string; count: number }>();
      for (const it of items) {
        if (it?.id === data?.id) continue;
        const list = Array.isArray(it.tags) ? it.tags : [];
        for (const t of list) {
          if (typeof t !== "string") continue;
          const cleaned = normalizeTag(t);
          if (!cleaned) continue;
          const key = cleaned.toLowerCase();
          const existing = counts.get(key);
          if (existing) existing.count += 1;
          else counts.set(key, { label: cleaned, count: 1 });
        }
      }
      setAllUserTags(
        Array.from(counts.values()).sort(
          (a, b) => b.count - a.count || a.label.localeCompare(b.label),
        ),
      );
    } catch {}
  };

  const openTagEditor = () => {
    setMenuOpen(false);
    setTagEditorOpen(true);
    fetchAllUserTags();
  };

  const handleEditorAddSmartTag = async (
    _label: string,
    nextDraft: string[],
  ): Promise<{ ok: true; tags?: string[] } | { ok: false; error?: string }> => {
    if (!data || !deviceId) return { ok: false, error: "Couldn't add tag. Please try again." };
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const res = await fetch(new URL(`/api/arena/interview-history/${data.id}`, getApiUrl()).toString(), {
        method: "PATCH",
        headers: { "x-device-id": deviceId, "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextDraft }),
      });
      if (!res.ok) return { ok: false, error: "Couldn't add tag. Please try again." };
      let savedTags: string[] = nextDraft;
      try {
        const j = await res.json();
        if (Array.isArray(j?.tags)) savedTags = j.tags;
      } catch {}
      setData((prev) => (prev ? { ...prev, tags: savedTags } : prev));
      return { ok: true, tags: savedTags };
    } catch {
      return { ok: false, error: "Couldn't add tag. Please try again." };
    }
  };

  const handleEditorSave = async (
    nextTags: string[],
  ): Promise<{ ok: true; tags?: string[] } | { ok: false; error?: string }> => {
    if (!data || !deviceId) return { ok: false };
    try {
      const res = await fetch(new URL(`/api/arena/interview-history/${data.id}`, getApiUrl()).toString(), {
        method: "PATCH",
        headers: { "x-device-id": deviceId, "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (!res.ok) {
        return { ok: false, error: "Couldn't save tags. Please try again." };
      }
      let savedTags: string[] = nextTags;
      try {
        const j = await res.json();
        if (Array.isArray(j?.tags)) savedTags = j.tags;
      } catch {}
      setData((prev) => (prev ? { ...prev, tags: savedTags } : prev));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTagEditorOpen(false);
      return { ok: true, tags: savedTags };
    } catch {
      return { ok: false, error: "Couldn't save tags. Please try again." };
    }
  };

  const submitRename = async () => {
    if (!data || !deviceId) return;
    setRenameError(null);
    setSavingRename(true);
    const trimmed = renameValue.trim().slice(0, 80);
    const newTitle = trimmed.length === 0 ? null : trimmed;
    try {
      const res = await fetch(new URL(`/api/arena/interview-history/${data.id}`, getApiUrl()).toString(), {
        method: "PATCH",
        headers: { "x-device-id": deviceId, "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setData((prev) => prev ? { ...prev, title: newTitle } : prev);
        setRenameOpen(false);
      } else {
        setRenameError("Couldn't save title. Please try again.");
      }
    } catch {
      setRenameError("Couldn't save title. Please try again.");
    } finally {
      setSavingRename(false);
    }
  };

  const buildShareText = (m: Msg) => {
    if (!data) return m.text;
    const speaker = m.isCallIn ? `${m.speakerName} (caller)` : m.speakerName;
    return `"${m.text}"\n— ${speaker}\n\nFrom ${data.interviewerName} × ${data.intervieweeName} on The Arena\n${SHARE_URL}`;
  };

  const handleCopyMsg = async (m: Msg) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await Clipboard.setStringAsync(buildShareText(m));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  const buildImageUrl = (m: Msg) => {
    if (!data) return "";
    return new URL(`/api/arena/interview-clip-image/${data.id}?msgId=${encodeURIComponent(m.id)}`, getApiUrl()).toString();
  };

  const handleShareImage = async (m: Msg) => {
    if (!data || !deviceId) return;
    setImageError(null);
    setGeneratingImage(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const url = buildImageUrl(m);
      if (Platform.OS === "web") {
        const res = await fetch(url, { headers: { "x-device-id": deviceId } });
        if (!res.ok) throw new Error("image fetch failed");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const file = new File([blob], `trumpbot-clip-${data.id}.png`, { type: "image/png" });
        type ShareNavigator = Navigator & {
          share?: (data: { files?: File[]; text?: string; url?: string; title?: string }) => Promise<void>;
          canShare?: (data: { files?: File[] }) => boolean;
        };
        const nav: ShareNavigator | undefined = typeof navigator !== "undefined" ? (navigator as ShareNavigator) : undefined;
        if (nav && typeof nav.canShare === "function" && nav.canShare({ files: [file] }) && typeof nav.share === "function") {
          try {
            await nav.share({ files: [file], text: buildShareText(m), url: SHARE_URL });
            URL.revokeObjectURL(blobUrl);
            setShareMsg(null);
            return;
          } catch {}
        }
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `trumpbot-clip-${data.id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        setShareMsg(null);
        return;
      }

      const target = `${FileSystem.cacheDirectory}trumpbot-clip-${data.id}-${m.id}.png`;
      const dl = await FileSystem.downloadAsync(url, target, { headers: { "x-device-id": deviceId } });
      if (dl.status !== 200) throw new Error("download failed");
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(dl.uri, {
          mimeType: "image/png",
          dialogTitle: "Share interview moment",
          UTI: "public.png",
        });
      } else {
        await Share.share({ url: dl.uri, message: buildShareText(m) });
      }
      setShareMsg(null);
    } catch {
      setImageError("Couldn't build the image. Try the text share.");
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleShareMsg = async (m: Msg) => {
    const text = buildShareText(m);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (Platform.OS === "web") {
        const nav: (Navigator & { share?: (data: { text?: string; url?: string; title?: string }) => Promise<void> }) | undefined =
          typeof navigator !== "undefined" ? navigator : undefined;
        if (nav && typeof nav.share === "function") {
          await nav.share({ text, url: SHARE_URL });
          setShareMsg(null);
          return;
        }
        await Clipboard.setStringAsync(text);
        setCopied(true);
        setTimeout(() => { setCopied(false); setShareMsg(null); }, 1200);
        return;
      }
      await Share.share({ message: text, url: SHARE_URL });
      setShareMsg(null);
    } catch {}
  };

  useEffect(() => {
    if (!deviceId || !id) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          new URL(`/api/arena/interview-bookmarks?interviewId=${encodeURIComponent(String(id))}`, getApiUrl()).toString(),
          { headers: { "x-device-id": deviceId } },
        );
        if (res.ok) {
          const j = await res.json();
          if (!cancel && Array.isArray(j.items)) {
            const m: Record<string, string> = {};
            for (const it of j.items) {
              if (it?.msgId && it?.id) m[String(it.msgId)] = String(it.id);
            }
            setBookmarks(m);
          }
        }
      } catch {}
    })();
    return () => { cancel = true; };
  }, [deviceId, id]);

  const isBookmarked = (m: Msg | null) => !!(m && bookmarks[m.id]);

  const toggleBookmark = async (m: Msg) => {
    if (!data || !deviceId || bookmarkBusy) return;
    setBookmarkError(null);
    const existingId = bookmarks[m.id];
    setBookmarkBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (existingId) {
        const res = await fetch(new URL(`/api/arena/interview-bookmarks/${existingId}`, getApiUrl()).toString(), {
          method: "DELETE",
          headers: { "x-device-id": deviceId },
        });
        if (res.ok || res.status === 404) {
          setBookmarks((prev) => {
            const n = { ...prev };
            delete n[m.id];
            return n;
          });
          setBookmarkJustAdded(false);
        } else {
          setBookmarkError("Couldn't remove bookmark.");
        }
      } else {
        const res = await fetch(new URL(`/api/arena/interview-bookmarks`, getApiUrl()).toString(), {
          method: "POST",
          headers: { "x-device-id": deviceId, "Content-Type": "application/json" },
          body: JSON.stringify({ interviewId: data.id, msgId: m.id }),
        });
        if (res.ok) {
          const j = await res.json();
          const newId = j?.bookmark?.id;
          if (newId) {
            setBookmarks((prev) => ({ ...prev, [m.id]: String(newId) }));
            setBookmarkJustAdded(true);
            setTimeout(() => setBookmarkJustAdded(false), 1600);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        } else {
          setBookmarkError("Couldn't bookmark moment.");
        }
      }
    } catch {
      setBookmarkError("Couldn't update bookmark.");
    } finally {
      setBookmarkBusy(false);
    }
  };

  useEffect(() => {
    if (!deviceId || !id) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(new URL(`/api/arena/interview-history/${id}`, getApiUrl()).toString(), {
          headers: { "x-device-id": deviceId },
        });
        if (!res.ok) {
          if (!cancel) setError(res.status === 404 ? "Transcript not found" : "Failed to load");
          return;
        }
        const d = await res.json();
        if (!cancel) setData(d);
        // After loading the interview, look for a matching local recording
        if (!cancel && d) {
          try {
            const recs = await getRecordings();
            // Primary match: recording startTime exactly matches interview startedAt
            let match = recs.find((r) => r.startTime === d.startedAt);
            if (!match) {
              // Secondary match: both personas present and start time within 5 seconds
              const pA = d.interviewerId;
              const pB = d.intervieweeId;
              match = recs.find((r) =>
                r.personas.includes(pA) &&
                r.personas.includes(pB) &&
                Math.abs(r.startTime - d.startedAt) < 5000,
              );
            }
            if (!cancel && match) setReplayId(match.id);
          } catch { /* best-effort */ }
        }
      } catch {
        if (!cancel) setError("Failed to load");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [deviceId, id]);

  const interviewerPortrait = data ? PERSONA_PORTRAITS[data.interviewerId] : null;
  const intervieweePortrait = data ? PERSONA_PORTRAITS[data.intervieweeId] : null;

  const lies = data?.lies || [];
  const userLieCount = lies.reduce((n, l) => n + (l.userFlagged ? 1 : 0), 0);
  const aiLieCount = lies.length - userLieCount;

  const partingShot = useMemo(() => {
    if (!data) return null;
    return data.messages.find((m) => m.isPartingShot) ?? null;
  }, [data]);

  const renderHeader = useMemo(() => {
    if (!data) return null;
    return (
      <View style={s.summary}>
        <View style={s.summaryRow}>
          <View style={s.portraitWrap}>
            {interviewerPortrait ? (
              <Image source={interviewerPortrait} style={s.portrait} />
            ) : (
              <View style={[s.portrait, s.portraitFallback]}><Ionicons name="person" size={24} color="#666" /></View>
            )}
            <Text style={[s.role, { color: "#FFD700" }]}>INTERVIEWER</Text>
            <Text style={s.name} numberOfLines={1}>{data.interviewerName}</Text>
          </View>
          <Text style={s.vs}>×</Text>
          <View style={s.portraitWrap}>
            {intervieweePortrait ? (
              <Image source={intervieweePortrait} style={s.portrait} />
            ) : (
              <View style={[s.portrait, s.portraitFallback]}><Ionicons name="person" size={24} color="#666" /></View>
            )}
            <Text style={[s.role, { color: "#4ADE80" }]}>GUEST</Text>
            <Text style={s.name} numberOfLines={1}>{data.intervieweeName}</Text>
          </View>
        </View>
        <Text style={s.summaryDate}>{formatDate(data.endedAt)}</Text>
        <View style={s.statsRow}>
          <View style={s.statPill}>
            <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={s.statText}>{data.durationMinutes} min</Text>
          </View>
          <View style={s.statPill}>
            <Ionicons name="chatbubbles-outline" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={s.statText}>{data.messageCount} messages</Text>
          </View>
          <Pressable
            onPress={() => setLiesOpen(true)}
            style={[s.statPill, lies.length > 0 && { backgroundColor: "rgba(255,77,77,0.12)", borderColor: "rgba(255,77,77,0.5)" }]}
            testID="open-lies-sheet"
          >
            <Ionicons name="flash" size={12} color={lies.length > 0 ? "#ff4d4d" : "rgba(255,255,255,0.7)"} />
            <Text style={[s.statText, lies.length > 0 && { color: "#ff4d4d" }]}>{lies.length} lies</Text>
          </Pressable>
        </View>

        {tags.length > 0 ? (
          <View style={s.tagsBlock} testID="transcript-tags-block">
            <View style={s.tagsLine}>
              {tags.map((t) => (
                <View
                  key={`tag-${t.toLowerCase()}`}
                  style={s.tagChip}
                  testID={`transcript-tag-${t.toLowerCase()}`}
                >
                  <Text style={s.tagChipText}>#{t}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {partingShot ? (
          <View style={s.partingShotBanner} testID="transcript-parting-shot">
            <Text style={s.partingShotLabel}>🔥 PARTING SHOT · {partingShot.speakerName}</Text>
            <Text style={s.partingShotText}>"{partingShot.text}"</Text>
          </View>
        ) : null}

        {replayId ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              router.push(`/arena-replay?id=${replayId}`);
            }}
            style={s.replayBtn}
            testID="transcript-watch-replay"
          >
            <Ionicons name="play-circle" size={18} color="#000" />
            <Text style={s.replayBtnText}>WATCH REPLAY</Text>
          </Pressable>
        ) : null}

        <Text style={s.transcriptLabel}>TRANSCRIPT</Text>
      </View>
    );
  }, [data, interviewerPortrait, intervieweePortrait, lies.length, tags, partingShot, replayId]);

  return (
    <View style={[s.container, { paddingTop: insets.top + webTop }]}>
      <LinearGradient colors={["rgba(255,215,0,0.10)", "rgba(0,0,0,0)", "#0a0a0a"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.iconBtn} testID="transcript-back">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{displayTitle}</Text>
          <Text style={s.headerSub} numberOfLines={1}>
            {data?.title ? defaultTitle : "Read-only replay"}
          </Text>
        </View>
        {data ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setMenuOpen(true);
            }}
            style={s.iconBtn}
            testID="transcript-menu"
            accessibilityLabel="More actions"
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#FFD700" />
          </Pressable>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      {loading ? (
        <View style={s.empty}><ActivityIndicator color="#FFD700" /></View>
      ) : error || !data ? (
        <View style={s.empty}>
          <Ionicons name="alert-circle-outline" size={42} color="rgba(255,77,77,0.7)" />
          <Text style={s.errorText}>{error || "Transcript unavailable"}</Text>
          <Pressable onPress={() => router.back()} style={s.emptyBtn}>
            <Text style={s.emptyBtnText}>GO BACK</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data.messages}
          keyExtractor={(m, i) => `${m.id || i}-${i}`}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + webBottom + 24 }}
          renderItem={({ item }) => {
            const isInterviewer = item.speakerId === data.interviewerId;
            const isCallIn = !!item.isCallIn;
            const isPartingShot = !!item.isPartingShot;
            if (isPartingShot) {
              return (
                <View style={[s.bubbleRow, { justifyContent: "center" }]}>
                  <Pressable
                    onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setCopied(false); setShareMsg(item); }}
                    onPress={() => { setCopied(false); setShareMsg(item); }}
                    delayLongPress={300}
                    testID={`bubble-${item.id}`}
                    style={s.bubblePartingShot}
                  >
                    <Text style={s.bubblePartingShotName}>🔥 {item.speakerName} · PARTING SHOT</Text>
                    <Text style={[s.bubbleText, { fontStyle: "italic", textAlign: "center" }]}>{item.text}</Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <View style={[s.bubbleRow, isCallIn ? { justifyContent: "center" } : isInterviewer ? { justifyContent: "flex-start" } : { justifyContent: "flex-end" }]}>
                <Pressable
                  onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setCopied(false); setShareMsg(item); }}
                  onPress={() => { setCopied(false); setShareMsg(item); }}
                  delayLongPress={300}
                  testID={`bubble-${item.id}`}
                  style={[
                    s.bubble,
                    isCallIn ? s.bubbleCallIn : isInterviewer ? s.bubbleInterviewer : s.bubbleInterviewee,
                    item.isInterruption && s.bubbleInterrupt,
                  ]}
                >
                  <Text style={[s.bubbleName, { color: isCallIn ? "#60a5fa" : isInterviewer ? "#FFD700" : "#4ADE80" }]}>
                    {item.speakerName}{item.isInterruption ? " · INTERRUPTS" : ""}{isCallIn ? " · CALL-IN" : ""}
                  </Text>
                  <Text style={s.bubbleText}>{item.text}</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}

      <Modal visible={!!shareMsg} transparent animationType="fade" onRequestClose={() => { setShareMsg(null); setImageError(null); setBookmarkError(null); setBookmarkJustAdded(false); }}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setShareMsg(null); setImageError(null); setBookmarkError(null); setBookmarkJustAdded(false); }} />
          <View style={s.shareSheet} testID="bubble-share-sheet">
            <View style={s.handle} />
            <Text style={s.shareTitle}>Share this moment</Text>
            {shareMsg && (
              <View style={s.sharePreview}>
                <Text style={s.sharePreviewSpeaker}>
                  {shareMsg.speakerName}{shareMsg.isCallIn ? " · CALL-IN" : ""}{shareMsg.isInterruption ? " · INTERRUPTS" : ""}
                </Text>
                <Text style={s.sharePreviewText} numberOfLines={5}>"{shareMsg.text}"</Text>
              </View>
            )}
            <Pressable
              onPress={() => shareMsg && toggleBookmark(shareMsg)}
              style={[
                s.shareActionBtn,
                s.shareBookmarkBtn,
                isBookmarked(shareMsg) && s.shareBookmarkBtnActive,
                bookmarkBusy && { opacity: 0.7 },
              ]}
              disabled={bookmarkBusy}
              testID="bubble-bookmark"
            >
              {bookmarkBusy ? (
                <ActivityIndicator color="#FFD700" size="small" />
              ) : (
                <Ionicons
                  name={isBookmarked(shareMsg) ? "bookmark" : "bookmark-outline"}
                  size={18}
                  color="#FFD700"
                />
              )}
              <Text style={s.shareBookmarkText}>
                {bookmarkBusy
                  ? (isBookmarked(shareMsg) ? "Removing…" : "Saving…")
                  : isBookmarked(shareMsg)
                    ? (bookmarkJustAdded ? "Saved to favorites" : "Remove bookmark")
                    : "Save to favorites"}
              </Text>
            </Pressable>
            {bookmarkError ? (
              <Text style={s.imageErrorText} testID="bubble-bookmark-error">{bookmarkError}</Text>
            ) : null}
            <Pressable
              onPress={() => shareMsg && handleShareImage(shareMsg)}
              style={[s.shareActionBtn, s.shareImageBtn, generatingImage && { opacity: 0.7 }]}
              disabled={generatingImage}
              testID="bubble-share-image"
            >
              {generatingImage ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Ionicons name="image-outline" size={18} color="#000" />
              )}
              <Text style={s.shareShareText}>{generatingImage ? "Building card…" : (Platform.OS === "web" ? "Share image card" : "Share image card")}</Text>
            </Pressable>
            {imageError ? (
              <Text style={s.imageErrorText} testID="bubble-share-image-error">{imageError}</Text>
            ) : null}
            <View style={s.shareActions}>
              <Pressable
                onPress={() => shareMsg && handleCopyMsg(shareMsg)}
                style={[s.shareActionBtn, s.shareCopyBtn]}
                testID="bubble-copy"
              >
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color="#FFD700" />
                <Text style={s.shareCopyText}>{copied ? "Copied" : "Copy text"}</Text>
              </Pressable>
              <Pressable
                onPress={() => shareMsg && handleShareMsg(shareMsg)}
                style={[s.shareActionBtn, s.shareShareBtn]}
                testID="bubble-share"
              >
                <Ionicons name="share-outline" size={16} color="#000" />
                <Text style={s.shareShareText}>Share text</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => { setShareMsg(null); setImageError(null); setBookmarkError(null); setBookmarkJustAdded(false); }} style={s.shareCancel}>
              <Text style={s.shareCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={liesOpen} transparent animationType="slide" onRequestClose={() => setLiesOpen(false)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLiesOpen(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Ionicons name="flash" size={20} color="#ff4d4d" />
              <Text style={{ flex: 1, color: "#fff", fontSize: 18, fontWeight: "900", marginLeft: 8 }}>LIE DETECTOR · {lies.length}</Text>
              <Pressable onPress={() => setLiesOpen(false)}><Ionicons name="close" size={22} color="#fff" /></Pressable>
            </View>
            {lies.length > 0 ? (
              <View style={s.lieBreakdownRow} testID="lie-breakdown">
                <View style={[s.lieBreakdownPill, s.lieBreakdownAi]}>
                  <Ionicons name="sparkles" size={11} color="#ff4d4d" />
                  <Text style={s.lieBreakdownAiText}>AI: {aiLieCount}</Text>
                </View>
                <Text style={s.lieBreakdownSep}>·</Text>
                <View
                  style={[
                    s.lieBreakdownPill,
                    userLieCount > 0 ? s.lieBreakdownViewerActive : s.lieBreakdownViewerEmpty,
                  ]}
                >
                  <Ionicons
                    name="flag"
                    size={11}
                    color={userLieCount > 0 ? "#60a5fa" : "rgba(255,255,255,0.45)"}
                  />
                  <Text
                    style={userLieCount > 0 ? s.lieBreakdownViewerText : s.lieBreakdownViewerEmptyText}
                  >
                    Viewers: {userLieCount}
                  </Text>
                </View>
              </View>
            ) : null}
            <ScrollView style={{ maxHeight: 480 }}>
              {lies.length === 0 ? (
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", padding: 30 }}>
                  No flagged statements in this interview.
                </Text>
              ) : lies.map((l) => (
                <View key={l.id} style={s.lieRow}>
                  <View style={s.lieHeader}>
                    <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "900", flex: 1 }} numberOfLines={1}>{l.speakerName}</Text>
                    {l.userFlagged && (
                      <View style={s.userFlagBadge}>
                        <Ionicons name="flag" size={9} color="#60a5fa" />
                        <Text style={s.userFlagBadgeText}>USER-FLAGGED</Text>
                      </View>
                    )}
                    <View style={s.lieScore}><Text style={{ color: "#ff4d4d", fontSize: 11, fontWeight: "900" }}>{l.score}/100</Text></View>
                  </View>
                  <Text style={s.lieQuote}>"{l.text}"</Text>
                  {!!l.fact && <Text style={s.lieFact}>FACT: {l.fact}</Text>}
                  {!!l.reason && <Text style={s.lieReason}>{l.reason}</Text>}
                </View>
              ))}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View style={s.menuSheet} testID="transcript-menu-sheet">
            <View style={s.handle} />
            <Text style={s.menuTitle}>Interview options</Text>
            <Pressable
              onPress={() => { setMenuOpen(false); openRename(); }}
              style={s.menuRow}
              testID="transcript-menu-rename"
            >
              <Ionicons name="create-outline" size={20} color="#FFD700" />
              <View style={{ flex: 1 }}>
                <Text style={s.menuRowText}>Rename</Text>
                <Text style={s.menuRowSub}>Give this interview a custom title.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
            </Pressable>
            <Pressable
              onPress={openTagEditor}
              style={s.menuRow}
              testID="transcript-menu-tags"
            >
              <Ionicons name="pricetags-outline" size={20} color="#FFD700" />
              <View style={{ flex: 1 }}>
                <Text style={s.menuRowText}>Tags</Text>
                <Text style={s.menuRowSub}>
                  {tags.length > 0
                    ? `${tags.length} of ${MAX_TAGS_PER_INTERVIEW} used · edit list`
                    : "Add tags to organize this interview."}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(false)}
              style={s.menuCancel}
              testID="transcript-menu-close"
            >
              <Text style={s.menuCancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <TagEditorModal
        visible={tagEditorOpen}
        initialTags={tags}
        smartSuggestions={smartSuggestions}
        computeSmartSuggestions={(draft) =>
          data
            ? buildSmartTagSuggestions(
                {
                  interviewerId: data.interviewerId,
                  intervieweeId: data.intervieweeId,
                  interviewerName: data.interviewerName,
                  intervieweeName: data.intervieweeName,
                  lieCount: data.lieCount,
                  userLieCount: (data.lies || []).reduce(
                    (n, l) => n + (l.userFlagged ? 1 : 0),
                    0,
                  ),
                  messageCount: data.messageCount,
                  durationMinutes: data.durationMinutes,
                  topics: data.topics,
                },
                draft,
                5,
              )
            : []
        }
        allTags={allUserTags}
        onClose={() => setTagEditorOpen(false)}
        onSave={handleEditorSave}
        onAddSmartTag={handleEditorAddSmartTag}
        testIDPrefix="transcript-tags"
      />

      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenameOpen(false)} />
          <View style={s.renameSheet} testID="transcript-rename-sheet">
            <View style={s.handle} />
            <Text style={s.renameTitle}>Rename interview</Text>
            <Text style={s.renameSub}>{defaultTitle}</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Custom title (leave blank to clear)"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={s.renameInput}
              maxLength={80}
              autoFocus
              testID="transcript-rename-input"
            />
            {renameError ? (
              <Text style={s.renameErrorText} testID="transcript-rename-error">{renameError}</Text>
            ) : null}
            <View style={s.renameActions}>
              <Pressable
                style={[s.renameBtn, s.renameBtnGhost]}
                onPress={() => setRenameOpen(false)}
              >
                <Text style={s.renameBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.renameBtn, s.renameBtnPrimary]}
                onPress={submitRename}
                disabled={savingRename}
                testID="transcript-rename-save"
              >
                {savingRename ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={s.renameBtnPrimaryText}>Save</Text>
                )}
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

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 10 },
  errorText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  emptyBtn: { marginTop: 12, backgroundColor: "#FFD700", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  summary: { padding: 14, marginBottom: 6, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,215,0,0.18)" },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  portraitWrap: { alignItems: "center", flex: 1 },
  portrait: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "rgba(255,215,0,0.4)" },
  portraitFallback: { backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
  vs: { color: "rgba(255,255,255,0.5)", fontSize: 24, fontWeight: "900", marginHorizontal: 8 },
  role: { fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 6 },
  name: { color: "#fff", fontSize: 12, fontWeight: "800", marginTop: 2 },
  summaryDate: { color: "rgba(255,215,0,0.85)", fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 12 },
  statsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10, flexWrap: "wrap" },
  statPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  statText: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700" },
  replayBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#FFD700", borderRadius: 14, paddingVertical: 11, marginTop: 14 },
  replayBtnText: { color: "#000", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  transcriptLabel: { color: "#FFD700", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: 14, textAlign: "center" },

  tagsBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  tagsLine: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  tagChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: "rgba(255,215,0,0.15)", borderWidth: 1, borderColor: "rgba(255,215,0,0.45)" },
  tagChipText: { color: "#FFD700", fontSize: 11, fontWeight: "800" },
  suggestLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "center", marginBottom: 6 },
  suggestLabel: { color: "rgba(255,215,0,0.7)", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  smartChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: "rgba(255,215,0,0.08)", borderWidth: 1, borderColor: "rgba(255,215,0,0.4)", borderStyle: "dashed" },
  smartChipText: { color: "#FFD700", fontSize: 11, fontWeight: "800" },
  tagErrorText: { color: "#ff4d4d", fontSize: 11, textAlign: "center", marginTop: 8, fontWeight: "700" },

  bubbleRow: { flexDirection: "row", marginVertical: 6 },
  bubble: { maxWidth: "82%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1 },
  bubbleInterviewer: { backgroundColor: "rgba(255,215,0,0.12)", borderColor: "rgba(255,215,0,0.35)", borderTopLeftRadius: 4 },
  bubbleInterviewee: { backgroundColor: "rgba(74,222,128,0.12)", borderColor: "rgba(74,222,128,0.35)", borderTopRightRadius: 4 },
  bubbleCallIn: { backgroundColor: "rgba(96,165,250,0.12)", borderColor: "rgba(96,165,250,0.35)" },
  bubbleInterrupt: { borderStyle: "dashed" },
  bubbleName: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5, marginBottom: 3 },
  bubbleText: { color: "#fff", fontSize: 14, lineHeight: 19 },
  bubblePartingShot: { maxWidth: "90%", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, backgroundColor: "rgba(255,80,0,0.18)", borderColor: "#ff6a00", alignItems: "center" },
  bubblePartingShotName: { fontSize: 10, fontWeight: "900" as const, letterSpacing: 0.5, marginBottom: 4, color: "#ff6a00", textAlign: "center" },

  partingShotBanner: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: "rgba(255,80,0,0.13)", borderWidth: 1, borderColor: "rgba(255,106,0,0.55)" },
  partingShotLabel: { color: "#ff6a00", fontSize: 10, fontWeight: "900" as const, letterSpacing: 0.8, marginBottom: 5 },
  partingShotText: { color: "#fff", fontSize: 13, fontStyle: "italic" as const, lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F0F12", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderTopWidth: 1, borderColor: "rgba(255,215,0,0.2)" },
  handle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 12 },

  shareSheet: { backgroundColor: "#0F0F12", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderTopWidth: 1, borderColor: "rgba(255,215,0,0.2)", paddingBottom: Platform.OS === "web" ? 34 : 18 },
  shareTitle: { color: "#fff", fontSize: 16, fontWeight: "900" as const, marginBottom: 12 },
  sharePreview: { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,215,0,0.18)", borderRadius: 12, padding: 12, marginBottom: 14 },
  sharePreviewSpeaker: { color: "#FFD700", fontSize: 11, fontWeight: "900" as const, letterSpacing: 0.5, marginBottom: 4 },
  sharePreviewText: { color: "#fff", fontSize: 13, lineHeight: 18, fontStyle: "italic" as const },
  shareActions: { flexDirection: "row", gap: 8, marginBottom: 8 },
  shareActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  shareCopyBtn: { backgroundColor: "rgba(255,215,0,0.1)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  shareCopyText: { color: "#FFD700", fontSize: 13, fontWeight: "800" as const },
  shareShareBtn: { backgroundColor: "#FFD700" },
  shareShareText: { color: "#000", fontSize: 13, fontWeight: "900" as const },
  shareImageBtn: { backgroundColor: "#FFD700", marginBottom: 8, paddingVertical: 14, gap: 8 },
  shareBookmarkBtn: { backgroundColor: "rgba(255,215,0,0.08)", borderWidth: 1, borderColor: "rgba(255,215,0,0.35)", marginBottom: 8, paddingVertical: 12, gap: 8 },
  shareBookmarkBtnActive: { backgroundColor: "rgba(255,215,0,0.18)", borderColor: "rgba(255,215,0,0.6)" },
  shareBookmarkText: { color: "#FFD700", fontSize: 13, fontWeight: "800" as const },
  imageErrorText: { color: "#ff4d4d", fontSize: 12, textAlign: "center" as const, marginBottom: 8 },
  shareCancel: { alignItems: "center", paddingVertical: 10 },
  shareCancelText: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" as const },

  lieBreakdownRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, marginLeft: 28 },
  lieBreakdownPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  lieBreakdownAi: { backgroundColor: "rgba(255,77,77,0.12)", borderColor: "rgba(255,77,77,0.4)" },
  lieBreakdownAiText: { color: "#ff4d4d", fontSize: 11, fontWeight: "900" as const, letterSpacing: 0.4 },
  lieBreakdownViewerActive: { backgroundColor: "rgba(96,165,250,0.14)", borderColor: "rgba(96,165,250,0.45)" },
  lieBreakdownViewerEmpty: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.12)" },
  lieBreakdownViewerText: { color: "#60a5fa", fontSize: 11, fontWeight: "900" as const, letterSpacing: 0.4 },
  lieBreakdownViewerEmptyText: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "900" as const, letterSpacing: 0.4 },
  lieBreakdownSep: { color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: "900" as const },
  lieRow: { padding: 12, marginBottom: 10, borderRadius: 12, backgroundColor: "rgba(255,77,77,0.06)", borderWidth: 1, borderColor: "rgba(255,77,77,0.25)" },
  lieHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  lieScore: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: "rgba(255,77,77,0.15)" },
  userFlagBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: "rgba(96,165,250,0.18)", borderWidth: 1, borderColor: "rgba(96,165,250,0.4)" },
  userFlagBadgeText: { color: "#60a5fa", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  lieQuote: { color: "#fff", fontSize: 13, fontStyle: "italic", lineHeight: 18 },
  lieFact: { color: "#4ADE80", fontSize: 11, marginTop: 6, fontWeight: "700" },
  lieReason: { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 4, lineHeight: 15 },

  menuSheet: { backgroundColor: "#0F0F12", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderTopWidth: 1, borderColor: "rgba(255,215,0,0.2)", paddingBottom: Platform.OS === "web" ? 34 : 24 },
  menuTitle: { color: "#fff", fontSize: 16, fontWeight: "900" as const, marginBottom: 8 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  menuRowText: { color: "#fff", fontSize: 14, fontWeight: "800" as const },
  menuRowSub: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2, fontWeight: "600" as const },
  menuCancel: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
  menuCancelText: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" as const },

  renameSheet: { backgroundColor: "#0F0F12", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderTopWidth: 1, borderColor: "rgba(255,215,0,0.2)", paddingBottom: Platform.OS === "web" ? 34 : 24 },
  renameTitle: { color: "#fff", fontSize: 16, fontWeight: "900" as const, marginBottom: 4 },
  renameSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginBottom: 14 },
  renameInput: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 12 : 8, color: "#fff", fontSize: 14, marginBottom: 14 },
  renameActions: { flexDirection: "row", gap: 8 },
  renameBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12 },
  renameBtnGhost: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  renameBtnGhostText: { color: "#fff", fontSize: 13, fontWeight: "800" as const },
  renameBtnPrimary: { backgroundColor: "#FFD700" },
  renameBtnPrimaryText: { color: "#000", fontSize: 13, fontWeight: "900" as const },
  renameErrorText: { color: "#ff4d4d", fontSize: 12, fontWeight: "700" as const, marginTop: -6, marginBottom: 10 },
});
