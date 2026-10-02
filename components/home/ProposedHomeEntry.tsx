import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const DEMO_LINES = [
  { name: "DONALD TRUMP", side: "left" as const, text: "The question is simple: who does this actually help?" },
  { name: "JOE BIDEN", side: "right" as const, text: "Start with the people doing the work. That's where the answer is." },
  { name: "DONALD TRUMP", side: "left" as const, text: "Then let's hear the case—and let everyone decide." },
];

type ProposedHomeEntryProps = {
  onSetup: () => void;
  onInterview: () => void;
  onTherapy: () => void;
  onFortune: () => void;
  onSports: () => void;
};

export function ProposedHomeEntry({ onSetup, onInterview, onTherapy, onFortune, onSports }: ProposedHomeEntryProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < 500;
  const currentLine = DEMO_LINES[lineIndex];

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setLineIndex((current) => (current + 1) % DEMO_LINES.length);
    }, 4200);
    return () => clearInterval(interval);
  }, [playing]);

  const advanceLine = () => {
    setLineIndex((current) => (current + 1) % DEMO_LINES.length);
    setPlaying(true);
  };

  return (
    <View style={styles.shell}>
      <View style={styles.intro}>
        <View style={styles.kicker}>
          <View style={styles.kickerDot} />
          <Text style={styles.kickerText}>THE ARENA</Text>
          <View style={styles.kickerRule} />
          <Text style={styles.kickerText}>YOUR FIRST DEBATE STARTS HERE</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>
          Hear the clash.{"\n"}<Text style={styles.titleEmphasis}>Take the mic.</Text>
        </Text>
        <Text style={styles.introCopy}>AI voices take opposite sides on the news. Listen in, jump into the room, and make your case.</Text>
      </View>

      <View style={styles.demoCard} testID="home-text-demo" accessibilityLabel="Interactive text demo: two voices, one question">
        <View style={[styles.demoHeader, compact && styles.demoHeaderCompact]}>
          <View>
            <Text style={styles.overline}>A QUICK PREVIEW</Text>
            <Text accessibilityRole="header" style={styles.demoTitle}>Two voices. One question.</Text>
          </View>
          <View style={styles.demoBadge}>
            <Ionicons name="headset-outline" size={14} color="#d2c6b6" />
            <Text style={styles.demoBadgeText}>TEXT DEMO</Text>
          </View>
        </View>

        <View style={[styles.stage, compact && styles.stageCompact]}>
          <LinearGradient
            colors={["rgba(215,87,58,0.20)", "rgba(39,32,29,0.22)", "rgba(84,103,126,0.18)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={styles.question}>
            <Text style={styles.questionLabel}>THE QUESTION</Text>
            <Text style={styles.questionText}>Who gets heard when prices rise?</Text>
          </View>
          <View style={styles.speakerRow}>
            <View style={[styles.speaker, styles.speakerLeft]}>
              <Image accessibilityLabel="Donald Trump" source={require("@/assets/images/persona-trump.png")} style={[styles.portrait, compact && styles.portraitCompact, currentLine.side === "left" && playing && styles.portraitActive]} />
              {!compact && <Text style={styles.speakerName}>DONALD TRUMP</Text>}
            </View>
            <Text style={styles.versus}>VS</Text>
            <View style={[styles.speaker, styles.speakerRight]}>
              {!compact && <Text style={styles.speakerName}>JOE BIDEN</Text>}
              <Image accessibilityLabel="Joe Biden" source={require("@/assets/images/persona-biden.png")} style={[styles.portrait, compact && styles.portraitCompact, currentLine.side === "right" && playing && styles.portraitActive]} />
            </View>
          </View>
          {compact && (
            <View style={styles.compactSpeakerNames}>
              <Text style={styles.speakerName}>DONALD TRUMP</Text>
              <Text style={styles.speakerName}>JOE BIDEN</Text>
            </View>
          )}
          <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: compact ? 25 : 39 }, (_, index) => (
              <View key={index} style={[styles.waveBar, { height: 6 + ((index * 17 + 11) % 22) }]} />
            ))}
          </View>
          <View style={styles.transcript} accessibilityLiveRegion="polite">
            <View style={[styles.turnDot, currentLine.side === "right" && styles.turnDotRight]} />
            <Text style={styles.transcriptText}>
              <Text style={styles.transcriptName}>{currentLine.name} </Text>
              {currentLine.text}
            </Text>
          </View>
        </View>

        <View style={[styles.player, compact && styles.playerCompact]}>
          <Pressable
            onPress={() => setPlaying((value) => !value)}
            style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause text demo" : "Play text demo"}
            accessibilityState={{ selected: playing }}
            testID="home-demo-play"
          >
            <Ionicons name={playing ? "pause" : "play"} size={17} color="#fff4e9" />
          </Pressable>
          <View
            style={styles.progressWrap}
            accessibilityRole="progressbar"
            accessibilityLabel="Text demo progress"
            accessibilityValue={{ min: 1, max: DEMO_LINES.length, now: lineIndex + 1, text: `Line ${lineIndex + 1} of ${DEMO_LINES.length}` }}
          >
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>{playing ? "READING THE EXCHANGE" : "TAP TO READ THE EXCHANGE"}</Text>
              <Text style={styles.progressLabel}>{lineIndex + 1} / {DEMO_LINES.length}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${((lineIndex + 1) / DEMO_LINES.length) * 100}%` }]} />
            </View>
          </View>
          <Pressable
            onPress={advanceLine}
            style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Next line in text demo"
            testID="home-demo-next"
          >
            <Text style={[styles.nextText, compact && styles.nextTextCompact]}>NEXT LINE</Text>
            <Ionicons name="chevron-forward" size={16} color="#e8bf66" />
          </Pressable>
        </View>
        <Text style={[styles.sampleNote, compact && styles.sampleNoteCompact]}>Scripted text sample. No audio plays here.</Text>
      </View>

      <View style={[styles.nextSection, compact && styles.nextSectionCompact]}>
        <View style={styles.nextCopy}>
          <Text style={styles.overline}>YOUR TURN, WHEN YOU'RE READY</Text>
          <Text style={styles.nextTitle}>Pick a topic.{"\n"}<Text style={styles.nextTitleMuted}>We’ll get the room ready.</Text></Text>
        </View>
        <Pressable
          onPress={onSetup}
          style={({ pressed }) => [styles.setupButton, compact && styles.setupButtonCompact, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Set up your debate"
          testID="arena-featured-button"
        >
          <Text style={styles.setupButtonText}>SET UP YOUR DEBATE</Text>
          <Ionicons name="arrow-forward" size={17} color="#fff4eb" />
        </Pressable>
        <View style={[styles.steps, compact && styles.stepsCompact]}>
          <Text style={styles.stepText}><Text style={styles.stepNumber}>01</Text> Choose a question</Text>
          <View style={styles.stepRule} />
          <Text style={styles.stepText}><Text style={styles.stepNumber}>02</Text> Pick your side</Text>
          <View style={styles.stepRule} />
          <Text style={styles.stepText}><Text style={styles.stepNumber}>03</Text> Speak by mic</Text>
        </View>
      </View>

      <View style={styles.modes}>
        <View style={styles.modeHeading}>
          <Text style={styles.modeHeadingTitle}>MORE WAYS IN</Text>
          <Text style={styles.modeHeadingAside}>Explore the Arena</Text>
        </View>
        <ScrollView horizontal={!compact} scrollEnabled={!compact} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.modeRow, compact && styles.modeColumn]}>
          <ModeShortcut icon={<Ionicons name="mic-outline" size={17} color="#e8bf66" />} title="1-on-1 Interviews" subtitle="Go deeper with a persona" onPress={onInterview} testID="home-interview-shortcut" />
          <ModeShortcut icon={<MaterialCommunityIcons name="brain" size={18} color="#e8bf66" />} title="Trump Therapy" subtitle="A different kind of session" onPress={onTherapy} testID="viral-therapy-btn" />
          <ModeShortcut icon={<MaterialCommunityIcons name="crystal-ball" size={18} color="#e8bf66" />} title="Fortune Parlor" subtitle="Step into the unknown" onPress={onFortune} testID="viral-fortune-btn" />
        </ScrollView>
        <Pressable
          onPress={onSports}
          style={({ pressed }) => [styles.sportsShortcut, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Open Sports Book"
          testID="sports-button"
        >
          <View style={styles.sportsMark}><MaterialCommunityIcons name="trophy-outline" size={17} color="#b0c497" /></View>
          <View style={styles.sportsCopy}>
            <Text style={styles.sportsTitle}>SPORTS BOOK</Text>
            <Text style={styles.sportsSubtitle}>Another room, another conversation</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color="#b0c497" />
        </Pressable>
      </View>
    </View>
  );
}

function ModeShortcut({ icon, title, subtitle, onPress, testID }: { icon: React.ReactNode; title: string; subtitle: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      testID={testID}
    >
      <View style={styles.modeIcon}>{icon}</View>
      <View style={styles.modeCopy}>
        <Text style={styles.modeTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.modeSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#948777" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { width: "100%", maxWidth: 868, alignSelf: "center", paddingHorizontal: 20 },
  intro: { alignItems: "center", paddingTop: 34, paddingBottom: 22 },
  kicker: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, flexWrap: "wrap" },
  kickerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#e65b48" },
  kickerText: { color: "#e8bf66", fontSize: 9, fontWeight: "800", letterSpacing: 1.6 },
  kickerRule: { width: 22, height: 1, backgroundColor: "rgba(232,191,102,0.4)" },
  title: { marginTop: 15, marginBottom: 9, color: "#f5eee3", textAlign: "center", fontFamily: "PlayfairDisplay_700Bold", fontSize: 56, lineHeight: 59, letterSpacing: -1.8 },
  titleCompact: { fontSize: 43, lineHeight: 47, letterSpacing: -1.4 },
  titleEmphasis: { color: "#e9bd69", fontStyle: "italic" },
  introCopy: { maxWidth: 435, color: "#b9afa2", textAlign: "center", fontSize: 14, lineHeight: 21 },
  demoCard: { overflow: "hidden", borderWidth: 1, borderColor: "rgba(231,218,194,0.16)", borderRadius: 13, backgroundColor: "#201e1b", ...({ boxShadow: "0 18px 52px rgba(0,0,0,0.24)" } as object) },
  demoHeader: { minHeight: 65, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 13 },
  demoHeaderCompact: { paddingHorizontal: 14, flexDirection: "column", alignItems: "flex-start", gap: 9 },
  overline: { color: "#e8bf66", fontSize: 9, fontWeight: "800", letterSpacing: 1.7 },
  demoTitle: { marginTop: 5, color: "#f5eee3", fontFamily: "PlayfairDisplay_700Bold", fontSize: 20 },
  demoBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  demoBadgeText: { color: "#cfc3b2", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  stage: { minHeight: 221, paddingHorizontal: 24, paddingTop: 15, backgroundColor: "#29211e" },
  stageCompact: { minHeight: 219, paddingHorizontal: 13, paddingTop: 13 },
  question: { zIndex: 1, flexDirection: "row", alignItems: "baseline", gap: 9, minHeight: 34, flexWrap: "wrap" },
  questionLabel: { color: "#d9a778", fontSize: 8, fontWeight: "800", letterSpacing: 1.4 },
  questionText: { color: "#f1e6d8", fontFamily: "PlayfairDisplay_700Bold", fontSize: 14 },
  speakerRow: { zIndex: 1, height: 93, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  speaker: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  speakerLeft: { justifyContent: "flex-start" },
  speakerRight: { justifyContent: "flex-end" },
  portrait: { width: 63, height: 72, borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,236,211,0.45)", backgroundColor: "#332c26" },
  portraitCompact: { width: 58, height: 68 },
  portraitActive: { borderColor: "#e8bf66", borderWidth: 2 },
  speakerName: { color: "#f3e4cf", fontSize: 8, fontWeight: "800", letterSpacing: 0.7 },
  versus: { width: 36, color: "#e5c782", textAlign: "center", fontFamily: "PlayfairDisplay_700Bold", fontStyle: "italic", fontSize: 15 },
  compactSpeakerNames: { zIndex: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 1, marginTop: -3 },
  wave: { height: 25, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, opacity: 0.7 },
  waveBar: { width: 2, borderRadius: 2, backgroundColor: "#e9bc6b" },
  transcript: { minHeight: 47, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.15)" },
  turnDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#e65b48" },
  turnDotRight: { backgroundColor: "#90a5bd" },
  transcriptText: { flex: 1, color: "#e8dfd3", fontFamily: "PlayfairDisplay_700Bold", fontSize: 13, lineHeight: 19 },
  transcriptName: { color: "#e9bd69", fontWeight: "800", fontSize: 9, letterSpacing: 0.5 },
  player: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 9 },
  playerCompact: { gap: 8, paddingHorizontal: 12 },
  playButton: { width: 33, height: 33, flexShrink: 0, alignItems: "center", justifyContent: "center", paddingLeft: 2, borderRadius: 17, backgroundColor: "#e65b48" },
  progressWrap: { flex: 1, minWidth: 0 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", gap: 6, marginBottom: 6 },
  progressLabel: { color: "#a99f93", fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  progressTrack: { height: 3, overflow: "hidden", borderRadius: 2, backgroundColor: "#49443e" },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: "#e65b48" },
  nextButton: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, paddingLeft: 5 },
  nextText: { color: "#e8bf66", fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  nextTextCompact: { display: "none" },
  pressed: { opacity: 0.76 },
  sampleNote: { margin: 0, paddingHorizontal: 20, paddingBottom: 12, color: "#a59b8d", fontSize: 10 },
  sampleNoteCompact: { paddingHorizontal: 12, fontSize: 9 },
  nextSection: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 14, paddingHorizontal: 2, paddingVertical: 23, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(240,226,204,0.16)" },
  nextSectionCompact: { flexDirection: "column", alignItems: "stretch", paddingVertical: 20 },
  nextCopy: { flex: 1, minWidth: 210 },
  nextTitle: { marginTop: 6, color: "#f5eee3", fontFamily: "PlayfairDisplay_700Bold", fontSize: 24, lineHeight: 26 },
  nextTitleMuted: { color: "#bcb2a5" },
  setupButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 13, paddingHorizontal: 18, borderRadius: 4, backgroundColor: "#e65b48" },
  setupButtonCompact: { width: "100%" },
  setupButtonText: { color: "#fff4eb", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  steps: { width: "100%", flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 1 },
  stepsCompact: { justifyContent: "space-between", gap: 4 },
  stepText: { color: "#aa9f91", fontSize: 10 },
  stepNumber: { color: "#e1b967", fontWeight: "800", fontSize: 9 },
  stepRule: { width: 19, height: 1, backgroundColor: "rgba(232,191,102,0.3)" },
  modes: { paddingTop: 19, paddingBottom: 12 },
  modeHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modeHeadingTitle: { color: "#dbbf83", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  modeHeadingAside: { color: "#a69c8e", fontSize: 9 },
  modeRow: { flexDirection: "row", gap: 9, paddingTop: 10 },
  modeColumn: { flexDirection: "column", gap: 6 },
  modeCard: { minHeight: 59, flex: 1, minWidth: 210, flexDirection: "row", alignItems: "center", gap: 9, padding: 9, borderWidth: 1, borderColor: "rgba(240,226,204,0.14)", borderRadius: 5, backgroundColor: "#1d1c19" },
  modeCardPressed: { borderColor: "rgba(232,191,102,0.6)", backgroundColor: "#25221d" },
  modeIcon: { width: 30, height: 30, flexShrink: 0, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(232,191,102,0.24)", borderRadius: 16 },
  modeCopy: { flex: 1, minWidth: 0 },
  modeTitle: { color: "#f5eee3", fontSize: 10, fontWeight: "700" },
  modeSubtitle: { marginTop: 4, color: "#9c9387", fontSize: 9 },
  sportsShortcut: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(127,151,111,0.26)", borderRadius: 5, backgroundColor: "rgba(87,112,76,0.12)" },
  sportsMark: { width: 29, height: 29, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(176,196,151,0.3)", borderRadius: 15 },
  sportsCopy: { flex: 1 },
  sportsTitle: { color: "#d9e0ce", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  sportsSubtitle: { marginTop: 3, color: "#a4a99a", fontSize: 9 },
});