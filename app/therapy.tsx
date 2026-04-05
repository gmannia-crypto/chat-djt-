import React, { useState, useRef } from "react";
import { useEngagement } from "@/lib/engagement-context";
import { useLiveActivity } from "@/lib/live-activity-context";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  Share,
  TextInput,
  Image,
  Dimensions,
  Linking,
  Modal,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { Audio, Video, ResizeMode } from "expo-av";
import { playTTS } from "@/lib/audio-helper";
import { SoundToggle } from "@/components/SoundToggle";
import { useSound } from "@/lib/sound-context";
import { useScreenTracker, useTrackEvent } from "@/lib/use-analytics";
import { recordTherapySession, getTherapyContext } from "@/lib/persona-memory";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  ZoomIn,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";

function SessionTimer({ active, ended, initialSeconds, mode, deepDuration, accent, deviceId, onSessionEnd, refreshBalance }: {
  active: boolean; ended: boolean; initialSeconds: number; mode: string; deepDuration: number;
  accent: string; deviceId: string | null; onSessionEnd: () => void; refreshBalance: () => void;
}) {
  const [seconds, setSeconds] = React.useState(initialSeconds);
  const tokenChargeRef = useRef(0);
  const lastChargeMinuteRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    setSeconds(initialSeconds);
    tokenChargeRef.current = 0;
    lastChargeMinuteRef.current = 0;
  }, [initialSeconds]);

  React.useEffect(() => {
    if (active && seconds > 0) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            onSessionEnd();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return 0;
          }
          const totalDuration = deepDuration * 60;
          const elapsed = totalDuration - (prev - 1);
          const minutesPassed = Math.floor(elapsed / 60);
          if (minutesPassed > lastChargeMinuteRef.current && minutesPassed > 0) {
            lastChargeMinuteRef.current = minutesPassed;
            tokenChargeRef.current += 1;
            if (deviceId) {
              const baseUrl = getApiUrl().replace(/\/$/, "");
              fetch(`${baseUrl}/api/therapy/charge-minute`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-device-id": deviceId },
                body: JSON.stringify({ minute: minutesPassed }),
              }).then(() => refreshBalance()).catch(() => {});
            }
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [active, mode, deepDuration, deviceId]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={timerStyles.container}>
      <Text style={timerStyles.label}>{mode === "deep" ? `DEEP SESSION (${deepDuration} MIN)` : `SESSION (${deepDuration} MIN)`}</Text>
      <Text style={[timerStyles.display, { color: accent }, seconds <= 30 && timerStyles.warning]}>
        {formatTime(seconds)}
      </Text>
      {active && (
        <Text style={[timerStyles.tokens, { color: accent }]}>
          {tokenChargeRef.current}/{deepDuration} D.C. tokens used
        </Text>
      )}
      {ended && <Text style={timerStyles.expired}>SESSION ENDED</Text>}
    </View>
  );
}

const timerStyles = StyleSheet.create({
  container: { alignItems: "center" as const, paddingVertical: 12 },
  label: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" as const, letterSpacing: 2, marginBottom: 4 },
  display: { fontSize: 36, fontWeight: "800" as const, fontVariant: ["tabular-nums" as const], letterSpacing: 2 },
  warning: { color: "#e74c3c" },
  tokens: { fontSize: 13, fontWeight: "600" as const, marginTop: 4 },
  expired: { color: "#e74c3c", fontSize: 14, fontWeight: "700" as const, letterSpacing: 1, marginTop: 4 },
});

const trumpTherapistImage = require("@/assets/images/trump-therapist.png");
const sophiaImage = require("@/assets/images/dr-sophia.jpg");
const jamesImage = require("@/assets/images/dr-james.jpg");
const patriciaImage = require("@/assets/images/dr-patricia.jpg");
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type TherapistVoice = "trump" | "sophia" | "james" | "patricia";

interface TherapistConfig {
  voice: TherapistVoice;
  name: string;
  title: string;
  image: any;
  accent: string;
  accentLight: string;
  accentBg: string;
  gradient: [string, string];
  bgGradient: [string, string, string];
  greeting: string;
  diagnosisLabel: string;
  introTitle: string;
  introSubtitle: string;
  introQuote: string;
  placeholder: string;
  buttonText: string;
  errorMsg: string;
  rxTitle: string;
  rxSubtitle: string;
  credentials: string;
  specialty: string;
  signature: string;
  questionPrompts?: string[];
  useAIQuestions?: boolean;
}

const THERAPIST_CONFIGS: Record<TherapistVoice, TherapistConfig> = {
  trump: {
    voice: "trump",
    name: "Dr. Dynamic",
    title: "DYNAMIC THERAPY",
    image: trumpTherapistImage,
    accent: "#ff4d4d",
    accentLight: "rgba(255,77,77,0.15)",
    accentBg: "rgba(255,77,77,0.08)",
    gradient: ["#ff4d4d", "#cc0000"],
    bgGradient: ["#0a0a0a", "#1a0505", "#0a0a0a"],
    greeting: "\"Lie down. Tell me everything. I'm listening...\"",
    diagnosisLabel: "DR. TRUMP'S DIAGNOSIS",
    introTitle: "DR. DYNAMIC",
    introSubtitle: "IS READY TO SEE YOU NOW",
    introQuote: "\"Lie down. Tell me everything.\"",
    placeholder: "Tell Dr. Dynamic what's wrong... or tap the mic",
    buttonText: "GET THERAPY",
    errorMsg: "Dr. Dynamic is taking a break. Even the best therapists need to play golf sometimes. Try again!",
    rxTitle: "DR. DYNAMIC'S RX",
    rxSubtitle: "\"I prescribe only the best. Believe me.\"",
    credentials: "45th & 47th President of the United States\nBillionaire Real Estate Mogul\nSelf-Certified Genius Therapist",
    specialty: "Winning Psychology & Executive Confidence",
    signature: "Dr. Donald J. Trump",
  },
  sophia: {
    voice: "sophia",
    name: "Dr. Sophia",
    title: "DR. SOPHIA",
    image: sophiaImage,
    accent: "#e87ba8",
    accentLight: "rgba(232,123,168,0.15)",
    accentBg: "rgba(232,123,168,0.08)",
    gradient: ["#e87ba8", "#c44d7b"],
    bgGradient: ["#0a0a0a", "#1a0510", "#0a0a0a"],
    greeting: "\"Welcome. This is a safe space. Take a deep breath, and share what's on your heart...\"",
    diagnosisLabel: "DR. SOPHIA'S REFLECTION",
    introTitle: "DR. SOPHIA",
    introSubtitle: "IS READY TO SEE YOU NOW",
    introQuote: "\"You are worthy of healing.\"",
    placeholder: "Share what's weighing on your heart... or tap the mic",
    buttonText: "BEGIN SESSION",
    errorMsg: "Dr. Sophia is taking a moment to center herself. Please try again in a moment.",
    rxTitle: "DR. SOPHIA'S WELLNESS",
    rxSubtitle: "\"Healing starts with nurturing yourself.\"",
    credentials: "Ph.D. in Clinical Psychology\nSpecializing in Attachment Theory & Trauma Recovery\nLicensed in New York",
    specialty: "Attachment Theory & Trauma Recovery",
    signature: "Dr. Sophia Chen, Ph.D.",
  },
  james: {
    voice: "james",
    name: "Dr. James",
    title: "DR. JAMES",
    image: jamesImage,
    accent: "#4d8bff",
    accentLight: "rgba(77,139,255,0.15)",
    accentBg: "rgba(77,139,255,0.08)",
    gradient: ["#4d8bff", "#2a5fc7"],
    bgGradient: ["#0a0a0a", "#05081a", "#0a0a0a"],
    greeting: "\"Let's examine this together. What thought patterns have you noticed?\"",
    diagnosisLabel: "DR. JAMES'S ANALYSIS",
    introTitle: "DR. JAMES",
    introSubtitle: "IS READY TO SEE YOU NOW",
    introQuote: "\"Let's examine the evidence together.\"",
    placeholder: "Describe what you're experiencing... or tap the mic",
    buttonText: "BEGIN ANALYSIS",
    errorMsg: "Dr. James is reviewing his notes. Please try again shortly.",
    rxTitle: "DR. JAMES'S RX",
    rxSubtitle: "\"Evidence-based recommendations for your wellbeing.\"",
    credentials: "Psy.D. in Cognitive Behavioral Therapy\nHarvard Medical School\nBoard-Certified",
    specialty: "Cognitive Behavioral Therapy",
    signature: "Dr. James Mitchell, Psy.D.",
  },
  patricia: {
    voice: "patricia",
    name: "Dr. Patricia",
    title: "DR. PATRICIA SERENA",
    image: patriciaImage,
    accent: "#ff99cc",
    accentLight: "rgba(255,153,204,0.15)",
    accentBg: "rgba(255,153,204,0.08)",
    gradient: ["#ff99cc", "#cc6699"],
    bgGradient: ["#0a0a0a", "#1a0a12", "#0a0a0a"],
    greeting: "\"Hello darling, come sit down and tell me everything. I'm here to listen \u2014 and maybe give you a little extra attention.\"",
    diagnosisLabel: "DR. PATRICIA'S INSIGHT",
    introTitle: "DR. SERENA",
    introSubtitle: "IS READY TO SEE YOU NOW",
    introQuote: "\"You're so brave for sharing that with me.\"",
    placeholder: "Tell Dr. Patricia what's on your mind, gorgeous... or tap the mic",
    buttonText: "BEGIN SESSION",
    errorMsg: "Dr. Patricia is freshening up. She'll be right back, sweetheart.",
    rxTitle: "DR. SERENA'S RX",
    rxSubtitle: "\"Taking care of yourself is the sexiest thing you can do, darling.\"",
    credentials: "Ph.D. in Psychology\nSpecializing in Psychodynamic & Relational Therapy\nLicensed in California & New York",
    specialty: "Psychodynamic & Relational Therapy",
    signature: "Dr. Patricia Serena, Ph.D.",
    questionPrompts: [
      "What's the one thing you wish someone understood about you?",
      "Mmm, tell me about the last time you felt truly alive.",
      "If your heart could speak right now, what would it say?",
      "I can see you're carrying something heavy. Let me help you with that...",
      "You know, I have a feeling there's more beneath the surface. Share it with me.",
    ],
    useAIQuestions: true,
  },
};

const SERIOUSNESS_LEVELS = [
  { value: "1", label: "1 - Minor annoyance" },
  { value: "2", label: "2 - Slightly annoying" },
  { value: "3", label: "3 - Meh" },
  { value: "4", label: "4 - Getting worse" },
  { value: "5", label: "5 - Moderate" },
  { value: "6", label: "6 - Pretty bad" },
  { value: "7", label: "7 - Very bad" },
  { value: "8", label: "8 - Terrible" },
  { value: "9", label: "9 - Disastrous" },
  { value: "10", label: "10 - Critical" },
];

