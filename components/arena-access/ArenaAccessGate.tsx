import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArenaSetupBackdrop } from "@/components/arena-setup/ArenaSetupBackdrop";
import { getArenaSetupPalette, type ArenaSetupDesign } from "@/lib/arena-setup-design";
import { TOKEN_PACKS, type TokenPackId } from "@/lib/token-packs";

type SessionDuration = 5 | 10 | 15;
type PlanTier = "standard" | "vip";

type ArenaAccessGateProps = {
  visible: boolean;
  design: ArenaSetupDesign;
  selectedDuration: SessionDuration;
  availableTokens: number | null;
  isUnlocking: boolean;
  audioPaused?: boolean;
  audioPausedPulseStyle?: any;
  onSelectDuration: (duration: SessionDuration) => void;
  onUnlock: () => void;
  onClose: () => void;
  onGetTokens: (packId?: TokenPackId) => void;
  onExplorePlan: (plan: PlanTier) => void;
};

const DURATIONS: SessionDuration[] = [5, 10, 15];

export function ArenaAccessGate({
  visible,
  design,
  selectedDuration,
  availableTokens,
  isUnlocking,
  audioPaused = false,
  audioPausedPulseStyle,
  onSelectDuration,
  onUnlock,
  onClose,
  onGetTokens,
  onExplorePlan,
}: ArenaAccessGateProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [plansExpanded, setPlansExpanded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const palette = getArenaSetupPalette(design);
  const compact = windowWidth < 380;

  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  if (!visible) return null;

  const colors = {
    ink: design === "lavender" ? "#202954" : "#f5eee3",
    muted: design === "lavender" ? "#4b5276" : "#c2b7a6",
    surface: design === "lavender" ? "#e9defb" : "#201d19",
    darkSurface: design === "lavender" ? "#ddd0f5" : "#171614",
    accent: palette.accent,
    red: palette.red,
    border: design === "lavender" ? "rgba(61,42,113,0.25)" : "rgba(237,212,172,0.2)",
    dim: design === "lavender" ? "rgba(32,41,84,0.66)" : "#a9a396",
  };
  const maxHeight = Math.max(260, windowHeight - insets.top - insets.bottom - 28);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ArenaSetupBackdrop design={design} />
        <View style={styles.scrim} />
        <View style={[styles.safeFrame, { paddingTop: Math.max(insets.top, 10), paddingBottom: Math.max(insets.bottom, 10) }]}>
          <ScrollView
            style={[styles.dialogScroll, { maxHeight, width: Math.min(windowWidth - 28, 540) }]}
            contentContainerStyle={styles.dialogScrollContent}
            showsVerticalScrollIndicator
            bounces={false}
            keyboardShouldPersistTaps="handled"
            accessibilityViewIsModal
            testID="arena-access-gate"
          >
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <LinearGradient
                colors={design === "lavender"
                  ? ["rgba(255,255,255,0.78)", "rgba(255,255,255,0.1)"]
                  : ["rgba(255,244,224,0.07)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <View style={styles.header}>
                <View style={styles.brandLockup}>
                  <View style={[styles.brandMark, { borderColor: colors.accent }]}>
                    <View style={[styles.brandMarkCore, { borderColor: colors.accent }]} />
                  </View>
                  <Text style={[styles.brandText, { color: colors.ink }]}>THE <Text style={{ color: colors.accent }}>ARENA</Text></Text>
                </View>
                <View style={styles.headerActions}>
                  <View style={[styles.gateBadge, { borderColor: colors.border }]}>
                    <View style={[styles.liveDot, { backgroundColor: colors.red }]} />
                    <Text style={[styles.gateBadgeText, { color: colors.muted }]}>SESSION GATE</Text>
                  </View>
                  <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close Arena access"
                    style={[styles.closeButton, { borderColor: colors.border }]}
                    testID="arena-access-close"
                  >
                    <Ionicons name="close" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              </View>

              {audioPaused && (
                <View style={[styles.audioNotice, { borderColor: colors.border }]} testID="arena-access-audio-paused">
                  <Animated.View style={audioPausedPulseStyle}>
                    <Ionicons name="volume-high" size={16} color={colors.accent} />
                  </Animated.View>
                  <Text style={[styles.audioNoticeText, { color: colors.accent }]}>Audio paused — resume when ready</Text>
                </View>
              )}

              <View style={styles.intro}>
                <View style={styles.kicker}>
                  <Text style={[styles.kickerNumber, { color: colors.red }]}>01</Text>
                  <View style={[styles.kickerRule, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.eyebrow, { color: colors.accent }]}>SESSION ACCESS</Text>
                </View>
                <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }, compact && styles.titleCompact]}>
                  Ready for the{"\n"}<Text style={{ color: colors.accent, fontStyle: "italic" }}>real verdict?</Text>
                </Text>
                <Text style={[styles.lede, { color: colors.muted }]}>
                  Choose a paid session to continue the debate. Paid sessions are eligible for an official verdict.
                </Text>
              </View>

              <View style={[styles.previewNote, { backgroundColor: colors.darkSurface, borderColor: colors.border, borderLeftColor: colors.red }]}>
                <View style={[styles.previewSymbol, { borderColor: colors.border }]}>
                  <Ionicons name="information-circle-outline" size={17} color={colors.muted} />
                </View>
                <View style={styles.previewCopy}>
                  <Text style={[styles.previewLabel, { color: colors.muted }]}>PREVIEW SESSION INFO</Text>
                  <Text style={[styles.previewText, { color: colors.ink }]}>
                    If granted, a trial lasts 2 minutes and does not include an official verdict.
                  </Text>
                </View>
                <Text style={[styles.previewTag, { color: colors.red, borderColor: colors.border }]}>INFO</Text>
              </View>

              <View style={[styles.section, { backgroundColor: colors.darkSurface, borderColor: colors.border }]}>
                <View style={styles.sectionHeading}>
                  <View>
                    <Text style={[styles.eyebrow, { color: colors.accent }]}>NEXT ROUND</Text>
                    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.ink }]}>Ranked session</Text>
                  </View>
                  <View style={[styles.verdictStamp, { borderColor: colors.red }]}>
                    <Text style={[styles.verdictStampText, { color: colors.red }]}>OFFICIAL{"\n"}VERDICT ELIGIBLE</Text>
                  </View>
                </View>
                <Text style={[styles.sectionCopy, { color: colors.muted }]}>
                  Select your time. Sessions use 1 token per minute.
                </Text>

                <View style={styles.durationHeading}>
                  <Text style={[styles.durationHeadingText, { color: colors.ink }]}>CHOOSE YOUR TIME</Text>
                  <Text style={[styles.rateText, { color: colors.dim }]}>1 TOKEN / MIN</Text>
                </View>
                <View style={styles.durationRow} accessibilityRole="radiogroup" accessibilityLabel="Session duration">
                  {DURATIONS.map((duration) => {
                    const selected = selectedDuration === duration;
                    return (
                      <Pressable
                        key={duration}
                        onPress={() => onSelectDuration(duration)}
                        accessibilityRole="radio"
                        accessibilityLabel={`${duration} minutes, ${duration} tokens`}
                        accessibilityState={{ checked: selected }}
                        aria-checked={selected}
                        style={[
                          styles.durationChip,
                          { backgroundColor: colors.surface, borderColor: selected ? colors.accent : colors.border },
                          selected && { backgroundColor: design === "lavender" ? "#d6c7f4" : "rgba(232,191,102,0.12)" },
                        ]}
                        testID={`arena-access-duration-${duration}`}
                      >
                        <Text style={[styles.durationNumber, { color: selected ? colors.accent : colors.ink }]}>{duration}</Text>
                        <Text style={[styles.durationUnit, { color: selected ? colors.accent : colors.muted }]}>MIN</Text>
                        <Text style={[styles.durationCost, { color: selected ? colors.accent : colors.dim }]}>{duration} tokens</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.balanceRow, { borderColor: colors.border }]}>
                  <Ionicons name="diamond" size={15} color={colors.accent} />
                  <Text style={[styles.balanceLabel, { color: colors.muted }]}>Available balance</Text>
                  {availableTokens === null ? (
                    <View style={styles.balanceLoading}>
                      <ActivityIndicator size="small" color={colors.accent} />
                      <Text style={[styles.balanceValue, { color: colors.ink }]}>Loading</Text>
                    </View>
                  ) : (
                    <Text style={[styles.balanceValue, { color: colors.ink }]}>{availableTokens} <Text style={[styles.balanceUnit, { color: colors.muted }]}>tokens</Text></Text>
                  )}
                </View>

                <Pressable
                  onPress={onUnlock}
                  disabled={isUnlocking}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isUnlocking, busy: isUnlocking }}
                  aria-disabled={isUnlocking}
                  aria-busy={isUnlocking}
                  style={[styles.primaryButton, { backgroundColor: colors.accent }, isUnlocking && styles.disabledButton]}
                  testID="arena-access-unlock"
                >
                  {isUnlocking ? (
                    <ActivityIndicator size="small" color={design === "lavender" ? "#fff" : "#211b0d"} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Unlock {selectedDuration} min · {selectedDuration} tokens</Text>
                      <Ionicons name="arrow-forward" size={17} color={design === "lavender" ? "#fff" : "#211b0d"} />
                    </>
                  )}
                </Pressable>
              </View>

              <View style={[styles.section, styles.packsSection, { backgroundColor: colors.darkSurface, borderColor: colors.border }]} testID="arena-access-tokens">
                <View style={styles.sectionHeading}>
                  <View>
                    <Text style={[styles.eyebrow, { color: colors.accent }]}>ONE-TIME TOKENS</Text>
                    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.ink }]}>Choose a pack</Text>
                  </View>
                  <Text style={[styles.oneTimeTag, { color: colors.accent, borderColor: colors.border }]}>ONE-TIME</Text>
                </View>
                <Text style={[styles.packsCopy, { color: colors.muted }]}>Continue to the existing purchase page to choose a token pack.</Text>
                <View style={styles.packList}>
                  {TOKEN_PACKS.map((pack) => (
                    <Pressable
                      key={pack.id}
                      onPress={() => onGetTokens(pack.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${pack.tokens} token pack, ${pack.price}`}
                      style={({ pressed }) => [
                        styles.packCard,
                        { backgroundColor: colors.surface, borderColor: pressed ? colors.accent : colors.border },
                        pressed && styles.pressed,
                      ]}
                      testID={`arena-access-pack-${pack.id}`}
                    >
                      <View style={[styles.packIcon, { borderColor: colors.border }]}>
                        <Ionicons name="flash" size={14} color={colors.accent} />
                      </View>
                      <View style={styles.packMain}>
                        <Text style={[styles.packTitle, { color: colors.ink }]}>{pack.tokens} <Text style={[styles.packUnit, { color: colors.muted }]}>tokens</Text></Text>
                        <Text style={[styles.packDescription, { color: colors.dim }]} numberOfLines={2}>{pack.description}</Text>
                      </View>
                      <View style={styles.packPriceWrap}>
                        <Text style={[styles.packPrice, { color: colors.accent }]}>{pack.price}</Text>
                        <Text style={[styles.packAction, { color: colors.muted }]}>View pack</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => onGetTokens()}
                  accessibilityRole="button"
                  style={[styles.moreTokensButton, { borderColor: colors.border }]}
                >
                  <Ionicons name="add-circle-outline" size={17} color={colors.accent} />
                  <Text style={[styles.moreTokensText, { color: colors.ink }]}>Get more tokens</Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.muted} />
                </Pressable>
              </View>

              <View style={[styles.plansSection, { backgroundColor: colors.darkSurface, borderColor: colors.border }]} testID="arena-access-plans">
                <Pressable
                  onPress={() => setPlansExpanded((expanded) => !expanded)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: plansExpanded }}
                  aria-expanded={plansExpanded}
                  style={styles.plansToggle}
                >
                  <View style={[styles.planPlus, { borderColor: colors.border }]}>
                    <Ionicons name="add" size={17} color={colors.accent} />
                  </View>
                  <View style={styles.planToggleCopy}>
                    <Text style={[styles.planToggleTitle, { color: colors.ink }]}>Prefer a monthly plan?</Text>
                    <Text style={[styles.planToggleSubtitle, { color: colors.muted }]}>Explore Standard and VIP</Text>
                  </View>
                  <Ionicons name={plansExpanded ? "remove" : "add"} size={18} color={colors.accent} />
                </Pressable>
                {plansExpanded && (
                  <View style={styles.planOptions}>
                    {(["standard", "vip"] as const).map((plan) => (
                      <Pressable
                        key={plan}
                        onPress={() => onExplorePlan(plan)}
                        accessibilityRole="button"
                        accessibilityLabel={`Explore ${plan === "vip" ? "VIP" : "Standard"} plan`}
                        style={({ pressed }) => [
                          styles.planOption,
                          { backgroundColor: colors.surface, borderColor: pressed ? colors.accent : colors.border },
                        ]}
                        testID={`arena-access-plan-${plan}`}
                      >
                        <Text style={[styles.planName, { color: colors.ink }]}>{plan === "vip" ? "VIP" : "Standard"}</Text>
                        <Text style={[styles.planAction, { color: colors.accent }]}>Explore</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.footer}>
                <Text style={[styles.footerBrand, { color: colors.muted }]}>THE ARENA</Text>
                <Text style={[styles.footerCopy, { color: colors.dim }]}>Choose your time. Then take the floor.</Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={[styles.footerClose, { borderColor: colors.border }]}
              >
                <Text style={[styles.footerCloseText, { color: colors.muted }]}>Close</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(7,6,6,0.76)" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,7,6,0.5)" },
  safeFrame: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  dialogScroll: { flexGrow: 0 },
  dialogScrollContent: { paddingVertical: 5 },
  card: { position: "relative", overflow: "hidden", padding: 19, borderWidth: 1, borderRadius: 8, shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 18 },
  header: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(180,160,130,0.25)" },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  brandMarkCore: { width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
  brandText: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  gateBadge: { minHeight: 23, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 7, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  gateBadgeText: { fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  closeButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 16 },
  audioNotice: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 13, padding: 9, borderWidth: 1, backgroundColor: "rgba(232,191,102,0.06)" },
  audioNoticeText: { fontSize: 11, fontWeight: "700" },
  intro: { paddingTop: 21, paddingBottom: 17 },
  kicker: { flexDirection: "row", alignItems: "center", gap: 9 },
  kickerNumber: { fontFamily: "monospace", fontSize: 9, fontWeight: "700" },
  kickerRule: { width: 28, height: StyleSheet.hairlineWidth, opacity: 0.7 },
  eyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1.6 },
  title: { marginTop: 12, fontFamily: "PlayfairDisplay_700Bold", fontSize: 40, lineHeight: 41, letterSpacing: -1.3 },
  titleCompact: { fontSize: 35, lineHeight: 37 },
  lede: { maxWidth: 430, marginTop: 10, fontSize: 12, lineHeight: 18 },
  previewNote: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderWidth: 1, borderLeftWidth: 2, marginBottom: 13 },
  previewSymbol: { width: 31, height: 31, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 16 },
  previewCopy: { flex: 1, minWidth: 0 },
  previewLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  previewText: { marginTop: 4, fontSize: 10, lineHeight: 15 },
  previewTag: { paddingHorizontal: 5, paddingVertical: 4, borderWidth: 1, fontSize: 7, fontWeight: "800", letterSpacing: 0.8 },
  section: { padding: 14, borderWidth: 1, marginBottom: 11, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 15, shadowOffset: { width: 0, height: 7 } },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sectionTitle: { marginTop: 4, fontFamily: "PlayfairDisplay_700Bold", fontSize: 21 },
  verdictStamp: { paddingHorizontal: 6, paddingVertical: 5, borderWidth: 1, transform: [{ rotate: "-4deg" }] },
  verdictStampText: { fontSize: 7, fontWeight: "800", letterSpacing: 0.6, lineHeight: 10, textAlign: "center" },
  sectionCopy: { marginTop: 6, marginBottom: 13, fontSize: 10, lineHeight: 15 },
  durationHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  durationHeadingText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  rateText: { fontSize: 8, letterSpacing: 0.5 },
  durationRow: { flexDirection: "row", gap: 7 },
  durationChip: { flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1 },
  durationNumber: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22, lineHeight: 25 },
  durationUnit: { marginTop: 1, fontSize: 7, fontWeight: "800", letterSpacing: 1.2 },
  durationCost: { marginTop: 5, fontSize: 9 },
  balanceRow: { minHeight: 39, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 11, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  balanceLabel: { flex: 1, fontSize: 10 },
  balanceValue: { fontSize: 13, fontWeight: "800" },
  balanceUnit: { fontSize: 9, fontWeight: "500" },
  balanceLoading: { flexDirection: "row", alignItems: "center", gap: 6 },
  primaryButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 11, paddingHorizontal: 11 },
  primaryButtonText: { color: "#211b0d", fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },
  disabledButton: { opacity: 0.65 },
  packsSection: { marginTop: 0 },
  oneTimeTag: { paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1, fontSize: 7, fontWeight: "800", letterSpacing: 0.7 },
  packsCopy: { marginTop: 7, marginBottom: 10, fontSize: 9, lineHeight: 14 },
  packList: { gap: 6 },
  packCard: { minHeight: 55, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1 },
  packIcon: { width: 27, height: 27, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 14 },
  packMain: { flex: 1, minWidth: 0 },
  packTitle: { fontSize: 12, fontWeight: "800" },
  packUnit: { fontSize: 9, fontWeight: "500" },
  packDescription: { marginTop: 3, fontSize: 8, lineHeight: 11 },
  packPriceWrap: { alignItems: "flex-end", gap: 3 },
  packPrice: { fontFamily: "monospace", fontSize: 11, fontWeight: "700" },
  packAction: { fontSize: 8 },
  moreTokensButton: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingHorizontal: 9, borderWidth: 1 },
  moreTokensText: { flex: 1, fontSize: 10, fontWeight: "700" },
  plansSection: { overflow: "hidden", borderWidth: 1, marginBottom: 9 },
  plansToggle: { minHeight: 57, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11, paddingVertical: 9 },
  planPlus: { width: 29, height: 29, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 15 },
  planToggleCopy: { flex: 1 },
  planToggleTitle: { fontSize: 10, fontWeight: "800" },
  planToggleSubtitle: { marginTop: 4, fontSize: 9 },
  planOptions: { flexDirection: "row", gap: 7, paddingHorizontal: 10, paddingBottom: 10 },
  planOption: { flex: 1, minHeight: 41, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, paddingHorizontal: 8, borderWidth: 1 },
  planName: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 14 },
  planAction: { fontSize: 8, fontWeight: "800" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 4, paddingBottom: 9 },
  footerBrand: { fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  footerCopy: { fontSize: 8 },
  footerClose: { minHeight: 36, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  footerCloseText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  pressed: { opacity: 0.76 },
});