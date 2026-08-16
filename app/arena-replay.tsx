import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn, SlideInRight } from "react-native-reanimated";
import { Audio } from "expo-av";
import { playTTS, playAudioFromUrl } from "@/lib/audio-helper";
import { getPersonaVoiceVolume, shouldSkipPersonaVoice } from "@/lib/persona-voice";
import {
  ArenaRecording,
  RecordedMessage,
  getRecordings,
  deleteRecording,
  formatDuration,
  generateShareText,
} from "@/lib/arena-recordings";

const PERSONA_COLORS: Record<string, string> = {
  trump: "#ff4d4d",
  netanyahu: "#0038b8",
  ruckus: "#8b0000",
  galloway: "#c41e3a",
  mcconnell: "#708090",
  carville: "#e63946",
  maddow: "#7c3aed",
  omar: "#06b6d4",
  biden: "#3b82f6",
  rosie: "#ec4899",
  berniemc: "#f59e0b",
  elon: "#1DA1F2",
};

const SPEED_OPTIONS = [1, 1.5, 2];

export default function ArenaReplayScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const [recordings, setRecordings] = useState<ArenaRecording[]>([]);
  const [filterType, setFilterType] = useState<"all" | "1on1" | "arena">("all");
  const [selected, setSelected] = useState<ArenaRecording | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [visibleMessages, setVisibleMessages] = useState<RecordedMessage[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [sliderWidth, setSliderWidth] = useState(300);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const voiceEnabledRef = useRef(true);
  const playingRef = useRef(false);

  // TTS sequential queue — each clip waits for the previous to finish
  type TTSQueueItem =
    | { id: string; kind: "tts"; text: string; personaId: string }
    | { id: string; kind: "audio"; audioUri: string };
  const ttsQueueRef = useRef<TTSQueueItem[]>([]);
  const ttsProcessingRef = useRef(false);

  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  const stopReplayAudio = useCallback(() => {
    if (currentSoundRef.current) {
      const s = currentSoundRef.current;
      currentSoundRef.current = null;
      s.getStatusAsync().then((st: any) => {
        if (st.isLoaded) s.stopAsync().then(() => s.unloadAsync()).catch(() => {});
      }).catch(() => {});
    }
  }, []);

  /** Play TTS and await completion (resolves when audio finishes or errors). */
  const playReplayTTSAwait = useCallback(async (text: string, personaId: string): Promise<void> => {
    if (!voiceEnabledRef.current) return;
    if (shouldSkipPersonaVoice(personaId)) return;
    return new Promise<void>(async (resolve) => {
      try {
        const sound = await playTTS("/api/persona-speak", { text, personaId }, { volume: getPersonaVoiceVolume(personaId) });
        currentSoundRef.current = sound;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          sound.setOnPlaybackStatusUpdate(null);
          if (currentSoundRef.current === sound) currentSoundRef.current = null;
          sound.getStatusAsync().then((st: any) => {
            if (st.isLoaded) sound.unloadAsync().catch(() => {});
          }).catch(() => {});
          resolve();
        };
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish || status.error) finish();
        });
        setTimeout(finish, 30000);
      } catch { resolve(); }
    });
  }, []);

  /** Play a stored audio URI and await completion. */
  const playUserAudioAwait = useCallback(async (audioUri: string): Promise<void> => {
    if (!voiceEnabledRef.current) return;
    return new Promise<void>(async (resolve) => {
      try {
        const sound = await playAudioFromUrl(audioUri, { volume: 1.0 });
        currentSoundRef.current = sound;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          sound.setOnPlaybackStatusUpdate(null);
          if (currentSoundRef.current === sound) currentSoundRef.current = null;
          sound.getStatusAsync().then((st: any) => {
            if (st.isLoaded) sound.unloadAsync().catch(() => {});
          }).catch(() => {});
          resolve();
        };
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish || status.error) finish();
        });
        setTimeout(finish, 30000);
      } catch { resolve(); }
    });
  }, []);

  /** Drain the TTS queue sequentially — each item plays in full before the next starts. */
  const drainTTSQueue = useCallback(async () => {
    if (ttsProcessingRef.current) return;
    ttsProcessingRef.current = true;
    while (ttsQueueRef.current.length > 0 && playingRef.current) {
      const item = ttsQueueRef.current.shift()!;
      if (item.kind === "audio") {
        await playUserAudioAwait(item.audioUri);
      } else {
        await playReplayTTSAwait(item.text, item.personaId);
      }
    }
    ttsProcessingRef.current = false;
  }, [playReplayTTSAwait, playUserAudioAwait]);

  useEffect(() => {
    return () => { stopReplayAudio(); };
  }, [stopReplayAudio]);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    const recs = await getRecordings();
    setRecordings(recs);
    if (params.id) {
      const found = recs.find((r) => r.id === params.id);
      if (found) setSelected(found);
    }
  };

  useEffect(() => {
    if (!selected) return;
    const msgs = selected.messages.filter(
      (m) => m.relativeTime <= playbackTime * 1000
    );
    const prevCount = visibleMessages.length;
    setVisibleMessages(msgs);
    if (playing && msgs.length > prevCount) {
      // Enqueue ALL new messages — not just the first one
      const newMsgs = msgs.slice(prevCount);
      for (const msg of newMsgs) {
        if (msg.speakerId === "user" && msg.audioUri) {
          ttsQueueRef.current.push({ id: msg.id, kind: "audio", audioUri: msg.audioUri });
        } else if (!msg.isSystem) {
          ttsQueueRef.current.push({ id: msg.id, kind: "tts", text: msg.text, personaId: msg.speakerId });
        }
      }
      drainTTSQueue();
    }
  }, [playbackTime, selected, playing, drainTTSQueue]);

  useEffect(() => {
    if (playing && selected) {
      timerRef.current = setInterval(() => {
        setPlaybackTime((prev) => {
          const next = prev + 0.1 * speed;
          if (next >= selected.duration) {
            setPlaying(false);
            // Don't stop audio — let the last clip finish naturally; just stop adding new ones
            ttsQueueRef.current = [];
            if (timerRef.current) clearInterval(timerRef.current);
            return selected.duration;
          }
          return next;
        });
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, speed, selected]);

  useEffect(() => {
    if (visibleMessages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [visibleMessages.length]);

  const togglePlay = () => {
    if (!selected) return;
    if (playbackTime >= selected.duration) {
      setPlaybackTime(0);
      setVisibleMessages([]);
      ttsQueueRef.current = [];
    }
    setPlaying((p) => {
      if (p) {
        ttsQueueRef.current = [];
        stopReplayAudio();
      }
      return !p;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSeek = (evt: any) => {
    if (!selected) return;
    const x = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / sliderWidth));
    const newTime = ratio * selected.duration;
    ttsQueueRef.current = [];
    stopReplayAudio();
    setPlaybackTime(newTime);
    Haptics.selectionAsync();
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    setSpeed(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleShare = async () => {
    if (!selected) return;
    const text = generateShareText(selected);
    try {
      await Share.share({ message: text });
    } catch {}
  };

  const handleDelete = async (id: string) => {
    await deleteRecording(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
    if (selected?.id === id) {
      setSelected(null);
      setPlaying(false);
      setPlaybackTime(0);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selectRecording = (rec: ArenaRecording) => {
    stopReplayAudio();
    lastSpokenIdRef.current = null;
    setSelected(rec);
    setPlaying(false);
    setPlaybackTime(0);
    setVisibleMessages([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const getPersonaColor = (id: string) => PERSONA_COLORS[id] || "#666";

  const filteredRecordings = recordings.filter((r) => {
    if (filterType === "1on1") return r.personas.length <= 2;
    if (filterType === "arena") return r.personas.length > 2;
    return true;
  });

  const getRecordingType = (r: ArenaRecording) =>
    r.personas.length <= 2 ? "1-on-1" : "Arena";

  const renderMessage = ({ item }: { item: RecordedMessage }) => {
    const isInterruption = !!item.isInterruption;
    const color = getPersonaColor(item.speakerId);
    return (
      <Animated.View
        entering={SlideInRight.duration(300)}
        style={[
          s.msgRow,
          { borderLeftColor: color, borderLeftWidth: 3 },
          isInterruption && s.interruptionRow,
        ]}
      >
        <View style={s.msgHeader}>
          <View style={[s.msgAvatar, { backgroundColor: color }]}>
            <Text style={s.msgAvatarText}>
              {item.speakerName
                .replace("⚡ ", "")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .substring(0, 2)}
            </Text>
          </View>
          <Text style={[s.msgName, { color }]}>{item.speakerName}</Text>
          <Pressable
            onPress={() => item.speakerId === "user" && item.audioUri ? playUserAudio(item.audioUri) : playReplayTTS(item.text, item.speakerId)}
            style={s.listenBtn}
            hitSlop={8}
          >
            <Ionicons name={item.speakerId === "user" && item.audioUri ? "mic" : "volume-medium"} size={12} color="rgba(255,255,255,0.4)" />
          </Pressable>
          <Text style={s.msgTime}>
            {formatDuration(item.relativeTime / 1000)}
          </Text>
        </View>
        <Text style={s.msgText}>{item.text}</Text>
      </Animated.View>
    );
  };

  const progress = selected
    ? Math.min(1, playbackTime / selected.duration)
    : 0;

  if (selected) {
    return (
      <View style={[s.container, { paddingTop: insets.top || (Platform.OS === "web" ? 67 : 0) }]}>
        <LinearGradient colors={["#1a0a0a", "#0a0a0a"]} style={StyleSheet.absoluteFill} />

        <View style={s.header}>
          <Pressable onPress={() => { setSelected(null); setPlaying(false); setPlaybackTime(0); }} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle} numberOfLines={1}>{selected.topic}</Text>
            <Text style={s.headerSub}>{selected.messageCount} exchanges</Text>
          </View>
          <Pressable
            onPress={() => {
              setVoiceEnabled((v) => {
                if (v) stopReplayAudio();
                return !v;
              });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={s.shareBtn}
          >
            <Ionicons name={voiceEnabled ? "volume-high" : "volume-mute"} size={20} color={voiceEnabled ? "#FFD700" : "#666"} />
          </Pressable>
          <Pressable onPress={handleShare} style={s.shareBtn}>
            <Ionicons name="share-outline" size={22} color="#D4A420" />
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={visibleMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={s.messageList}
          contentContainerStyle={s.messageContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyReplay}>
              <Ionicons name="play-circle-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={s.emptyText}>Press play to start replay</Text>
            </View>
          }
        />

        <View style={[s.playerBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 34 : 16) }]}>
          <View style={s.timeRow}>
            <Text style={s.timeText}>{formatDuration(playbackTime)}</Text>
            <Text style={s.timeText}>{formatDuration(selected.duration)}</Text>
          </View>

          <Pressable
            onPress={handleSeek}
            onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
            style={s.sliderContainer}
          >
            <View style={s.sliderTrack}>
              <View style={[s.sliderFill, { width: `${progress * 100}%` }]} />
              <View style={[s.sliderThumb, { left: `${progress * 100}%` }]} />
            </View>
            <View style={s.tickMarks}>
              {selected.messages
                .filter((m) => m.isInterruption)
                .map((m, i) => (
                  <View
                    key={`int-${i}`}
                    style={[
                      s.interruptionTick,
                      { left: `${(m.relativeTime / (selected.duration * 1000)) * 100}%` },
                    ]}
                  />
                ))}
              {selected.messages
                .filter((m) => m.isSystem && /topic (changed|auto-rotated) to/i.test(m.text))
                .map((m, i) => {
                  const pct = (m.relativeTime / (selected.duration * 1000)) * 100;
                  const label = m.text.replace(/.*?:\s*/, "").slice(0, 18);
                  return (
                    <View key={`topic-${i}`} style={[s.topicMarker, { left: `${pct}%` }]}>
                      <View style={s.topicMarkerLine} />
                      <View style={s.topicMarkerDot} />
                      <Text style={s.topicMarkerLabel} numberOfLines={1}>{label}</Text>
                    </View>
                  );
                })}
            </View>
          </Pressable>

          <View style={s.controls}>
            <Pressable onPress={() => { setPlaybackTime(Math.max(0, playbackTime - 10)); }} style={s.controlBtn}>
              <Ionicons name="play-back" size={22} color="#fff" />
            </Pressable>

            <Pressable onPress={togglePlay} style={s.playBtn}>
              <LinearGradient colors={["#D4A420", "#B8860B"]} style={s.playBtnGrad}>
                <Ionicons name={playing ? "pause" : "play"} size={28} color="#000" />
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => { setPlaybackTime(Math.min(selected.duration, playbackTime + 10)); }} style={s.controlBtn}>
              <Ionicons name="play-forward" size={22} color="#fff" />
            </Pressable>

            <Pressable onPress={cycleSpeed} style={s.speedBtn}>
              <Text style={s.speedText}>{speed}x</Text>
            </Pressable>
          </View>

          <View style={s.speakerTimeline}>
            {selected.personas.slice(0, 6).map((pid) => {
              const color = getPersonaColor(pid);
              const count = visibleMessages.filter((m) => m.speakerId === pid).length;
              return (
                <View key={pid} style={s.speakerDot}>
                  <View style={[s.dotCircle, { backgroundColor: color, opacity: count > 0 ? 1 : 0.3 }]} />
                  <Text style={[s.dotLabel, { color }]}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top || (Platform.OS === "web" ? 67 : 0) }]}>
      <LinearGradient colors={["#1a0a0a", "#0a0a0a"]} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Recordings</Text>
          <Text style={s.headerSub}>{filteredRecordings.length} session{filteredRecordings.length !== 1 ? "s" : ""} saved</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter pills */}
      <View style={s.filterRow}>
        {(["all", "1on1", "arena"] as const).map((f) => {
          const label = f === "all" ? "All" : f === "1on1" ? "1-on-1" : "Arena";
          const active = filterType === f;
          return (
            <Pressable
              key={f}
              onPress={() => { setFilterType(f); Haptics.selectionAsync(); }}
              style={[s.filterPill, active && s.filterPillActive]}
            >
              <Text style={[s.filterPillText, active && s.filterPillTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {recordings.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="albums-outline" size={64} color="rgba(255,255,255,0.2)" />
          <Text style={s.emptyStateTitle}>No Recordings Yet</Text>
          <Text style={s.emptyStateText}>
            Arena sessions are automatically saved when a topic ends or the session expires.
          </Text>
          <Pressable onPress={() => router.push("/arena")} style={s.goArenaBtn}>
            <Text style={s.goArenaBtnText}>Go to Arena</Text>
          </Pressable>
        </View>
      ) : filteredRecordings.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="filter-outline" size={48} color="rgba(255,255,255,0.2)" />
          <Text style={s.emptyStateTitle}>No {filterType === "1on1" ? "1-on-1" : "Arena"} Replays</Text>
          <Text style={s.emptyStateText}>
            You don't have any {filterType === "1on1" ? "1-on-1 debate" : "Arena"} recordings yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRecordings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 80).duration(400)}>
              <Pressable onPress={() => selectRecording(item)} style={s.recordingCard}>
                <LinearGradient
                  colors={["rgba(212,164,32,0.08)", "rgba(212,164,32,0.02)"]}
                  style={s.cardGrad}
                >
                  <View style={s.cardTop}>
                    <View style={s.cardTopicWrap}>
                      <Ionicons name="mic" size={16} color="#D4A420" />
                      <Text style={s.cardTopic} numberOfLines={1}>{item.topic}</Text>
                    </View>
                    <View style={[
                      s.typeBadge,
                      item.personas.length <= 2 ? s.typeBadge1on1 : s.typeBadgeArena,
                    ]}>
                      <Text style={[
                        s.typeBadgeText,
                        item.personas.length <= 2 ? s.typeBadgeText1on1 : s.typeBadgeTextArena,
                      ]}>
                        {getRecordingType(item)}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleDelete(item.id)} hitSlop={12} style={{ marginLeft: 6 }}>
                      <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.3)" />
                    </Pressable>
                  </View>

                  <View style={s.cardPersonas}>
                    {item.personas.slice(0, 5).map((pid) => (
                      <View key={pid} style={[s.cardPersonaDot, { backgroundColor: getPersonaColor(pid) }]} />
                    ))}
                    {item.personas.length > 5 && (
                      <Text style={s.cardMoreText}>+{item.personas.length - 5}</Text>
                    )}
                  </View>

                  <View style={s.cardBottom}>
                    <Text style={s.cardStat}>{item.messageCount} exchanges</Text>
                    <Text style={s.cardDot}>{"\u2022"}</Text>
                    <Text style={s.cardStat}>{formatDuration(item.duration)}</Text>
                    <Text style={s.cardDot}>{"\u2022"}</Text>
                    <Text style={s.cardStat}>
                      {new Date(item.startTime).toLocaleDateString()}
                    </Text>
                  </View>

                  {item.highlightQuote ? (
                    <Text style={s.cardQuote} numberOfLines={2}>
                      "{item.highlightQuote}"
                    </Text>
                  ) : null}

                  <View style={s.cardActions}>
                    <Pressable
                      onPress={() => selectRecording(item)}
                      style={s.cardPlayBtn}
                    >
                      <Ionicons name="play" size={16} color="#000" />
                      <Text style={s.cardPlayText}>Replay</Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        const text = generateShareText(item);
                        try { await Share.share({ message: text }); } catch {}
                      }}
                      style={s.cardShareBtn}
                    >
                      <Ionicons name="share-outline" size={16} color="#D4A420" />
                      <Text style={s.cardShareText}>Share</Text>
                    </Pressable>
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,164,32,0.15)",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    color: "#D4A420",
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  headerSub: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
  shareBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  messageList: { flex: 1 },
  messageContent: { padding: 16, gap: 12 },
  msgRow: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
  },
  interruptionRow: {
    backgroundColor: "rgba(255,77,77,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.2)",
  },
  msgHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  msgAvatarText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  msgName: { fontSize: 13, fontWeight: "700" as const, flex: 1 },
  listenBtn: {
    padding: 4,
    marginRight: 4,
  },
  msgTime: { color: "rgba(255,255,255,0.3)", fontSize: 11 },
  msgText: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 20 },
  playerBar: {
    backgroundColor: "rgba(20,20,20,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(212,164,32,0.2)",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  timeText: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
  sliderContainer: { height: 40, justifyContent: "center", marginBottom: 8, paddingTop: 16 },
  sliderTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    overflow: "visible",
  },
  sliderFill: {
    height: 4,
    backgroundColor: "#D4A420",
    borderRadius: 2,
  },
  sliderThumb: {
    position: "absolute",
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#D4A420",
    marginLeft: -8,
    shadowColor: "#D4A420",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  tickMarks: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    overflow: "visible",
  },
  interruptionTick: {
    position: "absolute",
    top: -2,
    width: 2,
    height: 8,
    backgroundColor: "#ff4d4d",
    borderRadius: 1,
  },
  topicMarker: {
    position: "absolute",
    top: -14,
    alignItems: "center",
    marginLeft: -1,
  },
  topicMarkerLine: {
    width: 2,
    height: 20,
    backgroundColor: "rgba(212,164,32,0.6)",
    borderRadius: 1,
  },
  topicMarkerDot: {
    position: "absolute",
    top: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D4A420",
  },
  topicMarkerLabel: {
    position: "absolute",
    top: -16,
    color: "rgba(212,164,32,0.8)",
    fontSize: 8,
    fontWeight: "600" as const,
    width: 60,
    textAlign: "center",
    marginLeft: -29,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 8,
  },
  controlBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  playBtn: { width: 56, height: 56, borderRadius: 28, overflow: "hidden" },
  playBtnGrad: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  speedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(212,164,32,0.15)",
  },
  speedText: { color: "#D4A420", fontSize: 13, fontWeight: "700" },
  speakerTimeline: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingTop: 4,
  },
  speakerDot: { alignItems: "center", gap: 2 },
  dotCircle: { width: 8, height: 8, borderRadius: 4 },
  dotLabel: { fontSize: 10, fontWeight: "600" },
  emptyReplay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    gap: 12,
  },
  emptyText: { color: "rgba(255,255,255,0.4)", fontSize: 14 },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyStateTitle: {
    color: "#D4A420",
    fontSize: 20,
    fontFamily: "PlayfairDisplay_700Bold",
    marginTop: 8,
  },
  emptyStateText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  goArenaBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#D4A420",
    borderRadius: 12,
  },
  goArenaBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  listContent: { padding: 16, gap: 12, paddingBottom: 60 },
  recordingCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.15)",
  },
  cardGrad: { padding: 16, gap: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTopicWrap: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  cardTopic: {
    color: "#D4A420",
    fontSize: 16,
    fontFamily: "PlayfairDisplay_700Bold",
    flex: 1,
  },
  cardPersonas: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardPersonaDot: { width: 12, height: 12, borderRadius: 6 },
  cardMoreText: { color: "rgba(255,255,255,0.4)", fontSize: 11 },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardStat: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  cardDot: { color: "rgba(255,255,255,0.2)", fontSize: 10 },
  cardQuote: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
  },
  cardActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  cardPlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#D4A420",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cardPlayText: { color: "#000", fontWeight: "700", fontSize: 13 },
  cardShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cardShareText: { color: "#D4A420", fontWeight: "600", fontSize: 13 },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,164,32,0.1)",
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "transparent",
  },
  filterPillActive: {
    backgroundColor: "#D4A420",
    borderColor: "#D4A420",
  },
  filterPillText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  filterPillTextActive: {
    color: "#000",
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeBadge1on1: {
    backgroundColor: "rgba(99,102,241,0.15)",
    borderColor: "rgba(99,102,241,0.4)",
  },
  typeBadgeArena: {
    backgroundColor: "rgba(212,164,32,0.12)",
    borderColor: "rgba(212,164,32,0.35)",
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  typeBadgeText1on1: { color: "#818cf8" },
  typeBadgeTextArena: { color: "#D4A420" },
});