export default function TherapyScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const { hasTokens, deviceId, refreshBalance, balance } = useTokens();
  const { showShareCard, awardBadge } = useEngagement();
  const { logEvent } = useLiveActivity();
  const { soundEnabled } = useSound();
  useScreenTracker("therapy");

  React.useEffect(() => { logEvent("therapy_start"); }, []);
  const trackEvent = useTrackEvent();

  const [selectedTherapist, setSelectedTherapist] = useState<TherapistVoice>("patricia");
  const [questionPrompt, setQuestionPrompt] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [problem, setProblem] = useState("");
  const [seriousness, setSeriousness] = useState("5");
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [therapy, setTherapy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpIndex, setFollowUpIndex] = useState(0);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; text: string }>>([]);
  const [sessionTimerKey, setSessionTimerKey] = useState(0);
  const [sessionInitialSeconds, setSessionInitialSeconds] = useState(300);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [deepDuration, setDeepDuration] = useState<5 | 10 | 15 | 20>(5);

  const [sessionMode, setSessionMode] = useState<"quick" | "deep" | "chat" | "hypno">("quick");
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [lipSyncEnabled, setLipSyncEnabled] = useState(false);
  const [lipSyncVideoUrl, setLipSyncVideoUrl] = useState<string | null>(null);
  const [lipSyncLoading, setLipSyncLoading] = useState(false);
  const [showSerenaIntro, setShowSerenaIntro] = useState(false);
  const serenaVideoRef = useRef<Video>(null);
  const [hypnoPreset, setHypnoPreset] = useState<string>("stress");
  const [hypnoLoading, setHypnoLoading] = useState(false);
  const [showHypnoOverlay, setShowHypnoOverlay] = useState(false);
  const [hypnoText, setHypnoText] = useState("");
  const hypnoAngleRef = useRef(0);
  const hypnoAnimRef = useRef<number | null>(null);
  const greetingSoundRef = useRef<Audio.Sound | null>(null);

  const [intakeStep, setIntakeStep] = useState<string | null>(null);
  const [intakeQuestion, setIntakeQuestion] = useState<string | null>(null);
  const [intakeOptions, setIntakeOptions] = useState<Array<{ label: string; value: number }> | null>(null);
  const [intakeInputType, setIntakeInputType] = useState<string | null>(null);
  const [intakeData, setIntakeData] = useState<any>({});
  const [intakeQuestionIndex, setIntakeQuestionIndex] = useState(0);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeMessages, setIntakeMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [phq9Score, setPhq9Score] = useState<number | null>(null);
  const [phq9Interpretation, setPhq9Interpretation] = useState<{ severity: string; description: string } | null>(null);
  const [intakeScaleValue, setIntakeScaleValue] = useState("5");

  const [diagnosisPlan, setDiagnosisPlan] = useState<any>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [showSerenaFullscreen, setShowSerenaFullscreen] = useState(false);

  const config = THERAPIST_CONFIGS[selectedTherapist];

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const hypnoEchoRef = useRef<Audio.Sound | null>(null);
  const hypnoAmbientRef = useRef<Audio.Sound | null>(null);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micTargetRef = useRef<"problem" | "followUp" | "chat">("problem");

  const pulseValue = useSharedValue(1);

  const spiralRotation1 = useSharedValue(0);
  const spiralRotation2 = useSharedValue(0);
  const spiralRotation3 = useSharedValue(0);
  const spiralScale = useSharedValue(1);

  const spiralStyle1 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spiralRotation1.value}deg` }],
  }));
  const spiralStyle2 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spiralRotation2.value}deg` }],
  }));
  const spiralStyle3 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spiralRotation3.value}deg` }],
  }));
  const spiralPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: spiralScale.value }],
  }));

  React.useEffect(() => {
    if (showHypnoOverlay) {
      spiralRotation1.value = withRepeat(
        withTiming(360, { duration: 8000, easing: Easing.linear }),
        -1, false
      );
      spiralRotation2.value = withRepeat(
        withTiming(-360, { duration: 6000, easing: Easing.linear }),
        -1, false
      );
      spiralRotation3.value = withRepeat(
        withTiming(360, { duration: 4000, easing: Easing.linear }),
        -1, false
      );
      spiralScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.9, { duration: 3000, easing: Easing.inOut(Easing.ease) })
        ),
        -1, true
      );
    } else {
      spiralRotation1.value = 0;
      spiralRotation2.value = 0;
      spiralRotation3.value = 0;
      spiralScale.value = 1;
    }
  }, [showHypnoOverlay]);

  const selectedTherapistRef = useRef(selectedTherapist);
  selectedTherapistRef.current = selectedTherapist;

  useFocusEffect(
    React.useCallback(() => {
      setShowIntro(true);
      introTimerRef.current = setTimeout(() => {
        setShowIntro(false);
        if (selectedTherapistRef.current === "patricia") {
          if (Platform.OS === "web" && SCREEN_WIDTH > 768) {
            setShowSerenaFullscreen(true);
          } else {
            setShowSerenaIntro(true);
          }
        }
      }, 3200);
      return () => {
        if (introTimerRef.current) clearTimeout(introTimerRef.current);
      };
    }, [])
  );

  React.useEffect(() => {
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  React.useEffect(() => {
    return () => {
      if (Platform.OS === "web") {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
      } else if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  function startMicFor(target: "problem" | "followUp" | "chat") {
    if (isRecording) {
      stopRecording();
      return;
    }
    micTargetRef.current = target;
    startRecording();
  }

  async function startRecording() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
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
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const response = await globalThis.fetch(`${baseUrl}/api/stt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, format }),
      });
      if (!response.ok) throw new Error("STT request failed");
      const data = await response.json();
      if (data.text && data.text.trim()) {
        const trimmed = data.text.trim();
        const target = micTargetRef.current;
        if (target === "followUp") {
          setFollowUpAnswer((prev) => prev ? prev + " " + trimmed : trimmed);
        } else if (target === "chat") {
          setChatInput((prev) => prev ? prev + " " + trimmed : trimmed);
        } else {
          setProblem((prev) => prev ? prev + " " + trimmed : trimmed);
        }
      }
    } catch (error) {
      console.error("Transcription error:", error);
    } finally {
      setIsTranscribing(false);
    }
  }

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseValue.value,
  }));

  const canSubmit = firstName.trim().length > 0 && problem.trim().length > 0;

  const handleGetTherapy = async () => {
    if (!canSubmit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (!hasTokens) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.push("/subscribe");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);
    setTherapy(null);

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const hdrs: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) hdrs["x-device-id"] = deviceId;

      const uid = deviceId || "anonymous";
      const historyContext = await getTherapyContext(uid).catch(() => "");

      const res = await fetch(`${baseUrl}/api/therapy`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          name: firstName.trim(),
          problem: problem.trim(),
          seriousness,
          voice: selectedTherapist,
          therapyHistory: historyContext || undefined,
        }),
      });

      if (res.status === 403) {
        refreshBalance();
        router.push("/subscribe");
        return;
      }
      if (!res.ok) throw new Error("Therapy failed");
      const data = await res.json();
      setTherapy(data.therapy);
      setConversationHistory([{ role: "therapist", text: data.therapy }]);
      if (data.followUp) {
        setFollowUpQuestion(data.followUp);
        setFollowUpIndex(data.followUpIndex !== undefined ? data.followUpIndex + 1 : 1);
      }
      const duration = deepDuration * 60;
      setSessionInitialSeconds(duration);
      setSessionTimerKey((k) => k + 1);
      setSessionActive(true);
      setSessionEnded(false);
      refreshBalance();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);

      const currentVoice = selectedTherapist;
      const speakText = data.therapy + (data.followUp ? " " + data.followUp : "");
      if (speakText) {
        setTimeout(() => handleSpeak(speakText, currentVoice), 500);
        recordTherapySession(uid, {
          therapist: currentVoice,
          problem: problem.trim(),
          seriousness: parseInt(seriousness as string) || 5,
          therapySnippet: data.therapy,
        }).catch(() => {});
      }
    } catch (err) {
      setTherapy(config.errorMsg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  async function handleSpeak(text: string, voice?: TherapistVoice) {
    const ttsVoice = voice || selectedTherapist;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (!soundEnabled) return;
      setSpeaking(true);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const sound = await playTTS("/api/tts", { text: text.slice(0, 2000), mood: "CALM", voice: ttsVoice });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) setSpeaking(false);
      });
    } catch (err) {
      console.error("TTS playback error:", err);
      setSpeaking(false);
    }
  }

  async function speakGreeting(voice: TherapistVoice) {
    try {
      if (greetingSoundRef.current) {
        await greetingSoundRef.current.stopAsync().catch(() => {});
        await greetingSoundRef.current.unloadAsync().catch(() => {});
        greetingSoundRef.current = null;
      }
      if (voice === "patricia") {
        if (Platform.OS === "web" && SCREEN_WIDTH > 768) {
          setShowSerenaFullscreen(true);
        } else {
          setShowSerenaIntro(true);
        }
        return;
      }
      if (!soundEnabled) return;
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const greetingText = THERAPIST_CONFIGS[voice].greeting.replace(/"/g, "").replace(/\\/g, "");
      const sound = await playTTS("/api/tts", { text: greetingText, mood: "CALM", voice });
      greetingSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          greetingSoundRef.current = null;
        }
      });
    } catch (err) {
      console.error("Greeting TTS error:", err);
    }
  }

  async function onSerenaVideoEnd() {
    setShowSerenaIntro(false);
    if (!soundEnabled) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const greetingText = THERAPIST_CONFIGS.patricia.greeting.replace(/"/g, "").replace(/\\/g, "");
      const sound = await playTTS("/api/tts", { text: greetingText, mood: "CALM", voice: "patricia" });
      greetingSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          greetingSoundRef.current = null;
        }
      });
    } catch (err) {
      console.error("Serena greeting TTS error:", err);
    }
  }

  function onSerenaFullscreenDismiss() {
    setShowSerenaFullscreen(false);
    setShowSerenaIntro(true);
  }

  async function generateDiagnosisPlan() {
    if (!therapy || diagnosisLoading) return;
    setDiagnosisLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const sessionNotes = conversationHistory.map(m => `${m.role === "user" ? "Patient" : config.name}: ${m.text}`).join("\n");
      const chatNotes = chatMessages.map(m => `${m.role === "user" ? "Patient" : config.name}: ${m.content}`).join("\n");
      const allNotes = sessionNotes || chatNotes || `Patient's concern: ${problem}\n${config.name}: ${therapy}`;
      const res = await fetch(`${baseUrl}/api/therapy/diagnosis-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(deviceId ? { "x-device-id": deviceId } : {}) },
        body: JSON.stringify({
          voice: selectedTherapist,
          name: firstName || "Friend",
          problem,
          therapy,
          sessionNotes: allNotes,
          level: seriousness,
          phq9Score,
          phq9Interpretation: phq9Interpretation?.description || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === "no_tokens") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.push("/subscribe");
          return;
        }
        throw new Error(errData.error || "Failed to generate plan");
      }
      const data = await res.json();
      if (data.plan) {
        setDiagnosisPlan(data.plan);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
      }
    } catch (err) {
      console.error("Diagnosis plan error:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDiagnosisLoading(false);
    }
  }

  async function handleShareDiagnosis() {
    if (!diagnosisPlan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const planText = `${config.diagnosisLabel}\nPatient: ${firstName || "Friend"}\nTherapist: ${config.signature}\n${config.credentials.replace(/\n/g, " | ")}\n\nDIAGNOSIS:\n${diagnosisPlan.diagnosis}\n\nTREATMENT PLAN:\n${diagnosisPlan.treatmentSteps?.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n\nACTIONABLE SOLUTIONS:\n${diagnosisPlan.solutions?.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n\nSESSION NOTES:\n${diagnosisPlan.sessionSummary}\n\nSigned: ${config.signature}\n\nGenerated by Chat DJT — trumpbot.rip`;
    try {
      await Share.share({ message: planText });
    } catch {}
  }

  const HYPNO_PRESETS = [
    { key: "stress", icon: "\u{1F9D8}", label: "Stress Relief" },
    { key: "sleep", icon: "\u{1F319}", label: "Deep Sleep" },
    { key: "confidence", icon: "\u{1F4AA}", label: "Confidence" },
    { key: "focus", icon: "\u{1F3AF}", label: "Focus & Clarity" },
    { key: "anxiety", icon: "\u{1F32C}", label: "Calm Anxiety" },
    { key: "motivation", icon: "\u{1F525}", label: "Motivation" },
  ];

  const hypnoSessionRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const webEchoRef = useRef<HTMLAudioElement | null>(null);

  async function playHypnoSound(base64Audio: string): Promise<void> {
    const dataUri = base64Audio.startsWith("data:") ? base64Audio : `data:audio/mpeg;base64,${base64Audio}`;
    const MAX_AUDIO_TIMEOUT = 30000;

    if (Platform.OS === "web") {
      return new Promise((resolve) => {
        let resolved = false;
        const done = () => { if (!resolved) { resolved = true; resolve(); } };

        const safetyTimer = setTimeout(() => {
          console.log("Hypno audio safety timeout (web)");
          done();
        }, MAX_AUDIO_TIMEOUT);

        try {
          const audio = new window.Audio(dataUri);
          audio.volume = 1.0;

          setTimeout(() => {
            try {
              const echo = new window.Audio(dataUri);
              echo.volume = 0.18;
              echo.play().catch(() => {});
              webEchoRef.current = echo;
            } catch {}
          }, 200);

          audio.onended = () => {
            clearTimeout(safetyTimer);
            if (webEchoRef.current) {
              webEchoRef.current.pause();
              webEchoRef.current = null;
            }
            done();
          };
          audio.onerror = () => { clearTimeout(safetyTimer); done(); };
          audio.play().catch(() => { clearTimeout(safetyTimer); done(); });
        } catch {
          clearTimeout(safetyTimer);
          done();
        }
      });
    }

    return new Promise(async (resolve) => {
      let resolved = false;
      const done = () => { if (!resolved) { resolved = true; resolve(); } };

      const safetyTimer = setTimeout(() => {
        console.log("Hypno audio safety timeout (native)");
        if (soundRef.current) {
          soundRef.current.stopAsync().catch(() => {});
          soundRef.current.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
        if (hypnoEchoRef.current) {
          hypnoEchoRef.current.stopAsync().catch(() => {});
          hypnoEchoRef.current.unloadAsync().catch(() => {});
          hypnoEchoRef.current = null;
        }
        done();
      }, MAX_AUDIO_TIMEOUT);

      try {
        const fileUri = (FileSystem.cacheDirectory || "") + `hypno_${Date.now()}.mp3`;
        const b64 = dataUri.replace(/^data:audio\/mpeg;base64,/, "");
        await FileSystem.writeAsStringAsync(fileUri, b64, { encoding: FileSystem.EncodingType.Base64 });
        const { sound } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true, volume: 1.0 });
        soundRef.current = sound;

        setTimeout(async () => {
          try {
            const { sound: echo } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true, volume: 0.18 });
            hypnoEchoRef.current = echo;
          } catch {}
        }, 200);

        sound.setOnPlaybackStatusUpdate((status: { isLoaded: boolean; didJustFinish?: boolean }) => {
          if (status.isLoaded && status.didJustFinish) {
            clearTimeout(safetyTimer);
            sound.unloadAsync().catch(() => {});
            if (hypnoEchoRef.current) {
              hypnoEchoRef.current.stopAsync().catch(() => {});
              hypnoEchoRef.current.unloadAsync().catch(() => {});
              hypnoEchoRef.current = null;
            }
            soundRef.current = null;
            done();
          }
        });
      } catch {
        clearTimeout(safetyTimer);
        done();
      }
    });
  }

  async function startHypnosis() {
    if (hypnoLoading) return;
    setHypnoLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const session = { cancelled: false };
    hypnoSessionRef.current = session;

    try {
      const apiUrl = getApiUrl();
      const uid = deviceId || "anonymous";
      const historyContext = await getTherapyContext(uid).catch(() => "");
      const resp = await fetch(new URL("/api/therapy/hypnosis", apiUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ preset: hypnoPreset, personaId: selectedTherapist, therapyHistory: historyContext || undefined, patientName: firstName.trim() || undefined }),
      });
      const data = await resp.json();
      if (data.error) {
        alert(data.error);
        setHypnoLoading(false);
        return;
      }
      refreshBalance();
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      setShowHypnoOverlay(true);

      const isCancelled = () => session.cancelled;

      if (data.openingAudio && !isCancelled()) {
        setHypnoText(data.openingText || "Close your eyes...");
        await playHypnoSound(data.openingAudio);
        if (!isCancelled()) await new Promise(r => setTimeout(r, 1500));
      }

      if (data.audioBase64 && !isCancelled()) {
        setHypnoText(data.introText || "Breathe deeply...");
        await playHypnoSound(data.audioBase64);
        if (!isCancelled()) await new Promise(r => setTimeout(r, 1500));
      }

      const phraseAudios: (string | null)[] = data.phraseAudios || [];
      const phrases: string[] = data.phrases || [];

      for (let i = 0; i < phrases.length; i++) {
        if (isCancelled()) break;
        setHypnoText(phrases[i]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (phraseAudios[i]) {
          await playHypnoSound(phraseAudios[i] as string);
        } else {
          await new Promise(r => setTimeout(r, 4000));
        }
        if (!isCancelled()) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      if (data.closingAudio && !isCancelled()) {
        setHypnoText(data.closingText || "Open your eyes...");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await playHypnoSound(data.closingAudio);
        if (!isCancelled()) await new Promise(r => setTimeout(r, 2000));
      } else if (!data.closingAudio && !isCancelled()) {
        setHypnoText("Open your eyes...");
        await new Promise(r => setTimeout(r, 3000));
      }

      if (!isCancelled()) {
        setHypnoText("Session complete.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await new Promise(r => setTimeout(r, 2500));
      }
      setShowHypnoOverlay(false);
      setHypnoLoading(false);
    } catch (err) {
      console.error("Hypnosis error:", err);
      setHypnoLoading(false);
    }
  }

  React.useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (greetingSoundRef.current) {
        greetingSoundRef.current.unloadAsync().catch(() => {});
        greetingSoundRef.current = null;
      }
      if (hypnoEchoRef.current) {
        hypnoEchoRef.current.unloadAsync().catch(() => {});
        hypnoEchoRef.current = null;
      }
      if (hypnoAmbientRef.current) {
        hypnoAmbientRef.current.unloadAsync().catch(() => {});
        hypnoAmbientRef.current = null;
      }
    };
  }, []);

  const handleSessionEnd = React.useCallback(() => {
    setSessionActive(false);
    setSessionEnded(true);
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
    }
    setSpeaking(false);
    awardBadge("therapy_complete");
  }, []);

  const handleFollowUp = async () => {
    if (!followUpAnswer.trim() || followUpLoading) return;
    if (sessionEnded) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    const currentVoice = selectedTherapist;
    setFollowUpLoading(true);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const hdrs: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) hdrs["x-device-id"] = deviceId;
      const res = await fetch(`${baseUrl}/api/therapy`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          name: firstName.trim(),
          problem: problem.trim(),
          seriousness,
          voice: currentVoice,
          previousAnswer: followUpAnswer.trim(),
          followUpIndex,
        }),
      });
      if (res.status === 403) {
        refreshBalance();
        router.push("/subscribe");
        return;
      }
      if (!res.ok) throw new Error("Follow-up failed");
      const data = await res.json();
      setConversationHistory((prev) => [
        ...prev,
        { role: "user", text: followUpAnswer.trim() },
        { role: "therapist", text: data.therapy },
      ]);
      setFollowUpAnswer("");
      refreshBalance();
      if (data.followUp && followUpIndex < 2) {
        setFollowUpQuestion(data.followUp);
        setFollowUpIndex(data.followUpIndex !== undefined ? data.followUpIndex + 1 : followUpIndex + 1);
      } else {
        setFollowUpQuestion(null);
      }
      if (data.therapy) {
        const speakFollowUp = data.therapy + (data.followUp ? " " + data.followUp : "");
        setTimeout(() => handleSpeak(speakFollowUp, currentVoice), 500);
      }
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleShare = async () => {
    if (!therapy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const snippet = therapy.length > 120 ? therapy.slice(0, 120) + "..." : therapy;
    showShareCard("Therapy Session", `${config.therapistName} says: "${snippet}"`, "therapy");
    const baseUrl = getApiUrl().replace(/\/$/, "");
    fetch(`${baseUrl}/api/track-share`, { method: "POST", body: JSON.stringify({ feature: "therapy", platform: Platform.OS, contentPreview: therapy.slice(0, 100) }), headers: { "Content-Type": "application/json" } }).catch(() => {});
  };

  const handleStartChat = async () => {
    if (!firstName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (!hasTokens) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.push("/subscribe");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    awardBadge("first_session");

    let greeting: string;
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const hdrs: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) hdrs["x-device-id"] = deviceId;
      const greetingRes = await fetch(`${baseUrl}/api/therapy/greeting`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({ personaId: selectedTherapist }),
      });
      if (greetingRes.ok) {
        const greetingData = await greetingRes.json();
        greeting = greetingData.greeting;
      } else {
        greeting = config.greeting.replace(/"/g, "");
      }
    } catch {
      greeting = config.greeting.replace(/"/g, "");
    }

    setChatMessages([{ role: "assistant", content: greeting }]);
    setChatStarted(true);
    const duration = deepDuration * 60;
    setSessionInitialSeconds(duration);
    setSessionTimerKey((k) => k + 1);
    setSessionActive(true);
    setSessionEnded(false);
    setTimeout(() => handleSpeak(greeting, selectedTherapist), 500);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    if (sessionEnded) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    const userMsg = chatInput.trim();
    const currentVoice = selectedTherapist;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const hdrs: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) hdrs["x-device-id"] = deviceId;

      const uid = deviceId || "anonymous";
      const historyContext = await getTherapyContext(uid).catch(() => "");

      const allMessages = [...chatMessages, { role: "user", content: userMsg }];

      const voiceConfig = THERAPIST_CONFIGS[currentVoice];
      const res = await fetch(`${baseUrl}/api/therapy/chat`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          name: firstName.trim(),
          voice: currentVoice,
          messages: allMessages,
          therapyHistory: historyContext || undefined,
          useAIQuestions: voiceConfig.useAIQuestions || undefined,
        }),
      });

      if (res.status === 403) {
        refreshBalance();
        router.push("/subscribe");
        return;
      }
      if (!res.ok) throw new Error("Chat failed");
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      refreshBalance();

      if (data.reply && lipSyncEnabled) {
        setLipSyncLoading(true);
        setLipSyncVideoUrl(null);
        let videoGenerated = false;
        try {
          const lipRes = await fetch(`${baseUrl}/api/therapy/lip-sync`, {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify({ text: data.reply.slice(0, 500), personaId: currentVoice }),
          });
          if (lipRes.ok) {
            const lipData = await lipRes.json();
            if (lipData.videoUrl) {
              setLipSyncVideoUrl(lipData.videoUrl);
              videoGenerated = true;
            }
          }
        } catch {
        } finally {
          setLipSyncLoading(false);
        }
        if (!videoGenerated) {
          setTimeout(() => handleSpeak(data.reply, currentVoice), 500);
        }
        refreshBalance();
      } else if (data.reply) {
        setTimeout(() => handleSpeak(data.reply, currentVoice), 500);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);

      recordTherapySession(uid, {
        therapist: currentVoice,
        problem: userMsg,
        seriousness: 5,
        therapySnippet: data.reply,
      }).catch(() => {});
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: config.errorMsg }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setChatLoading(false);
    }
  };

  const handleStartIntake = async () => {
    if (!firstName.trim() || !problem.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (!hasTokens) {
      router.push("/subscribe");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIntakeLoading(true);
    setIntakeMessages([{ role: "user", text: problem.trim() }]);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const hdrs: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) hdrs["x-device-id"] = deviceId;
      const res = await fetch(`${baseUrl}/api/therapy/intake`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          name: firstName.trim(),
          voice: selectedTherapist,
          step: "start",
          response: problem.trim(),
          intakeData: {},
        }),
      });
      if (res.status === 403) { refreshBalance(); router.push("/subscribe"); return; }
      if (!res.ok) throw new Error("Intake failed");
      const data = await res.json();
      setIntakeStep(data.step);
      setIntakeQuestion(data.question);
      setIntakeOptions(data.options || null);
      setIntakeInputType(data.inputType || null);
      setIntakeData(data.intakeData || {});
      setIntakeMessages(prev => [...prev, { role: "therapist", text: data.question }]);
      if (data.question) {
        setTimeout(() => handleSpeak(data.question, selectedTherapist), 500);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIntakeLoading(false);
    }
  };

  const handleIntakeResponse = async (responseValue: string | number) => {
    setIntakeLoading(true);
    const displayText = intakeOptions?.find(o => o.value === responseValue)?.label || String(responseValue);
    setIntakeMessages(prev => [...prev, { role: "user", text: displayText }]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const hdrs: Record<string, string> = { "Content-Type": "application/json" };
      if (deviceId) hdrs["x-device-id"] = deviceId;
      const res = await fetch(`${baseUrl}/api/therapy/intake`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          name: firstName.trim(),
          voice: selectedTherapist,
          step: intakeStep,
          response: String(responseValue),
          intakeData,
          questionIndex: intakeQuestionIndex,
        }),
      });
      if (res.status === 403) { refreshBalance(); router.push("/subscribe"); return; }
      if (!res.ok) throw new Error("Intake step failed");
      const data = await res.json();

      if (data.step === "complete") {
        setTherapy(data.assessment);
        setPhq9Score(data.phq9Score);
        setPhq9Interpretation(data.phq9Interpretation);
        setIntakeStep(null);
        setIntakeQuestion(null);
        setIntakeOptions(null);
        setIntakeMessages(prev => [...prev, { role: "therapist", text: data.assessment }]);
        setConversationHistory([{ role: "therapist", text: data.assessment }]);
        const uid = deviceId || "anonymous";
        recordTherapySession(uid, {
          therapist: selectedTherapist,
          problem: problem.trim(),
          seriousness: data.phq9Score || 0,
          therapySnippet: data.assessment,
        }).catch(() => {});
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (data.assessment) {
          setTimeout(() => handleSpeak(data.assessment, selectedTherapist), 500);
        }
      } else {
        setIntakeStep(data.step);
        setIntakeQuestion(data.question);
        setIntakeOptions(data.options || null);
        setIntakeInputType(data.inputType || null);
        setIntakeData(data.intakeData || intakeData);
        if (data.questionIndex !== undefined) setIntakeQuestionIndex(data.questionIndex);
        setIntakeMessages(prev => [...prev, { role: "therapist", text: data.question }]);
        if (data.question) {
          setTimeout(() => handleSpeak(data.question, selectedTherapist), 500);
        }
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIntakeLoading(false);
    }
  };

  const handleNewSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTherapy(null);
    setFirstName("");
    setProblem("");
    setSeriousness("5");
    setFollowUpQuestion(null);
    setFollowUpIndex(0);
    setFollowUpAnswer("");
    setConversationHistory([]);
    setSessionActive(false);
    setDiagnosisPlan(null);
    setSessionEnded(false);
    setSessionInitialSeconds(deepDuration * 60);
    setSessionTimerKey((k) => k + 1);
    setIntakeStep(null);
    setIntakeQuestion(null);
    setIntakeOptions(null);
    setIntakeInputType(null);
    setIntakeData({});
    setIntakeQuestionIndex(0);
    setIntakeMessages([]);
    setPhq9Score(null);
    setPhq9Interpretation(null);
    setIntakeScaleValue("5");
    setSessionMode("quick");
    setChatMessages([]);
    setChatInput("");
    setChatLoading(false);
    setChatStarted(false);
    if (soundRef.current) {
      soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setSpeaking(false);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const selectedLevel = SERIOUSNESS_LEVELS.find(l => l.value === seriousness);

  if (showIntro) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", paddingTop: webTopInset, paddingBottom: webBottomInset }]}>
        <LinearGradient
          colors={config.bgGradient}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          entering={ZoomIn.duration(800).springify()}
          style={[styles.introImageWrapper, { borderColor: config.accent, shadowColor: config.accent }]}
        >
          <Image
            source={config.image}
            style={styles.introImage}
            resizeMode="cover"
          />
        </Animated.View>
        <Animated.Text
          entering={FadeInDown.delay(600).duration(600)}
          style={[styles.introTitle, { color: config.accent, textShadowColor: config.accent }]}
        >
          {config.introTitle}
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(1000).duration(600)}
          style={styles.introSubtitle}
        >
          {config.introSubtitle}
        </Animated.Text>
        <Animated.View
          entering={FadeIn.delay(1800).duration(600)}
          style={styles.introQuote}
        >
          <Text style={styles.introQuoteText}>
            {config.introQuote}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(2400).duration(400)} style={styles.introLoader}>
          <ActivityIndicator color={config.accent} size="small" />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient
        colors={config.bgGradient}
        style={StyleSheet.absoluteFillObject}
      />
      <Image
        source={config.image}
        style={styles.bgImage}
        resizeMode="cover"
      />
      <View style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={["rgba(10,10,10,0.7)", "rgba(10,10,10,0.85)", "rgba(10,10,10,0.95)"]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: `${config.accent}20` }]}>
          <Ionicons name="arrow-back" size={22} color={config.accent} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {balance && (
          <Pressable onPress={() => router.push("/subscribe")} style={{ flexDirection: "row" as const, alignItems: "center" as const, gap: 3, backgroundColor: "rgba(212,164,32,0.15)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(212,164,32,0.3)", marginRight: 8 }}>
            <Image source={require("@/assets/images/dc-lightning-token.jpeg")} style={{ width: 14, height: 14, borderRadius: 7 }} />
            <Text style={{ fontSize: 11, fontWeight: "800" as const, color: "#D4A420" }}>{balance.totalAvailable}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        bounces={true}
        overScrollMode="always"
        nestedScrollEnabled={true}
        decelerationRate="normal"
      >
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.titleArea}>
          <Text style={[styles.title, { color: config.accent, textShadowColor: `${config.accent}80` }]}>{config.title}</Text>
          <Animated.View style={[styles.liveBadge, { backgroundColor: config.accent }, pulseStyle]}>
            <Text style={styles.liveBadgeText}>{"\u26A1"} LIVE NOW {"\u26A1"}</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.therapistSelector}>
          {(["patricia", "trump", "sophia", "james"] as TherapistVoice[]).map((voice) => {
            const tc = THERAPIST_CONFIGS[voice];
            const isSelected = selectedTherapist === voice;
            return (
              <Pressable
                key={voice}
                onPress={() => {
                  if (!loading && !therapy && !chatStarted) {
                    setSelectedTherapist(voice);
                    const prompts = THERAPIST_CONFIGS[voice].questionPrompts;
                    setQuestionPrompt(prompts ? prompts[Math.floor(Math.random() * prompts.length)] : null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    speakGreeting(voice);
                  }
                }}
                style={[
                  styles.therapistCard,
                  isSelected && { borderColor: tc.accent, backgroundColor: `${tc.accent}15` },
                  !isSelected && { opacity: 0.6 },
                ]}
              >
                <Image source={tc.image} style={styles.therapistCardImage} resizeMode="cover" />
                <Text style={[styles.therapistCardName, isSelected && { color: tc.accent }]}>{tc.name}</Text>
                {isSelected && <View style={[styles.therapistCardDot, { backgroundColor: tc.accent }]} />}
              </Pressable>
            );
          })}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={[styles.socialProof, { backgroundColor: config.accentBg, borderColor: `${config.accent}4D` }]}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: config.accent }]}>1,247</Text>
            <Text style={styles.statLabel}>Sessions Today</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: `${config.accent}33` }]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: config.accent }]}>98%</Text>
            <Text style={styles.statLabel}>"Feeling Better"</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: `${config.accent}33` }]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: config.accent }]}>4.9/5</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.timerContainer}>
          <SessionTimer
            key={sessionTimerKey}
            active={sessionActive}
            ended={sessionEnded}
            initialSeconds={sessionInitialSeconds}
            mode={sessionMode}
            deepDuration={deepDuration}
            accent={config.accent}
            deviceId={deviceId}
            onSessionEnd={handleSessionEnd}
            refreshBalance={refreshBalance}
          />
        </Animated.View>

        {!chatStarted && sessionMode !== "hypno" && <Animated.View entering={FadeInDown.delay(300).duration(500)} style={[styles.therapyCard, { borderColor: `${config.accent}66` }]}>
          <Text style={[styles.greeting, { color: config.accent }]}>{config.greeting}</Text>

          <Text style={[styles.inputLabel, { color: config.accent }]}>{"\uD83D\uDC64"} Your name (first only):</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="e.g., Mike"
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.textInput}
            maxLength={30}
          />

          {sessionMode !== "chat" && (
            <>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0, color: config.accent }]}>{"\uD83D\uDE1F"} {questionPrompt || "What's bothering you?"}</Text>
                <Pressable
                  onPress={() => startMicFor("problem")}
                  disabled={isTranscribing}
                  testID="mic-button"
                  accessibilityLabel={isRecording && micTargetRef.current === "problem" ? "Stop recording" : "Start voice input"}
                  style={({ pressed }) => [
                    styles.micButton,
                    { backgroundColor: config.accentLight, borderColor: `${config.accent}66` },
                    isRecording && micTargetRef.current === "problem" && { backgroundColor: config.accent, borderColor: config.accent },
                    pressed && { opacity: 0.7 },
                    isTranscribing && { opacity: 0.5 },
                  ]}
                >
                  {isTranscribing && micTargetRef.current === "problem" ? (
                    <ActivityIndicator color={config.accent} size="small" />
                  ) : (
                    <Ionicons
                      name={isRecording && micTargetRef.current === "problem" ? "stop" : "mic"}
                      size={18}
                      color={isRecording && micTargetRef.current === "problem" ? "#fff" : config.accent}
                    />
                  )}
                </Pressable>
              </View>
              {isRecording && micTargetRef.current === "problem" && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Listening... tap mic to stop</Text>
                </Animated.View>
              )}
              <TextInput
                value={problem}
                onChangeText={setProblem}
                placeholder={isRecording && micTargetRef.current === "problem" ? "Speak now..." : config.placeholder}
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={[styles.textInput, styles.textArea, isRecording && micTargetRef.current === "problem" && { borderColor: `${config.accent}99` }]}
                multiline
                maxLength={500}
                textAlignVertical="top"
                editable={!(isRecording && micTargetRef.current === "problem")}
              />

              <Text style={[styles.inputLabel, { color: config.accent }]}>{"\uD83D\uDCCA"} How serious is it? (1-10)</Text>
              <Pressable
                onPress={() => setShowLevelPicker(!showLevelPicker)}
                style={styles.levelSelector}
              >
                <Text style={styles.levelSelectorText}>
                  {selectedLevel?.label || "Select level"}
                </Text>
                <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.5)" />
              </Pressable>

              {showLevelPicker && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.levelPicker}>
                  {SERIOUSNESS_LEVELS.map((level) => (
                    <Pressable
                      key={level.value}
                      onPress={() => {
                        setSeriousness(level.value);
                        setShowLevelPicker(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={[styles.levelOption, seriousness === level.value && styles.levelOptionSelected]}
                    >
                      <Text style={[styles.levelOptionText, seriousness === level.value && { color: "#ff4d4d" }]}>
                        {level.label}
                      </Text>
                    </Pressable>
                  ))}
                </Animated.View>
              )}
            </>
          )}
          {sessionMode === "chat" && (
            <Text style={[styles.chatModeHint, { color: config.accent }]}>
              Just enter your name above and start chatting freely with {config.name}
            </Text>
          )}
        </Animated.View>}

        {!chatStarted && <Animated.View entering={FadeInDown.delay(350).duration(500)} style={styles.modeToggleContainer}>
          <Pressable
            onPress={() => { if (!therapy && !intakeStep && !chatStarted) { setSessionMode("quick"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
            style={[styles.modeToggleBtn, sessionMode === "quick" && { backgroundColor: `${config.accent}25`, borderColor: config.accent }]}
          >
            <Ionicons name="flash" size={14} color={sessionMode === "quick" ? config.accent : "rgba(255,255,255,0.4)"} />
            <Text style={[styles.modeToggleText, sessionMode === "quick" && { color: config.accent }]}>Quick</Text>
          </Pressable>
          <Pressable
            onPress={() => { if (!therapy && !intakeStep && !chatStarted) { setSessionMode("deep"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
            style={[styles.modeToggleBtn, sessionMode === "deep" && { backgroundColor: `${config.accent}25`, borderColor: config.accent }]}
          >
            <Ionicons name="analytics" size={14} color={sessionMode === "deep" ? config.accent : "rgba(255,255,255,0.4)"} />
            <Text style={[styles.modeToggleText, sessionMode === "deep" && { color: config.accent }]}>Deep + PHQ-9</Text>
          </Pressable>
          <Pressable
            onPress={() => { if (!therapy && !intakeStep && !chatStarted) { setSessionMode("chat"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
            style={[styles.modeToggleBtn, sessionMode === "chat" && { backgroundColor: `${config.accent}25`, borderColor: config.accent }]}
          >
            <Ionicons name="chatbubbles" size={14} color={sessionMode === "chat" ? config.accent : "rgba(255,255,255,0.4)"} />
            <Text style={[styles.modeToggleText, sessionMode === "chat" && { color: config.accent }]}>Free Chat</Text>
          </Pressable>
          <Pressable
            onPress={() => { if (!therapy && !intakeStep && !chatStarted) { setSessionMode("hypno"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } }}
            style={[styles.modeToggleBtn, sessionMode === "hypno" && { backgroundColor: "rgba(224,64,251,0.15)", borderColor: "#e040fb" }]}
          >
            <Ionicons name="eye" size={14} color={sessionMode === "hypno" ? "#e040fb" : "rgba(255,255,255,0.4)"} />
            <Text style={[styles.modeToggleText, sessionMode === "hypno" && { color: "#e040fb" }]}>Hypnosis</Text>
          </Pressable>
        </Animated.View>}

        {sessionMode === "hypno" && !chatStarted && (
          <Animated.View entering={FadeInDown.delay(350).duration(400)} style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: "#e040fb", fontSize: 13, fontWeight: "700" as const, textAlign: "center", marginBottom: 12, letterSpacing: 1 }}>YOUR NAME</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter your first name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={{
                backgroundColor: "rgba(26,26,46,0.8)",
                borderWidth: 2,
                borderColor: firstName.trim() ? "#e040fb" : "#333",
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 16,
                color: "#fff",
                fontSize: 16,
                fontWeight: "600" as const,
                textAlign: "center",
                marginBottom: 20,
              }}
              maxLength={30}
            />
            <Text style={{ color: "#e040fb", fontSize: 13, fontWeight: "700" as const, textAlign: "center", marginBottom: 12, letterSpacing: 1 }}>CHOOSE YOUR SESSION</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
              {HYPNO_PRESETS.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => { setHypnoPreset(p.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={{
                    backgroundColor: hypnoPreset === p.key ? "rgba(224,64,251,0.15)" : "rgba(26,26,46,0.8)",
                    borderWidth: 2,
                    borderColor: hypnoPreset === p.key ? "#e040fb" : "#333",
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    alignItems: "center",
                    minWidth: 100,
                  }}
                >
                  <Text style={{ fontSize: 26, marginBottom: 4 }}>{p.icon}</Text>
                  <Text style={{ color: hypnoPreset === p.key ? "#e040fb" : "#ccc", fontSize: 12, fontWeight: "700" as const }}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={startHypnosis}
              disabled={hypnoLoading || !firstName.trim()}
              style={({ pressed }) => ({
                marginTop: 20,
                alignSelf: "center",
                paddingVertical: 14,
                paddingHorizontal: 36,
                borderRadius: 30,
                opacity: (hypnoLoading || !firstName.trim()) ? 0.5 : pressed ? 0.8 : 1,
                overflow: "hidden" as const,
              })}
            >
              <LinearGradient
                colors={firstName.trim() ? ["#e040fb", "#7c4dff"] : ["#333", "#222"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ ...StyleSheet.absoluteFillObject, borderRadius: 30 }}
              />
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" as const, letterSpacing: 1, textAlign: "center" }}>
                {hypnoLoading ? "Preparing..." : "\u{1F300} BEGIN HYPNOSIS"}
              </Text>
            </Pressable>
            <Text style={{ color: "#999", fontSize: 11, textAlign: "center", marginTop: 8 }}>Costs 2 D.C. tokens per session</Text>
          </Animated.View>
        )}

        {!chatStarted && sessionMode !== "hypno" && (
          <Animated.View entering={FadeInDown.delay(380).duration(400)} style={styles.durationContainer}>
            <Text style={[styles.durationLabel, { color: config.accent }]}>SESSION LENGTH</Text>
            <View style={styles.durationRow}>
              {([5, 10, 15, 20] as const).map((mins) => (
                <Pressable
                  key={mins}
                  onPress={() => { if (!therapy && !intakeStep && !chatStarted) { setDeepDuration(mins); setSessionInitialSeconds(mins * 60); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
                  style={[styles.durationBtn, deepDuration === mins && { backgroundColor: `${config.accent}30`, borderColor: config.accent }]}
                >
                  <Text style={[styles.durationBtnTime, deepDuration === mins && { color: config.accent }]}>{mins}</Text>
                  <Text style={[styles.durationBtnUnit, deepDuration === mins && { color: config.accent }]}>MIN</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.durationCostRow}>
              <Ionicons name="flash" size={12} color={config.accent} />
              <Text style={[styles.durationCostText, { color: config.accent }]}>{deepDuration} D.C. tokens ({deepDuration} min × 1 token/min)</Text>
            </View>
          </Animated.View>
        )}

        {!chatStarted && sessionMode !== "hypno" && (
          <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.buttonContainer}>
            <Pressable
              onPress={sessionMode === "chat" ? handleStartChat : sessionMode === "deep" ? handleStartIntake : handleGetTherapy}
              disabled={sessionMode === "chat" ? !firstName.trim() : (sessionMode === "deep" ? intakeLoading : loading) || !canSubmit}
              style={({ pressed }) => [
                styles.therapyButton,
                { shadowColor: config.accent },
                (sessionMode === "chat" ? !firstName.trim() : !canSubmit) && styles.therapyButtonDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              <LinearGradient
                colors={(sessionMode === "chat" ? firstName.trim() : canSubmit) ? config.gradient : ["#333", "#222"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.therapyButtonGradient}
              >
                {(sessionMode === "deep" ? intakeLoading : loading) ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.therapyButtonText}>
                    {sessionMode === "chat" ? `START ${deepDuration} MIN CHAT` : sessionMode === "deep" ? `BEGIN ${deepDuration} MIN SESSION` : `${config.buttonText} (${deepDuration} MIN)`}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {intakeStep && intakeMessages.length > 0 && !therapy && (
          <Animated.View entering={FadeInUp.duration(600)} style={[styles.intakeConversation, { borderColor: `${config.accent}40` }]}>
            <View style={styles.intakeHeader}>
              <Ionicons name="analytics" size={16} color={config.accent} />
              <Text style={[styles.intakeHeaderText, { color: config.accent }]}>DEEP SESSION IN PROGRESS</Text>
              {intakeStep === "screening" && (
                <Text style={styles.intakeProgress}>{intakeQuestionIndex + 1}/9</Text>
              )}
            </View>

            {intakeMessages.map((msg, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(i > intakeMessages.length - 3 ? 100 : 0).duration(300)}
                style={[styles.intakeMsg, msg.role === "user" ? styles.intakeMsgUser : styles.intakeMsgTherapist]}
              >
                {msg.role === "therapist" && (
                  <Image source={config.image} style={styles.intakeMsgAvatar} resizeMode="cover" />
                )}
                <View style={[styles.intakeMsgBubble, msg.role === "user" ? { backgroundColor: `${config.accent}20` } : { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                  <Text style={[styles.intakeMsgText, msg.role === "therapist" && { color: "rgba(255,255,255,0.9)" }]}>{msg.text}</Text>
                </View>
              </Animated.View>
            ))}

            {intakeLoading && (
              <View style={styles.intakeLoadingRow}>
                <Image source={config.image} style={styles.intakeMsgAvatar} resizeMode="cover" />
                <View style={[styles.intakeMsgBubble, { backgroundColor: "rgba(255,255,255,0.06)", paddingVertical: 12 }]}>
                  <ActivityIndicator color={config.accent} size="small" />
                </View>
              </View>
            )}

            {!intakeLoading && intakeOptions && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.intakeOptionsContainer}>
                {intakeOptions.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => handleIntakeResponse(opt.value)}
                    style={({ pressed }) => [styles.intakeOptionBtn, { borderColor: `${config.accent}40` }, pressed && { backgroundColor: `${config.accent}30` }]}
                  >
                    <Text style={[styles.intakeOptionText, { color: config.accent }]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </Animated.View>
            )}

            {!intakeLoading && intakeInputType === "scale" && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.intakeScaleContainer}>
                <View style={styles.intakeScaleRow}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <Pressable
                      key={n}
                      onPress={() => { setIntakeScaleValue(String(n)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      style={[styles.intakeScaleBtn, intakeScaleValue === String(n) && { backgroundColor: config.accent, borderColor: config.accent }]}
                    >
                      <Text style={[styles.intakeScaleBtnText, intakeScaleValue === String(n) && { color: "#fff" }]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => handleIntakeResponse(intakeScaleValue)}
                  style={({ pressed }) => [styles.intakeSubmitScaleBtn, { backgroundColor: config.accent }, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.intakeSubmitScaleBtnText}>CONFIRM</Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        )}

        {chatStarted && sessionMode === "chat" && (
          <Animated.View entering={FadeInUp.duration(600)} style={[styles.chatContainer, { borderColor: `${config.accent}40` }]}>
            <View style={styles.chatHeader}>
              <Ionicons name="chatbubbles" size={16} color={config.accent} />
              <Text style={[styles.chatHeaderText, { color: config.accent }]}>FREE CHAT SESSION</Text>
              <Pressable
                onPress={() => { setLipSyncEnabled(!lipSyncEnabled); setLipSyncVideoUrl(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[styles.chatEndBtn, { backgroundColor: lipSyncEnabled ? `${config.accent}30` : `${config.accent}10`, borderColor: lipSyncEnabled ? config.accent : `${config.accent}40` }]}
              >
                <Ionicons name="videocam" size={12} color={lipSyncEnabled ? config.accent : "rgba(255,255,255,0.4)"} />
                <Text style={[styles.chatEndBtnText, { color: lipSyncEnabled ? config.accent : "rgba(255,255,255,0.4)", marginLeft: 4 }]}>
                  {lipSyncEnabled ? "VIDEO ON" : "VIDEO"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleNewSession}
                style={[styles.chatEndBtn, { backgroundColor: `${config.accent}20`, borderColor: `${config.accent}60` }]}
              >
                <Text style={[styles.chatEndBtnText, { color: config.accent }]}>END</Text>
              </Pressable>
            </View>

            {chatMessages.map((msg, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(i > chatMessages.length - 3 ? 100 : 0).duration(300)}
                style={[styles.chatMsg, msg.role === "user" ? styles.chatMsgUser : styles.chatMsgTherapist]}
              >
                {msg.role === "assistant" && (
                  <Image source={config.image} style={styles.chatMsgAvatar} resizeMode="cover" />
                )}
                <View style={[styles.chatMsgBubble, msg.role === "user" ? { backgroundColor: `${config.accent}20` } : { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                  <Text style={[styles.chatMsgText, msg.role === "assistant" && { color: "rgba(255,255,255,0.9)" }]}>{msg.content}</Text>
                </View>
              </Animated.View>
            ))}

            {chatLoading && (
              <View style={styles.chatLoadingRow}>
                <Image source={config.image} style={styles.chatMsgAvatar} resizeMode="cover" />
                <View style={[styles.chatMsgBubble, { backgroundColor: "rgba(255,255,255,0.06)", paddingVertical: 12 }]}>
                  <ActivityIndicator color={config.accent} size="small" />
                  {lipSyncEnabled && <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4 }}>Generating video...</Text>}
                </View>
              </View>
            )}

            {lipSyncLoading && !chatLoading && (
              <View style={styles.chatLoadingRow}>
                <View style={[styles.chatMsgBubble, { backgroundColor: "rgba(255,255,255,0.06)", paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 }]}>
                  <ActivityIndicator color={config.accent} size="small" />
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Creating lip-sync video...</Text>
                </View>
              </View>
            )}

            {lipSyncVideoUrl && (
              <Animated.View entering={FadeIn.duration(400)} style={styles.lipSyncVideoContainer}>
                <Pressable
                  onPress={() => setLipSyncVideoUrl(null)}
                  style={styles.lipSyncCloseBtn}
                >
                  <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.7)" />
                </Pressable>
                <View style={styles.lipSyncWebVideo}>
                  <Ionicons name="videocam" size={32} color={config.accent} />
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center", marginTop: 8 }}>Therapist Video Response</Text>
                  <Pressable
                    onPress={() => {
                      if (Platform.OS === "web" && typeof window !== "undefined") {
                        window.open(lipSyncVideoUrl, "_blank");
                      } else {
                        Linking.openURL(lipSyncVideoUrl);
                      }
                    }}
                    style={({ pressed }) => [styles.lipSyncPlayBtn, { backgroundColor: config.accent }, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="play" size={20} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" as const, marginLeft: 6 }}>Play Video</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {sessionEnded && (
              <Animated.View entering={FadeIn.duration(400)} style={[styles.chatSessionEnd, { borderColor: `${config.accent}40` }]}>
                <Text style={[styles.sessionEndTitle, { color: config.accent }]}>Session Complete</Text>
                <Text style={styles.sessionEndText}>Your session has ended.</Text>
                <Pressable
                  onPress={handleNewSession}
                  style={({ pressed }) => [styles.chatNewSessionBtn, { backgroundColor: config.accent }, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.chatNewSessionBtnText}>NEW SESSION</Text>
                </Pressable>
              </Animated.View>
            )}

            {!sessionEnded && (
              <View style={[styles.chatInputRow, { borderColor: `${config.accent}40` }]}>
                <Pressable
                  onPress={() => startMicFor("chat")}
                  disabled={isTranscribing || chatLoading}
                  testID="chat-mic-btn"
                  style={({ pressed }) => [
                    styles.chatMicBtn,
                    { borderColor: `${config.accent}40` },
                    isRecording && micTargetRef.current === "chat" && { backgroundColor: config.accent, borderColor: config.accent },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {isTranscribing && micTargetRef.current === "chat" ? (
                    <ActivityIndicator color={config.accent} size="small" />
                  ) : (
                    <Ionicons
                      name={isRecording && micTargetRef.current === "chat" ? "stop" : "mic"}
                      size={18}
                      color={isRecording && micTargetRef.current === "chat" ? "#fff" : config.accent}
                    />
                  )}
                </Pressable>
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder={isRecording && micTargetRef.current === "chat" ? "Speak now..." : `Talk to ${config.name}...`}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={[styles.chatInput, { borderColor: `${config.accent}30` }]}
                  multiline
                  maxLength={500}
                  editable={!chatLoading && !(isRecording && micTargetRef.current === "chat")}
                  onSubmitEditing={handleChatSend}
                  testID="chat-input"
                />
                <Pressable
                  onPress={handleChatSend}
                  disabled={chatLoading || !chatInput.trim()}
                  style={({ pressed }) => [
                    styles.chatSendBtn,
                    { backgroundColor: chatInput.trim() ? config.accent : "rgba(51,51,51,0.8)" },
                    pressed && { opacity: 0.8 },
                  ]}
                  testID="chat-send-btn"
                >
                  {chatLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="send" size={18} color="#fff" />
                  )}
                </Pressable>
              </View>
            )}
          </Animated.View>
        )}

        {therapy && phq9Score !== null && (
          <Animated.View entering={FadeInUp.delay(200).duration(500)} style={[styles.phq9Card, { borderColor: `${config.accent}60` }]}>
            <View style={styles.phq9Header}>
              <Ionicons name="clipboard" size={18} color={config.accent} />
              <Text style={[styles.phq9Title, { color: config.accent }]}>PHQ-9 RESULTS</Text>
            </View>
            <View style={styles.phq9ScoreRow}>
              <Text style={[styles.phq9ScoreNum, { color: config.accent }]}>{phq9Score}</Text>
              <Text style={styles.phq9ScoreMax}>/27</Text>
            </View>
            <View style={[styles.phq9Badge, { backgroundColor: phq9Score <= 4 ? "#2ecc71" : phq9Score <= 9 ? "#f39c12" : phq9Score <= 14 ? "#e67e22" : phq9Score <= 19 ? "#e74c3c" : "#c0392b" }]}>
              <Text style={styles.phq9BadgeText}>{phq9Interpretation?.description || ""}</Text>
            </View>
            <View style={styles.phq9Bar}>
              <View style={[styles.phq9BarFill, { width: `${Math.min((phq9Score / 27) * 100, 100)}%`, backgroundColor: phq9Score <= 4 ? "#2ecc71" : phq9Score <= 9 ? "#f39c12" : phq9Score <= 14 ? "#e67e22" : phq9Score <= 19 ? "#e74c3c" : "#c0392b" }]} />
            </View>
            <Text style={styles.phq9Disclaimer}>This screening is for informational purposes only and is not a clinical diagnosis. If you are in crisis, please contact a mental health professional or call 988.</Text>
          </Animated.View>
        )}

        {therapy && (
          <Animated.View entering={FadeInUp.duration(600)} style={[styles.resultCard, { borderColor: `${config.accent}80` }]}>
            <View style={[styles.trumpPortrait, { backgroundColor: config.accent }]}>
              <Image source={config.image} style={{ width: 64, height: 64, borderRadius: 32 }} resizeMode="cover" />
            </View>
            <Text style={[styles.diagnosisTitle, { color: config.accent }]}>{config.diagnosisLabel}</Text>
            <View style={[styles.diagnosisBox, { borderLeftColor: config.accent }]}>
              <Text style={styles.diagnosisText}>"{therapy}"</Text>
            </View>

            {conversationHistory.length > 1 && (
              <View style={styles.conversationHistory}>
                {conversationHistory.slice(1).map((msg, i) => (
                  <View key={i} style={[styles.convMessage, msg.role === "user" ? styles.convUser : styles.convTherapist]}>
                    <Text style={[styles.convRole, { color: msg.role === "user" ? "rgba(255,255,255,0.5)" : config.accent }]}>
                      {msg.role === "user" ? "You" : config.name}
                    </Text>
                    <Text style={styles.convText}>
                      {msg.role === "user" ? msg.text : `"${msg.text}"`}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {followUpQuestion && !sessionEnded && (
              <Animated.View entering={FadeInDown.duration(400)} style={[styles.followUpCard, { borderColor: `${config.accent}40` }]}>
                <Text style={[styles.followUpLabel, { color: config.accent }]}>
                  {config.name} asks:
                </Text>
                <Text style={styles.followUpQuestion}>"{followUpQuestion}"</Text>
                <View style={styles.followUpInputRow}>
                  <TextInput
                    value={followUpAnswer}
                    onChangeText={setFollowUpAnswer}
                    placeholder={isRecording && micTargetRef.current === "followUp" ? "Speak now..." : "Type or speak your answer..."}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={[styles.textInput, styles.followUpInput, { borderColor: `${config.accent}40`, flex: 1 }]}
                    multiline
                    maxLength={300}
                    textAlignVertical="top"
                    editable={!followUpLoading && !(isRecording && micTargetRef.current === "followUp")}
                  />
                  <Pressable
                    onPress={() => startMicFor("followUp")}
                    disabled={isTranscribing || followUpLoading}
                    testID="followup-mic-btn"
                    style={({ pressed }) => [
                      styles.followUpMicBtn,
                      { borderColor: `${config.accent}40` },
                      isRecording && micTargetRef.current === "followUp" && { backgroundColor: config.accent, borderColor: config.accent },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    {isTranscribing && micTargetRef.current === "followUp" ? (
                      <ActivityIndicator color={config.accent} size="small" />
                    ) : (
                      <Ionicons
                        name={isRecording && micTargetRef.current === "followUp" ? "stop" : "mic"}
                        size={18}
                        color={isRecording && micTargetRef.current === "followUp" ? "#fff" : config.accent}
                      />
                    )}
                  </Pressable>
                </View>
                <Pressable
                  onPress={handleFollowUp}
                  disabled={followUpLoading || !followUpAnswer.trim()}
                  style={({ pressed }) => [
                    styles.followUpBtn,
                    { backgroundColor: followUpAnswer.trim() ? config.accent : "rgba(51,51,51,0.8)" },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  {followUpLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.followUpBtnText}>RESPOND</Text>
                  )}
                </Pressable>
              </Animated.View>
            )}

            {sessionEnded && (
              <Animated.View entering={FadeIn.duration(400)} style={[styles.sessionEndCard, { borderColor: `${config.accent}40` }]}>
                <Text style={[styles.sessionEndTitle, { color: config.accent }]}>Session Complete</Text>
                <Text style={styles.sessionEndText}>Your session has ended. Start a new session to continue.</Text>
              </Animated.View>
            )}

            <View style={styles.resultActions}>
              <Pressable
                onPress={() => therapy && handleSpeak(therapy)}
                disabled={speaking}
                style={({ pressed }) => [styles.resultActionBtn, { borderColor: `${config.accent}80`, backgroundColor: config.accentLight }, pressed && { opacity: 0.7 }, speaking && { opacity: 0.6 }]}
              >
                <MaterialCommunityIcons name={speaking ? "volume-high" : "play"} size={16} color={config.accent} />
                <Text style={[styles.resultActionText, { color: config.accent }]}>{speaking ? "SPEAKING..." : "LISTEN"}</Text>
              </Pressable>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [styles.resultActionBtn, { borderColor: `${config.accent}66`, backgroundColor: config.accentBg }, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="share-outline" size={16} color={config.accent} />
                <Text style={[styles.resultActionText, { color: config.accent }]}>SHARE</Text>
              </Pressable>
              <Pressable
                onPress={handleNewSession}
                style={({ pressed }) => [styles.resultActionBtn, { backgroundColor: config.accent, borderColor: config.accent }, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={[styles.resultActionText, { color: "#fff" }]}>NEW SESSION</Text>
              </Pressable>
            </View>

            {!diagnosisPlan && (
              <Pressable
                onPress={generateDiagnosisPlan}
                disabled={diagnosisLoading}
                style={({ pressed }) => [
                  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: `${config.accent}60`, backgroundColor: config.accentBg },
                  pressed && { opacity: 0.7 },
                ]}
              >
                {diagnosisLoading ? (
                  <ActivityIndicator color={config.accent} size="small" />
                ) : (
                  <>
                    <Ionicons name="document-text" size={18} color={config.accent} />
                    <Text style={{ color: config.accent, fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 1 }}>GET DIAGNOSIS PLAN</Text>
                  </>
                )}
              </Pressable>
            )}
          </Animated.View>
        )}

        {!!therapy && (
          <View style={[styles.picksCard, { borderColor: `${config.accent}4D` }]}>
            <Text style={[styles.picksTitle, { color: config.accent }]}>{config.rxTitle}</Text>
            <Text style={styles.picksSubtitle}>{config.rxSubtitle}</Text>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL("https://www.amazon.com/s?k=omega+3+fish+oil+supplement&tag=trumpbot-20");
              }}
              style={({ pressed }) => [styles.pickItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.pickEmoji}>{"\uD83D\uDC8A"}</Text>
              <View style={styles.pickInfo}>
                <Text style={styles.pickName}>"Omega-3 Fish Oil – Tremendous for the Brain!"</Text>
                <Text style={styles.pickDesc}>The smartest people take this. I know many of them.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL("https://www.amazon.com/s?k=magnesium+glycinate+supplement&tag=trumpbot-20");
              }}
              style={({ pressed }) => [styles.pickItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.pickEmoji}>{"\u2728"}</Text>
              <View style={styles.pickInfo}>
                <Text style={styles.pickName}>"Magnesium – Sleep Like a Winner!"</Text>
                <Text style={styles.pickDesc}>I sleep 4 hours and wake up a genius. Imagine what you could do.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL("https://www.amazon.com/s?k=ashwagandha+supplement&tag=trumpbot-20");
              }}
              style={({ pressed }) => [styles.pickItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.pickEmoji}>{"\uD83C\uDF3F"}</Text>
              <View style={styles.pickInfo}>
                <Text style={styles.pickName}>"Ashwagandha – Stress? Never Heard of It!"</Text>
                <Text style={styles.pickDesc}>Ancient wisdom. Very powerful. Many people are saying it works.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL("https://www.amazon.com/s?k=vitamin+d3+supplement&tag=trumpbot-20");
              }}
              style={({ pressed }) => [styles.pickItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.pickEmoji}>{"\u2600\uFE0F"}</Text>
              <View style={styles.pickInfo}>
                <Text style={styles.pickName}>"Vitamin D – The Sunshine Vitamin!"</Text>
                <Text style={styles.pickDesc}>I get plenty from my golf courses. You? Take a pill.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL("https://www.amazon.com/s?k=l-theanine+supplement+focus&tag=trumpbot-20");
              }}
              style={({ pressed }) => [styles.pickItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.pickEmoji}>{"\uD83E\uDDE0"}</Text>
              <View style={styles.pickInfo}>
                <Text style={styles.pickName}>"L-Theanine – Focus Like a Dealmaker!"</Text>
                <Text style={styles.pickDesc}>Calm focus. No jitters. Just winning. Art of the Deal energy.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL("https://www.amazon.com/s?k=probiotics+gut+health&tag=trumpbot-20");
              }}
              style={({ pressed }) => [styles.pickItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.pickEmoji}>{"\uD83E\uDDA0"}</Text>
              <View style={styles.pickInfo}>
                <Text style={styles.pickName}>"Probiotics – Trust Your Gut!"</Text>
                <Text style={styles.pickDesc}>My gut is never wrong. Yours could be better. Tremendous bacteria.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL("https://www.amazon.com/s?k=melatonin+sleep+aid&tag=trumpbot-20");
              }}
              style={({ pressed }) => [styles.pickItem, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.pickEmoji}>{"\uD83C\uDF19"}</Text>
              <View style={styles.pickInfo}>
                <Text style={styles.pickName}>"Melatonin – Sleep Bigly!"</Text>
                <Text style={styles.pickDesc}>Rest well. Wake up ready to make deals. Winners sleep smart.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>

            <Text style={styles.picksDisclaimer}>
              As an Amazon Associate, I earn from qualifying purchases.
            </Text>
          </View>
        )}

        {diagnosisPlan && (
          <Animated.View entering={FadeInUp.duration(600)} style={[diagStyles.card, { borderColor: `${config.accent}60` }]}>
            <LinearGradient colors={[`${config.accent}15`, "transparent"]} style={diagStyles.cardHeader}>
              <View style={diagStyles.drRow}>
                <Image source={config.image} style={diagStyles.drImage} resizeMode="cover" />
                <View style={diagStyles.drInfo}>
                  <Text style={[diagStyles.drName, { color: config.accent }]}>{config.signature}</Text>
                  {config.credentials.split("\n").map((line, i) => (
                    <Text key={i} style={diagStyles.credential}>{line}</Text>
                  ))}
                </View>
              </View>
              <View style={[diagStyles.divider, { backgroundColor: `${config.accent}30` }]} />
              <Text style={diagStyles.planLabel}>DIAGNOSIS & TREATMENT PLAN</Text>
              <Text style={diagStyles.patientName}>Patient: {firstName || "Friend"}</Text>
              <Text style={diagStyles.dateText}>Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</Text>
            </LinearGradient>

            <View style={diagStyles.section}>
              <Text style={[diagStyles.sectionTitle, { color: config.accent }]}>DIAGNOSIS</Text>
              <Text style={diagStyles.sectionText}>{diagnosisPlan.diagnosis}</Text>
            </View>

            {diagnosisPlan.treatmentSteps?.length > 0 && (
              <View style={diagStyles.section}>
                <Text style={[diagStyles.sectionTitle, { color: config.accent }]}>TREATMENT PLAN</Text>
                {diagnosisPlan.treatmentSteps.map((step: string, i: number) => (
                  <View key={i} style={diagStyles.stepRow}>
                    <View style={[diagStyles.stepBadge, { backgroundColor: config.accent }]}>
                      <Text style={diagStyles.stepNum}>{i + 1}</Text>
                    </View>
                    <Text style={diagStyles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}

            {diagnosisPlan.solutions?.length > 0 && (
              <View style={diagStyles.section}>
                <Text style={[diagStyles.sectionTitle, { color: config.accent }]}>ACTIONABLE SOLUTIONS</Text>
                {diagnosisPlan.solutions.map((sol: string, i: number) => (
                  <View key={i} style={diagStyles.solRow}>
                    <Ionicons name="checkmark-circle" size={16} color={config.accent} />
                    <Text style={diagStyles.solText}>{sol}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={diagStyles.section}>
              <Text style={[diagStyles.sectionTitle, { color: config.accent }]}>SESSION NOTES</Text>
              <Text style={diagStyles.sectionText}>{diagnosisPlan.sessionSummary}</Text>
            </View>

            <View style={[diagStyles.divider, { backgroundColor: `${config.accent}30` }]} />

            <View style={diagStyles.signatureBlock}>
              <Text style={[diagStyles.signatureText, { color: config.accent }]}>{config.signature}</Text>
              <Text style={diagStyles.specialtyText}>{config.specialty}</Text>
              <Text style={diagStyles.disclaimerText}>For entertainment purposes only. Not a substitute for professional medical advice.</Text>
            </View>

            <View style={diagStyles.actionsRow}>
              <Pressable
                onPress={handleShareDiagnosis}
                style={({ pressed }) => [diagStyles.actionBtn, { borderColor: `${config.accent}60`, backgroundColor: config.accentBg }, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="share-outline" size={16} color={config.accent} />
                <Text style={[diagStyles.actionText, { color: config.accent }]}>SHARE PLAN</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const planText = `${config.diagnosisLabel}\nPatient: ${firstName || "Friend"}\nTherapist: ${config.signature}\n${config.credentials.replace(/\n/g, " | ")}\n\nDIAGNOSIS:\n${diagnosisPlan.diagnosis}\n\nTREATMENT PLAN:\n${diagnosisPlan.treatmentSteps?.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n\nACTIONABLE SOLUTIONS:\n${diagnosisPlan.solutions?.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n\nSESSION NOTES:\n${diagnosisPlan.sessionSummary}\n\nSigned: ${config.signature}`;
                  if (Platform.OS === "web") {
                    navigator.clipboard?.writeText(planText).catch(() => {});
                  }
                }}
                style={({ pressed }) => [diagStyles.actionBtn, { borderColor: `${config.accent}60`, backgroundColor: config.accentBg }, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="copy-outline" size={16} color={config.accent} />
                <Text style={[diagStyles.actionText, { color: config.accent }]}>COPY</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <Modal
        visible={showHypnoOverlay}
        transparent
        animationType="fade"
        onRequestClose={() => {
          hypnoSessionRef.current.cancelled = true;
          setShowHypnoOverlay(false);
          setHypnoLoading(false);
          if (soundRef.current) {
            soundRef.current.stopAsync().catch(() => {});
            soundRef.current.unloadAsync().catch(() => {});
            soundRef.current = null;
          }
          if (hypnoEchoRef.current) {
            hypnoEchoRef.current.stopAsync().catch(() => {});
            hypnoEchoRef.current.unloadAsync().catch(() => {});
            hypnoEchoRef.current = null;
          }
        }}
      >
        <View style={serenaStyles.hypnoOverlay}>
          <View style={{ position: "absolute", top: 50, left: 0, right: 0, alignItems: "center", zIndex: 10 }}>
            <Text style={{ color: "rgba(224,64,251,0.6)", fontSize: 11, fontWeight: "700" as const, letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 4 }}>SESSION FOR</Text>
            <Text style={{ color: "#e040fb", fontSize: 22, fontWeight: "800" as const, letterSpacing: 1 }}>{firstName.trim() || "Guest"}</Text>
            <View style={{ width: 60, height: 2, backgroundColor: "rgba(224,64,251,0.3)", borderRadius: 1, marginTop: 6 }} />
          </View>
          <Animated.View style={[serenaStyles.spiralContainer, spiralPulseStyle]}>
            <Animated.View
              style={[
                serenaStyles.spiralRing,
                { borderColor: "#e040fb", width: 240, height: 240, borderRadius: 120 },
                spiralStyle1,
              ]}
            />
            <Animated.View
              style={[
                serenaStyles.spiralRing,
                { borderColor: "#7c4dff", width: 180, height: 180, borderRadius: 90, position: "absolute" },
                spiralStyle2,
              ]}
            />
            <Animated.View
              style={[
                serenaStyles.spiralRing,
                { borderColor: "#ce93d8", width: 120, height: 120, borderRadius: 60, position: "absolute" },
                spiralStyle3,
              ]}
            />
            <Animated.View
              style={[
                serenaStyles.spiralRing,
                { borderColor: "#e040fb", width: 60, height: 60, borderRadius: 30, position: "absolute", opacity: 0.8 },
                spiralStyle1,
              ]}
            />
            <View style={serenaStyles.spiralCenter}>
              <Ionicons name="eye" size={28} color="#e040fb" />
            </View>
          </Animated.View>
          <Animated.Text entering={FadeIn.duration(1200)} key={hypnoText} style={serenaStyles.hypnoTextDisplay}>
            {hypnoText}
          </Animated.Text>
          <Pressable
            onPress={() => {
              hypnoSessionRef.current.cancelled = true;
              setShowHypnoOverlay(false);
              setHypnoLoading(false);
              if (Platform.OS === "web") {
                if (webEchoRef.current) { webEchoRef.current.pause(); webEchoRef.current = null; }
                document.querySelectorAll("audio").forEach(a => { a.pause(); a.remove(); });
              }
              if (soundRef.current) {
                soundRef.current.stopAsync().catch(() => {});
                soundRef.current.unloadAsync().catch(() => {});
                soundRef.current = null;
              }
              if (hypnoEchoRef.current) {
                hypnoEchoRef.current.stopAsync().catch(() => {});
                hypnoEchoRef.current.unloadAsync().catch(() => {});
                hypnoEchoRef.current = null;
              }
              if (hypnoAmbientRef.current) {
                hypnoAmbientRef.current.stopAsync().catch(() => {});
                hypnoAmbientRef.current.unloadAsync().catch(() => {});
                hypnoAmbientRef.current = null;
              }
            }}
            style={serenaStyles.hypnoExitBtn}
          >
            <Text style={serenaStyles.hypnoExitText}>End Session</Text>
          </Pressable>
        </View>
      </Modal>
      <Modal visible={showSerenaFullscreen} transparent animationType="fade" onRequestClose={() => onSerenaFullscreenDismiss()}>
        <View style={serenaFullStyles.overlay}>
          <LinearGradient colors={["#0a0005", "#1a0a12", "#0a0005"]} style={serenaFullStyles.bg}>
            <Image source={patriciaImage} style={serenaFullStyles.fullImage} resizeMode="cover" />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.9)"]} style={serenaFullStyles.bottomGradient}>
              <Animated.View entering={FadeInUp.duration(800).delay(300)} style={serenaFullStyles.textBlock}>
                <Text style={serenaFullStyles.nameText}>DR. SERENA</Text>
                <Text style={serenaFullStyles.titleText}>Ph.D. in Psychology — Psychodynamic & Relational Therapy</Text>
                <Text style={serenaFullStyles.quoteText}>"You're safe here, darling. Let's begin."</Text>
              </Animated.View>
              <Pressable
                onPress={() => onSerenaFullscreenDismiss()}
                style={({ pressed }) => [serenaFullStyles.beginBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={serenaFullStyles.beginText}>BEGIN SESSION</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </Pressable>
            </LinearGradient>
          </LinearGradient>
        </View>
      </Modal>
      <Modal visible={showSerenaIntro} transparent animationType="fade" onRequestClose={() => setShowSerenaIntro(false)}>
        <View style={serenaIntroStyles.overlay}>
          <View style={serenaIntroStyles.videoContainer}>
            <Video
              ref={serenaVideoRef}
              source={{ uri: new URL("/server/assets/dr-serena-intro.mp4", getApiUrl()).toString() }}
              style={serenaIntroStyles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping={false}
              rate={2.0}
              onPlaybackStatusUpdate={(status: any) => {
                if (status.didJustFinish) {
                  onSerenaVideoEnd();
                }
              }}
            />
            <Pressable
              style={serenaIntroStyles.skipBtn}
              onPress={() => onSerenaVideoEnd()}
            >
              <Text style={serenaIntroStyles.skipText}>Skip</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Modal>
      <SoundToggle />
    </View>
  );
}

const serenaFullStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000",
  },
  bg: {
    flex: 1,
    justifyContent: "flex-end",
  },
  fullImage: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  bottomGradient: {
    paddingHorizontal: 40,
    paddingBottom: 60,
    paddingTop: 200,
  },
  textBlock: {
    marginBottom: 30,
  },
  nameText: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    color: "#ff99cc",
    letterSpacing: 3,
    marginBottom: 8,
  },
  titleText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 16,
  },
  quoteText: {
    fontSize: 20,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.9)",
    fontStyle: "italic" as const,
  },
  beginBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 10,
    backgroundColor: "#ff99cc",
    paddingVertical: 16,
    borderRadius: 30,
    marginTop: 10,
  },
  beginText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 2,
  },
});

const diagStyles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(20,20,20,0.95)",
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 24,
    overflow: "hidden" as const,
  },
  cardHeader: {
    padding: 20,
  },
  drRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 14,
    marginBottom: 16,
  },
  drImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  drInfo: {
    flex: 1,
  },
  drName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  credential: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 16,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  planLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 2,
    marginBottom: 6,
  },
  patientName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    lineHeight: 22,
  },
  stepRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 10,
    marginBottom: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginTop: 1,
  },
  stepNum: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    lineHeight: 21,
  },
  solRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 8,
    marginBottom: 8,
  },
  solText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    lineHeight: 21,
  },
  signatureBlock: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center" as const,
  },
  signatureText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontStyle: "italic" as const,
    marginBottom: 4,
  },
  specialtyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center" as const,
    fontStyle: "italic" as const,
  },
  actionsRow: {
    flexDirection: "row" as const,
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
});

const serenaIntroStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  videoContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  skipBtn: {
    position: "absolute",
    bottom: 60,
    right: 30,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 4,
  },
  skipText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
  },
});

const serenaStyles = StyleSheet.create({
  hypnoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    justifyContent: "center",
    alignItems: "center",
  },
  spiralContainer: {
    width: 260,
    height: 260,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 50,
  },
  spiralRing: {
    borderWidth: 3,
    borderStyle: "dashed" as any,
    opacity: 0.6,
  },
  spiralCenter: {
    position: "absolute",
  },
  hypnoTextDisplay: {
    color: "#e040fb",
    fontSize: 22,
    fontWeight: "300" as const,
    textAlign: "center",
    fontStyle: "italic",
    paddingHorizontal: 40,
    marginBottom: 40,
    letterSpacing: 1,
  },
  hypnoExitBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(224,64,251,0.4)",
    backgroundColor: "rgba(224,64,251,0.1)",
  },
  hypnoExitText: {
    color: "#e040fb",
    fontSize: 14,
    fontWeight: "600" as const,
  },
});

const styles = StyleSheet.create({
  introImageWrapper: {
    width: SCREEN_WIDTH * 0.65,
    height: SCREEN_HEIGHT * 0.38,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#ff4d4d",
    shadowColor: "#ff4d4d",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 15,
    marginBottom: 24,
  },
  introImage: {
    width: "100%" as const,
    height: "100%" as const,
  },
  introTitle: {
    fontSize: 38,
    fontWeight: "900" as const,
    color: "#ff4d4d",
    letterSpacing: 6,
    textShadowColor: "rgba(255,77,77,0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
    marginBottom: 6,
  },
  introSubtitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 4,
    marginBottom: 24,
  },
  introQuote: {
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  introQuoteText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.5)",
    fontStyle: "italic" as const,
    textAlign: "center" as const,
  },
  introLoader: {
    marginTop: 10,
  },
  bgImage: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%" as const,
    height: "100%" as const,
    opacity: 0.15,
  },
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    ...Platform.select({
      web: {
        height: "100vh" as any,
        maxHeight: "100vh" as any,
        overflow: "hidden" as any,
        display: "flex" as any,
        flexDirection: "column" as any,
      },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 44,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,77,77,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
    ...Platform.select({
      web: {
        overflow: "auto" as any,
        minHeight: 0 as any,
      },
    }),
  },
  scrollContent: {
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        paddingBottom: 40,
        maxWidth: 600,
        alignSelf: "center" as any,
        width: "100%" as any,
      },
    }),
  },
  therapistSelector: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    gap: 12,
    marginBottom: 20,
  },
  therapistCard: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(26,26,26,0.6)",
  },
  therapistCardImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 8,
  },
  therapistCardName: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center" as const,
  },
  therapistCardDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  titleArea: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#ff4d4d",
    letterSpacing: 3,
    textTransform: "uppercase",
    textShadowColor: "rgba(255,77,77,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 6,
  },
  liveBadge: {
    backgroundColor: "#ff4d4d",
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 12,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  socialProof: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,77,77,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.3)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ff4d4d",
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,77,77,0.2)",
  },
  therapyCard: {
    backgroundColor: "rgba(26,26,26,0.9)",
    borderWidth: 2,
    borderColor: "rgba(255,77,77,0.4)",
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 18,
    color: "#ff4d4d",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginTop: 16,
    marginBottom: 8,
  },
  inputLabel: {
    color: "#ff4d4d",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 16,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,77,77,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255,77,77,0.4)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  micButtonRecording: {
    backgroundColor: "#ff4d4d",
    borderColor: "#ff4d4d",
  },
  recordingIndicator: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff4d4d",
  },
  recordingText: {
    color: "#ff4d4d",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  textInputRecording: {
    borderColor: "rgba(255,77,77,0.6)",
  },
  textInput: {
    backgroundColor: "rgba(51,51,51,0.8)",
    borderWidth: 2,
    borderColor: "rgba(255,77,77,0.3)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#fff",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  levelSelector: {
    backgroundColor: "rgba(51,51,51,0.8)",
    borderWidth: 2,
    borderColor: "rgba(255,77,77,0.3)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  levelSelectorText: {
    fontSize: 16,
    color: "#fff",
  },
  levelPicker: {
    backgroundColor: "rgba(20,20,20,0.95)",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.3)",
    marginTop: 8,
  },
  levelOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  levelOptionSelected: {
    backgroundColor: "rgba(255,77,77,0.15)",
  },
  levelOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  buttonContainer: {
    marginBottom: 20,
  },
  therapyButton: {
    borderRadius: 30,
    overflow: "hidden",
    shadowColor: "#ff4d4d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  therapyButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  therapyButtonGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  therapyButtonText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  timerContainer: {
    alignItems: "center" as const,
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(10,10,10,0.8)",
    borderRadius: 12,
  },
  timerLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  timerDisplay: {
    fontSize: 42,
    fontWeight: "900" as const,
    fontVariant: ["tabular-nums" as const],
    marginTop: 4,
  },
  timerWarning: {
    opacity: 0.7,
  },
  timerExpired: {
    color: "#ff4d4d",
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1,
    marginTop: 4,
  },
  timerTokens: {
    fontSize: 11,
    fontWeight: "600" as const,
    marginTop: 4,
    opacity: 0.8,
  },
  conversationHistory: {
    marginBottom: 16,
    gap: 10,
  },
  convMessage: {
    borderRadius: 12,
    padding: 14,
  },
  convUser: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderLeftWidth: 3,
    borderLeftColor: "rgba(255,255,255,0.2)",
  },
  convTherapist: {
    backgroundColor: "rgba(51,51,51,0.5)",
    borderLeftWidth: 3,
  },
  convRole: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase" as const,
  },
  convText: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.85)",
  },
  followUpCard: {
    backgroundColor: "rgba(20,20,20,0.9)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  followUpLabel: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase" as const,
  },
  followUpQuestion: {
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,255,255,0.8)",
    fontStyle: "italic" as const,
    marginBottom: 12,
  },
  followUpInput: {
    minHeight: 70,
    marginBottom: 10,
    paddingTop: 12,
  },
  followUpBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  followUpBtnText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 1,
  },
  sessionEndCard: {
    backgroundColor: "rgba(20,20,20,0.9)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: "center" as const,
  },
  sessionEndTitle: {
    fontSize: 16,
    fontWeight: "800" as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  sessionEndText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center" as const,
  },
  resultCard: {
    backgroundColor: "rgba(26,26,26,0.95)",
    borderWidth: 2,
    borderColor: "rgba(255,77,77,0.5)",
    borderRadius: 16,
    padding: 24,
    marginBottom: 30,
  },
  trumpPortrait: {
    width: 70,
    height: 70,
    backgroundColor: "#ff4d4d",
    borderRadius: 35,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#fff",
  },
  diagnosisTitle: {
    color: "#ff4d4d",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 16,
  },
  diagnosisBox: {
    backgroundColor: "rgba(51,51,51,0.6)",
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#ff4d4d",
    marginBottom: 20,
  },
  diagnosisText: {
    fontSize: 17,
    lineHeight: 26,
    color: "rgba(255,255,255,0.9)",
    fontStyle: "italic",
  },
  resultActions: {
    flexDirection: "row",
    gap: 8,
  },
  resultActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.4)",
    backgroundColor: "rgba(255,77,77,0.08)",
  },
  listenBtn: {
    borderColor: "rgba(255,77,77,0.5)",
    backgroundColor: "rgba(255,77,77,0.12)",
  },
  newSessionBtn: {
    backgroundColor: "#ff4d4d",
    borderColor: "#ff4d4d",
  },
  resultActionText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  picksCard: {
    backgroundColor: "rgba(26,26,26,0.95)",
    borderWidth: 2,
    borderColor: "rgba(255,77,77,0.3)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    overflow: "hidden",
  },
  picksTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ff4d4d",
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: 4,
  },
  picksSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 16,
  },
  pickItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,77,77,0.12)",
    gap: 12,
  },
  pickEmoji: {
    fontSize: 28,
    width: 36,
    textAlign: "center",
  },
  pickInfo: {
    flex: 1,
  },
  pickName: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 2,
  },
  pickDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    fontStyle: "italic",
  },
  picksDisclaimer: {
    fontSize: 10,
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
    marginTop: 14,
  },
  modeToggleContainer: {
    flexDirection: "row" as const,
    gap: 10,
    marginBottom: 16,
    marginTop: 4,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(26,26,26,0.5)",
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.4)",
  },
  durationContainer: {
    marginBottom: 16,
    alignItems: "center" as const,
  },
  durationLabel: {
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  durationRow: {
    flexDirection: "row" as const,
    gap: 10,
  },
  durationBtn: {
    width: 62,
    height: 62,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(26,26,26,0.5)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  durationBtnTime: {
    fontSize: 20,
    fontWeight: "900" as const,
    color: "rgba(255,255,255,0.4)",
  },
  durationBtnUnit: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 1,
    marginTop: -2,
  },
  durationCostRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    marginTop: 10,
  },
  durationCostText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  intakeConversation: {
    marginTop: 16,
    backgroundColor: "rgba(20,20,20,0.8)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  intakeHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: 4,
  },
  intakeHeaderText: {
    fontSize: 12,
    fontWeight: "800" as const,
    letterSpacing: 1,
  },
  intakeProgress: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.5)",
    marginLeft: "auto" as any,
  },
  intakeMsg: {
    flexDirection: "row" as const,
    gap: 8,
    maxWidth: "90%" as any,
  },
  intakeMsgUser: {
    alignSelf: "flex-end" as const,
  },
  intakeMsgTherapist: {
    alignSelf: "flex-start" as const,
  },
  intakeMsgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 4,
  },
  intakeMsgBubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "85%" as any,
  },
  intakeMsgText: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.7)",
  },
  intakeLoadingRow: {
    flexDirection: "row" as const,
    gap: 8,
    alignSelf: "flex-start" as const,
  },
  intakeOptionsContainer: {
    gap: 8,
    marginTop: 4,
  },
  intakeOptionBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  intakeOptionText: {
    fontSize: 14,
    fontWeight: "600" as const,
    textAlign: "center" as const,
  },
  intakeScaleContainer: {
    gap: 12,
    marginTop: 4,
  },
  intakeScaleRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
    justifyContent: "center" as const,
  },
  intakeScaleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  intakeScaleBtnText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "rgba(255,255,255,0.5)",
  },
  intakeSubmitScaleBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center" as const,
  },
  intakeSubmitScaleBtnText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 1,
  },
  phq9Card: {
    marginTop: 16,
    backgroundColor: "rgba(20,20,20,0.9)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center" as const,
  },
  phq9Header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: 12,
  },
  phq9Title: {
    fontSize: 14,
    fontWeight: "800" as const,
    letterSpacing: 1.5,
  },
  phq9ScoreRow: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
    marginBottom: 10,
  },
  phq9ScoreNum: {
    fontSize: 48,
    fontWeight: "900" as const,
  },
  phq9ScoreMax: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.3)",
  },
  phq9Badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  phq9BadgeText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#fff",
    letterSpacing: 0.5,
  },
  phq9Bar: {
    width: "100%" as any,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
    overflow: "hidden" as const,
    marginBottom: 14,
  },
  phq9BarFill: {
    height: "100%" as any,
    borderRadius: 4,
  },
  phq9Disclaimer: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center" as const,
    lineHeight: 14,
  },
  chatModeHint: {
    fontSize: 14,
    fontStyle: "italic" as const,
    textAlign: "center" as const,
    marginTop: 16,
    opacity: 0.7,
  },
  chatContainer: {
    marginTop: 16,
    backgroundColor: "rgba(20,20,20,0.8)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  chatHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: 4,
  },
  chatHeaderText: {
    fontSize: 12,
    fontWeight: "800" as const,
    letterSpacing: 1,
    flex: 1,
  },
  chatEndBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  chatEndBtnText: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  chatMsg: {
    flexDirection: "row" as const,
    gap: 8,
    maxWidth: "90%" as any,
  },
  chatMsgUser: {
    alignSelf: "flex-end" as const,
  },
  chatMsgTherapist: {
    alignSelf: "flex-start" as const,
  },
  chatMsgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 4,
  },
  chatMsgBubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "85%" as any,
  },
  chatMsgText: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.7)",
  },
  chatLoadingRow: {
    flexDirection: "row" as const,
    gap: 8,
    alignSelf: "flex-start" as const,
  },
  chatSessionEnd: {
    backgroundColor: "rgba(20,20,20,0.9)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center" as const,
    gap: 10,
  },
  chatNewSessionBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  chatNewSessionBtnText: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: 1,
  },
  chatInputRow: {
    flexDirection: "row" as const,
    gap: 8,
    alignItems: "flex-end" as const,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  chatInput: {
    flex: 1,
    backgroundColor: "rgba(51,51,51,0.8)",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#fff",
    maxHeight: 100,
  },
  chatSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  chatMicBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(51,51,51,0.8)",
  },
  followUpInputRow: {
    flexDirection: "row" as const,
    gap: 8,
    alignItems: "flex-end" as const,
  },
  followUpMicBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(51,51,51,0.8)",
    marginBottom: 2,
  },
  lipSyncVideoContainer: {
    marginVertical: 12,
    borderRadius: 16,
    overflow: "hidden" as const,
    backgroundColor: "rgba(0,0,0,0.4)",
    position: "relative" as const,
  },
  lipSyncCloseBtn: {
    position: "absolute" as const,
    top: 8,
    right: 8,
    zIndex: 10,
  },
  lipSyncWebVideo: {
    padding: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  lipSyncPlayBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 8,
  },
});
