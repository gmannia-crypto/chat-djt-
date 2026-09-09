import React from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useVoicePreference } from "@/lib/voice-preference";
import { useReactionOverlapEnabled } from "@/lib/reaction-overlap-settings";
import { useBonusGamePreference, BONUS_PREFERENCE_OPTIONS } from "@/lib/bonus-game-preference";

/**
 * Central home for cross-screen player preferences. Previously these lived
 * only as small icon buttons scattered across app/game.tsx, app/arena.tsx,
 * app/interview.tsx, and app/debate-stage.tsx. Those inline toggles keep
 * working (so a player mid-session doesn't lose quick access), but this
 * screen is now the one place a player can find and change every one of
 * them, and each shared preference module (lib/voice-preference.ts,
 * lib/reaction-overlap-settings.ts, lib/bonus-game-preference.ts) keeps
 * every screen in sync automatically.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { voicePreferenceEnabled, toggleVoicePreference } = useVoicePreference();
  const { reactionOverlapEnabled, toggleReactionOverlap } = useReactionOverlapEnabled();
  const { bonusGamePreference, setBonusGamePreference } = useBonusGamePreference();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#0a0a14", "#000"]} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={styles.backBtn}
          testID="settings-back-button"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>AUDIO</Text>
        <View style={styles.card}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleVoicePreference(); }}
            style={styles.row}
            testID="settings-voice-toggle"
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name={voicePreferenceEnabled ? "volume-high" : "volume-mute"} size={20} color={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Voice</Text>
              <Text style={styles.rowSubtitle}>Persona narration and interview/debate audio playback.</Text>
            </View>
            <View style={[styles.pill, voicePreferenceEnabled && styles.pillActive]}>
              <Text style={[styles.pillText, voicePreferenceEnabled && styles.pillTextActive]}>
                {voicePreferenceEnabled ? "ON" : "OFF"}
              </Text>
            </View>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleReactionOverlap(); }}
            style={styles.row}
            testID="settings-reaction-overlap-toggle"
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name={reactionOverlapEnabled ? "happy" : "happy-outline"} size={20} color={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Reaction Overlap</Text>
              <Text style={styles.rowSubtitle}>Overlapping laugh/scoff reaction clips during interviews, debates, and the arena.</Text>
            </View>
            <View style={[styles.pill, reactionOverlapEnabled && styles.pillActive]}>
              <Text style={[styles.pillText, reactionOverlapEnabled && styles.pillTextActive]}>
                {reactionOverlapEnabled ? "ON" : "OFF"}
              </Text>
            </View>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/voice-settings"); }}
            style={styles.row}
            testID="settings-voice-mixer-link"
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="options" size={20} color={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Persona Voice Mixer</Text>
              <Text style={styles.rowSubtitle}>Mute or set the volume for each persona individually.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>BILLIONAIRE GAME</Text>
        <View style={styles.card}>
          <Text style={styles.bonusIntro}>Which mini-game should the bonus round offer between deals?</Text>
          {BONUS_PREFERENCE_OPTIONS.map((opt, idx) => {
            const selected = bonusGamePreference === opt.value;
            return (
              <React.Fragment key={opt.value}>
                {idx > 0 && <View style={styles.divider} />}
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBonusGamePreference(opt.value); }}
                  style={styles.row}
                  testID={`settings-bonus-pref-${opt.value}`}
                >
                  <Text style={styles.bonusEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.rowTitle, { flex: 1 }]}>{opt.label}</Text>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={Colors.gold} />}
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>

        <Text style={styles.footerNote}>
          These preferences apply everywhere in the app and are remembered for next time.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,164,32,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.18)",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(212,164,32,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  rowSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.08)", marginLeft: 14 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  pillActive: { backgroundColor: "rgba(212,164,32,0.18)", borderColor: "rgba(212,164,32,0.4)" },
  pillText: { fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.5)" },
  pillTextActive: { color: Colors.gold },
  bonusIntro: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
  },
  bonusEmoji: { fontSize: 20 },
  footerNote: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 24,
  },
});
