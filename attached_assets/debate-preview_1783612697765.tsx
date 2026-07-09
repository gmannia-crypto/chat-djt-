/**
 * TEMPORARY TEST SCREEN — debate-preview.tsx
 * ------------------------------------------
 * Drop this in your app/ folder (so it becomes the route /debate-preview),
 * then navigate to it to SEE the AnimatedDebateFace effect working inside the
 * real app with your real images — before wiring it into faceoff/interview.
 *
 * REQUIRES (save these in assets/images/ first):
 *   persona-trump-neutral.png / -angry.png / -shocked.png
 *   persona-elon-neutral.png  / -flustered.png / -smug.png
 *
 * It cycles a scripted Trump-vs-Elon exchange so you can watch the expression
 * cross-fades, the glow, the breathing pulse, and the speaker highlight.
 * Delete this file once you're happy with the look.
 */
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import AnimatedDebateFace, { EXPRESSION_SOURCES, Mood } from "@/components/AnimatedDebateFace";

type Line = { sp: "A" | "B"; who: string; col: string; mA: Mood; mB: Mood; txt: string };

const LINES: Line[] = [
  { sp: "A", who: "Trump", col: "#FFD34D", mA: "angry",   mB: "flustered", txt: "Nobody's built a better rocket than me, Elon. Tremendous rockets. I could've done it faster." },
  { sp: "B", who: "Elon",  col: "#5A9AFF", mA: "neutral", mB: "smug",      txt: "I... uh... I literally land them upright. That's — that's rocket science. Actual rocket science." },
  { sp: "A", who: "Trump", col: "#FFD34D", mA: "angry",   mB: "flustered", txt: "Landing? I've landed deals bigger than your little rockets. Nobody talks about that. Sad!" },
  { sp: "B", who: "Elon",  col: "#5A9AFF", mA: "shocked", mB: "flustered", txt: "That's... that doesn't even... okay, sure, a real-estate deal is exactly like orbital mechanics." },
];

export default function DebatePreview() {
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<any>(null);

  const L = LINES[cur % LINES.length];

  useEffect(() => {
    if (playing) {
      timer.current = setTimeout(() => setCur((c) => c + 1), 3200);
    }
    return () => clearTimeout(timer.current);
  }, [playing, cur]);

  // base portraits (fall back to neutral variant if you haven't set a plain one)
  const trumpBase = EXPRESSION_SOURCES.trump?.neutral;
  const elonBase = EXPRESSION_SOURCES.elon?.neutral;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, alignItems: "center" }}>
      <Text style={styles.title}>⚡ THE ARENA</Text>
      <Text style={styles.sub}>expression-swap preview · your real images</Text>

      <View style={styles.arena}>
        <View style={[styles.card, L.sp === "A" && styles.cardOn]}>
          <AnimatedDebateFace
            personaId="trump"
            baseImage={trumpBase}
            speaking={L.sp === "A"}
            mood={L.mA}
            side="left"
            size={130}
            expressionImages={EXPRESSION_SOURCES.trump}
          />
          <Text style={styles.name}>Trump</Text>
          <Text style={styles.tag}>Political</Text>
        </View>

        <View style={styles.vsWrap}><Text style={styles.vs}>VS</Text></View>

        <View style={[styles.card, L.sp === "B" && styles.cardOn]}>
          <AnimatedDebateFace
            personaId="elon"
            baseImage={elonBase}
            speaking={L.sp === "B"}
            mood={L.mB}
            side="right"
            size={130}
            expressionImages={EXPRESSION_SOURCES.elon}
          />
          <Text style={styles.name}>Elon</Text>
          <Text style={styles.tag}>Tech</Text>
        </View>
      </View>

      <View style={styles.speech}>
        <Text style={[styles.sw, { color: L.col }]}>{L.who}:</Text>
        <Text style={styles.st}>{L.txt}</Text>
      </View>

      <View style={styles.ctrls}>
        <Pressable style={[styles.btn, styles.btnPlay]} onPress={() => setPlaying((p) => !p)}>
          <Text style={styles.btnPlayTxt}>{playing ? "Pause" : "Play debate"}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => setCur((c) => c + 1)}>
          <Text style={styles.btnTxt}>Next line</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        Watch each speaker's portrait cross-fade between expressions, the ring glow by
        emotion, and the active speaker pulse. No lip-sync. Delete this screen once happy.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07070d" },
  title: { color: "#FFD34D", fontSize: 16, fontWeight: "800", letterSpacing: 2, marginTop: 8 },
  sub: { color: "#555", fontSize: 11, marginBottom: 18 },
  arena: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", marginBottom: 16 },
  card: {
    backgroundColor: "rgba(255,255,255,0.02)", borderWidth: 1, borderColor: "#1c1c26",
    borderRadius: 16, padding: 12, alignItems: "center", width: 150,
  },
  cardOn: { borderColor: "#FFD34D" },
  vsWrap: { justifyContent: "center", alignItems: "center", width: 40, paddingTop: 50 },
  vs: { color: "#FFD34D", fontWeight: "800", fontSize: 14 },
  name: { color: "#fff", fontWeight: "700", fontSize: 14, marginTop: 8 },
  tag: { color: "#888", fontSize: 10 },
  speech: {
    backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "#1c1c26",
    borderRadius: 12, padding: 12, minHeight: 70, width: "100%", marginBottom: 12,
  },
  sw: { fontWeight: "700", fontSize: 12, marginBottom: 4 },
  st: { color: "#e0e0e8", fontSize: 13, lineHeight: 19 },
  ctrls: { flexDirection: "row", gap: 8, width: "100%" },
  btn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#333", backgroundColor: "rgba(255,255,255,0.03)", alignItems: "center" },
  btnPlay: { borderColor: "#FFD34D" },
  btnPlayTxt: { color: "#FFD34D", fontWeight: "700", fontSize: 13 },
  btnTxt: { color: "#eee", fontWeight: "700", fontSize: 13 },
  note: { color: "#444", fontSize: 10, textAlign: "center", marginTop: 16, lineHeight: 15 },
});
