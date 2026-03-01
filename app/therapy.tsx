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
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";
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
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SERIOUSNESS_LEVELS = [
  { value: "1", label: "1 - Minor annoyance" },
  { value: "2", label: "2 - Slightly annoying" },
  { value: "3", label: "3 - Meh" },
  { value: "4", label: "4 - Getting worse" },
  { value: "5", label: "5 - Moderate (sad!)" },
  { value: "6", label: "6 - Pretty bad" },
  { value: "7", label: "7 - Very bad" },
  { value: "8", label: "8 - Terrible" },
  { value: "9", label: "9 - Disastrous" },
  { value: "10", label: "10 - TOTAL WITCH HUNT" },
];

export default function TherapyScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const { hasTokens, deviceId, refreshBalance } = useTokens();

  const [showIntro, setShowIntro] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [problem, setProblem] = useState("");
  const [seriousness, setSeriousness] = useState("5");
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [therapy, setTherapy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

      const res = await fetch(`${baseUrl}/api/therapy`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          name: firstName.trim(),
          problem: problem.trim(),
          seriousness,
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
      refreshBalance();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);

      if (data.therapy) {
        setTimeout(() => handleSpeak(data.therapy), 500);
      }
    } catch (err) {
      setTherapy("Dr. Trump is taking a break. Even the best therapists need to play golf sometimes. Try again!");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  async function handleSpeak(text: string) {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setSpeaking(true);
      const apiUrl = getApiUrl().replace(/\/$/, "");
      const ttsRes = await fetch(`${apiUrl}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mood: "CALM" }),
      });
      if (!ttsRes.ok) { setSpeaking(false); return; }
      const blob = await ttsRes.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const { sound } = await Audio.Sound.createAsync(
            { uri: `data:audio/mpeg;base64,${base64}` },
            { shouldPlay: true }
          );
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status.didJustFinish) setSpeaking(false);
          });
        } catch { setSpeaking(false); }
      };
      reader.onerror = () => setSpeaking(false);
      reader.readAsDataURL(blob);
    } catch { setSpeaking(false); }
  }

  React.useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  const handleShare = async () => {
    if (!therapy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const baseUrl = getApiUrl().replace(/\/$/, "");
    const cardUrl = `${baseUrl}/api/therapy/card?name=${encodeURIComponent(firstName || "Friend")}&therapy=${encodeURIComponent(therapy)}`;
    try {
      await Share.share({
        message: `\uD83E\uDDE0 TRUMP THERAPY \uD83E\uDDE0\n\nDr. Trump's Diagnosis for ${firstName}:\n\n"${therapy}"\n\nSee my therapy card: ${cardUrl}`,
      });
      fetch(`${baseUrl}/api/track-share`, { method: "POST", body: JSON.stringify({ feature: "therapy", platform: Platform.OS, contentPreview: therapy.slice(0, 100) }), headers: { "Content-Type": "application/json" } }).catch(() => {});
    } catch {}
  };

  const handleNewSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTherapy(null);
    setFirstName("");
    setProblem("");
    setSeriousness("5");
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
          colors={["#0a0a0a", "#1a0505", "#0a0a0a"]}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          entering={ZoomIn.duration(800).springify()}
          style={styles.introImageWrapper}
        >
          <Image
            source={trumpTherapistImage}
            style={styles.introImage}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.Text
          entering={FadeInDown.delay(600).duration(600)}
          style={styles.introTitle}
        >
          DR. TRUMP
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(1000).duration(600)}
          style={styles.introSubtitle}
        >
          IS READY TO SEE YOU NOW
        </Animated.Text>
        <Animated.View
          entering={FadeIn.delay(1800).duration(600)}
          style={styles.introQuote}
        >
          <Text style={styles.introQuoteText}>
            "Lie down. Tell me everything."
          </Text>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(2400).duration(400)} style={styles.introLoader}>
          <ActivityIndicator color="#ff4d4d" size="small" />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient
        colors={["#0a0a0a", "#1a0505", "#0a0a0a"]}
        style={StyleSheet.absoluteFillObject}
      />
      <Image
        source={trumpTherapistImage}
        style={styles.bgImage}
        resizeMode="cover"
      />
      <View style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={["rgba(10,10,10,0.7)", "rgba(26,5,5,0.85)", "rgba(10,10,10,0.95)"]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#ff4d4d" />
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
          <Text style={styles.titleEmoji}>{"\uD83E\uDDE0"}</Text>
          <Text style={styles.title}>TRUMP THERAPY</Text>
          <Text style={styles.subtitle}>"The best therapy. Believe me. Very smart people say so."</Text>
          <Animated.View style={[styles.liveBadge, pulseStyle]}>
            <Text style={styles.liveBadgeText}>{"\u26A1"} LIVE NOW {"\u26A1"}</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.socialProof}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>1,247</Text>
            <Text style={styles.statLabel}>Sessions Today</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>98%</Text>
            <Text style={styles.statLabel}>"Feeling Better"</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>4.9/5</Text>
            <Text style={styles.statLabel}>Trump Rating</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.therapyCard}>
          <Text style={styles.couchEmoji}>{"\uD83D\uDECB\uFE0F"}</Text>
          <Text style={styles.greeting}>"Lie down. Tell me everything. I'm listening..."</Text>

          <Text style={styles.inputLabel}>{"\uD83D\uDC64"} Your name (first only):</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="e.g., Mike"
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.textInput}
            maxLength={30}
          />

          <View style={styles.labelRow}>
            <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0 }]}>{"\uD83D\uDE1F"} What's bothering you?</Text>
            <Pressable
              onPress={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              testID="mic-button"
              accessibilityLabel={isRecording ? "Stop recording" : "Start voice input"}
              style={({ pressed }) => [
                styles.micButton,
                isRecording && styles.micButtonRecording,
                pressed && { opacity: 0.7 },
                isTranscribing && { opacity: 0.5 },
              ]}
            >
              {isTranscribing ? (
                <ActivityIndicator color="#ff4d4d" size="small" />
              ) : (
                <Ionicons
                  name={isRecording ? "stop" : "mic"}
                  size={18}
                  color={isRecording ? "#fff" : "#ff4d4d"}
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
            placeholder={isRecording ? "Speak now..." : "Tell Dr. Trump what's wrong... or tap the mic"}
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={[styles.textInput, styles.textArea, isRecording && styles.textInputRecording]}
            multiline
            maxLength={500}
            textAlignVertical="top"
            editable={!isRecording}
          />

          <Text style={styles.inputLabel}>{"\uD83D\uDCCA"} How serious is it? (1-10)</Text>
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
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.buttonContainer}>
          <Pressable
            onPress={handleGetTherapy}
            disabled={loading || !canSubmit}
            style={({ pressed }) => [
              styles.therapyButton,
              !canSubmit && styles.therapyButtonDisabled,
              pressed && { opacity: 0.8 },
            ]}
          >
            <LinearGradient
              colors={canSubmit ? ["#ff4d4d", "#cc0000"] : ["#333", "#222"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.therapyButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.therapyButtonText}>
                    {"\uD83D\uDD25"} GET THERAPY {"\uD83D\uDD25"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {therapy && (
          <Animated.View entering={FadeInUp.duration(600)} style={styles.resultCard}>
            <View style={styles.trumpPortrait}>
              <Text style={{ fontSize: 32 }}>{"\uD83D\uDDE3\uFE0F"}</Text>
            </View>
            <Text style={styles.diagnosisTitle}>DR. TRUMP'S DIAGNOSIS</Text>
            <View style={styles.diagnosisBox}>
              <Text style={styles.diagnosisText}>"{therapy}"</Text>
            </View>

            <View style={styles.resultActions}>
              <Pressable
                onPress={() => therapy && handleSpeak(therapy)}
                disabled={speaking}
                style={({ pressed }) => [styles.resultActionBtn, styles.listenBtn, pressed && { opacity: 0.7 }, speaking && { opacity: 0.6 }]}
              >
                <MaterialCommunityIcons name={speaking ? "volume-high" : "play"} size={16} color="#ff4d4d" />
                <Text style={[styles.resultActionText, { color: "#ff4d4d" }]}>{speaking ? "SPEAKING..." : "LISTEN"}</Text>
              </Pressable>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [styles.resultActionBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="share-outline" size={16} color="#ff4d4d" />
                <Text style={[styles.resultActionText, { color: "#ff4d4d" }]}>SHARE</Text>
              </Pressable>
              <Pressable
                onPress={handleNewSession}
                style={({ pressed }) => [styles.resultActionBtn, styles.newSessionBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={[styles.resultActionText, { color: "#fff" }]}>NEW SESSION</Text>
              </Pressable>
            </View>
          </Animated.View>
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
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  titleArea: {
    alignItems: "center",
    marginBottom: 20,
  },
  titleEmoji: {
    fontSize: 48,
    marginBottom: 8,
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
  couchEmoji: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 12,
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
});
