import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { HomePersonaPreview } from "@/components/home/HomePersonaPreview";

type ProposedHomeEntryProps = {
  onSetup: () => void;
  onInterview: () => void;
  onTherapy: () => void;
  onFortune: () => void;
  onSports: () => void;
};

export function ProposedHomeEntry({ onSetup, onInterview, onTherapy, onFortune, onSports }: ProposedHomeEntryProps) {
  const { width } = useWindowDimensions();
  const compact = width < 500;

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

      <HomePersonaPreview />

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
  overline: { color: "#e8bf66", fontSize: 9, fontWeight: "800", letterSpacing: 1.7 },
  pressed: { opacity: 0.76 },
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