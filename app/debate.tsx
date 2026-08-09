import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
  Share,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { fetch as expoFetch } from "expo/fetch";
import { CashAppDonate } from "@/components/CashAppDonate";

const DEBATE_TOPICS = [
  {
    topic: "The Economy",
    question: "What's the best way to fix the economy?",
    trumpStance: "Tariffs on EVERYTHING. Bring jobs back. Cut regulations. The economy was the BEST under me — everyone knows it. MAGA economics WORKS.",
    options: [
      { text: "Lower taxes and reduce spending", points: 8, rebuttal: "Not bad. But MY tax cuts were the biggest in history. You're basically copying me. Badly." },
      { text: "Invest in infrastructure and education", points: 6, rebuttal: "Spend more money? That's what Democrats do! I built things UNDER BUDGET and AHEAD OF SCHEDULE." },
      { text: "Tariffs are actually a terrible idea", points: 10, rebuttal: "WRONG! Tariffs brought in BILLIONS. China was PAYING US. You clearly don't understand business." },
      { text: "Cryptocurrency is the future of money", points: 7, rebuttal: "I launched $TRUMP coin — the most SUCCESSFUL crypto ever. But the dollar is still king. For now." },
    ],
  },
  {
    topic: "Energy Policy",
    question: "What should America's energy strategy be?",
    trumpStance: "DRILL BABY DRILL! We have more oil than Saudi Arabia. Wind turbines? They kill birds and cause cancer. Probably.",
    options: [
      { text: "Go all-in on renewable energy", points: 9, rebuttal: "The wind doesn't always blow! What happens then? You sit in the dark? Solar is okay, but OIL is POWER." },
      { text: "Balance fossil fuels with clean energy", points: 7, rebuttal: "Balance? That's a fancy word for doing NOTHING. You have to go BIG or go home. I go big." },
      { text: "Nuclear energy is the real answer", points: 10, rebuttal: "Nuclear... look, my uncle was a nuclear professor at MIT. Great genes. Nuclear is tremendous but people are scared." },
      { text: "Energy independence through any means", points: 6, rebuttal: "That's what I DID! We were energy independent under ME. Then Biden ruined it. In like five minutes." },
    ],
  },
  {
    topic: "Immigration",
    question: "How should we handle immigration?",
    trumpStance: "BUILD THE WALL! It's beautiful, it's big, and it WORKS. We need MERIT-BASED immigration. Only the best people.",
    options: [
      { text: "Open borders and welcome everyone", points: 10, rebuttal: "OPEN BORDERS?! That's the most INSANE thing I've ever heard! And I've heard Nancy Pelosi talk!" },
      { text: "Comprehensive immigration reform", points: 7, rebuttal: "Reform is code for amnesty. I've been to the border. I've SEEN it. You need a wall. Period." },
      { text: "Focus on legal pathways, not walls", points: 8, rebuttal: "Legal pathways are great — I AGREE! But without a wall, legal means NOTHING. It's just words." },
      { text: "Deport everyone, no exceptions", points: 5, rebuttal: "Look, I'm tough on the border, but even I have limits. We need the GOOD ones. The workers. The winners." },
    ],
  },
  {
    topic: "Social Media",
    question: "Should social media companies be regulated?",
    trumpStance: "They CENSORED the President of the United States! ME! The most followed person on Twitter! That's ELECTION INTERFERENCE!",
    options: [
      { text: "Free speech means no regulation", points: 7, rebuttal: "Free speech, sure, but they banned ME! The president! That's not free speech, that's a RIGGED system." },
      { text: "Break up Big Tech monopolies", points: 9, rebuttal: "Break them up? Maybe. But Truth Social is BETTER than all of them. The best platform. Everyone's saying it." },
      { text: "Let the market sort it out", points: 6, rebuttal: "The market gave us a president getting BANNED from the internet! The market needs a little TRUMP in it." },
      { text: "Strong content moderation is good", points: 10, rebuttal: "Content moderation? You mean CENSORSHIP! They moderate conservatives but let the radicals run wild! UNFAIR!" },
    ],
  },
  {
    topic: "Foreign Policy",
    question: "How should America deal with China?",
    trumpStance: "I was TOUGH on China. Nobody was tougher. The trade deal was MASSIVE. Xi respected me. He called me his FRIEND. Then COVID happened.",
    options: [
      { text: "Diplomacy and economic cooperation", points: 7, rebuttal: "Cooperation? With CHINA? They ripped us off for DECADES! You need STRENGTH, not handshakes." },
      { text: "Complete economic decoupling", points: 8, rebuttal: "Decoupling sounds tough, I like it. But we need their stuff too. It's about LEVERAGE. I wrote the book on it." },
      { text: "Military containment strategy", points: 6, rebuttal: "Military? Look, I rebuilt the military. The BEST military ever. But we don't want war. We want DEALS." },
      { text: "Focus on competing, not confronting", points: 9, rebuttal: "Competing? We're not just competing — we're WINNING! America First means we win EVERY negotiation!" },
    ],
  },
];

