import React, { useState, useRef } from "react";
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
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";
import { playTTS } from "@/lib/audio-helper";
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
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";

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
  questionPrompts?: string[];
}

const THERAPIST_CONFIGS: Record<TherapistVoice, TherapistConfig> = {
  trump: {
    voice: "trump",
    name: "Dr. Trump",
    title: "TRUMP THERAPY",
    image: trumpTherapistImage,
    accent: "#ff4d4d",
    accentLight: "rgba(255,77,77,0.15)",
    accentBg: "rgba(255,77,77,0.08)",
    gradient: ["#ff4d4d", "#cc0000"],
    bgGradient: ["#0a0a0a", "#1a0505", "#0a0a0a"],
    greeting: "\"Lie down. Tell me everything. I'm listening...\"",
    diagnosisLabel: "DR. TRUMP'S DIAGNOSIS",
    introTitle: "DR. TRUMP",
    introSubtitle: "IS READY TO SEE YOU NOW",
    introQuote: "\"Lie down. Tell me everything.\"",
    placeholder: "Tell Dr. Trump what's wrong... or tap the mic",
    buttonText: "GET THERAPY",
    errorMsg: "Dr. Trump is taking a break. Even the best therapists need to play golf sometimes. Try again!",
    rxTitle: "DR. TRUMP'S RX",
    rxSubtitle: "\"I prescribe only the best. Believe me.\"",
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
    introTitle: "DR. PATRICIA",
    introSubtitle: "IS READY TO SEE YOU NOW",
    introQuote: "\"You're so brave for sharing that with me.\"",
    placeholder: "Tell Dr. Patricia what's on your mind, gorgeous... or tap the mic",
    buttonText: "BEGIN SESSION",
    errorMsg: "Dr. Patricia is freshening up. She'll be right back, sweetheart.",
    rxTitle: "DR. PATRICIA'S RX",
    rxSubtitle: "\"Taking care of yourself is the sexiest thing you can do.\"",
    questionPrompts: [
      "What's the one thing you wish someone understood about you?",
      "Mmm, tell me about the last time you felt truly alive.",
      "If your heart could speak right now, what would it say?",
      "I can see you're carrying something heavy. Let me help you with that...",
      "You know, I have a feeling there's more beneath the surface. Share it with me.",
    ],
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
  const { hasTokens, deviceId, refreshBalance } = useTokens();

  const [selectedTherapist, setSelectedTherapist] = useState<TherapistVoice>("trump");
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
  const [sessionSeconds, setSessionSeconds] = useState(120);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  const [sessionMode, setSessionMode] = useState<"quick" | "deep" | "chat">("quick");
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);

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

  const config = THERAPIST_CONFIGS[selectedTherapist];

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const pulseValue = useSharedValue(1);

  useFocusEffect(
    React.useCallback(() => {
      setShowIntro(true);
      introTimerRef.current = setTimeout(() => {
        setShowIntro(false);
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
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const response = await globalThis.fetch(`${baseUrl}/api/stt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, format }),
      });
      if (!response.ok) throw new Error("STT request failed");
      const data = await response.json();
      if (data.text && data.text.trim()) {
        setProblem((prev) => {
          const trimmed = data.text.trim();
          return prev ? prev + " " + trimmed : trimmed;
        });
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
      setSessionSeconds(120);
      setSessionActive(true);
      setSessionEnded(false);
      refreshBalance();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);

      const currentVoice = selectedTherapist;
      if (data.therapy) {
        setTimeout(() => handleSpeak(data.therapy, currentVoice), 500);
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
      setSpeaking(true);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const sound = await playTTS("/api/tts", { text, mood: "CALM", voice: ttsVoice });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) setSpeaking(false);
      });
    } catch { setSpeaking(false); }
  }

  React.useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (sessionActive && sessionSeconds > 0) {
      sessionTimerRef.current = setInterval(() => {
        setSessionSeconds((prev) => {
          if (prev <= 1) {
            if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
            setSessionActive(false);
            setSessionEnded(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      };
    }
  }, [sessionActive]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleFollowUp = async () => {
    if (!followUpAnswer.trim() || followUpLoading || sessionEnded) return;
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
        setTimeout(() => handleSpeak(data.therapy, currentVoice), 500);
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
    const baseUrl = getApiUrl().replace(/\/$/, "");
    const cardUrl = `${baseUrl}/api/therapy/card?name=${encodeURIComponent(firstName || "Friend")}&therapy=${encodeURIComponent(therapy)}`;
    try {
      await Share.share({
        message: `${config.title}\n\n${config.diagnosisLabel} for ${firstName}:\n\n"${therapy}"\n\nSee my therapy card: ${cardUrl}`,
      });
      fetch(`${baseUrl}/api/track-share`, { method: "POST", body: JSON.stringify({ feature: "therapy", platform: Platform.OS, contentPreview: therapy.slice(0, 100) }), headers: { "Content-Type": "application/json" } }).catch(() => {});
    } catch {}
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
    const greeting = config.greeting.replace(/"/g, "");
    setChatMessages([{ role: "assistant", content: greeting }]);
    setChatStarted(true);
    setSessionSeconds(120);
    setSessionActive(true);
    setSessionEnded(false);
    setTimeout(() => handleSpeak(greeting, selectedTherapist), 500);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading || sessionEnded) return;
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

      const res = await fetch(`${baseUrl}/api/therapy/chat`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          name: firstName.trim(),
          voice: currentVoice,
          messages: allMessages,
          therapyHistory: historyContext || undefined,
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

      if (data.reply) {
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
    setSessionEnded(false);
    setSessionSeconds(120);
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
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
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
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.titleArea}>
          <Text style={[styles.title, { color: config.accent, textShadowColor: `${config.accent}80` }]}>{config.title}</Text>
          <Animated.View style={[styles.liveBadge, { backgroundColor: config.accent }, pulseStyle]}>
            <Text style={styles.liveBadgeText}>{"\u26A1"} LIVE NOW {"\u26A1"}</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.therapistSelector}>
          {(["trump", "sophia", "james", "patricia"] as TherapistVoice[]).map((voice) => {
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
          <Text style={styles.timerLabel}>YOUR SESSION</Text>
          <Text style={[styles.timerDisplay, { color: config.accent }, sessionSeconds <= 30 && styles.timerWarning]}>
            {formatTime(sessionSeconds)}
          </Text>
          {sessionEnded && (
            <Text style={styles.timerExpired}>SESSION ENDED</Text>
          )}
        </Animated.View>

        {!chatStarted && <Animated.View entering={FadeInDown.delay(300).duration(500)} style={[styles.therapyCard, { borderColor: `${config.accent}66` }]}>
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
                  onPress={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing}
                  testID="mic-button"
                  accessibilityLabel={isRecording ? "Stop recording" : "Start voice input"}
                  style={({ pressed }) => [
                    styles.micButton,
                    { backgroundColor: config.accentLight, borderColor: `${config.accent}66` },
                    isRecording && { backgroundColor: config.accent, borderColor: config.accent },
                    pressed && { opacity: 0.7 },
                    isTranscribing && { opacity: 0.5 },
                  ]}
                >
                  {isTranscribing ? (
                    <ActivityIndicator color={config.accent} size="small" />
                  ) : (
                    <Ionicons
                      name={isRecording ? "stop" : "mic"}
                      size={18}
                      color={isRecording ? "#fff" : config.accent}
                    />
                  )}
                </Pressable>
              </View>
              {isRecording && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Listening... tap mic to stop</Text>
                </Animated.View>
              )}
              <TextInput
                value={problem}
                onChangeText={setProblem}
                placeholder={isRecording ? "Speak now..." : config.placeholder}
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={[styles.textInput, styles.textArea, isRecording && { borderColor: `${config.accent}99` }]}
                multiline
                maxLength={500}
                textAlignVertical="top"
                editable={!isRecording}
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
        </Animated.View>}

        {!chatStarted && (
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
                    {sessionMode === "chat" ? "START FREE CHAT" : sessionMode === "deep" ? "BEGIN DEEP SESSION" : config.buttonText}
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
                </View>
              </View>
            )}

            {sessionEnded && (
              <Animated.View entering={FadeIn.duration(400)} style={[styles.chatSessionEnd, { borderColor: `${config.accent}40` }]}>
                <Text style={[styles.sessionEndTitle, { color: config.accent }]}>Session Complete</Text>
                <Text style={styles.sessionEndText}>Your 2-minute session has ended.</Text>
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
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder={`Talk to ${config.name}...`}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={[styles.chatInput, { borderColor: `${config.accent}30` }]}
                  multiline
                  maxLength={500}
                  editable={!chatLoading}
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
                <TextInput
                  value={followUpAnswer}
                  onChangeText={setFollowUpAnswer}
                  placeholder="Type your answer..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={[styles.textInput, styles.followUpInput, { borderColor: `${config.accent}40` }]}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                  editable={!followUpLoading}
                />
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
                <Text style={styles.sessionEndText}>Your 2-minute session has ended. Start a new session to continue.</Text>
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
      </ScrollView>
    </View>
  );
}

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
});
