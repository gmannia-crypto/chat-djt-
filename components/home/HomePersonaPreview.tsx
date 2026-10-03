import React, { useCallback, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { HOME_PREVIEW_LIMIT, HOME_PREVIEW_PERSONAS, type HomePreviewPersonaId } from "@shared/home-persona-preview";
import { useHomePersonaPreview } from "@/hooks/useHomePersonaPreview";

const PORTRAITS: Record<HomePreviewPersonaId, number> = {
  trump: require("@/assets/images/persona-trump.png"),
  biden: require("@/assets/images/persona-biden.png"),
  obama: require("@/assets/images/persona-obama.png"),
  kamala: require("@/assets/images/persona-kamala.png"),
  carville: require("@/assets/images/persona-carville.png"),
  galloway: require("@/assets/images/persona-galloway.png"),
  malcolmx: require("@/assets/images/persona-malcolmx.jpg"),
  cornellwest: require("@/assets/images/persona-cornellwest.jpg"),
  maponga: require("@/assets/images/persona-maponga.png"),
  candace: require("@/assets/images/persona-candace.png"),
  rogan: require("@/assets/images/persona-rogan.png"),
  musk: require("@/assets/images/persona-musk.png"),
  berniesanders: require("@/assets/images/persona-berniesanders.jpg"),
  tuckercarlson: require("@/assets/images/persona-tuckercarlson.jpg"),
};

type Pair = { left: HomePreviewPersonaId; right: HomePreviewPersonaId };
type Slot = "left" | "right";

function createRandomPair(excludeKey?: string): Pair {
  const options: Pair[] = [];
  for (let first = 0; first < HOME_PREVIEW_PERSONAS.length; first += 1) {
    for (let second = first + 1; second < HOME_PREVIEW_PERSONAS.length; second += 1) {
      const left = HOME_PREVIEW_PERSONAS[first].id;
      const right = HOME_PREVIEW_PERSONAS[second].id;
      options.push({ left, right }, { left: right, right: left });
    }
  }
  const eligible = options.filter((candidate) => pairKey(candidate) !== excludeKey);
  return eligible[Math.floor(Math.random() * eligible.length)];
}

function pairKey(pair: Pair) {
  return [pair.left, pair.right].sort().join(":");
}

function getPersona(id: HomePreviewPersonaId) {
  return HOME_PREVIEW_PERSONAS.find((persona) => persona.id === id)!;
}

export function HomePersonaPreview() {
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const [pair, setPair] = useState<Pair>(createRandomPair);
  const pairRef = useRef(pair);
  const applyPair = useCallback((next: Pair) => {
    pairRef.current = next;
    setPair(next);
  }, []);
  const seenPairs = useRef(new Set([pairKey(pair)]));
  const [focusedSlot, setFocusedSlot] = useState<Slot>(() => Math.random() < 0.5 ? "left" : "right");
  const [selectorSlot, setSelectorSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [showCaptions, setShowCaptions] = useState(false);
  const preview = useHomePersonaPreview();

  const stopBeforeChange = () => {
    if (preview.playingPersonaId) preview.stop();
  };

  const rotateSlot = (slot: Slot) => {
    stopBeforeChange();
    const opposingId = slot === "left" ? pair.right : pair.left;
    const choices = HOME_PREVIEW_PERSONAS.filter((persona) => persona.id !== opposingId && persona.id !== pair[slot]);
    const replacement = choices[Math.floor(Math.random() * choices.length)].id;
    const next = { ...pair, [slot]: replacement };
    applyPair(next);
    seenPairs.current.add(pairKey(next));
    setFocusedSlot(slot);
  };

  const openSelector = (slot: Slot) => {
    if (preview.busy) return;
    stopBeforeChange();
    setFocusedSlot(slot);
    setSelectorSlot(slot);
  };

  const selectPersona = (id: HomePreviewPersonaId) => {
    if (!selectorSlot) return;
    stopBeforeChange();
    const next = { ...pair, [selectorSlot]: id };
    applyPair(next);
    seenPairs.current.add(pairKey(next));
    setFocusedSlot(selectorSlot);
    setSelectorSlot(null);
  };

  const shufflePair = () => {
    if (preview.busy) return;
    stopBeforeChange();
    let available = HOME_PREVIEW_PERSONAS.flatMap((left) =>
      HOME_PREVIEW_PERSONAS
        .filter((right) => right.id !== left.id)
        .map((right) => ({ left: left.id, right: right.id })),
    ).filter((candidate) => !seenPairs.current.has(pairKey(candidate)));
    if (!available.length) {
      seenPairs.current = new Set([pairKey(pair)]);
      available = HOME_PREVIEW_PERSONAS.flatMap((left) =>
        HOME_PREVIEW_PERSONAS
          .filter((right) => right.id !== left.id)
          .map((right) => ({ left: left.id, right: right.id })),
      ).filter((candidate) => !seenPairs.current.has(pairKey(candidate)));
    }
    const next = available[Math.floor(Math.random() * available.length)];
    applyPair(next);
    seenPairs.current.add(pairKey(next));
    setFocusedSlot(Math.random() < 0.5 ? "left" : "right");
  };

  const editName = (value: string) => {
    stopBeforeChange();
    setName(value.slice(0, 40));
  };

  const listen = (id: HomePreviewPersonaId) => {
    if (preview.busy) return;
    if (preview.playingPersonaId === id) preview.stop();
    else {
      setFocusedSlot(pair.left === id ? "left" : "right");
      void preview.play(id, name);
    }
  };

  const resetForHomeEntry = useCallback(() => {
    preview.stop();
    const next = createRandomPair(pairKey(pairRef.current));
    seenPairs.current = new Set([pairKey(next)]);
    applyPair(next);
    setFocusedSlot(Math.random() < 0.5 ? "left" : "right");
    setSelectorSlot(null);
  }, [preview.stop, applyPair]);

  useFocusEffect(useCallback(() => {
    resetForHomeEntry();
    return () => {
      preview.stop();
      setSelectorSlot(null);
    };
  }, [preview.stop, resetForHomeEntry]));

  const renderSpeaker = (slot: Slot) => {
    const id = pair[slot];
    const persona = getPersona(id);
    const isPlaying = preview.playingPersonaId === id;
    const hasSavedSample = preview.hasSample(id, name);
    const isFocused = focusedSlot === slot;
    const listenTestId = slot === "left" ? "home-preview-listen-left" : "home-preview-listen-right";
    const rotateTestId = slot === "left" ? "home-preview-rotate-left" : "home-preview-rotate-right";
    const selectTestId = slot === "left" ? "home-preview-select-left" : "home-preview-select-right";

    return (
      <View key={slot} style={[styles.speaker, slot === "right" && styles.speakerRight, isFocused && styles.speakerFocused]}>
        <View style={styles.speakerTop}>
          <View style={styles.speakerIdentity}>
            <Image source={PORTRAITS[id]} accessibilityLabel={`${persona.name} portrait`} style={styles.portrait} />
            <View style={styles.identityCopy}>
              <Text style={styles.slotLabel}>{slot === "left" ? "VOICE 01" : "VOICE 02"}{isFocused ? "  ·  IN FOCUS" : ""}</Text>
              <Text style={styles.personaName} numberOfLines={1}>{persona.name}</Text>
              <Text style={styles.personaLine} numberOfLines={2}>Hear their case for why they belong in your next debate.</Text>
            </View>
          </View>
          <View style={styles.personaTools}>
            <Pressable
              onPress={() => rotateSlot(slot)}
              disabled={preview.busy}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, preview.busy && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={`Rotate ${persona.name} for another voice`}
              accessibilityState={{ disabled: preview.busy }}
              aria-disabled={preview.busy}
              testID={rotateTestId}
            >
              <Ionicons name="shuffle-outline" size={16} color="#dfbd75" />
            </Pressable>
            <Pressable
              onPress={() => openSelector(slot)}
              disabled={preview.busy}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, preview.busy && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={`Choose a voice for ${slot === "left" ? "voice one" : "voice two"}`}
              accessibilityState={{ disabled: preview.busy, expanded: selectorSlot === slot }}
              aria-disabled={preview.busy}
              aria-expanded={selectorSlot === slot}
              testID={selectTestId}
            >
              <Ionicons name="list-outline" size={16} color="#dfbd75" />
            </Pressable>
          </View>
        </View>
        <View style={styles.pitchRule} />
        <Text style={styles.pitchCue}>A SHORT PERSONAL INVITATION</Text>
        <Pressable
          onPress={() => listen(id)}
          disabled={preview.busy}
          style={({ pressed }) => [styles.listenButton, isPlaying && styles.stopButton, pressed && styles.pressed, preview.busy && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? `Stop ${persona.name} audio sample` : hasSavedSample ? `Replay saved ${persona.name} audio sample` : `Listen to ${persona.name}${name.trim() ? ` address ${name.trim()}` : ""}`}
          accessibilityState={{ disabled: preview.busy, selected: isPlaying, busy: preview.busy && focusedSlot === slot }}
          aria-disabled={preview.busy}
          aria-pressed={isPlaying}
          aria-busy={preview.busy && focusedSlot === slot}
          testID={listenTestId}
        >
          <Ionicons name={isPlaying ? "stop" : "play"} size={14} color={isPlaying ? "#f2dca9" : "#fff3e5"} />
          <Text style={[styles.listenText, isPlaying && styles.stopText]}>{isPlaying ? "STOP SAMPLE" : preview.busy ? "PREPARING AUDIO…" : hasSavedSample ? "REPLAY SAVED PITCH" : "LISTEN TO THE PITCH"}</Text>
          {!isPlaying && !preview.busy && <Ionicons name="volume-medium-outline" size={15} color="#fff3e5" />}
        </Pressable>
        {preview.busy && focusedSlot === slot && (
          <View style={styles.loadingLine} accessibilityLiveRegion="polite">
            <View style={styles.loadingMark} />
            <Text style={styles.loadingText}>Preparing this voice for you…</Text>
          </View>
        )}
      </View>
    );
  };

  const availableChoices = HOME_PREVIEW_PERSONAS.filter((persona) => persona.id !== (selectorSlot === "left" ? pair.right : pair.left));

  return (
    <View testID="home-text-demo">
    <View style={styles.card} testID="home-audio-demo" accessibilityLabel="Interactive audio preview with two selectable voices">
      <View style={styles.topAccent} />
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.headerCopy}>
          <View style={styles.eyebrowRow}>
            <View style={styles.liveDot} />
            <Text style={styles.eyebrow}>A QUICK PREVIEW</Text>
            <View style={styles.eyebrowRule} />
            <Text style={styles.eyebrowSecondary}>REAL VOICES. YOUR CALL.</Text>
          </View>
          <Text accessibilityRole="header" style={styles.title}>Two voices. One question.</Text>
        </View>
        <Pressable
          onPress={shufflePair}
          disabled={preview.busy}
          style={({ pressed }) => [styles.shuffleButton, pressed && styles.pressed, preview.busy && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="Shuffle both preview voices"
          accessibilityState={{ disabled: preview.busy }}
          aria-disabled={preview.busy}
          testID="home-preview-shuffle"
        >
          <Ionicons name="sync-outline" size={15} color="#e7c77f" />
          <Text style={styles.shuffleText}>SHUFFLE</Text>
        </Pressable>
      </View>

      <View style={[styles.questionBand, compact && styles.questionBandCompact]}>
        <Text style={styles.questionLabel}>THE QUESTION</Text>
        <Text style={styles.question}>Who gets heard when prices rise?</Text>
        <View style={styles.questionMark}><Text style={styles.questionMarkText}>?</Text></View>
      </View>

      <View style={[styles.callIn, compact && styles.callInCompact]} testID="home-preview-name-band">
        <View style={styles.callInCopy}>
          <Text style={styles.callInLabel}>CALL-IN NAME · START HERE</Text>
          <Text style={styles.callInHint} testID="home-preview-name-instructions">
            Optional. Enter your name first, then pick a persona and tap Listen to hear them address you by name.
          </Text>
          <Text style={styles.rosterHint}>{HOME_PREVIEW_PERSONAS.length} voices · Tap the list icon to choose, or shuffle to explore.</Text>
        </View>
        <TextInput
          value={name}
          onChangeText={editName}
          onFocus={stopBeforeChange}
          editable={!preview.busy}
          maxLength={40}
          placeholder="Your name"
          placeholderTextColor="#84796c"
          style={[styles.nameInput, compact && styles.nameInputCompact, preview.busy && styles.disabled]}
          accessibilityLabel="Optional name for personalized voice samples"
          testID="home-preview-name"
        />
      </View>

      <View style={[styles.speakerRow, compact && styles.speakerColumn]}>
        {renderSpeaker("left")}
        {!compact && <View style={styles.versus}><View style={styles.versusRule} /><Text style={styles.versusText}>VS</Text><View style={styles.versusRule} /></View>}
        {renderSpeaker("right")}
      </View>

      <View style={[styles.usageRow, compact && styles.usageColumn]}>
        <View style={styles.usageCopy}>
          <Ionicons name="disc-outline" size={15} color="#d6b46a" />
          <Text style={styles.usageText} testID="home-preview-usage">{preview.samplesUsed} / {HOME_PREVIEW_LIMIT} new clips this visit</Text>
          <Text style={styles.usageSubtext}> · saved replays don’t use another clip</Text>
        </View>
        <Pressable
          onPress={() => setShowCaptions((value) => !value)}
          style={styles.captionToggle}
          accessibilityRole="button"
          accessibilityLabel={showCaptions ? "Hide audio captions" : "Show audio captions"}
          accessibilityState={{ selected: showCaptions }}
          aria-pressed={showCaptions}
        >
          <Ionicons name={showCaptions ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} size={14} color={showCaptions ? "#e7c77f" : "#a99e90"} />
          <Text style={[styles.captionLabel, showCaptions && styles.captionLabelActive]}>CAPTIONS {showCaptions ? "ON" : "OFF"}</Text>
        </Pressable>
      </View>

      {!preview.audioEnabled && (
        <View style={styles.mutedNotice} accessibilityLiveRegion="polite">
          <Ionicons name="volume-mute-outline" size={15} color="#e6bb6d" />
          <Text style={styles.mutedText}>Audio is muted in your sound or persona voice settings. Turn both on to listen.</Text>
        </View>
      )}
      {preview.error ? (
        <View style={styles.errorBox} accessibilityLiveRegion="assertive" testID="home-preview-error">
          <Ionicons name="alert-circle-outline" size={16} color="#f18a75" />
          <Text style={styles.errorText}>{preview.error}</Text>
        </View>
      ) : null}
      {showCaptions && preview.transcript ? (
        <View style={styles.captionBox} accessibilityRole="text" accessibilityLabel={`Audio captions: ${preview.transcript}`}>
          <Text style={styles.captionEyebrow}>CAPTIONS · AUDIO PREVIEW</Text>
          <Text style={styles.captionText}>{preview.transcript}</Text>
        </View>
      ) : null}
      <View style={styles.footnote}>
        <Ionicons name="information-circle-outline" size={14} color="#9f9383" />
        <Text style={styles.footnoteText}>Four fresh audio clips per visit, including name variations. Your saved samples can be replayed.</Text>
      </View>

      <Modal
        visible={selectorSlot !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectorSlot(null)}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dialog} accessibilityLabel={`Choose voice for ${selectorSlot === "left" ? "voice one" : "voice two"}`} accessibilityViewIsModal>
            <View style={styles.dialogHeader}>
              <View>
                <Text style={styles.eyebrow}>THE ARENA ROSTER</Text>
                <Text style={styles.dialogTitle}>Choose a voice</Text>
              </View>
              <Pressable onPress={() => setSelectorSlot(null)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close voice selector">
                <Ionicons name="close" size={20} color="#e7ddcd" />
              </Pressable>
            </View>
            <Text style={styles.dialogHint}>One voice per side. The opposing speaker is left out.</Text>
            <ScrollView style={styles.roster} contentContainerStyle={styles.rosterContent}>
              {availableChoices.map((persona) => {
                const selected = pair[selectorSlot ?? "left"] === persona.id;
                return (
                  <Pressable
                    key={persona.id}
                    onPress={() => selectPersona(persona.id)}
                    style={({ pressed }) => [styles.rosterChoice, selected && styles.rosterChoiceSelected, pressed && styles.pressed]}
                    accessibilityRole="radio"
                    accessibilityLabel={persona.name}
                    accessibilityState={{ checked: selected }}
                    aria-checked={selected}
                    testID={`home-preview-choice-${persona.id}`}
                  >
                    <Image source={PORTRAITS[persona.id]} accessibilityLabel="" style={styles.rosterPortrait} />
                    <View style={styles.rosterCopy}>
                      <Text style={styles.rosterName}>{persona.name}</Text>
                      <Text style={styles.rosterPitch} numberOfLines={2}>{persona.pitch}</Text>
                    </View>
                    <View style={[styles.radioMark, selected && styles.radioMarkSelected]}>{selected && <View style={styles.radioDot} />}</View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", borderWidth: 1, borderColor: "rgba(231,218,194,0.17)", borderRadius: 13, backgroundColor: "#201e1b", boxShadow: "0 18px 52px rgba(0,0,0,0.24)" } as object,
  topAccent: { height: 2, backgroundColor: "#b84b3d" },
  header: { minHeight: 78, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, paddingVertical: 15 },
  headerCompact: { alignItems: "flex-start", flexDirection: "column", paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#e65b48" },
  eyebrow: { color: "#e8bf66", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  eyebrowRule: { width: 18, height: 1, backgroundColor: "rgba(232,191,102,0.4)" },
  eyebrowSecondary: { color: "#a99e90", fontSize: 8, fontWeight: "800", letterSpacing: 0.9 },
  title: { marginTop: 6, color: "#f5eee3", fontFamily: "PlayfairDisplay_700Bold", fontSize: 20 },
  shuffleButton: { minHeight: 35, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(232,191,102,0.31)", borderRadius: 4, backgroundColor: "rgba(232,191,102,0.06)" },
  shuffleText: { color: "#e7c77f", fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  questionBand: { minHeight: 53, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(236,220,193,0.10)", backgroundColor: "#29211e" },
  questionBandCompact: { paddingHorizontal: 13, flexWrap: "wrap", gap: 7, minHeight: 62 },
  questionLabel: { color: "#d9a778", fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  question: { color: "#f1e6d8", fontFamily: "PlayfairDisplay_700Bold", fontSize: 14, flexShrink: 1 },
  questionMark: { width: 22, height: 22, marginLeft: "auto", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(217,167,120,0.4)", borderRadius: 11 },
  questionMarkText: { color: "#d9a778", fontFamily: "PlayfairDisplay_700Bold", fontSize: 13 },
  speakerRow: { flexDirection: "row", alignItems: "stretch", paddingHorizontal: 12, paddingVertical: 13, backgroundColor: "#25211e" },
  speakerColumn: { flexDirection: "column", paddingHorizontal: 9, gap: 9 },
  speaker: { flex: 1, minWidth: 0, padding: 12, borderWidth: 1, borderColor: "rgba(240,226,204,0.10)", borderRadius: 7, backgroundColor: "rgba(34,31,28,0.82)" },
  speakerRight: { borderColor: "rgba(119,142,166,0.22)" },
  speakerFocused: { borderColor: "rgba(232,191,102,0.48)", backgroundColor: "rgba(54,43,31,0.58)" },
  speakerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  speakerIdentity: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0, gap: 10 },
  portrait: { width: 55, height: 62, borderRadius: 4, borderWidth: 1, borderColor: "rgba(255,236,211,0.42)", backgroundColor: "#332c26" },
  identityCopy: { flex: 1, minWidth: 0 },
  slotLabel: { color: "#d6b46a", fontSize: 7, fontWeight: "900", letterSpacing: 1, marginBottom: 5 },
  personaName: { color: "#f3e4cf", fontFamily: "PlayfairDisplay_700Bold", fontSize: 15 },
  personaLine: { color: "#a99e90", fontSize: 9, lineHeight: 13, marginTop: 3 },
  personaTools: { flexDirection: "row", gap: 5, alignSelf: "flex-start" },
  iconButton: { width: 29, height: 29, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(232,191,102,0.24)", borderRadius: 15, backgroundColor: "rgba(232,191,102,0.05)" },
  pitchRule: { height: 1, marginTop: 11, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.11)" },
  pitchCue: { color: "#a99e90", fontSize: 7, fontWeight: "800", letterSpacing: 1.1, marginBottom: 7 },
  listenButton: { minHeight: 37, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 10, borderRadius: 4, backgroundColor: "#b84b3d" },
  stopButton: { borderWidth: 1, borderColor: "rgba(232,191,102,0.38)", backgroundColor: "rgba(184,75,61,0.16)" },
  listenText: { color: "#fff3e5", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  stopText: { color: "#f2dca9" },
  loadingLine: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 },
  loadingMark: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#e8bf66" },
  loadingText: { color: "#c8bba8", fontSize: 9 },
  versus: { width: 43, flexShrink: 0, alignItems: "center", justifyContent: "center", gap: 5 },
  versusRule: { width: 1, height: 17, backgroundColor: "rgba(232,191,102,0.26)" },
  versusText: { color: "#e5c782", fontFamily: "PlayfairDisplay_700Bold", fontStyle: "italic", fontSize: 12 },
  callIn: { minHeight: 82, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingHorizontal: 19, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(240,226,204,0.10)", backgroundColor: "#211f1c" },
  callInCompact: { alignItems: "stretch", flexDirection: "column", gap: 9, paddingHorizontal: 13 },
  callInCopy: { flex: 1, minWidth: 0 },
  callInLabel: { color: "#e8bf66", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  callInHint: { color: "#d0c4b4", fontSize: 11, lineHeight: 16, marginTop: 5 },
  rosterHint: { color: "#a99e90", fontSize: 9, lineHeight: 13, marginTop: 4 },
  nameInput: { width: 196, height: 37, borderWidth: 1, borderColor: "rgba(232,191,102,0.27)", borderRadius: 4, paddingHorizontal: 10, color: "#f3e4cf", backgroundColor: "#171614", fontSize: 12, outlineStyle: "none" } as object,
  nameInputCompact: { width: "100%" },
  usageRow: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 19, paddingVertical: 8, borderTopWidth: 1, borderColor: "rgba(240,226,204,0.08)" },
  usageColumn: { alignItems: "flex-start", flexDirection: "column", paddingHorizontal: 13 },
  usageCopy: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, flex: 1 },
  usageText: { color: "#d8cbb8", fontSize: 9, fontWeight: "800" },
  usageSubtext: { color: "#928779", fontSize: 8 },
  captionToggle: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
  captionLabel: { color: "#a99e90", fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  captionLabelActive: { color: "#e7c77f" },
  mutedNotice: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 13, marginBottom: 8, padding: 9, borderWidth: 1, borderColor: "rgba(232,191,102,0.17)", borderRadius: 4, backgroundColor: "rgba(232,191,102,0.05)" },
  mutedText: { flex: 1, color: "#c7bba9", fontSize: 9, lineHeight: 13 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 13, marginBottom: 8, padding: 9, borderWidth: 1, borderColor: "rgba(230,91,72,0.34)", borderRadius: 4, backgroundColor: "rgba(153,55,45,0.12)" },
  errorText: { flex: 1, color: "#f1b4a7", fontSize: 10, lineHeight: 14 },
  captionBox: { marginHorizontal: 13, marginBottom: 8, padding: 10, borderLeftWidth: 2, borderLeftColor: "#e8bf66", backgroundColor: "rgba(232,191,102,0.06)" },
  captionEyebrow: { color: "#e8bf66", fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  captionText: { color: "#e8dfd3", fontFamily: "PlayfairDisplay_700Bold", fontSize: 12, lineHeight: 18, marginTop: 5 },
  footnote: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingHorizontal: 19, paddingTop: 7, paddingBottom: 12 },
  footnoteText: { flex: 1, color: "#9e9487", fontSize: 8, lineHeight: 12 },
  disabled: { opacity: 0.46 },
  pressed: { opacity: 0.75 },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 17, paddingVertical: 24, backgroundColor: "rgba(10,9,8,0.78)" },
  dialog: { width: "100%", maxWidth: 520, maxHeight: "82%", borderWidth: 1, borderColor: "rgba(232,191,102,0.27)", borderRadius: 9, padding: 16, backgroundColor: "#211f1c" },
  dialogHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dialogTitle: { color: "#f5eee3", fontFamily: "PlayfairDisplay_700Bold", fontSize: 22, marginTop: 4 },
  closeButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(240,226,204,0.16)", borderRadius: 17 },
  dialogHint: { color: "#a99e90", fontSize: 10, marginTop: 7, marginBottom: 11 },
  roster: { flexGrow: 0 },
  rosterContent: { gap: 6, paddingBottom: 3 },
  rosterChoice: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderWidth: 1, borderColor: "rgba(240,226,204,0.11)", borderRadius: 5, backgroundColor: "#292521" },
  rosterChoiceSelected: { borderColor: "rgba(232,191,102,0.57)", backgroundColor: "rgba(232,191,102,0.07)" },
  rosterPortrait: { width: 40, height: 46, borderRadius: 3, backgroundColor: "#332c26" },
  rosterCopy: { flex: 1, minWidth: 0 },
  rosterName: { color: "#f3e4cf", fontSize: 11, fontWeight: "800" },
  rosterPitch: { color: "#aa9f91", fontSize: 9, lineHeight: 13, marginTop: 3 },
  radioMark: { width: 18, height: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#968a78", borderRadius: 9 },
  radioMarkSelected: { borderColor: "#e8bf66" },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e8bf66" },
});