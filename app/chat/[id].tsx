import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  AppState,
  type AppStateStatus,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons, MaterialCommunityIcons, Feather, FontAwesome5 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  withSpring,
  cancelAnimation,
  interpolateColor,
} from "react-native-reanimated";
import { createAudioPlayer, type AudioPlayer as ExpoAudioPlayer } from "expo-audio";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Colors from "@/constants/colors";
import {
  Message,
  getConversation,
  saveMessages,
  generateUniqueId,
  saveDraft,
  loadDraft,
  clearDraft,
} from "@/lib/chat-storage";
import { streamChat, type ChatMood } from "@/lib/stream-chat";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";

interface FileAttachment {
  type: "image" | "document";
  uri: string;
  name: string;
  mimeType: string;
  base64?: string;
  textContent?: string;
}

const TRUMP_VOICE_KEY = "chatdjt_trump_voice";
const AUTO_SPEAK_KEY = "chatdjt_auto_speak";

let currentPlayer: ExpoAudioPlayer | HTMLAudioElement | null = null;
let lastAudioUri: string | null = null;
let lastAudioMood: ChatMood | undefined = undefined;
let lastAudioMessageId: string | null = null;

function MessageBubble({
  message,
}: {
  message: Message;
}) {
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
      ]}
    >
      {!isUser && (
        <View style={styles.avatarContainer}>
          <MaterialCommunityIcons name="crown" size={16} color={Colors.gold} />
        </View>
      )}
      <View style={isUser ? styles.userBubbleWrap : styles.assistantBubbleWrap}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
            ]}
          >
            {message.content}
          </Text>
        </View>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.typingRow}>
      <View style={styles.avatarContainer}>
        <MaterialCommunityIcons name="crown" size={16} color={Colors.gold} />
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          <Animated.View
            entering={FadeIn.delay(0).duration(400)}
            style={styles.dot}
          />
          <Animated.View
            entering={FadeIn.delay(200).duration(400)}
            style={styles.dot}
          />
          <Animated.View
            entering={FadeIn.delay(400).duration(400)}
            style={styles.dot}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const trumpAvatarImage = require("@/assets/images/trump-avatar.jpg");

function MouthShape({ openAmount }: { openAmount: Animated.SharedValue<number> }) {
  const mouthStyle = useAnimatedStyle(() => {
    const open = openAmount.value;
    return {
      height: 4 + open * 14,
      width: 22 + open * 8,
      borderRadius: 6 + open * 8,
      opacity: 0.7 + open * 0.3,
    };
  });

  return (
    <Animated.View style={[avatarStyles.mouthShape, mouthStyle]} />
  );
}

