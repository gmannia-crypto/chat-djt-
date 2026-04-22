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
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";

const SHARE_URL = "https://trumpbot.rip";

type Msg = { id: string; speakerId: string; speakerName: string; text: string; ts: number; isInterruption?: boolean; isCallIn?: boolean; callerName?: string };
type LieEntry = { id: string; speakerId: string; speakerName: string; text: string; score: number; reason: string; fact: string; ts: number };

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
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const defaultTitle = data ? `${data.interviewerName} × ${data.intervieweeName}` : "TRANSCRIPT";
  const displayTitle = (data?.title && data.title.trim().length > 0) ? data.title : defaultTitle;

  const openRename = () => {
    setRenameValue(data?.title || "");
    setRenameError(null);
    setRenameOpen(true);
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
    return `"${m.text}"\n— ${speaker}\n\nFrom ${data.interviewerName} × ${data.intervieweeName} on TrumpBot.rip\n${SHARE_URL}`;
  };

  const handleCopyMsg = async (m: Msg) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await Clipboard.setStringAsync(buildShareText(m));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
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
        const res = await fetch(new URL(`/api/arena/interview-history/${id}`, getApiUrl()).toString(), {
          headers: { "x-device-id": deviceId },
        });
        if (!res.ok) {
          if (!cancel) setError(res.status === 404 ? "Transcript not found" : "Failed to load");
          return;
        }
        const d = await res.json();
        if (!cancel) setData(d);
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
        <Text style={s.transcriptLabel}>TRANSCRIPT</Text>
      </View>
    );
  }, [data, interviewerPortrait, intervieweePortrait, lies.length]);

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
          <Pressable onPress={openRename} style={s.iconBtn} testID="transcript-rename">
            <Ionicons name="create-outline" size={20} color="#FFD700" />
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

      <Modal visible={!!shareMsg} transparent animationType="fade" onRequestClose={() => setShareMsg(null)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareMsg(null)} />
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
            <View style={s.shareActions}>
              <Pressable
                onPress={() => shareMsg && handleCopyMsg(shareMsg)}
                style={[s.shareActionBtn, s.shareCopyBtn]}
                testID="bubble-copy"
              >
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color="#FFD700" />
                <Text style={s.shareCopyText}>{copied ? "Copied" : "Copy"}</Text>
              </Pressable>
              <Pressable
                onPress={() => shareMsg && handleShareMsg(shareMsg)}
                style={[s.shareActionBtn, s.shareShareBtn]}
                testID="bubble-share"
              >
                <Ionicons name="share-outline" size={16} color="#000" />
                <Text style={s.shareShareText}>Share</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setShareMsg(null)} style={s.shareCancel}>
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
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Ionicons name="flash" size={20} color="#ff4d4d" />
              <Text style={{ flex: 1, color: "#fff", fontSize: 18, fontWeight: "900", marginLeft: 8 }}>LIE DETECTOR · {lies.length}</Text>
              <Pressable onPress={() => setLiesOpen(false)}><Ionicons name="close" size={22} color="#fff" /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              {lies.length === 0 ? (
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", padding: 30 }}>
                  No flagged statements in this interview.
                </Text>
              ) : lies.map((l) => (
                <View key={l.id} style={s.lieRow}>
                  <View style={s.lieHeader}>
                    <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "900", flex: 1 }} numberOfLines={1}>{l.speakerName}</Text>
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
  transcriptLabel: { color: "#FFD700", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: 14, textAlign: "center" },

  bubbleRow: { flexDirection: "row", marginVertical: 6 },
  bubble: { maxWidth: "82%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1 },
  bubbleInterviewer: { backgroundColor: "rgba(255,215,0,0.12)", borderColor: "rgba(255,215,0,0.35)", borderTopLeftRadius: 4 },
  bubbleInterviewee: { backgroundColor: "rgba(74,222,128,0.12)", borderColor: "rgba(74,222,128,0.35)", borderTopRightRadius: 4 },
  bubbleCallIn: { backgroundColor: "rgba(96,165,250,0.12)", borderColor: "rgba(96,165,250,0.35)" },
  bubbleInterrupt: { borderStyle: "dashed" },
  bubbleName: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5, marginBottom: 3 },
  bubbleText: { color: "#fff", fontSize: 14, lineHeight: 19 },

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
  shareCancel: { alignItems: "center", paddingVertical: 10 },
  shareCancelText: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" as const },

  lieRow: { padding: 12, marginBottom: 10, borderRadius: 12, backgroundColor: "rgba(255,77,77,0.06)", borderWidth: 1, borderColor: "rgba(255,77,77,0.25)" },
  lieHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  lieScore: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: "rgba(255,77,77,0.15)" },
  lieQuote: { color: "#fff", fontSize: 13, fontStyle: "italic", lineHeight: 18 },
  lieFact: { color: "#4ADE80", fontSize: 11, marginTop: 6, fontWeight: "700" },
  lieReason: { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 4, lineHeight: 15 },

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
