import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ArenaDesign = "classic" | "electric" | "lavender";

type ArenaDesignPickerProps = {
  visible: boolean;
  selected: ArenaDesign;
  onSelect: (design: ArenaDesign) => void;
  onClose: () => void;
  saving?: boolean;
  error?: string | null;
};

type DesignOption = {
  id: ArenaDesign;
  title: string;
  description: string;
  eyebrow: string;
  palette: {
    surface: string;
    raised: string;
    line: string;
    accent: string;
    accentSoft: string;
    ink: string;
    muted: string;
  };
  glossy: boolean;
};

const OPTIONS: DesignOption[] = [
  {
    id: "classic",
    title: "Classic Arena",
    description: "Calm gold and red. Clear, steady, and easy on the eyes.",
    eyebrow: "THE ORIGINAL",
    palette: {
      surface: "#211b16",
      raised: "#32251d",
      line: "#72553b",
      accent: "#e8bf66",
      accentSoft: "#e65b48",
      ink: "#f5eee3",
      muted: "#c2b7a6",
    },
    glossy: false,
  },
  {
    id: "electric",
    title: "Electric Gloss",
    description: "The Arena’s gold-and-red look, with a live electric edge.",
    eyebrow: "GOLD / RED",
    palette: {
      surface: "#211a16",
      raised: "#433024",
      line: "#a27a45",
      accent: "#f2ca6c",
      accentSoft: "#ee624d",
      ink: "#fff4df",
      muted: "#d0bca0",
    },
    glossy: true,
  },
  {
    id: "lavender",
    title: "Lavender Electric",
    description: "Glossy lavender and violet, with the same live current.",
    eyebrow: "LAVENDER / VIOLET",
    palette: {
      surface: "#b4a2e1",
      raised: "#e9defb",
      line: "#8c76b7",
      accent: "#5531b5",
      accentSoft: "#345fe3",
      ink: "#202954",
      muted: "#4b5276",
    },
    glossy: true,
  },
];