function TrumpTalkingAvatar({ isSpeaking, mood }: { isSpeaking: boolean; mood?: ChatMood }) {
  const glowPulse = useSharedValue(0.4);
  const scaleAnim = useSharedValue(1);
  const borderAnim = useSharedValue(0);
  const mouthOpen = useSharedValue(0);
  const jawMove = useSharedValue(0);
  const browTense = useSharedValue(0);
  const headTilt = useSharedValue(0);

  const isFiredUp = mood === "FIRED_UP";

  useEffect(() => {
    if (isSpeaking) {
      glowPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true
      );
      scaleAnim.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.98, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.01, { duration: 350, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true
      );
      borderAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true
      );

      const mouthSpeed = isFiredUp ? 120 : 200;
      mouthOpen.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: mouthSpeed, easing: Easing.out(Easing.quad) }),
          withTiming(0.2, { duration: mouthSpeed * 0.7, easing: Easing.in(Easing.quad) }),
          withTiming(0.7, { duration: mouthSpeed * 0.8, easing: Easing.out(Easing.quad) }),
          withTiming(0.1, { duration: mouthSpeed * 0.6, easing: Easing.in(Easing.quad) }),
          withTiming(0.8, { duration: mouthSpeed * 0.9, easing: Easing.out(Easing.quad) }),
          withTiming(0.3, { duration: mouthSpeed * 0.5, easing: Easing.in(Easing.quad) }),
          withTiming(0.6, { duration: mouthSpeed * 0.7, easing: Easing.out(Easing.quad) }),
          withTiming(0.05, { duration: mouthSpeed * 1.2, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false
      );

      jawMove.value = withRepeat(
        withSequence(
          withTiming(1, { duration: mouthSpeed * 1.2, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: mouthSpeed * 0.8, easing: Easing.in(Easing.quad) }),
          withTiming(0.7, { duration: mouthSpeed, easing: Easing.out(Easing.quad) }),
          withTiming(0.1, { duration: mouthSpeed * 0.6, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false
      );

      if (isFiredUp) {
        browTense.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }),
            withTiming(0.5, { duration: 300 }),
            withTiming(0.8, { duration: 250 }),
            withTiming(0.3, { duration: 500 }),
          ),
          -1,
          false
        );
        headTilt.value = withRepeat(
          withSequence(
            withTiming(3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
            withTiming(-2, { duration: 500, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(-3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true
        );
      } else {
        browTense.value = withTiming(0, { duration: 300 });
        headTilt.value = withRepeat(
          withSequence(
            withTiming(1.5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            withTiming(-1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true
        );
      }
    } else {
      cancelAnimation(glowPulse);
      cancelAnimation(scaleAnim);
      cancelAnimation(borderAnim);
      cancelAnimation(mouthOpen);
      cancelAnimation(jawMove);
      cancelAnimation(browTense);
      cancelAnimation(headTilt);
      glowPulse.value = withTiming(0, { duration: 300 });
      scaleAnim.value = withTiming(1, { duration: 200 });
      borderAnim.value = withTiming(0, { duration: 200 });
      mouthOpen.value = withTiming(0, { duration: 150 });
      jawMove.value = withTiming(0, { duration: 150 });
      browTense.value = withTiming(0, { duration: 200 });
      headTilt.value = withTiming(0, { duration: 300 });
    }
  }, [isSpeaking, isFiredUp]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value,
    transform: [{ scale: 1 + glowPulse.value * 0.05 }],
  }));

  const frameStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scaleAnim.value },
      { rotate: `${headTilt.value}deg` },
    ],
    borderColor: interpolateColor(
      borderAnim.value,
      [0, 1],
      [isFiredUp ? "#CC3333" : "#D4A420", isFiredUp ? "#FF5555" : "#FFD700"]
    ),
  }));

  const jawStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: jawMove.value * 3 }],
  }));

  const browStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 - browTense.value * 0.3 }],
    opacity: browTense.value * 0.6,
  }));

  if (!isSpeaking) return null;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={avatarStyles.container}>
      <Animated.View style={[avatarStyles.glowRing, glowStyle, isFiredUp && avatarStyles.glowRingAngry]} />
      <Animated.View style={[avatarStyles.avatarFrame, frameStyle]}>
        <Animated.View style={jawStyle}>
          <Image
            source={trumpAvatarImage}
            style={avatarStyles.avatarImage}
            resizeMode="cover"
          />
        </Animated.View>
        <Animated.View style={[avatarStyles.browOverlay, browStyle]} />
        <View style={avatarStyles.mouthArea}>
          <MouthShape openAmount={mouthOpen} />
        </View>
      </Animated.View>
      <View style={avatarStyles.speakingRow}>
        <View style={[avatarStyles.speakingDot, isFiredUp && avatarStyles.dotAngry]} />
        <Text style={[avatarStyles.speakingLabel, isFiredUp && avatarStyles.labelAngry]}>
          {isFiredUp ? "FIRED UP" : "SPEAKING"}
        </Text>
        <View style={[avatarStyles.speakingDot, isFiredUp && avatarStyles.dotAngry]} />
      </View>
    </Animated.View>
  );
}

const avatarStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 10,
    gap: 8,
  },
  glowRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    top: 3,
    backgroundColor: "transparent",
    borderWidth: 2.5,
    borderColor: Colors.gold,
    ...Platform.select({
      web: {
        boxShadow: "0 0 24px rgba(212, 164, 32, 0.6), 0 0 48px rgba(212, 164, 32, 0.25)",
      },
      default: {},
    }),
  },
  glowRingAngry: {
    borderColor: "#CC3333",
    ...Platform.select({
      web: {
        boxShadow: "0 0 24px rgba(204, 51, 51, 0.6), 0 0 48px rgba(255, 68, 68, 0.25)",
      },
      default: {},
    }),
  },
  avatarFrame: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "#0A0A0A",
    borderWidth: 3,
    borderColor: Colors.gold,
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 6px 20px rgba(0,0,0,0.6), 0 2px 8px rgba(212, 164, 32, 0.4)",
      },
      default: {},
    }),
  },
  avatarImage: {
    width: 128 as any,
    height: 128 as any,
  },
  browOverlay: {
    position: "absolute",
    top: 25,
    left: 20,
    right: 20,
    height: 18,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 4,
  },
  mouthArea: {
    position: "absolute",
    bottom: 22,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    height: 24,
  },
  mouthShape: {
    backgroundColor: "rgba(30, 10, 10, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(150, 80, 80, 0.4)",
  },
  speakingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  speakingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.gold,
  },
  dotAngry: {
    backgroundColor: "#FF4444",
  },
  speakingLabel: {
    fontSize: 10,
    color: Colors.gold,
    fontWeight: "700" as const,
    letterSpacing: 2,
  },
  labelAngry: {
    color: "#FF4444",
  },
});

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { deviceId, balance, refreshBalance, hasTokens } = useTokens();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [trumpVoice, setTrumpVoice] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [messageMoods, setMessageMoods] = useState<Record<string, ChatMood>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const inputRef = useRef<TextInput>(null);
  const initializedRef = useRef(false);
  const conversationIdRef = useRef(id);
  const trumpVoiceRef = useRef(true);
  const autoSpeakRef = useRef(true);
  const pendingAutoSpeakRef = useRef<string | null>(null);
  const handleSpeakRef = useRef<(messageId: string, text: string, mood?: ChatMood) => Promise<void>>();
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadConversation();
    loadVoicePreference();
    loadAutoSpeakPreference();
    loadDraftText();
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [id]);

  async function loadDraftText() {
    if (!id) return;
    const draft = await loadDraft(id);
    if (draft) setInputText(draft);
  }

  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (id) saveDraft(id, text);
    }, 500);
  }, [id]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current === "active" && (nextState === "background" || nextState === "inactive")) {
        stopCurrentPlayer();
        setSpeakingMessageId(null);

        if (isRecording) {
          try {
            if (Platform.OS === "web") {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
              }
            } else if (recordingRef.current) {
              recordingRef.current.stopAndUnloadAsync().catch(() => {});
              Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
              recordingRef.current = null;
            }
          } catch {}
          setIsRecording(false);
        }
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [isRecording]);

  async function loadVoicePreference() {
    try {
      const saved = await AsyncStorage.getItem(TRUMP_VOICE_KEY);
      if (saved !== null) {
        const val = saved === "true";
        setTrumpVoice(val);
        trumpVoiceRef.current = val;
      }
    } catch {}
  }

  async function loadAutoSpeakPreference() {
    try {
      const saved = await AsyncStorage.getItem(AUTO_SPEAK_KEY);
      if (saved !== null) {
        const val = saved === "true";
        setAutoSpeak(val);
        autoSpeakRef.current = val;
      }
    } catch {}
  }

  async function toggleTrumpVoice() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newVal = !trumpVoice;
    setTrumpVoice(newVal);
    trumpVoiceRef.current = newVal;
    await AsyncStorage.setItem(TRUMP_VOICE_KEY, String(newVal));
  }

  async function toggleAutoSpeak() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newVal = !autoSpeak;
    setAutoSpeak(newVal);
    autoSpeakRef.current = newVal;
    await AsyncStorage.setItem(AUTO_SPEAK_KEY, String(newVal));
  }

  async function startRecording() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (Platform.OS === "web") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          await transcribeAudio(blob, "webm");
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
      } else {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) return;

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setIsRecording(true);
      }
    } catch (error) {
      console.error("Recording start error:", error);
      setIsRecording(false);
    }
  }

  async function stopRecording() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (Platform.OS === "web") {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
      } else {
        if (!recordingRef.current) return;
        setIsRecording(false);

        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

        const uri = recordingRef.current.getURI();
        recordingRef.current = null;

        if (!uri) return;

        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await transcribeFromBase64(base64, "m4a");
      }
    } catch (error) {
      console.error("Recording stop error:", error);
      setIsRecording(false);
    }
  }

  async function transcribeAudio(blob: Blob, format: string) {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      await transcribeFromBase64(base64, format);
    } catch (error) {
      console.error("Transcription error:", error);
    } finally {
      setIsTranscribing(false);
    }
  }

  async function transcribeFromBase64(base64: string, format: string) {
    setIsTranscribing(true);
    try {
      const baseUrl = getApiUrl();
      const response = await globalThis.fetch(`${baseUrl}api/stt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, format }),
      });

      if (!response.ok) throw new Error("STT request failed");

      const data = await response.json();
      if (data.text && data.text.trim()) {
        setInputText((prev) => {
          const updated = prev ? prev + " " + data.text.trim() : data.text.trim();
          if (id) saveDraft(id, updated);
          return updated;
        });
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Transcription error:", error);
    } finally {
      setIsTranscribing(false);
    }
  }

  function stopCurrentPlayer() {
    if (currentPlayer) {
      if (currentPlayer instanceof HTMLAudioElement) {
        try { currentPlayer.pause(); currentPlayer.src = ""; } catch {}
      } else {
        try { currentPlayer.pause(); } catch {}
        try { currentPlayer.remove(); } catch {}
      }
      currentPlayer = null;
    }
  }

  async function playAudioFromUri(uri: string, msgId: string): Promise<void> {
    stopCurrentPlayer();
    setSpeakingMessageId(msgId);

    try {
      if (Platform.OS === "web") {
        const audio = new window.Audio(uri);
        currentPlayer = audio;

        audio.onended = () => {
          setSpeakingMessageId(null);
          currentPlayer = null;
        };

        audio.onerror = () => {
          setSpeakingMessageId(null);
          currentPlayer = null;
        };

        try {
          await audio.play();
        } catch (playErr) {
          console.warn("Audio autoplay blocked, retrying...", playErr);
          const retryPlay = () => {
            audio.play().catch(() => {});
            document.removeEventListener("click", retryPlay);
          };
          document.addEventListener("click", retryPlay, { once: true });
        }
      } else {
        const player = createAudioPlayer({ uri });
        currentPlayer = player;

        let hasFinished = false;
        const safetyTimeout = setTimeout(() => {
          if (!hasFinished) {
            hasFinished = true;
            setSpeakingMessageId(null);
            try { player.pause(); } catch {}
            try { player.remove(); } catch {}
            currentPlayer = null;
          }
        }, 120000);

        player.addListener("playbackStatusUpdate", (status: any) => {
          if (hasFinished) return;
          const isIdle = status.playing === false && status.isBuffering !== true;
          if (status.didJustFinish || (status.playbackState && String(status.playbackState).toLowerCase().includes("end")) || (isIdle && status.currentTime > 0)) {
            hasFinished = true;
            clearTimeout(safetyTimeout);
            setSpeakingMessageId(null);
            try { player.remove(); } catch {}
            currentPlayer = null;
          }
        });

        try {
          player.play();
        } catch (playErr) {
          console.warn("Native audio play failed:", playErr);
          clearTimeout(safetyTimeout);
          setSpeakingMessageId(null);
          try { player.remove(); } catch {}
          currentPlayer = null;
        }
      }
    } catch (err) {
      console.error("Audio play error:", err);
      setSpeakingMessageId(null);
    }
  }

  async function handleSpeak(messageId: string, text: string, mood?: ChatMood) {
    stopCurrentPlayer();
    setSpeakingMessageId(messageId);

    try {
      const baseUrl = getApiUrl();
      const msgMood = mood || "CALM";
      const cleanText = text.replace(/\[MOOD:(CALM|FIRED_UP)\]\n?/g, "").trim();
      if (!cleanText) {
        setSpeakingMessageId(null);
        return;
      }
      const response = await globalThis.fetch(`${baseUrl}api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, mood: msgMood }),
      });

      if (!response.ok) throw new Error(`TTS request failed: ${response.status}`);

      const audioBlob = await response.blob();

      if (Platform.OS === "web") {
        if (lastAudioUri) {
          try { URL.revokeObjectURL(lastAudioUri); } catch {}
        }
        const blobUrl = URL.createObjectURL(audioBlob);
        lastAudioUri = blobUrl;
        lastAudioMood = mood;
        lastAudioMessageId = messageId;
        await playAudioFromUri(blobUrl, messageId);
      } else {
        const arrayBuffer = await new Response(audioBlob).arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 8192;
        let base64 = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          base64 += String.fromCharCode.apply(null, chunk as any);
        }
        base64 = btoa(base64);
        const tempPath = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(tempPath, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        lastAudioUri = tempPath;
        lastAudioMood = mood;
        lastAudioMessageId = messageId;
        await playAudioFromUri(tempPath, messageId);
      }
    } catch (error) {
      console.error("TTS playback error:", error);
      setSpeakingMessageId(null);
    }
  }

  async function handleReplay() {
    if (!lastAudioUri || !lastAudioMessageId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await playAudioFromUri(lastAudioUri, lastAudioMessageId);
  }

  handleSpeakRef.current = handleSpeak;

  async function compressImageBase64(base64: string, mimeType: string): Promise<string> {
    if (Platform.OS === "web") {
      try {
        const img = new window.Image();
        const loadPromise = new Promise<string>((resolve, reject) => {
          img.onload = () => {
            const maxDim = 1024;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
              else { w = Math.round(w * maxDim / h); h = maxDim; }
            }
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) { resolve(base64); return; }
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
            resolve(dataUrl.split(",")[1] || base64);
          };
          img.onerror = () => resolve(base64);
        });
        img.src = `data:${mimeType};base64,${base64}`;
        return await loadPromise;
      } catch {
        return base64;
      }
    }
    return base64;
  }

  async function pickImage() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.5,
        base64: true,
        allowsEditing: false,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        let base64Data = asset.base64 || undefined;

        if (base64Data) {
          if (Platform.OS === "web" && base64Data.length > 300000) {
            base64Data = await compressImageBase64(base64Data, asset.mimeType || "image/jpeg");
          }
          const MAX_BASE64 = 1500000;
          if (base64Data.length > MAX_BASE64) {
            base64Data = base64Data.substring(0, MAX_BASE64);
          }
        }

        setAttachment({
          type: "image",
          uri: asset.uri,
          name: asset.fileName || "photo.jpg",
          mimeType: asset.mimeType || "image/jpeg",
          base64: base64Data,
        });
      }
    } catch (error) {
      console.error("Image picker error:", error);
    }
  }

  async function pickDocument() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/*", "application/pdf", "application/json", "text/csv", "text/plain"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isImage = asset.mimeType?.startsWith("image/");
        const isPdf = asset.mimeType === "application/pdf";

        if (asset.size && asset.size > 10 * 1024 * 1024) {
          Alert.alert("File Too Large", "Please choose a file smaller than 10MB.");
          return;
        }

        if (isImage) {
          let base64: string | undefined;
          try {
            if (Platform.OS !== "web" && FileSystem.documentDirectory) {
              const b64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              const MAX_BASE64 = 1500000;
              base64 = b64.length > MAX_BASE64 ? b64.substring(0, MAX_BASE64) : b64;
            }
          } catch {
            console.warn("Failed to read image as base64");
          }
          setAttachment({
            type: "image",
            uri: asset.uri,
            name: asset.name || "file",
            mimeType: asset.mimeType || "image/jpeg",
            base64,
          });
        } else if (isPdf) {
          setAttachment({
            type: "document",
            uri: asset.uri,
            name: asset.name || "document.pdf",
            mimeType: "application/pdf",
            textContent: `[PDF Document: ${asset.name || "document.pdf"}${asset.size ? ` (${Math.round(asset.size / 1024)}KB)` : ""}]\n\nThis is a PDF file. I can see that you've shared it, but I can't read the contents directly. Tell me what's in it and I'll give you my opinion!`,
          });
        } else {
          let textContent = "";
          try {
            if (Platform.OS === "web") {
              const controller = new AbortController();
              const fetchTimeout = setTimeout(() => controller.abort(), 10000);
              const resp = await fetch(asset.uri, { signal: controller.signal });
              clearTimeout(fetchTimeout);
              textContent = await resp.text();
            } else if (FileSystem.documentDirectory) {
              const fileInfo = await FileSystem.getInfoAsync(asset.uri);
              if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > 500000) {
                textContent = `[File too large to read: ${asset.name} (${Math.round(fileInfo.size / 1024)}KB)]`;
              } else {
                textContent = await FileSystem.readAsStringAsync(asset.uri, {
                  encoding: FileSystem.EncodingType.UTF8,
                });
              }
            }
          } catch {
            textContent = `[Unable to read file: ${asset.name}]`;
          }

          setAttachment({
            type: "document",
            uri: asset.uri,
            name: asset.name || "document",
            mimeType: asset.mimeType || "text/plain",
            textContent: textContent.slice(0, 8000),
          });
        }
      }
    } catch (error) {
      console.error("Document picker error:", error);
    }
  }

  function showAttachmentOptions() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") {
      pickDocument();
      return;
    }
    Alert.alert("Attach File", "Choose what to share with the President", [
      { text: "Photo", onPress: pickImage },
      { text: "Document", onPress: pickDocument },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function loadConversation() {
    if (initializedRef.current) return;
    const conv = await getConversation(id!);
    if (conv) {
      setMessages(conv.messages);
    }
    initializedRef.current = true;
    setIsLoading(false);
  }

  async function handleSend() {
    const text = inputText.trim();
    const currentAttachment = attachment;
    if ((!text && !currentAttachment) || isStreaming) return;

    if (!hasTokens) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.push("/subscribe");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText("");
    setAttachment(null);
    if (id) clearDraft(id);

    let displayContent = text;
    let imageBase64ForApi: string | undefined;

    if (currentAttachment) {
      if (currentAttachment.type === "image") {
        displayContent = text ? `[Image: ${currentAttachment.name}]\n${text}` : `[Image: ${currentAttachment.name}]`;
        if (currentAttachment.base64) {
          imageBase64ForApi = `data:${currentAttachment.mimeType};base64,${currentAttachment.base64}`;
        } else if (Platform.OS === "web") {
          try {
            const resp = await fetch(currentAttachment.uri);
            const blob = await resp.blob();
            if (blob.size > 5 * 1024 * 1024) {
              console.warn("Image blob too large, skipping base64 conversion");
            } else {
              const reader = new FileReader();
              const b64 = await Promise.race([
                new Promise<string>((resolve, reject) => {
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                }),
                new Promise<string>((_, reject) =>
                  setTimeout(() => reject(new Error("File read timeout")), 15000)
                ),
              ]);
              imageBase64ForApi = b64;
            }
          } catch (fileErr) {
            console.warn("Failed to read image for API:", fileErr);
          }
        }
      } else if (currentAttachment.type === "document" && currentAttachment.textContent) {
        const filePrefix = `[File: ${currentAttachment.name}]\n---\n${currentAttachment.textContent}\n---\n`;
        displayContent = text ? `${filePrefix}\n${text}` : `${filePrefix}\nPlease review this file and give me your advice.`;
      }
    }

    const currentMessages = [...messages];
    const userMessage: Message = {
      id: generateUniqueId(),
      role: "user",
      content: displayContent || "What do you think of this?",
      timestamp: Date.now(),
    };

    const updatedWithUser = [...currentMessages, userMessage];
    setMessages(updatedWithUser);
    setIsStreaming(true);
    setShowTyping(true);

    await saveMessages(conversationIdRef.current!, updatedWithUser);

    let fullContent = "";
    let assistantAdded = false;
    let finalMessages = updatedWithUser;
    let assistantMsgId = "";
    let detectedMood: ChatMood = "CALM";

    try {
      const chatHistory: { role: string; content: string; imageBase64?: string }[] = [
        ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const lastMsg: { role: string; content: string; imageBase64?: string } = {
        role: "user",
        content: text || (currentAttachment?.type === "image" ? "What do you think of this image? Give me your advice." : "Please review this and give me your advice."),
      };
      if (imageBase64ForApi) {
        lastMsg.imageBase64 = imageBase64ForApi;
      } else if (currentAttachment?.type === "document" && currentAttachment.textContent) {
        lastMsg.content = `[File: ${currentAttachment.name}]\n---\n${currentAttachment.textContent}\n---\n\n${text || "Please review this file and give me your advice."}`;
      }
      chatHistory.push(lastMsg);

      const voiceSetting = trumpVoiceRef.current;
      const result = await streamChat(chatHistory, (chunk) => {

        fullContent += chunk;

        if (!assistantAdded) {
          setShowTyping(false);
          assistantMsgId = generateUniqueId();
          const assistantMsg: Message = {
            id: assistantMsgId,
            role: "assistant",
            content: chunk,
            timestamp: Date.now(),
          };
          setMessages((prev) => {
            const updated = [...prev, assistantMsg];
            finalMessages = updated;
            return updated;
          });
          assistantAdded = true;
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: fullContent,
            };
            finalMessages = updated;
            return updated;
          });
        }
      }, voiceSetting, deviceId);

      detectedMood = result.mood;
      if (assistantMsgId) {
        setMessageMoods((prev) => ({ ...prev, [assistantMsgId]: detectedMood }));
      }
      refreshBalance();
    } catch (error: any) {
      setShowTyping(false);

      if (error?.message === "NO_TOKENS") {
        const noTokenMsg: Message = {
          id: generateUniqueId(),
          role: "assistant",
          content: "You're out of Trump Tokens! Get more tokens to keep this tremendous conversation going.",
          timestamp: Date.now(),
        };
        setMessages((prev) => {
          const updated = [...prev, noTokenMsg];
          finalMessages = updated;
          return updated;
        });
        refreshBalance();
        setTimeout(() => router.push("/subscribe"), 1500);
      } else {
        const errorMsg: Message = {
          id: generateUniqueId(),
          role: "assistant",
          content:
            "Look, we had a little problem. Believe me, it's not my fault. The FAKE servers are acting up. Try again!",
          timestamp: Date.now(),
        };
        setMessages((prev) => {
          const updated = [...prev, errorMsg];
          finalMessages = updated;
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
      await saveMessages(conversationIdRef.current!, finalMessages);

      if (autoSpeakRef.current && fullContent.length > 0) {
        const lastMsg = finalMessages[finalMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && handleSpeakRef.current) {
          handleSpeakRef.current(lastMsg.id, lastMsg.content, detectedMood);
        }
      }
    }
  }

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const isWeb = Platform.OS === "web";
  const displayMessages = isWeb ? messages : [...messages].reverse();
  const flatListRef = useRef<FlatList>(null);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <Image
        source={require("@/assets/images/djt-logo.png")}
        style={styles.chatBackgroundLogo}
        resizeMode="contain"
      />
      <View style={styles.chatHeader}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
          testID="back-button"
        >
          <Ionicons name="chevron-back" size={24} color={Colors.gold} />
        </Pressable>
        <View style={styles.chatHeaderCenter}>
          <MaterialCommunityIcons name="crown" size={20} color={Colors.gold} />
          <Text style={styles.chatHeaderTitle}>Chat DJT</Text>
        </View>
        <Pressable
          onPress={() => router.push("/subscribe")}
          style={styles.tokenBadge}
          testID="token-badge"
        >
          <FontAwesome5 name="coins" size={12} color={Colors.gold} />
          <Text style={styles.tokenBadgeText}>
            {balance ? balance.totalAvailable : "..."}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
            />
          )}
          inverted={!isWeb && messages.length > 0}
          onContentSizeChange={() => {
            if (isWeb && messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          ListHeaderComponent={!isWeb && showTyping ? <TypingIndicator /> : null}
          ListFooterComponent={isWeb && showTyping ? <TypingIndicator /> : null}
          ListEmptyComponent={
            <View style={[styles.welcomeContainer, !isWeb && styles.welcomeFlipped]}>
              <Animated.View
                entering={FadeInDown.duration(600)}
                style={styles.welcomeInner}
              >
                <MaterialCommunityIcons
                  name="crown"
                  size={48}
                  color={Colors.gold}
                />
                <Text style={styles.welcomeTitle}>
                  Ask Me Anything!
                </Text>
                <Text style={styles.welcomeSubtitle}>
                  I know more about everything than anybody. Believe me. Go ahead, ask!
                </Text>
              </Animated.View>
            </View>
          }
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.messageListEmpty,
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        <TrumpTalkingAvatar
          isSpeaking={!!speakingMessageId}
          mood={speakingMessageId ? messageMoods[speakingMessageId] : undefined}
        />

        <View
          style={[
            styles.inputContainer,
            { paddingBottom: insets.bottom + webBottomInset + 8 },
          ]}
        >
          {attachment && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.attachmentPreview}>
              {attachment.type === "image" ? (
                <Image
                  source={{ uri: attachment.uri }}
                  style={styles.attachmentImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.attachmentDocIcon}>
                  <Ionicons name="document-text" size={20} color={Colors.gold} />
                </View>
              )}
              <Text style={styles.attachmentName} numberOfLines={1}>
                {attachment.name}
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAttachment(null);
                }}
                style={styles.attachmentRemove}
                testID="remove-attachment"
              >
                <Ionicons name="close-circle" size={20} color={Colors.whiteMuted} />
              </Pressable>
            </Animated.View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Ask the greatest president ever..."
              placeholderTextColor={Colors.whiteMuted}
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={2000}
              blurOnSubmit={false}
              onSubmitEditing={handleSend}
              editable={!isStreaming && !isRecording}
              testID="chat-input"
            />
            <Pressable
              onPress={() => {
                handleSend();
                inputRef.current?.focus();
              }}
              disabled={(!inputText.trim() && !attachment) || isStreaming}
              style={({ pressed }) => [
                styles.glossySendButton,
                ((!inputText.trim() && !attachment) || isStreaming) && styles.glossyButtonDisabled,
                pressed && styles.glossyButtonPressed,
              ]}
              testID="send-button"
            >
              {isStreaming ? (
                <ActivityIndicator size="small" color="#1A1000" />
              ) : (
                <Ionicons name="arrow-up" size={18} color="#1A1000" />
              )}
            </Pressable>
          </View>
          <View style={styles.iconBar}>
            <Pressable
              onPress={showAttachmentOptions}
              disabled={isStreaming || isRecording}
              style={[
                styles.glossyIconWrap,
                (isStreaming || isRecording) && styles.glossyButtonDisabled,
              ]}
              testID="attach-button"
            >
              <View style={styles.glossyIconCircle}>
                <Feather name="paperclip" size={17} color="#1A1000" />
              </View>
              <Text style={styles.glossyIconLabel}>File</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (isRecording) {
                  stopRecording();
                } else {
                  startRecording();
                }
              }}
              disabled={isStreaming || isTranscribing}
              style={[
                styles.glossyIconWrap,
                (isStreaming || isTranscribing) && styles.glossyButtonDisabled,
              ]}
              testID="mic-button"
            >
              <View style={[styles.glossyIconCircle, isRecording && styles.glossyIconRecording]}>
                {isTranscribing ? (
                  <ActivityIndicator size={14} color="#1A1000" />
                ) : (
                  <Ionicons
                    name={isRecording ? "stop" : "mic"}
                    size={17}
                    color={isRecording ? "#FFF" : "#1A1000"}
                  />
                )}
              </View>
              <Text style={styles.glossyIconLabel}>{isRecording ? "Stop" : isTranscribing ? "..." : "Voice"}</Text>
            </Pressable>
            <Pressable
              onPress={toggleAutoSpeak}
              style={styles.glossyIconWrap}
              testID="auto-speak-toggle"
            >
              <View style={[styles.glossyIconCircle, autoSpeak && styles.glossyIconActive]}>
                <Ionicons
                  name={autoSpeak ? "volume-high" : "volume-mute"}
                  size={17}
                  color={autoSpeak ? "#1A1000" : "#1A1000"}
                />
              </View>
              <Text style={[styles.glossyIconLabel, autoSpeak && styles.glossyIconLabelActive]}>{autoSpeak ? "Sound On" : "Sound"}</Text>
            </Pressable>
            <Pressable
              onPress={handleReplay}
              disabled={!lastAudioUri || !!speakingMessageId}
              style={[
                styles.glossyIconWrap,
                (!lastAudioUri || !!speakingMessageId) && styles.glossyButtonDisabled,
              ]}
              testID="replay-button"
            >
              <View style={[styles.glossyIconCircle, !!lastAudioUri && !speakingMessageId && styles.glossyIconActive]}>
                <Ionicons
                  name="play-back"
                  size={17}
                  color="#1A1000"
                />
              </View>
              <Text style={[styles.glossyIconLabel, !!lastAudioUri && !speakingMessageId && styles.glossyIconLabelActive]}>Replay</Text>
            </Pressable>
            <Pressable
              onPress={toggleTrumpVoice}
              disabled={isStreaming}
              style={[
                styles.glossyIconWrap,
                isStreaming && styles.glossyButtonDisabled,
              ]}
              testID="voice-toggle"
            >
              <View style={[styles.glossyIconCircle, trumpVoice && styles.glossyIconActive]}>
                <MaterialCommunityIcons
                  name="account-voice"
                  size={17}
                  color="#1A1000"
                />
              </View>
              <Text style={[styles.glossyIconLabel, trumpVoice && styles.glossyIconLabelActive]}>{trumpVoice ? "DJT" : "Spirit"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  chatBackgroundLogo: {
    position: "absolute",
    top: "15%",
    left: "10%",
    right: "10%",
    bottom: "15%",
    width: "80%",
    height: "70%",
    opacity: 0.06,
    alignSelf: "center",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageListEmpty: {
    flex: 1,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 12,
    maxWidth: "85%",
  },
  bubbleRowUser: {
    alignSelf: "flex-end",
  },
  bubbleRowAssistant: {
    alignSelf: "flex-start",
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(212, 164, 32, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 4,
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: "100%",
    flexShrink: 1,
  },
  bubbleUser: {
    backgroundColor: Colors.gold,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: Colors.black,
    fontWeight: "500" as const,
  },
  bubbleTextAssistant: {
    color: Colors.white,
  },
  typingRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  typingBubble: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typingDots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  welcomeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeFlipped: {
    transform: [{ scaleY: -1 }],
  },
  welcomeInner: {
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: Colors.whiteDim,
    textAlign: "center",
    lineHeight: 22,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  attachmentPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(212, 164, 32, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.25)",
    gap: 10,
  },
  attachmentImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  attachmentDocIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(212, 164, 32, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentName: {
    flex: 1,
    fontSize: 13,
    color: Colors.white,
    fontWeight: "500" as const,
  },
  attachmentRemove: {
    padding: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: Colors.white,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  glossySendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    backgroundColor: Colors.gold,
    borderWidth: 1.5,
    borderColor: "#E8C84A",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(212, 164, 32, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
      },
      default: {},
    }),
  },
  glossyButtonDisabled: {
    opacity: 0.35,
  },
  glossyButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.92 }],
  },
  iconBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingTop: 10,
    paddingBottom: 2,
  },
  glossyIconWrap: {
    alignItems: "center",
    gap: 4,
  },
  glossyIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gold,
    borderWidth: 1.5,
    borderColor: "#E8C84A",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(212, 164, 32, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
      },
      default: {},
    }),
  },
  glossyIconRecording: {
    backgroundColor: "#CC3333",
    borderColor: "#FF5555",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 10px rgba(255, 68, 68, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.2)",
      },
      default: {},
    }),
  },
  glossyIconActive: {
    backgroundColor: "#E8B820",
    borderColor: "#F0D050",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 12px rgba(212, 164, 32, 0.6), inset 0 1px 3px rgba(255, 255, 255, 0.4)",
      },
      default: {},
    }),
  },
  glossyIconLabel: {
    fontSize: 10,
    color: Colors.whiteMuted,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
  },
  glossyIconLabelActive: {
    color: Colors.gold,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tokenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(212, 164, 32, 0.12)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(212, 164, 32, 0.25)",
  },
  tokenBadgeText: {
    fontSize: 13,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.gold,
  },
  userBubbleWrap: {
    maxWidth: "100%",
    flexShrink: 1,
  },
  assistantBubbleWrap: {
    maxWidth: "100%",
    flexShrink: 1,
  },
});
