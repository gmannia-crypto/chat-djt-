import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator,
  Platform, Image, FlatList,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from "react-native-reanimated";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";
import Colors from "@/constants/colors";
import { ShareAppButton } from "@/components/ShareAppButton";

type PersonaLite = { id: string; name: string };
type Topic = { id: string; title: string; description: string; era: "current" | "past" };
type Msg = { id: string; speakerId: string; speakerName: string; text: string; ts: number; isInterruption?: boolean };

const DURATIONS: Array<{ minutes: 5 | 10 | 15; cost: number }> = [
  { minutes: 5, cost: 5 },
  { minutes: 10, cost: 10 },
  { minutes: 15, cost: 15 },
];

const TOPIC_MIXES = [
  { id: "current", label: "Current Headlines", icon: "newspaper" as const },
  { id: "past", label: "Past Controversies", icon: "time" as const },
  { id: "mixed", label: "Both", icon: "shuffle" as const },
];

const webTop = Platform.OS === "web" ? 67 : 0;
const webBottom = Platform.OS === "web" ? 34 : 0;

export default function InterviewScreen() {
  const insets = useSafeAreaInsets();
  const { deviceId, balance, refreshBalance } = useTokens();

  const [interviewers, setInterviewers] = useState<PersonaLite[]>([]);
  const [interviewees, setInterviewees] = useState<PersonaLite[]>([]);
  const [interviewerId, setInterviewerId] = useState<string | null>(null);
  const [intervieweeId, setIntervieweeId] = useState<string | null>(null);
  const [duration, setDuration] = useState<5 | 10 | 15>(10);
  const [topicMix, setTopicMix] = useState<"current" | "past" | "mixed">("mixed");

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicIdx, setTopicIdx] = useState(0);
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());

  const [phase, setPhase] = useState<"setup" | "live" | "ended">("setup");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isThinking, setIsThinking] = useState<"interviewer" | "interviewee" | null>(null);
  const [topicsPanelOpen, setTopicsPanelOpen] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const sessionEndsAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runningRef = useRef(false);
  const isPausedRef = useRef(false);
  const exchangesOnTopicRef = useRef(0);
  const messagesRef = useRef<Msg[]>([]);
  const topicIdxRef = useRef(0);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { topicIdxRef.current = topicIdx; }, [topicIdx]);

  // Load persona lists
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(new URL("/api/arena/interview-personas", getApiUrl()).toString());
        if (res.ok) {
          const data = await res.json();
          setInterviewers(data.interviewers || []);
          setInterviewees(data.interviewees || []);
          if (!interviewerId && data.interviewers?.[0]) setInterviewerId(data.interviewers[0].id);
          if (!intervieweeId && data.interviewees?.[0]) setIntervieweeId(data.interviewees[0].id);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const interviewer = useMemo(() => interviewers.find((p) => p.id === interviewerId) || null, [interviewers, interviewerId]);
  const interviewee = useMemo(() => interviewees.find((p) => p.id === intervieweeId) || null, [interviewees, intervieweeId]);
  const currentTopic = topics[topicIdx] || null;

  const generateTopics = useCallback(async () => {
    if (!interviewerId || !intervieweeId) return;
    setTopicsLoading(true);
    setTopics([]);
    setTopicIdx(0);
    setCompletedTopics(new Set());
    try {
      const res = await fetch(new URL("/api/arena/interview-topics", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewerId, intervieweeId, topicMix, durationMinutes: duration }),
      });
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics || []);
      }
    } catch {} finally {
      setTopicsLoading(false);
    }
  }, [interviewerId, intervieweeId, topicMix, duration]);

  // Auto-generate when pairing/duration changes
  useEffect(() => {
    if (interviewerId && intervieweeId && phase === "setup") {
      generateTopics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewerId, intervieweeId, topicMix, duration]);

  // Countdown
  useEffect(() => {
    if (phase !== "live") return;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((sessionEndsAtRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        runningRef.current = false;
        setPhase("ended");
      }
    }, 500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const addMessage = useCallback((m: Msg) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  const fetchQuestion = useCallback(async (opts: { isFollowUp?: boolean; isTransition?: boolean; previousTopicTitle?: string; isInterruption?: boolean; currentTopicArg?: Topic | null }) => {
    if (!deviceId || !interviewerId || !intervieweeId) return null;
    const topicArg = opts.currentTopicArg !== undefined ? opts.currentTopicArg : currentTopic;
    try {
      const res = await fetch(new URL("/api/arena/interview-question", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({
          interviewerId, intervieweeId,
          topic: topicArg,
          conversationHistory: messagesRef.current.slice(-6),
          isFollowUp: !!opts.isFollowUp,
          isTransition: !!opts.isTransition,
          previousTopicTitle: opts.previousTopicTitle,
          isInterruption: !!opts.isInterruption,
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          runningRef.current = false;
          setShowPaywall(true);
          setPhase("setup");
        }
        return null;
      }
      const data = await res.json();
      return data;
    } catch { return null; }
  }, [deviceId, interviewerId, intervieweeId, currentTopic]);

  const fetchAnswer = useCallback(async (lastQuestion: string, opts: { wasInterrupted?: boolean; interruptionText?: string; isInterruption?: boolean } = {}) => {
    if (!deviceId || !interviewerId || !intervieweeId) return null;
    try {
      const res = await fetch(new URL("/api/arena/interview-answer", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({
          interviewerId, intervieweeId,
          topic: currentTopic,
          conversationHistory: messagesRef.current.slice(-6),
          lastQuestion,
          wasInterrupted: !!opts.wasInterrupted,
          interruptionText: opts.interruptionText,
          isInterruption: !!opts.isInterruption,
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          runningRef.current = false;
          setShowPaywall(true);
          setPhase("setup");
        }
        return null;
      }
      return await res.json();
    } catch { return null; }
  }, [deviceId, interviewerId, intervieweeId, currentTopic]);

  // Main turn loop
  const runLoop = useCallback(async () => {
    while (runningRef.current && Date.now() < sessionEndsAtRef.current) {
      if (isPausedRef.current) { await new Promise((r) => setTimeout(r, 400)); continue; }

      const idx = topicIdxRef.current;
      const topic = topics[idx];
      if (!topic) break;

      const isFirstQuestionOnTopic = exchangesOnTopicRef.current === 0;
      const isFollowUp = !isFirstQuestionOnTopic;

      setIsThinking("interviewer");
      const q = await fetchQuestion({
        isFollowUp,
        isTransition: false,
        currentTopicArg: topic,
      });
      setIsThinking(null);
      if (!q || !runningRef.current) break;
      addMessage({ id: `q-${Date.now()}-${Math.random()}`, speakerId: q.speakerId, speakerName: q.speakerName, text: q.text, ts: Date.now() });

      // Estimate read time and start answer with ~1s overlap
      const qReadMs = Math.min(7000, Math.max(2200, q.text.length * 55));
      await new Promise((r) => setTimeout(r, Math.max(800, qReadMs - 1000)));
      if (!runningRef.current) break;

      // Random interruption from interviewee on the question (15%)
      let interruptionText: string | undefined;
      if (Math.random() < 0.12) {
        const intr = await fetchAnswer(q.text, { isInterruption: true });
        if (intr && intr.text && runningRef.current) {
          interruptionText = intr.text;
          addMessage({ id: `intr-${Date.now()}-${Math.random()}`, speakerId: intr.speakerId, speakerName: intr.speakerName, text: intr.text, ts: Date.now(), isInterruption: true });
          await new Promise((r) => setTimeout(r, 600));
        }
      }
      if (!runningRef.current) break;

      setIsThinking("interviewee");
      const a = await fetchAnswer(q.text, { wasInterrupted: !!interruptionText, interruptionText });
      setIsThinking(null);
      if (!a || !runningRef.current) break;
      addMessage({ id: `a-${Date.now()}-${Math.random()}`, speakerId: a.speakerId, speakerName: a.speakerName, text: a.text, ts: Date.now() });

      const aReadMs = Math.min(8500, Math.max(2500, a.text.length * 55));
      await new Promise((r) => setTimeout(r, Math.max(900, aReadMs - 1000)));
      if (!runningRef.current) break;

      // Random interviewer cut-in mid-answer (10%)
      if (Math.random() < 0.1) {
        const cut = await fetchQuestion({ isInterruption: true, currentTopicArg: topic });
        if (cut && cut.text && runningRef.current) {
          addMessage({ id: `cut-${Date.now()}-${Math.random()}`, speakerId: cut.speakerId, speakerName: cut.speakerName, text: cut.text, ts: Date.now(), isInterruption: true });
          await new Promise((r) => setTimeout(r, 700));
        }
      }

      exchangesOnTopicRef.current += 1;

      // Move to next topic after enough exchanges OR if running low on time per topic
      const exchangesPerTopic = duration <= 5 ? 2 : duration <= 10 ? 3 : 3;
      const shouldAdvance = exchangesOnTopicRef.current >= exchangesPerTopic;
      if (shouldAdvance) {
        setCompletedTopics((prev) => new Set(prev).add(topic.id));
        const nextIdx = idx + 1;
        if (nextIdx >= topics.length) {
          // All topics done — end
          runningRef.current = false;
          setPhase("ended");
          break;
        }
        // Transition message
        const nextTopic = topics[nextIdx];
        setIsThinking("interviewer");
        const trans = await fetchQuestion({
          isTransition: true,
          previousTopicTitle: topic.title,
          currentTopicArg: nextTopic,
        });
        setIsThinking(null);
        if (trans && trans.text && runningRef.current) {
          addMessage({ id: `trans-${Date.now()}-${Math.random()}`, speakerId: trans.speakerId, speakerName: trans.speakerName, text: trans.text, ts: Date.now() });
        }
        setTopicIdx(nextIdx);
        topicIdxRef.current = nextIdx;
        exchangesOnTopicRef.current = 1; // transition counts as first question
        await new Promise((r) => setTimeout(r, 700));
      }
    }
    runningRef.current = false;
    if (Date.now() >= sessionEndsAtRef.current) setPhase("ended");
  }, [topics, fetchQuestion, fetchAnswer, addMessage, duration]);

  const startInterview = useCallback(async () => {
    if (!deviceId || !interviewerId || !intervieweeId || topics.length === 0 || isStarting) return;
    setIsStarting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Check / acquire arena access
    let hasSession = false;
    try {
      const sres = await fetch(new URL("/api/arena/status", getApiUrl()).toString(), { headers: { "x-device-id": deviceId } });
      if (sres.ok) {
        const sdata = await sres.json();
        hasSession = !!sdata.hasSession;
      }
    } catch {}

    if (!hasSession) {
      // try free trial
      try {
        const tr = await fetch(new URL("/api/arena/free-trial", getApiUrl()).toString(), {
          method: "POST", headers: { "x-device-id": deviceId, "Content-Type": "application/json" },
        });
        if (tr.ok) {
          const td = await tr.json();
          if (td.granted) hasSession = true;
        }
      } catch {}
    }
    if (!hasSession) {
      setShowPaywall(true);
      setIsStarting(false);
      return;
    }

    sessionEndsAtRef.current = Date.now() + duration * 60 * 1000;
    setSecondsLeft(duration * 60);
    setMessages([]);
    setTopicIdx(0);
    topicIdxRef.current = 0;
    exchangesOnTopicRef.current = 0;
    setCompletedTopics(new Set());
    setPhase("live");
    runningRef.current = true;
    isPausedRef.current = false;
    setIsStarting(false);
    setTimeout(() => { runLoop(); }, 300);
  }, [deviceId, interviewerId, intervieweeId, topics.length, isStarting, duration, runLoop]);

  const unlockSession = useCallback(async () => {
    if (!deviceId || isUnlocking) return;
    setIsUnlocking(true);
    try {
      const res = await fetch(new URL("/api/arena/access", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ duration }),
      });
      const data = await res.json();
      if (res.ok && data.granted) {
        setShowPaywall(false);
        await refreshBalance();
        // Auto-start
        sessionEndsAtRef.current = Date.now() + duration * 60 * 1000;
        setSecondsLeft(duration * 60);
        setMessages([]);
        setTopicIdx(0);
        topicIdxRef.current = 0;
        exchangesOnTopicRef.current = 0;
        setCompletedTopics(new Set());
        setPhase("live");
        runningRef.current = true;
        isPausedRef.current = false;
        setTimeout(() => { runLoop(); }, 300);
      }
    } catch {} finally {
      setIsUnlocking(false);
    }
  }, [deviceId, duration, isUnlocking, refreshBalance, runLoop]);

  const stopInterview = useCallback(() => {
    runningRef.current = false;
    setPhase("ended");
  }, []);

  const togglePause = useCallback(() => {
    isPausedRef.current = !isPausedRef.current;
  }, []);

  const skipTopic = useCallback(() => {
    if (topicIdx + 1 >= topics.length) return;
    setCompletedTopics((prev) => new Set(prev).add(topics[topicIdx].id));
    const next = topicIdx + 1;
    setTopicIdx(next);
    topicIdxRef.current = next;
    exchangesOnTopicRef.current = 0;
  }, [topicIdx, topics]);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // SETUP SCREEN
  if (phase === "setup") {
    return (
      <View style={[s.container, { paddingTop: insets.top + webTop }]}>
        <LinearGradient colors={["rgba(255,215,0,0.12)", "rgba(0,0,0,0)", "#0a0a0a"]} style={StyleSheet.absoluteFill} />

        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn} testID="interview-back">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>1-ON-1 INTERVIEWS</Text>
            <Text style={s.headerSub}>Provocative · Live · Unscripted</Text>
          </View>
          <ShareAppButton variant="icon" area="arena" />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <Text style={s.sectionLabel}>INTERVIEWER</Text>
          <View style={s.chipRow}>
            {interviewers.map((p) => (
              <Pressable key={p.id} onPress={() => { Haptics.selectionAsync(); setInterviewerId(p.id); }}
                style={[s.chip, interviewerId === p.id && s.chipActive]} testID={`interviewer-${p.id}`}>
                <Text style={[s.chipText, interviewerId === p.id && s.chipTextActive]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>GUEST</Text>
          <View style={s.chipRow}>
            {interviewees.map((p) => (
              <Pressable key={p.id} onPress={() => { Haptics.selectionAsync(); setIntervieweeId(p.id); }}
                style={[s.chip, intervieweeId === p.id && s.chipActiveGuest]} testID={`interviewee-${p.id}`}>
                <Text style={[s.chipText, intervieweeId === p.id && s.chipTextActive]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>SEGMENT LENGTH</Text>
          <View style={s.durationRow}>
            {DURATIONS.map((d) => (
              <Pressable key={d.minutes} onPress={() => { Haptics.selectionAsync(); setDuration(d.minutes); }}
                style={[s.durationCard, duration === d.minutes && s.durationCardActive]} testID={`duration-${d.minutes}`}>
                <Text style={[s.durationMins, duration === d.minutes && s.durationMinsActive]}>{d.minutes}</Text>
                <Text style={[s.durationSub, duration === d.minutes && s.durationSubActive]}>min</Text>
                <Text style={[s.durationCost, duration === d.minutes && s.durationCostActive]}>{d.cost} tokens</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>TOPIC MIX</Text>
          <View style={s.mixRow}>
            {TOPIC_MIXES.map((m) => (
              <Pressable key={m.id} onPress={() => { Haptics.selectionAsync(); setTopicMix(m.id as any); }}
                style={[s.mixCard, topicMix === m.id && s.mixCardActive]} testID={`mix-${m.id}`}>
                <Ionicons name={m.icon} size={18} color={topicMix === m.id ? "#000" : "#FFD700"} />
                <Text style={[s.mixText, topicMix === m.id && s.mixTextActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[s.topicsCard, { marginTop: 18 }]}>
            <View style={s.topicsHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="list" size={16} color="#FFD700" />
                <Text style={s.topicsTitle}>INTERVIEW QUESTIONS</Text>
              </View>
              <Pressable onPress={generateTopics} disabled={topicsLoading || !interviewerId || !intervieweeId} style={s.refreshTopicsBtn}>
                {topicsLoading ? (
                  <ActivityIndicator size="small" color="#FFD700" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={14} color="#FFD700" />
                    <Text style={s.refreshTopicsText}>New</Text>
                  </>
                )}
              </Pressable>
            </View>
            {topicsLoading && topics.length === 0 ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#FFD700" />
                <Text style={{ color: "#888", fontSize: 12, marginTop: 8 }}>Generating provocative angles…</Text>
              </View>
            ) : topics.length === 0 ? (
              <Text style={{ color: "#666", fontSize: 12, padding: 12, textAlign: "center" }}>
                Pick an interviewer and guest to generate questions.
              </Text>
            ) : (
              topics.map((t, i) => (
                <View key={t.id} style={s.topicRow}>
                  <View style={[s.topicNum, { backgroundColor: t.era === "current" ? "rgba(74,222,128,0.2)" : "rgba(255,215,0,0.2)" }]}>
                    <Text style={[s.topicNumText, { color: t.era === "current" ? "#4ADE80" : "#FFD700" }]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.topicTitle} numberOfLines={2}>{t.title}</Text>
                    <Text style={s.topicDesc} numberOfLines={2}>{t.description}</Text>
                    <View style={[s.eraTag, { backgroundColor: t.era === "current" ? "rgba(74,222,128,0.15)" : "rgba(255,215,0,0.12)" }]}>
                      <Text style={[s.eraTagText, { color: t.era === "current" ? "#4ADE80" : "#FFD700" }]}>
                        {t.era === "current" ? "TODAY" : "PAST"}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          <Pressable
            onPress={startInterview}
            disabled={isStarting || !interviewerId || !intervieweeId || topics.length === 0}
            style={[s.startBtn, (isStarting || !interviewerId || !intervieweeId || topics.length === 0) && { opacity: 0.4 }]}
            testID="start-interview"
          >
            <Ionicons name="mic" size={18} color="#000" />
            <Text style={s.startBtnText}>
              {isStarting ? "STARTING…" : !deviceId ? "CONNECTING…" : `START ${duration}-MIN INTERVIEW`}
            </Text>
          </Pressable>
          <Text style={s.startSub}>
            {interviewer?.name || "—"} grills {interviewee?.name || "—"} · {topics.length} topic{topics.length === 1 ? "" : "s"}
          </Text>
        </ScrollView>

        {renderPaywall()}
      </View>
    );
  }

  // LIVE / ENDED
  return (
    <View style={[s.container, { paddingTop: insets.top + webTop }]}>
      <LinearGradient colors={["rgba(255,215,0,0.08)", "rgba(0,0,0,0)", "#0a0a0a"]} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Pressable onPress={() => { stopInterview(); router.back(); }} style={s.iconBtn} testID="interview-exit">
          <Ionicons name="exit-outline" size={20} color="#ff4d4d" />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{interviewer?.name} × {interviewee?.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={[s.liveDot]} />
            <Text style={s.liveText}>LIVE · {mmss(secondsLeft)}</Text>
          </View>
        </View>
        <Pressable onPress={togglePause} style={s.iconBtn}>
          <Ionicons name={isPausedRef.current ? "play" : "pause"} size={18} color="#FFD700" />
        </Pressable>
        <ShareAppButton variant="icon" area="arena" />
      </View>

      {/* Topic strip */}
      <Pressable onPress={() => setTopicsPanelOpen(true)} style={s.topicStrip} testID="topic-strip">
        <View style={{ flex: 1 }}>
          <Text style={s.topicStripLabel}>TOPIC {topicIdx + 1} OF {topics.length}</Text>
          <Text style={s.topicStripTitle} numberOfLines={1}>{currentTopic?.title || "—"}</Text>
        </View>
        <Pressable onPress={skipTopic} style={s.skipBtn} disabled={topicIdx + 1 >= topics.length}>
          <Ionicons name="play-skip-forward" size={14} color={topicIdx + 1 >= topics.length ? "#444" : "#FFD700"} />
          <Text style={[s.skipText, { color: topicIdx + 1 >= topics.length ? "#444" : "#FFD700" }]}>Next</Text>
        </Pressable>
        <Ionicons name="list" size={18} color="#FFD700" style={{ marginLeft: 10 }} />
      </Pressable>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + webBottom + 90 }}
        renderItem={({ item }) => {
          const isInterviewer = item.speakerId === interviewerId;
          return (
            <Animated.View entering={FadeInUp.duration(300)} style={[s.bubbleRow, isInterviewer ? { justifyContent: "flex-start" } : { justifyContent: "flex-end" }]}>
              <View style={[
                s.bubble,
                isInterviewer ? s.bubbleInterviewer : s.bubbleInterviewee,
                item.isInterruption && s.bubbleInterrupt,
              ]}>
                <Text style={[s.bubbleName, { color: isInterviewer ? "#FFD700" : "#4ADE80" }]}>
                  {item.speakerName}{item.isInterruption ? " · INTERRUPTS" : ""}
                </Text>
                <Text style={s.bubbleText}>{item.text}</Text>
              </View>
            </Animated.View>
          );
        }}
        ListFooterComponent={
          isThinking ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={[s.bubbleRow, isThinking === "interviewer" ? { justifyContent: "flex-start" } : { justifyContent: "flex-end" }]}>
              <View style={[s.bubble, isThinking === "interviewer" ? s.bubbleInterviewer : s.bubbleInterviewee, { paddingVertical: 10 }]}>
                <ActivityIndicator size="small" color={isThinking === "interviewer" ? "#FFD700" : "#4ADE80"} />
              </View>
            </Animated.View>
          ) : null
        }
        scrollEnabled={messages.length > 0}
      />

      {phase === "ended" && (
        <Animated.View entering={FadeInDown.duration(300)} style={[s.endedBar, { paddingBottom: insets.bottom + webBottom + 12 }]}>
          <Text style={s.endedTitle}>INTERVIEW COMPLETE</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable onPress={() => setPhase("setup")} style={s.endedBtnSecondary}>
              <Ionicons name="arrow-back" size={14} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>NEW BOOKING</Text>
            </Pressable>
            <ShareAppButton variant="pill" area="arena" />
          </View>
        </Animated.View>
      )}

      {/* Topics panel */}
      <Modal visible={topicsPanelOpen} transparent animationType="slide" onRequestClose={() => setTopicsPanelOpen(false)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTopicsPanelOpen(false)} />
          <View style={s.topicsSheet}>
            <View style={s.handle} />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ flex: 1, color: "#fff", fontSize: 18, fontWeight: "900" }}>QUESTION QUEUE</Text>
              <Pressable onPress={() => setTopicsPanelOpen(false)}><Ionicons name="close" size={22} color="#fff" /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              {topics.map((t, i) => {
                const isCurrent = i === topicIdx;
                const isDone = completedTopics.has(t.id);
                return (
                  <View key={t.id} style={[s.queueRow, isCurrent && s.queueRowCurrent]}>
                    <View style={[s.queueNum, isDone && { backgroundColor: "rgba(74,222,128,0.25)" }, isCurrent && { backgroundColor: "#FFD700" }]}>
                      {isDone ? (
                        <Ionicons name="checkmark" size={14} color="#4ADE80" />
                      ) : (
                        <Text style={[{ fontSize: 12, fontWeight: "900", color: isCurrent ? "#000" : "#FFD700" }]}>{i + 1}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isCurrent ? "#FFD700" : "#fff", fontSize: 13, fontWeight: "800" }}>{t.title}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>{t.description}</Text>
                    </View>
                  </View>
                );
              })}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {renderPaywall()}
    </View>
  );

  function renderPaywall() {
    return (
      <Modal visible={showPaywall} transparent animationType="fade" onRequestClose={() => setShowPaywall(false)}>
        <View style={s.modalOverlay}>
          <View style={s.paywallCard}>
            <Ionicons name="lock-closed" size={32} color="#FFD700" />
            <Text style={s.paywallTitle}>Unlock Interview</Text>
            <Text style={s.paywallSub}>1 token per minute. Use a {duration}-minute session?</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <Image source={require("@/assets/images/dc-lightning-token.jpeg")} style={{ width: 14, height: 14, borderRadius: 7 }} />
              <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "800" }}>{balance?.totalAvailable ?? 0} tokens available</Text>
            </View>
            <Pressable onPress={unlockSession} disabled={isUnlocking} style={[s.paywallBtn, isUnlocking && { opacity: 0.6 }]}>
              {isUnlocking ? <ActivityIndicator color="#000" /> : <Text style={s.paywallBtnText}>Unlock {duration} min for {duration} tokens</Text>}
            </Pressable>
            <Pressable onPress={() => { setShowPaywall(false); router.push("/subscribe"); }} style={s.paywallSecondary}>
              <Text style={s.paywallSecondaryText}>Get more tokens</Text>
            </Pressable>
            <Pressable onPress={() => setShowPaywall(false)}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 10 }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.2)" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#FFD700", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  headerSub: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ff4d4d" },
  liveText: { color: "#ff4d4d", fontSize: 11, fontWeight: "800" },

  sectionLabel: { color: "#FFD700", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  chipActive: { backgroundColor: "rgba(255,215,0,0.18)", borderColor: "#FFD700" },
  chipActiveGuest: { backgroundColor: "rgba(74,222,128,0.18)", borderColor: "#4ADE80" },
  chipText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#fff" },

  durationRow: { flexDirection: "row", gap: 8 },
  durationCard: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center" },
  durationCardActive: { backgroundColor: "rgba(255,215,0,0.18)", borderColor: "#FFD700" },
  durationMins: { color: "#fff", fontSize: 26, fontWeight: "900" },
  durationMinsActive: { color: "#FFD700" },
  durationSub: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: -2 },
  durationSubActive: { color: "#FFD700" },
  durationCost: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 6 },
  durationCostActive: { color: "rgba(255,215,0,0.85)" },

  mixRow: { flexDirection: "row", gap: 8 },
  mixCard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  mixCardActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  mixText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  mixTextActive: { color: "#000" },

  topicsCard: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(255,215,0,0.15)" },
  topicsHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  topicsTitle: { color: "#FFD700", fontSize: 12, fontWeight: "800", letterSpacing: 1, flex: 1 },
  refreshTopicsBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,215,0,0.1)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  refreshTopicsText: { color: "#FFD700", fontSize: 11, fontWeight: "800" },
  topicRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  topicNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 2 },
  topicNumText: { fontSize: 12, fontWeight: "900" },
  topicTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  topicDesc: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2, lineHeight: 15 },
  eraTag: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginTop: 5 },
  eraTagText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  startBtn: { marginTop: 20, paddingVertical: 16, borderRadius: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, backgroundColor: "#FFD700" },
  startBtnText: { color: "#000", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  startSub: { color: "rgba(255,255,255,0.5)", fontSize: 11, textAlign: "center", marginTop: 8 },

  topicStrip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,215,0,0.08)", borderWidth: 1, borderColor: "rgba(255,215,0,0.25)" },
  topicStripLabel: { color: "rgba(255,215,0,0.7)", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  topicStripTitle: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 2 },
  skipBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)" },
  skipText: { fontSize: 11, fontWeight: "800" },

  bubbleRow: { flexDirection: "row", marginVertical: 6 },
  bubble: { maxWidth: "82%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1 },
  bubbleInterviewer: { backgroundColor: "rgba(255,215,0,0.12)", borderColor: "rgba(255,215,0,0.35)", borderTopLeftRadius: 4 },
  bubbleInterviewee: { backgroundColor: "rgba(74,222,128,0.12)", borderColor: "rgba(74,222,128,0.35)", borderTopRightRadius: 4 },
  bubbleInterrupt: { borderStyle: "dashed" },
  bubbleName: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5, marginBottom: 3 },
  bubbleText: { color: "#fff", fontSize: 14, lineHeight: 19 },

  endedBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: "rgba(20,20,20,0.95)", borderTopWidth: 1, borderTopColor: "rgba(255,215,0,0.3)", alignItems: "center" },
  endedTitle: { color: "#FFD700", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  endedBtnSecondary: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  topicsSheet: { backgroundColor: "#0F0F12", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderTopWidth: 1, borderColor: "rgba(255,215,0,0.2)" },
  handle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 12 },
  queueRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  queueRowCurrent: { backgroundColor: "rgba(255,215,0,0.06)", borderRadius: 8, paddingHorizontal: 8 },
  queueNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 10, backgroundColor: "rgba(255,215,0,0.12)" },

  paywallCard: { backgroundColor: "#15151A", margin: 30, padding: 20, borderRadius: 18, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  paywallTitle: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 6 },
  paywallSub: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4, textAlign: "center" },
  paywallBtn: { marginTop: 14, backgroundColor: "#FFD700", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, alignItems: "center", minWidth: 220 },
  paywallBtnText: { color: "#000", fontSize: 13, fontWeight: "900" },
  paywallSecondary: { marginTop: 8, paddingVertical: 8 },
  paywallSecondaryText: { color: "#FFD700", fontSize: 12, fontWeight: "800" },
});
