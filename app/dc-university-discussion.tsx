import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";
import { playTTS } from "@/lib/audio-helper";
import { shareContent } from "@/lib/track-share";
import { trackAnalyticsEvent } from "@/lib/use-analytics";

const EDUCATOR_PORTRAITS: Record<string, any> = {
  cornellwest: require("@/assets/images/persona-cornellwest.jpg"),
  richardwolff: require("@/assets/images/persona-richardwolff.jpg"),
  jeffreysachs: require("@/assets/images/persona-jeffreysachs.png"),
  claudeanderson: require("@/assets/images/persona-claudeanderson.png"),
  drbenj: require("@/assets/images/persona-drbenj.jpg"),
  clarke: require("@/assets/images/persona-clarke.png"),
  neiltyson: require("@/assets/images/persona-neiltyson.jpg"),
  professorjiang: require("@/assets/images/persona-professorjiang.png"),
  carlsagan: require("@/assets/images/persona-carlsagan.png"),
};

type Phase = "loading" | "chat" | "error";

interface TranscriptLine {
  role: "educator" | "student";
  text: string;
}

export default function DcUniversityDiscussionScreen() {
  const insets = useSafeAreaInsets();
  const { deviceId, refreshBalance } = useTokens();
  const params = useLocalSearchParams<{ courseId: string; minutes: string; studentName: string }>();
  const courseId = params.courseId;
  const minutes = Number(params.minutes) as 5 | 10 | 15;
  const studentName = params.studentName || "Student";

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [educatorId, setEducatorId] = useState("");
  const [educatorName, setEducatorName] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [hasMemory, setHasMemory] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [ending, setEnding] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const speak = useCallback(async (text: string) => {
    setIsSpeaking(true);
    try {
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      const sound = await playTTS("/api/persona-speak", { text, personaId: educatorId });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setIsSpeaking(false);
      });
    } catch {
      setIsSpeaking(false);
    }
  }, [educatorId]);

  const start = useCallback(async () => {
    if (!deviceId || !courseId || !minutes) return;
    setPhase("loading");
    try {
      const res = await fetch(`${getApiUrl()}/api/dc-university/discussion/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ courseId, minutes, studentName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error === "insufficient_tokens" ? "You don't have enough DC Tokens for office hours." : (data.error || "Failed to start office hours"));
        setPhase("error");
        return;
      }
      setSessionId(data.sessionId);
      setEducatorId(data.educatorId);
      setEducatorName(data.educatorName);
      setCourseTitle(data.courseTitle);
      setHasMemory(!!data.hasMemory);
      setTranscript([{ role: "educator", text: data.text }]);
      setPhase("chat");
      refreshBalance();
      trackAnalyticsEvent("dc_university_discussion_started", { courseId, minutes, hasMemory: !!data.hasMemory });
    } catch (e) {
      setErrorMsg("Network error starting office hours. Please try again.");
      setPhase("error");
    }
  }, [deviceId, courseId, minutes, studentName, refreshBalance]);

  useEffect(() => {
    start();
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "chat" && transcript.length > 0 && educatorId) {
      const last = transcript[transcript.length - 1];
      if (last.role === "educator") speak(last.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, educatorId]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [transcript]);

  const sendMessage = async () => {
    const m = message.trim();
    if (!m || !sessionId || isSending) return;
    setIsSending(true);
    setMessage("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTranscript((t) => [...t, { role: "student", text: m }]);
    try {
      const res = await fetch(`${getApiUrl()}/api/dc-university/discussion/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: m }),
      });
      const data = await res.json();
      if (res.ok) {
        setTranscript((t) => [...t, { role: "educator", text: data.text }]);
        if (typeof data.balance === "number") refreshBalance();
      }
    } catch {
    } finally {
      setIsSending(false);
    }
  };

  const endSession = async () => {
    if (!sessionId || ending) return;
    setEnding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await fetch(`${getApiUrl()}/api/dc-university/discussion/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch {}
    router.replace("/dc-university");
  };

  const shareRecap = () => {
    shareContent({
      deviceId: deviceId || undefined,
      feature: "dc_university_office_hours_recap",
      text: `I just had office hours with ${educatorName} at DC University. 🎓`,
    });
  };

  const confirmEnd = () => {
    Alert.alert(
      "End office hours?",
      `${educatorName} will remember this conversation next time.`,
      [
        { text: "Keep talking", style: "cancel" },
        { text: "End session", style: "destructive", onPress: endSession },
      ]
    );
  };

  const portrait = EDUCATOR_PORTRAITS[educatorId];

  if (phase === "loading") {
    return (
      <View style={styles.centerContainer}>
        <LinearGradient colors={["#0B1F3A", "#050B18"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Walking into office hours…</Text>
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <LinearGradient colors={["#0B1F3A", "#050B18"]} style={StyleSheet.absoluteFill} />
        <Feather name="alert-triangle" size={36} color="#FF6B6B" />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()} testID="dc-discussion-error-back">
          <Text style={styles.primaryButtonText}>Back to DC University</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#0B1F3A", "#050B18"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={confirmEnd} hitSlop={12} style={styles.backButton} testID="dc-discussion-back">
          <Feather name="chevron-left" size={26} color="#FFF" />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerCourse} numberOfLines={1}>Office Hours</Text>
          <Text style={styles.headerProgress}>with {educatorName}</Text>
        </View>
        <Pressable onPress={shareRecap} hitSlop={12} style={styles.backButton} testID="dc-discussion-share">
          <Feather name="share-2" size={20} color="#FFD700" />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.educatorRow}>
          {portrait && <Image source={portrait} style={styles.avatar} />}
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.educatorNameLarge}>{educatorName}</Text>
            {isSpeaking ? (
              <Text style={styles.speakingIndicator}>Speaking…</Text>
            ) : hasMemory ? (
              <Text style={styles.memoryIndicator}>Remembers your past conversations</Text>
            ) : null}
          </View>
        </View>

        <ScrollView ref={scrollRef} style={styles.transcriptScroll} contentContainerStyle={{ paddingBottom: 16 }}>
          {transcript.map((line, i) => (
            <Pressable
              key={i}
              onPress={line.role === "educator" ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); speak(line.text); } : undefined}
              style={[styles.transcriptBubble, line.role === "student" ? styles.studentBubble : styles.educatorBubble]}
              testID={`dc-discussion-line-${i}`}
            >
              <Text style={styles.transcriptText}>{line.text}</Text>
            </Pressable>
          ))}
          {isSending && <ActivityIndicator color="#FFD700" style={{ marginTop: 8 }} />}
        </ScrollView>

        <View style={styles.qaRow}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={`Talk with ${educatorName.split(" ")[0]}…`}
            placeholderTextColor="#8899AA"
            style={styles.qaInput}
            onSubmitEditing={sendMessage}
            testID="dc-discussion-input"
          />
          <Pressable onPress={sendMessage} style={styles.qaSendButton} disabled={isSending || !message.trim()} testID="dc-discussion-send">
            <Feather name="send" size={18} color="#050B18" />
          </Pressable>
        </View>

        <Pressable
          onPress={confirmEnd}
          disabled={ending}
          style={({ pressed }) => [styles.secondaryEndButton, { marginHorizontal: 16, marginBottom: insets.bottom + 12 }, pressed && { opacity: 0.8 }]}
          testID="dc-discussion-end-button"
        >
          {ending ? <ActivityIndicator color="#FFD700" /> : <Text style={styles.secondaryEndButtonText}>End Office Hours</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050B18" },
  centerContainer: { flex: 1, backgroundColor: "#050B18", alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { color: "#B9C4D4", marginTop: 16, fontSize: 14 },
  errorText: { color: "#FFF", fontSize: 15, textAlign: "center", marginTop: 14, marginBottom: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10 },
  backButton: { padding: 4 },
  headerCourse: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  headerProgress: { color: "#8899AA", fontSize: 11, marginTop: 2 },
  educatorRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "#FFD700" },
  educatorNameLarge: { color: "#FFD700", fontSize: 16, fontWeight: "800" },
  speakingIndicator: { color: "#6FCF97", fontSize: 12, marginTop: 3 },
  memoryIndicator: { color: "#8899AA", fontSize: 11, marginTop: 3, fontStyle: "italic" },
  transcriptScroll: { flex: 1, paddingHorizontal: 16 },
  transcriptBubble: { borderRadius: 14, padding: 12, marginBottom: 10, maxWidth: "90%" },
  educatorBubble: { backgroundColor: "rgba(255,255,255,0.07)", alignSelf: "flex-start" },
  studentBubble: { backgroundColor: "rgba(255,215,0,0.15)", alignSelf: "flex-end" },
  transcriptText: { color: "#FFF", fontSize: 14, lineHeight: 20 },
  qaRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  qaInput: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: "#FFF", fontSize: 14 },
  qaSendButton: { backgroundColor: "#FFD700", borderRadius: 12, padding: 10, alignItems: "center", justifyContent: "center" },
  primaryButton: { backgroundColor: "#FFD700", borderRadius: 14, paddingVertical: 14, alignItems: "center", paddingHorizontal: 24 },
  primaryButtonText: { color: "#050B18", fontWeight: "800", fontSize: 15 },
  secondaryEndButton: { borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  secondaryEndButtonText: { color: "#B9C4D4", fontWeight: "700", fontSize: 13 },
});