function DesignPreview({ option }: { option: DesignOption }) {
  const { palette, glossy } = option;
  return (
    <View
      accessible={false}
      style={[
        styles.preview,
        {
          backgroundColor: palette.surface,
          borderColor: palette.line,
        },
      ]}
    >
      {glossy ? (
        <>
          <LinearGradient
            colors={[
              `${palette.accent}28`,
              `${palette.accentSoft}10`,
              "transparent",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View
            style={[
              styles.previewSheen,
              { backgroundColor: `${palette.ink}10` },
            ]}
          />
        </>
      ) : null}
      <View style={styles.previewTopline}>
        <View style={[styles.previewMark, { borderColor: palette.accent }]}>
          <Text style={[styles.previewMarkText, { color: palette.accent }]}>A</Text>
        </View>
        <Text style={[styles.previewWordmark, { color: palette.ink }]}>
          ARENA
        </Text>
        <View style={[styles.previewCurrent, { backgroundColor: palette.accentSoft }]} />
        <Text style={[styles.previewLive, { color: palette.muted }]}>LIVE</Text>
      </View>
      <View style={[styles.previewRule, { backgroundColor: `${palette.accent}55` }]} />
      <View style={styles.previewContent}>
        <View style={styles.previewCopy}>
          <View style={[styles.previewTag, { backgroundColor: `${palette.accent}22` }]}>
            <Text style={[styles.previewTagText, { color: palette.accent }]}>
              THE FLOOR IS OPEN
            </Text>
          </View>
          <View style={[styles.previewHeadingLine, { backgroundColor: palette.ink }]} />
          <View style={[styles.previewShortLine, { backgroundColor: `${palette.ink}88` }]} />
        </View>
        <View style={[styles.previewDebate, { backgroundColor: palette.raised, borderColor: palette.line }]}>
          <View style={styles.previewDebateRow}>
            <View style={[styles.previewDot, { backgroundColor: palette.accentSoft }]} />
            <View style={[styles.previewSpeech, { backgroundColor: `${palette.ink}b0` }]} />
          </View>
          <View style={styles.previewDebateRow}>
            <View style={[styles.previewDot, { backgroundColor: palette.accent }]} />
            <View style={[styles.previewSpeech, styles.previewSpeechShort, { backgroundColor: `${palette.ink}80` }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function ArenaDesignPicker({
  visible,
  selected,
  onSelect,
  onClose,
  saving = false,
  error,
}: ArenaDesignPickerProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = width < 430;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top, 14),
            paddingBottom: Math.max(insets.bottom, 14),
            paddingHorizontal: compact ? 12 : 24,
          },
        ]}
      >
        <Pressable
          accessible={false}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          testID="arena-design-backdrop"
        />
        <View
          accessibilityRole={Platform.OS === "web" ? ("dialog" as any) : undefined}
          accessibilityViewIsModal
          accessibilityLabel="Choose an Arena design"
          aria-modal={Platform.OS === "web" ? true : undefined}
          style={[
            styles.dialog,
            {
              maxHeight: Math.max(260, height - Math.max(insets.top, 14) - Math.max(insets.bottom, 14) - 16),
              width: Math.min(width - (compact ? 24 : 48), 620),
            },
          ]}
          testID="arena-design-picker"
        >
          <View style={styles.dialogHeader}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>MAKE IT YOURS</Text>
              <Text style={styles.title}>Choose your Arena look</Text>
              <Text style={styles.intro}>You can change this any time.</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close design picker"
              hitSlop={8}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              testID="arena-design-close"
            >
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.optionsScroll}
            contentContainerStyle={styles.optionsContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {OPTIONS.map((option) => {
              const isSelected = selected === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected, selected: isSelected, disabled: saving }}
                  accessibilityLabel={`${option.title}. ${option.description}${isSelected ? ". Selected" : ""}`}
                  disabled={saving}
                  onPress={() => onSelect(option.id)}
                  style={({ pressed }) => [
                    styles.option,
                    isSelected && styles.optionSelected,
                    pressed && !saving && styles.optionPressed,
                    saving && styles.optionSaving,
                  ]}
                  testID={`arena-design-choice-${option.id}`}
                >
                  <DesignPreview option={option} />
                  <View style={styles.optionDetails}>
                    <View style={styles.optionTitleLine}>
                      <View style={styles.optionNameGroup}>
                        <Text style={styles.optionEyebrow}>{option.eyebrow}</Text>
                        <Text style={styles.optionTitle}>{option.title}</Text>
                      </View>
                      <View
                        style={[
                          styles.selectionMark,
                          isSelected && styles.selectionMarkActive,
                        ]}
                      >
                        {isSelected ? <Text style={styles.check}>✓</Text> : null}
                      </View>
                    </View>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                    {isSelected ? (
                      <Text style={styles.selectedLabel}>CURRENT DESIGN</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            {saving ? (
              <View style={styles.statusBox} accessibilityLiveRegion="polite">
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Saving your design…</Text>
              </View>
            ) : null}
            {!saving && error ? (
              <View
                style={styles.errorBox}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                <View style={styles.errorCopy}>
                  <Text style={styles.errorTitle}>Couldn’t save that design</Text>
                  <Text style={styles.errorMessage}>{error}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Try saving ${selected} design again`}
                  onPress={() => onSelect(selected)}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              {saving ? "Your choice is being saved." : "Your debates stay exactly as they are."}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(9, 8, 8, 0.78)",
    justifyContent: "center",
    alignItems: "center",
  },
  dialog: {
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(232,191,102,0.42)",
    backgroundColor: "#191715",
    shadowColor: "#000",
    shadowOpacity: 0.48,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 21,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(232,191,102,0.2)",
  },
  headerCopy: { flex: 1, paddingRight: 12 },
  kicker: {
    color: "#e8bf66",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  title: {
    color: "#f5eee3",
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "700",
    letterSpacing: -0.7,
    marginTop: 5,
  },
  intro: {
    color: "#c2b7a6",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(237,212,172,0.23)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  closeGlyph: { color: "#f5eee3", fontSize: 25, lineHeight: 28, fontWeight: "300" },
  optionsScroll: { flexShrink: 1 },
  optionsContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, gap: 10 },
  option: {
    minHeight: 116,
    flexDirection: "row",
    alignItems: "stretch",
    padding: 9,
    gap: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(237,212,172,0.2)",
    backgroundColor: "#211e1a",
  },
  optionSelected: {
    borderColor: "#e8bf66",
    backgroundColor: "#29231b",
    shadowColor: "#d2a650",
    shadowOpacity: 0.13,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  optionPressed: { opacity: 0.84 },
  optionSaving: { opacity: 0.72 },
  preview: {
    width: 147,
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 9,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingTop: 8,
    paddingBottom: 7,
    justifyContent: "space-between",
  },
  previewSheen: {
    position: "absolute",
    left: -10,
    top: -23,
    width: "120%",
    height: 29,
    transform: [{ rotate: "-10deg" }],
  },
  previewTopline: { flexDirection: "row", alignItems: "center", gap: 5 },
  previewMark: {
    width: 17,
    height: 17,
    borderWidth: 1,
    borderRadius: 5,
    borderBottomLeftRadius: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  previewMarkText: { fontSize: 10, fontWeight: "900" },
  previewWordmark: { fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  previewCurrent: { width: 5, height: 5, borderRadius: 3, marginLeft: "auto" },
  previewLive: { fontSize: 6, fontWeight: "900", letterSpacing: 0.8 },
  previewRule: { height: StyleSheet.hairlineWidth, marginTop: 5 },
  previewContent: { flexDirection: "row", alignItems: "flex-end", gap: 7, marginTop: 7 },
  previewCopy: { flex: 1, alignItems: "flex-start" },
  previewTag: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3, marginBottom: 5 },
  previewTagText: { fontSize: 4.8, letterSpacing: 0.45, fontWeight: "900" },
  previewHeadingLine: { width: "94%", height: 4, borderRadius: 2, marginBottom: 4 },
  previewShortLine: { width: "67%", height: 2.5, borderRadius: 2 },
  previewDebate: {
    width: 56,
    height: 35,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 5,
    justifyContent: "center",
    paddingHorizontal: 5,
    gap: 6,
  },
  previewDebateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  previewDot: { width: 5, height: 5, borderRadius: 3 },
  previewSpeech: { width: 32, height: 2, borderRadius: 2 },
  previewSpeechShort: { width: 24 },
  optionDetails: { flex: 1, justifyContent: "center", paddingVertical: 5 },
  optionTitleLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  optionNameGroup: { flex: 1 },
  optionEyebrow: { color: "#e8bf66", fontSize: 7, fontWeight: "900", letterSpacing: 1.15 },
  optionTitle: { color: "#f5eee3", fontSize: 15, fontWeight: "700", marginTop: 3, letterSpacing: -0.2 },
  selectionMark: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#756957",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionMarkActive: { borderColor: "#e8bf66", backgroundColor: "#e8bf66" },
  check: { color: "#21190f", fontSize: 13, fontWeight: "900", lineHeight: 16 },
  optionDescription: { color: "#c2b7a6", fontSize: 10, lineHeight: 14, marginTop: 4, paddingRight: 3 },
  selectedLabel: { color: "#e8bf66", fontSize: 7, fontWeight: "900", letterSpacing: 0.9, marginTop: 5 },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: "rgba(232,191,102,0.09)",
    borderWidth: 1,
    borderColor: "rgba(232,191,102,0.24)",
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#e8bf66" },
  statusText: { color: "#f1dfbd", fontSize: 11, fontWeight: "600" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(230,91,72,0.44)",
    backgroundColor: "rgba(112,39,32,0.2)",
  },
  errorCopy: { flex: 1 },
  errorTitle: { color: "#ffd6ca", fontSize: 11, fontWeight: "800" },
  errorMessage: { color: "#d9b8ad", fontSize: 10, lineHeight: 14, marginTop: 3 },
  retryButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(230,91,72,0.55)",
    backgroundColor: "rgba(230,91,72,0.12)",
  },
  retryText: { color: "#ffd6ca", fontSize: 10, fontWeight: "800" },
  footer: {
    minHeight: 61,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(232,191,102,0.2)",
  },
  footerNote: { flex: 1, color: "#aa9e8c", fontSize: 9, lineHeight: 13 },
  doneButton: {
    minWidth: 73,
    minHeight: 37,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(232,191,102,0.62)",
    backgroundColor: "rgba(232,191,102,0.12)",
  },
  doneText: { color: "#f2cf7e", fontSize: 11, fontWeight: "900", letterSpacing: 0.25 },
  pressed: { opacity: 0.72 },
});