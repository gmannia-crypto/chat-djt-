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
  Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import Colors from "@/constants/colors";
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

type Phase = "loading" | "lecture" | "quiz" | "results" | "error";

interface TranscriptLine {
  role: "educator" | "student";
  text: string;
}

interface QuizQ {
  id: string;
  question: string;
  choices: string[];
}

interface BookReference {
  title: string;
  author: string;
  url: string;
}

export default function DcUniversityLectureScreen() {
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
  const [beatIndex, setBeatIndex] = useState(0);
  const [totalBeats, setTotalBeats] = useState(1);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  const [quiz, setQuiz] = useState<QuizQ[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [books, setBooks] = useState<BookReference[]>([]);

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
      const res = await fetch(`${getApiUrl()}/api/dc-university/lecture/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ courseId, minutes, studentName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error === "insufficient_tokens" ? "You don't have enough DC Tokens for this lecture." : (data.error || "Failed to start lecture"));
        setPhase("error");
        return;
      }
      setSessionId(data.sessionId);
      setEducatorId(data.educatorId);
      setEducatorName(data.educatorName);
      setCourseTitle(data.courseTitle);
      setBeatIndex(0);
      setTotalBeats(data.totalBeats);
      setTranscript([{ role: "educator", text: data.text }]);
      setBooks(Array.isArray(data.books) ? data.books : []);
      setPhase("lecture");
      refreshBalance();
      trackAnalyticsEvent("dc_university_lecture_started", { courseId, minutes });
    } catch (e) {
      setErrorMsg("Network error starting lecture. Please try again.");
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
    if (phase === "lecture" && transcript.length > 0 && educatorId) {
      const last = transcript[transcript.length - 1];
      if (last.role === "educator") speak(last.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, educatorId]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [transcript]);

  const nextBeat = async () => {
    if (!sessionId || isAdvancing) return;
    setIsAdvancing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${getApiUrl()}/api/dc-university/lecture/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.done) {
        await loadQuiz();
      } else {
        setBeatIndex(data.beatIndex);
        setTranscript((t) => [...t, { role: "educator", text: data.text }]);
      }
    } catch {
      setErrorMsg("Lost connection to the lecture. Please try again.");
      setPhase("error");
    } finally {
      setIsAdvancing(false);
    }
  };

  const askQuestion = async () => {
    const q = question.trim();
    if (!q || !sessionId || isAsking) return;
    setIsAsking(true);
    setQuestion("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTranscript((t) => [...t, { role: "student", text: q }]);
    try {
      const res = await fetch(`${getApiUrl()}/api/dc-university/lecture/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question: q }),
      });
      const data = await res.json();
      if (res.ok) {
        setTranscript((t) => [...t, { role: "educator", text: data.text }]);
      }
    } catch {
    } finally {
      setIsAsking(false);
    }
  };

  const loadQuiz = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/dc-university/quiz?courseId=${courseId}&minutes=${minutes}`);
      const data = await res.json();
      setQuiz(data.quiz || []);
      setQuizAnswers(new Array((data.quiz || []).length).fill(-1));
      setPhase("quiz");
    } catch {
      setErrorMsg("Failed to load the quiz.");
      setPhase("error");
    }
  };

  const submitQuiz = async () => {
    if (!deviceId || submittingQuiz) return;
    if (quizAnswers.some((a) => a === -1)) return;
    setSubmittingQuiz(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const res = await fetch(`${getApiUrl()}/api/dc-university/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ sessionId, courseId, minutes, studentName, answers: quizAnswers }),
      });
      const data = await res.json();
      setResults(data);
      setPhase("results");
      trackAnalyticsEvent("dc_university_quiz_completed", { courseId, minutes, passed: data.passed });
    } catch {
      setErrorMsg("Failed to submit your quiz. Please try again.");
      setPhase("error");
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const shareCertificate = () => {
    if (!results?.passed) return;
    shareContent({
      deviceId: deviceId || undefined,
      feature: "dc_university_certificate",
      text: `I just earned my ${courseTitle} certificate from ${educatorName} at DC University — scored ${results.score}/${results.total}! 🎓`,
    });
  };

  const portrait = EDUCATOR_PORTRAITS[educatorId];

  if (phase === "loading") {
    return (
      <View style={styles.centerContainer}>
        <LinearGradient colors={["#0B1F3A", "#050B18"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Walking into the lecture hall…</Text>
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <LinearGradient colors={["#0B1F3A", "#050B18"]} style={StyleSheet.absoluteFill} />
        <Feather name="alert-triangle" size={36} color="#FF6B6B" />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()} testID="dc-lecture-error-back">
          <Text style={styles.primaryButtonText}>Back to DC University</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#0B1F3A", "#050B18"]} style={StyleSheet.absoluteFill} />
      <Image source={require("@/assets/images/dc-university-crest.png")} style={styles.crestWatermark as any} resizeMode="contain" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton} testID="dc-lecture-back">
          <Feather name="chevron-left" size={26} color="#FFF" />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerCourse} numberOfLines={1}>{courseTitle}</Text>
          {phase === "lecture" && (
            <Text style={styles.headerProgress}>Topic {beatIndex + 1} of {totalBeats}</Text>
          )}
        </View>
        <View style={{ width: 26 }} />
      </View>

      {phase === "lecture" && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.educatorRow}>
            {portrait && <Image source={portrait} style={styles.lectureAvatar} />}
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.educatorNameLarge}>{educatorName}</Text>
              {isSpeaking && <Text style={styles.speakingIndicator}>Speaking…</Text>}
            </View>
          </View>

          <ScrollView ref={scrollRef} style={styles.transcriptScroll} contentContainerStyle={{ paddingBottom: 16 }}>
            {transcript.map((line, i) => (
              <View key={i} style={[styles.transcriptBubble, line.role === "student" ? styles.studentBubble : styles.educatorBubble]}>
                <Text style={styles.transcriptText}>{line.text}</Text>
              </View>
            ))}
            {isAsking && <ActivityIndicator color="#FFD700" style={{ marginTop: 8 }} />}
          </ScrollView>

          <View style={styles.qaRow}>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder={`Ask ${educatorName.split(" ")[0]} a question…`}
              placeholderTextColor="#8899AA"
              style={styles.qaInput}
              onSubmitEditing={askQuestion}
              testID="dc-lecture-question-input"
            />
            <Pressable onPress={askQuestion} style={styles.qaSendButton} disabled={isAsking || !question.trim()} testID="dc-lecture-ask-button">
              <Feather name="send" size={18} color="#050B18" />
            </Pressable>
          </View>

          {books.length > 0 && (
            <View style={styles.readingSection}>
              <Text style={styles.readingLabel}>Recommended Reading</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.affiliateRow}>
                {books.map((b, i) => (
                  <Pressable
                    key={i}
                    style={styles.affiliateBtn}
                    onPress={() => Linking.openURL(b.url)}
                    testID={`dc-lecture-book-${i}`}
                  >
                    <Feather name="book-open" size={13} color="#FFD700" />
                    <View style={{ marginLeft: 6, maxWidth: 150 }}>
                      <Text style={styles.affiliateBtnTitle} numberOfLines={1}>{b.title}</Text>
                      <Text style={styles.affiliateBtnAuthor} numberOfLines={1}>{b.author}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <Pressable
            onPress={nextBeat}
            disabled={isAdvancing}
            style={({ pressed }) => [styles.primaryButton, { marginHorizontal: 16, marginBottom: insets.bottom + 12 }, pressed && { opacity: 0.8 }]}
            testID="dc-lecture-next-button"
          >
            {isAdvancing ? (
              <ActivityIndicator color="#050B18" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {beatIndex + 1 >= totalBeats ? "Finish Lecture & Take Quiz" : "Continue Lecture"}
              </Text>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      )}

      {phase === "quiz" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          <Text style={styles.quizIntro}>Quick check — pass with 70% or better to earn your certificate.</Text>
          {quiz.map((q, qi) => (
            <View key={q.id} style={styles.quizCard}>
              <Text style={styles.quizQuestion}>{qi + 1}. {q.question}</Text>
              {q.choices.map((choice, ci) => (
                <Pressable
                  key={ci}
                  onPress={() => setQuizAnswers((a) => a.map((v, i) => (i === qi ? ci : v)))}
                  style={[styles.quizChoice, quizAnswers[qi] === ci && styles.quizChoiceSelected]}
                  testID={`dc-quiz-${qi}-choice-${ci}`}
                >
                  <Text style={[styles.quizChoiceText, quizAnswers[qi] === ci && styles.quizChoiceTextSelected]}>{choice}</Text>
                </Pressable>
              ))}
            </View>
          ))}
          <Pressable
            onPress={submitQuiz}
            disabled={submittingQuiz || quizAnswers.some((a) => a === -1)}
            style={[styles.primaryButton, quizAnswers.some((a) => a === -1) && { opacity: 0.4 }]}
            testID="dc-quiz-submit"
          >
            {submittingQuiz ? <ActivityIndicator color="#050B18" /> : <Text style={styles.primaryButtonText}>Submit Quiz</Text>}
          </Pressable>
        </ScrollView>
      )}

      {phase === "results" && results && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, alignItems: "center" }}>
          <Ionicons name={results.passed ? "ribbon" : "close-circle"} size={64} color={results.passed ? "#FFD700" : "#FF6B6B"} />
          <Text style={styles.resultsTitle}>{results.passed ? "You passed!" : "Not quite — try again anytime"}</Text>
          <Text style={styles.resultsScore}>{results.score} / {results.total} correct</Text>

          {results.passed && (
            <View style={styles.certificateCard}>
              <Text style={styles.certLabel}>CERTIFICATE OF COMPLETION</Text>
              <Text style={styles.certCourse}>{courseTitle}</Text>
              <Text style={styles.certPresented}>presented to</Text>
              <Text style={styles.certName}>{studentName}</Text>
              <Text style={styles.certEducator}>by {educatorName}, DC University</Text>
            </View>
          )}

          <View style={styles.resultsStatsRow}>
            <View style={styles.resultsStat}>
              <Text style={styles.resultsStatValue}>+{results.pointsEarned}</Text>
              <Text style={styles.resultsStatLabel}>DC Points</Text>
            </View>
            <View style={styles.resultsStat}>
              <Text style={styles.resultsStatValue}>{results.streak}🔥</Text>
              <Text style={styles.resultsStatLabel}>Day Streak</Text>
            </View>
            <View style={styles.resultsStat}>
              <Text style={styles.resultsStatValue}>{results.level}</Text>
              <Text style={styles.resultsStatLabel}>Level</Text>
            </View>
          </View>
          {results.leveledUp && <Text style={styles.levelUpText}>🎉 You leveled up to {results.level}!</Text>}
          {results.weeklyBonus && (
            <Text style={styles.weeklyBonusText}>Includes +{results.weeklyBonus.bonusPoints} {results.weeklyBonus.label} bonus</Text>
          )}

          {results.passed && (
            <Pressable style={styles.shareButton} onPress={shareCertificate} testID="dc-share-certificate">
              <Feather name="share-2" size={16} color="#050B18" />
              <Text style={styles.shareButtonText}>Share Certificate</Text>
            </Pressable>
          )}

          <Pressable style={styles.secondaryButton} onPress={() => router.replace("/dc-university")} testID="dc-results-done">
            <Text style={styles.secondaryButtonText}>Back to DC University</Text>
          </Pressable>
        </ScrollView>
      )}
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
  lectureAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "#FFD700" },
  educatorNameLarge: { color: "#FFD700", fontSize: 16, fontWeight: "800" },
  speakingIndicator: { color: "#6FCF97", fontSize: 12, marginTop: 3 },
  transcriptScroll: { flex: 1, paddingHorizontal: 16 },
  transcriptBubble: { borderRadius: 14, padding: 12, marginBottom: 10, maxWidth: "90%" },
  educatorBubble: { backgroundColor: "rgba(255,255,255,0.07)", alignSelf: "flex-start" },
  studentBubble: { backgroundColor: "rgba(255,215,0,0.15)", alignSelf: "flex-end" },
  transcriptText: { color: "#FFF", fontSize: 14, lineHeight: 20 },
  qaRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  qaInput: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: "#FFF", fontSize: 14 },
  qaSendButton: { backgroundColor: "#FFD700", borderRadius: 12, padding: 10, alignItems: "center", justifyContent: "center" },
  primaryButton: { backgroundColor: "#FFD700", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: "#050B18", fontWeight: "800", fontSize: 15 },
  secondaryButton: { marginTop: 14, paddingVertical: 12, paddingHorizontal: 20 },
  secondaryButtonText: { color: "#8899AA", fontSize: 13, fontWeight: "600" },
  quizIntro: { color: "#B9C4D4", fontSize: 13, marginBottom: 16, textAlign: "center" },
  quizCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, marginBottom: 14 },
  quizQuestion: { color: "#FFF", fontSize: 14, fontWeight: "700", marginBottom: 10 },
  quizChoice: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, borderWidth: 1, borderColor: "transparent" },
  quizChoiceSelected: { backgroundColor: "rgba(255,215,0,0.18)", borderColor: "#FFD700" },
  quizChoiceText: { color: "#B9C4D4", fontSize: 13 },
  quizChoiceTextSelected: { color: "#FFD700", fontWeight: "700" },
  resultsTitle: { color: "#FFF", fontSize: 19, fontWeight: "800", marginTop: 14 },
  resultsScore: { color: "#B9C4D4", fontSize: 14, marginTop: 4 },
  certificateCard: { marginTop: 22, borderWidth: 2, borderColor: "#FFD700", borderRadius: 16, padding: 22, alignItems: "center", backgroundColor: "rgba(255,215,0,0.06)", width: "100%" },
  certLabel: { color: "#FFD700", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  certCourse: { color: "#FFF", fontSize: 16, fontWeight: "800", marginTop: 10, textAlign: "center" },
  certPresented: { color: "#8899AA", fontSize: 11, marginTop: 12 },
  certName: { color: "#FFD700", fontSize: 20, fontWeight: "800", marginTop: 4 },
  certEducator: { color: "#B9C4D4", fontSize: 12, marginTop: 10 },
  resultsStatsRow: { flexDirection: "row", marginTop: 22, width: "100%", justifyContent: "space-around" },
  resultsStat: { alignItems: "center" },
  resultsStatValue: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  resultsStatLabel: { color: "#8899AA", fontSize: 11, marginTop: 2 },
  levelUpText: { color: "#FFD700", fontSize: 13, fontWeight: "700", marginTop: 14 },
  weeklyBonusText: { color: "#6FCF97", fontSize: 12, marginTop: 6 },
  shareButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFD700", borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12, marginTop: 22 },
  shareButtonText: { color: "#050B18", fontWeight: "800", fontSize: 14 },
  readingSection: { paddingHorizontal: 16, marginBottom: 10 },
  readingLabel: { color: "#8899AA", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8, textTransform: "uppercase" },
  affiliateRow: { gap: 10, paddingRight: 8 },
  affiliateBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,215,0,0.1)", borderWidth: 1, borderColor: "rgba(255,215,0,0.35)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  affiliateBtnTitle: { color: "#FFD700", fontSize: 12, fontWeight: "700" },
  affiliateBtnAuthor: { color: "#8899AA", fontSize: 10.5, marginTop: 1 },
  crestWatermark: { position: "absolute", width: 460, height: 825, opacity: 0.16, alignSelf: "center", top: 10, pointerEvents: "none" },
});