type GamePhase = "intro" | "playing" | "trump_response" | "results";

interface RoundResult {
  topic: string;
  userChoice: string;
  userPoints: number;
  trumpRebuttal: string;
  trumpPoints: number;
}

export default function DebateScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const [phase, setPhase] = useState<GamePhase>("intro");
  const [currentRound, setCurrentRound] = useState(0);
  const [userScore, setUserScore] = useState(0);
  const [trumpScore, setTrumpScore] = useState(0);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [showingRebuttal, setShowingRebuttal] = useState(false);
  const [currentRebuttal, setCurrentRebuttal] = useState("");
  const [currentTrumpPoints, setCurrentTrumpPoints] = useState(0);
  const [aiRebuttal, setAiRebuttal] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const totalRounds = Math.min(5, DEBATE_TOPICS.length);
  const shuffledTopics = useRef(
    [...DEBATE_TOPICS].sort(() => Math.random() - 0.5).slice(0, totalRounds)
  ).current;

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const startGame = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase("playing");
    setCurrentRound(0);
    setUserScore(0);
    setTrumpScore(0);
    setRoundResults([]);
  };

  const handleAnswer = async (optionIndex: number) => {
    const topic = shuffledTopics[currentRound];
    const option = topic.options[optionIndex];
    setSelectedOption(optionIndex);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const userPts = option.points;
    const trumpPts = Math.floor(Math.random() * 4) + 6;

    setUserScore((prev) => prev + userPts);
    setTrumpScore((prev) => prev + trumpPts);
    setCurrentTrumpPoints(trumpPts);
    setShowingRebuttal(true);
    setPhase("trump_response");

    setAiLoading(true);
    try {
      const baseUrl = getApiUrl();
      const res = await expoFetch(`${baseUrl}api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are Donald Trump in a live debate. Someone just said: "${option.text}" about ${topic.topic}. Give a QUICK, PUNCHY 1-2 sentence rebuttal. Be funny, outrageous, and in-character. NO mood tags. Raw quote only.`,
            },
            { role: "user", content: option.text },
          ],
        }),
      });

      if (res.ok) {
        const reader = res.body?.getReader();
        if (reader) {
          let fullText = "";
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullText += parsed.content;
                  setAiRebuttal(fullText);
                }
              } catch {}
            }
          }
          if (fullText.length > 10) {
            setCurrentRebuttal(fullText);
          } else {
            setCurrentRebuttal(option.rebuttal);
          }
        } else {
          setCurrentRebuttal(option.rebuttal);
        }
      } else {
        setCurrentRebuttal(option.rebuttal);
      }
    } catch {
      setCurrentRebuttal(option.rebuttal);
    } finally {
      setAiLoading(false);
      setAiRebuttal("");
    }

    setRoundResults((prev) => [
      ...prev,
      {
        topic: topic.topic,
        userChoice: option.text,
        userPoints: userPts,
        trumpRebuttal: option.rebuttal,
        trumpPoints: trumpPts,
      },
    ]);
  };

  const nextRound = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowingRebuttal(false);
    setCurrentRebuttal("");
    setSelectedOption(null);
    if (currentRound + 1 >= totalRounds) {
      setPhase("results");
      Haptics.notificationAsync(
        userScore > trumpScore
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
    } else {
      setCurrentRound((prev) => prev + 1);
      setPhase("playing");
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const won = userScore > trumpScore;
    const tied = userScore === trumpScore;
    try {
      await Share.share({
        message: `${won ? "\uD83C\uDFC6" : tied ? "\uD83E\uDD1D" : "\uD83D\uDE24"} I just ${won ? "BEAT" : tied ? "TIED" : "debated"} Trump!\n\nMe: ${userScore} pts vs Trump: ${trumpScore} pts\n\n${won ? "Even Trump couldn't handle my arguments!" : tied ? "It was a dead heat!" : "Trump talked his way out of it... this time."}\n\nThink you can beat him? Try it!\n\n- via The Arena (thearena.rip)`,
      });
    } catch {}
  };

  const handlePlayAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    shuffledTopics.splice(0, shuffledTopics.length, ...[...DEBATE_TOPICS].sort(() => Math.random() - 0.5).slice(0, totalRounds));
    setPhase("intro");
    setCurrentRound(0);
    setUserScore(0);
    setTrumpScore(0);
    setRoundResults([]);
    setShowingRebuttal(false);
    setCurrentRebuttal("");
    setSelectedOption(null);
  };

  const topic = shuffledTopics[currentRound];
  const won = userScore > trumpScore;
  const tied = userScore === trumpScore;

  return (
    <View style={[styles.container, Platform.OS === "web" && { maxHeight: "100vh" as any, overflow: "hidden" as any }]}>
      <LinearGradient colors={["#0a0a0a", "#1a0505", "#0a0a0a"]} style={StyleSheet.absoluteFillObject} />

      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name="flash" size={18} color="#FF4D4D" />
          <Text style={styles.headerTitle}>DEBATE TRUMP</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {phase === "intro" && (
          <Animated.View entering={FadeIn.duration(500)} style={styles.introContainer}>
            <Text style={styles.introEmoji}>{"\u26A1"}</Text>
            <Text style={styles.introTitle}>BEAT TRUMP{"\n"}IN A DEBATE</Text>
            <Text style={styles.introSubtitle}>5 rounds. 5 hot topics. Can you out-argue the Don?</Text>

            <View style={styles.rulesCard}>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleNum}>1</Text>
                <Text style={styles.ruleText}>Pick your stance on each topic</Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleNum}>2</Text>
                <Text style={styles.ruleText}>Trump fires back with AI-powered rebuttals</Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleNum}>3</Text>
                <Text style={styles.ruleText}>Best arguments win more points</Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleNum}>4</Text>
                <Text style={styles.ruleText}>Outscore Trump to claim victory</Text>
              </View>
            </View>

            <Animated.View style={pulseStyle}>
              <Pressable
                onPress={startGame}
                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={["#FF4D4D", "#CC0000", "#FF4D4D"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.startButton}
                >
                  <Ionicons name="flash" size={20} color="#fff" />
                  <Text style={styles.startButtonText}>START DEBATE</Text>
                  <Ionicons name="flash" size={20} color="#fff" />
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </Animated.View>
        )}

        {(phase === "playing" || phase === "trump_response") && topic && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={styles.scoreBar}>
              <View style={styles.scoreLeft}>
                <Text style={styles.scoreLabel}>YOU</Text>
                <Text style={styles.scoreValue}>{userScore}</Text>
              </View>
              <View style={styles.roundBadge}>
                <Text style={styles.roundText}>ROUND {currentRound + 1}/{totalRounds}</Text>
              </View>
              <View style={styles.scoreRight}>
                <Text style={styles.scoreLabel}>TRUMP</Text>
                <Text style={[styles.scoreValue, { color: "#FF4D4D" }]}>{trumpScore}</Text>
              </View>
            </View>

            <View style={styles.topicCard}>
              <Text style={styles.topicLabel}>{topic.topic.toUpperCase()}</Text>
              <Text style={styles.topicQuestion}>{topic.question}</Text>
            </View>

            <View style={styles.trumpStanceCard}>
              <View style={styles.trumpStanceHeader}>
                <Text style={styles.trumpStanceAvatar}>{"\uD83D\uDC54"}</Text>
                <Text style={styles.trumpStanceName}>Trump's Position</Text>
              </View>
              <Text style={styles.trumpStanceText}>"{topic.trumpStance}"</Text>
            </View>

            {!showingRebuttal && (
              <Animated.View entering={FadeInUp.delay(200).duration(400)}>
                <Text style={styles.yourTurnLabel}>YOUR RESPONSE:</Text>
                {topic.options.map((opt, i) => (
                  <Animated.View key={i} entering={FadeInDown.delay(300 + i * 100).duration(300)}>
                    <Pressable
                      onPress={() => handleAnswer(i)}
                      style={({ pressed }) => [styles.optionButton, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
                    >
                      <Text style={styles.optionText}>{opt.text}</Text>
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
                    </Pressable>
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            {showingRebuttal && (
              <Animated.View entering={FadeInDown.duration(400)}>
                {selectedOption !== null && (
                  <View style={styles.yourChoiceCard}>
                    <Text style={styles.yourChoiceLabel}>YOUR ARGUMENT:</Text>
                    <Text style={styles.yourChoiceText}>"{topic.options[selectedOption].text}"</Text>
                    <Text style={styles.pointsBadge}>+{topic.options[selectedOption].points} pts</Text>
                  </View>
                )}

                <View style={styles.rebuttalCard}>
                  <View style={styles.rebuttalHeader}>
                    <Text style={styles.rebuttalAvatar}>{"\uD83D\uDC54"}</Text>
                    <Text style={styles.rebuttalName}>Trump Fires Back!</Text>
                    <Text style={[styles.pointsBadge, { color: "#FF4D4D", backgroundColor: "rgba(255,77,77,0.15)" }]}>+{currentTrumpPoints} pts</Text>
                  </View>
                  {aiLoading ? (
                    <View style={styles.rebuttalLoading}>
                      <ActivityIndicator size="small" color="#FF4D4D" />
                      <Text style={styles.rebuttalLoadingText}>
                        {aiRebuttal ? `"${aiRebuttal}"` : "Trump is thinking of a comeback..."}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.rebuttalText}>"{currentRebuttal}"</Text>
                  )}
                </View>

                {!aiLoading && (
                  <Animated.View entering={FadeIn.delay(300).duration(300)}>
                    <Pressable
                      onPress={nextRound}
                      style={({ pressed }) => [pressed && { opacity: 0.8 }]}
                    >
                      <LinearGradient
                        colors={["#FFD700", "#b8860b"]}
                        style={styles.nextButton}
                      >
                        <Text style={styles.nextButtonText}>
                          {currentRound + 1 >= totalRounds ? "SEE RESULTS" : "NEXT ROUND"}
                        </Text>
                        <Ionicons name="arrow-forward" size={16} color="#0a0a0a" />
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                )}
              </Animated.View>
            )}
          </Animated.View>
        )}

        {phase === "results" && (
          <Animated.View entering={FadeIn.duration(500)} style={styles.resultsContainer}>
            <Text style={styles.resultsEmoji}>{won ? "\uD83C\uDFC6" : tied ? "\uD83E\uDD1D" : "\uD83D\uDE24"}</Text>
            <Text style={styles.resultsTitle}>
              {won ? "YOU WON!" : tied ? "IT'S A TIE!" : "TRUMP WINS!"}
            </Text>
            <Text style={styles.resultsSubtitle}>
              {won ? "You actually out-debated the Don!" : tied ? "A rare dead heat!" : "Trump talked his way to victory... again."}
            </Text>

            <View style={styles.finalScoreCard}>
              <View style={styles.finalScoreCol}>
                <Text style={styles.finalScoreLabel}>YOU</Text>
                <Text style={[styles.finalScoreNum, won && { color: "#4ADE80" }]}>{userScore}</Text>
              </View>
              <View style={styles.finalScoreVs}>
                <Text style={styles.finalScoreVsText}>VS</Text>
              </View>
              <View style={styles.finalScoreCol}>
                <Text style={styles.finalScoreLabel}>TRUMP</Text>
                <Text style={[styles.finalScoreNum, !won && !tied && { color: "#FF4D4D" }]}>{trumpScore}</Text>
              </View>
            </View>

            <View style={styles.roundSummary}>
              <Text style={styles.roundSummaryTitle}>ROUND BREAKDOWN</Text>
              {roundResults.map((r, i) => (
                <View key={i} style={styles.roundSummaryRow}>
                  <Text style={styles.roundSummaryTopic}>{r.topic}</Text>
                  <View style={styles.roundSummaryScores}>
                    <Text style={[styles.roundSummaryPts, r.userPoints > r.trumpPoints && { color: "#4ADE80" }]}>{r.userPoints}</Text>
                    <Text style={styles.roundSummaryDash}>-</Text>
                    <Text style={[styles.roundSummaryPts, r.trumpPoints > r.userPoints && { color: "#FF4D4D" }]}>{r.trumpPoints}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.resultsActions}>
              <Pressable onPress={handleShare} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
                <LinearGradient colors={["#3B82F6", "#1D4ED8"]} style={styles.shareButton}>
                  <Ionicons name="share-social" size={16} color="#fff" />
                  <Text style={styles.shareButtonText}>SHARE RESULT</Text>
                </LinearGradient>
              </Pressable>

              <Pressable onPress={handlePlayAgain} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
                <LinearGradient colors={["#FF4D4D", "#CC0000"]} style={styles.shareButton}>
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.shareButtonText}>REMATCH</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>
        )}

        <CashAppDonate />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FF4D4D",
    letterSpacing: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  introContainer: {
    alignItems: "center",
    paddingTop: 20,
  },
  introEmoji: {
    fontSize: 56,
    marginBottom: 10,
  },
  introTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FF4D4D",
    textAlign: "center",
    letterSpacing: 3,
    lineHeight: 38,
    marginBottom: 10,
  },
  introSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 24,
  },
  rulesCard: {
    backgroundColor: "rgba(255,77,77,0.08)",
    borderRadius: 16,
    padding: 18,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.2)",
    marginBottom: 28,
    gap: 12,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ruleNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,77,77,0.2)",
    textAlign: "center",
    lineHeight: 26,
    fontSize: 13,
    fontWeight: "800",
    color: "#FF4D4D",
    overflow: "hidden",
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 20,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 16,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 2,
  },
  scoreBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  scoreLeft: {
    alignItems: "center",
    flex: 1,
  },
  scoreRight: {
    alignItems: "center",
    flex: 1,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#4ADE80",
  },
  roundBadge: {
    backgroundColor: "rgba(255,215,0,0.15)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roundText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 1,
  },
  topicCard: {
    backgroundColor: "rgba(255,215,0,0.08)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
    marginBottom: 12,
  },
  topicLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 2,
    marginBottom: 6,
  },
  topicQuestion: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.white,
    lineHeight: 24,
  },
  trumpStanceCard: {
    backgroundColor: "rgba(255,77,77,0.08)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.2)",
    borderLeftWidth: 3,
    borderLeftColor: "#FF4D4D",
    marginBottom: 16,
  },
  trumpStanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  trumpStanceAvatar: {
    fontSize: 20,
  },
  trumpStanceName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FF4D4D",
    letterSpacing: 1,
  },
  trumpStanceText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 21,
    fontStyle: "italic",
  },
  yourTurnLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4ADE80",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  optionButton: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.white,
    lineHeight: 20,
    marginRight: 8,
  },
  yourChoiceCard: {
    backgroundColor: "rgba(74,222,128,0.08)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.2)",
    borderLeftWidth: 3,
    borderLeftColor: "#4ADE80",
    marginBottom: 12,
  },
  yourChoiceLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4ADE80",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  yourChoiceText: {
    fontSize: 14,
    color: Colors.white,
    fontStyle: "italic",
    lineHeight: 20,
  },
  pointsBadge: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4ADE80",
    backgroundColor: "rgba(74,222,128,0.15)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
    overflow: "hidden",
  },
  rebuttalCard: {
    backgroundColor: "rgba(255,77,77,0.08)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.2)",
    borderLeftWidth: 3,
    borderLeftColor: "#FF4D4D",
    marginBottom: 16,
  },
  rebuttalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  rebuttalAvatar: {
    fontSize: 20,
  },
  rebuttalName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    color: "#FF4D4D",
    letterSpacing: 1,
  },
  rebuttalLoading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  rebuttalLoadingText: {
    flex: 1,
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontStyle: "italic",
    lineHeight: 21,
  },
  rebuttalText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 21,
    fontStyle: "italic",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0a0a0a",
    letterSpacing: 1.5,
  },
  resultsContainer: {
    alignItems: "center",
    paddingTop: 20,
  },
  resultsEmoji: {
    fontSize: 56,
    marginBottom: 10,
  },
  resultsTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFD700",
    letterSpacing: 3,
    marginBottom: 8,
  },
  resultsSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  finalScoreCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 340,
    marginBottom: 24,
  },
  finalScoreCol: {
    flex: 1,
    alignItems: "center",
  },
  finalScoreLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  finalScoreNum: {
    fontSize: 40,
    fontWeight: "900",
    color: Colors.white,
  },
  finalScoreVs: {
    paddingHorizontal: 16,
  },
  finalScoreVsText: {
    fontSize: 14,
    fontWeight: "900",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 2,
  },
  roundSummary: {
    width: "100%",
    maxWidth: 340,
    marginBottom: 24,
  },
  roundSummaryTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 1.5,
    marginBottom: 10,
    textAlign: "center",
  },
  roundSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  roundSummaryTopic: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.white,
  },
  roundSummaryScores: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roundSummaryPts: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.white,
  },
  roundSummaryDash: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
  },
  resultsActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    maxWidth: 340,
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    paddingHorizontal: 20,
  },
  shareButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 1,
  },
});
