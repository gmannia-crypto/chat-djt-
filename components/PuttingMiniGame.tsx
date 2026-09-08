import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, PanResponder, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type PuttOutcome = "hole" | "near" | "miss";

export interface PuttingResult {
  outcome: PuttOutcome;
  netWorthBonus: number;
}

interface PuttingMiniGameProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (result: PuttingResult) => void;
}

const COURSE_WIDTH = Math.min(SCREEN_WIDTH - 72, 280);
const COURSE_HEIGHT = 380;
const BALL_RADIUS = 12;
const HOLE_RADIUS = 15;
const HOLE_IN_TOLERANCE = HOLE_RADIUS + 4;
const NEAR_TOLERANCE = HOLE_RADIUS + 42;

// Both the ball's start anchor and the hole are positioned via `bottom` in the same course box,
// so "distance up from the anchor" is one shared coordinate system used for the hole's on-screen
// position AND the flight-scoring math below — they must never drift apart, or a shot that
// visually lands on the hole can score as a miss (or vice versa).
const COURSE_PAD_BOTTOM = 40; // ball's start distance from the bottom of the course
const COURSE_PAD_TOP = 30; // keeps the hole/overshoot within the course at full power
const TRAVEL_RANGE = COURSE_HEIGHT - COURSE_PAD_BOTTOM - COURSE_PAD_TOP;

// Reward tiers are intentionally small relative to the game's own per-turn profit swings
// (up to $250M pre-multiplier — see server/billionaire-game-validation.ts) so a putting streak
// can never substitute for playing scenario turns or let a game reach the $1B win threshold
// on its own. GameScreen also clamps the applied bonus so it can never cross that threshold.
//
// Rewards are net-worth only, never karma: the server's anti-cheat check bounds a submission's
// total karma at 45 per scenario turn (see BILLIONAIRE_MAX_KARMA_PER_CHOICE in
// server/billionaire-game-validation.ts), and that bound accounts only for scenario choices. A
// karma nudge here — however small — could push a legitimately-played run over that bound and
// get its result rejected on submission, so karma is left untouched.
const REWARD: Record<PuttOutcome, { netWorthBonus: number; title: string; subtitle: string; color: string }> = {
  hole: { netWorthBonus: 4_000_000, title: "SUNK IT!", subtitle: "Hole in one — bonus deal flow incoming", color: "#22C55E" },
  near: { netWorthBonus: 1_250_000, title: "SO CLOSE!", subtitle: "Lipped out — still a nice tap-in bonus", color: Colors.gold },
  miss: { netWorthBonus: 0, title: "MISSED", subtitle: "Whiffed it — back to business", color: "#8A8A8A" },
};

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function PuttingMiniGame({ visible, onClose, onComplete }: PuttingMiniGameProps) {
  const [phase, setPhase] = useState<"aim" | "power" | "flight" | "result">("aim");
  const [aimOffset, setAimOffset] = useState(0); // -1..1
  const [power, setPower] = useState(0); // 0..1
  const [holeOffsetNorm, setHoleOffsetNorm] = useState(0);
  const [holeYFrac, setHoleYFrac] = useState(0.22);
  const [idealPower, setIdealPower] = useState(0.55);
  const [outcome, setOutcome] = useState<PuttOutcome | null>(null);

  const dragStartX = useRef(0);
  const powerRAF = useRef<number | null>(null);
  const powerDirection = useRef(1);
  const powerValueRef = useRef(0);

  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  const ballScale = useSharedValue(1);

  const resetRound = useCallback(() => {
    setPhase("aim");
    setAimOffset(0);
    setPower(0);
    setOutcome(null);
    setHoleOffsetNorm(randRange(-0.55, 0.55));
    setHoleYFrac(randRange(0.35, 0.85));
    setIdealPower(randRange(0.45, 0.65));
    ballX.value = 0;
    ballY.value = 0;
    ballScale.value = 1;
    powerValueRef.current = 0;
  }, [ballX, ballY, ballScale]);

  useEffect(() => {
    if (visible) resetRound();
    return () => {
      if (powerRAF.current) cancelAnimationFrame(powerRAF.current);
    };
  }, [visible, resetRound]);

  // Timing-bar power mechanic: oscillate 0 -> 1 -> 0 while in the "power" phase; tapping PUTT
  // locks in whatever value the bar is at that instant.
  useEffect(() => {
    if (phase !== "power") return;
    let last = Date.now();
    const step = () => {
      const now = Date.now();
      const dt = now - last;
      last = now;
      powerValueRef.current += (dt / 700) * powerDirection.current;
      if (powerValueRef.current >= 1) {
        powerValueRef.current = 1;
        powerDirection.current = -1;
      } else if (powerValueRef.current <= 0) {
        powerValueRef.current = 0;
        powerDirection.current = 1;
      }
      setPower(powerValueRef.current);
      powerRAF.current = requestAnimationFrame(step);
    };
    powerRAF.current = requestAnimationFrame(step);
    return () => {
      if (powerRAF.current) cancelAnimationFrame(powerRAF.current);
    };
  }, [phase]);

  const aimPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartX.current = 0;
      },
      onPanResponderMove: (_evt, gesture) => {
        const trackHalf = (COURSE_WIDTH - BALL_RADIUS * 2) / 2;
        const next = Math.max(-1, Math.min(1, gesture.dx / trackHalf));
        setAimOffset(next);
      },
      onPanResponderRelease: () => {
        Haptics.selectionAsync().catch(() => {});
      },
    })
  ).current;

  const lockPower = useCallback(() => {
    if (phase !== "power") return;
    if (powerRAF.current) cancelAnimationFrame(powerRAF.current);
    const finalPower = powerValueRef.current;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPhase("flight");

    const trackHalf = (COURSE_WIDTH - BALL_RADIUS * 2) / 2;
    const holeX = holeOffsetNorm * trackHalf;
    // Negative translateY = up the course, toward the hole. Uses the same TRAVEL_RANGE /
    // holeYFrac the render below uses for the hole's `bottom` position, so scoring always
    // matches what's on screen.
    const holeY = -(holeYFrac * TRAVEL_RANGE);
    const maxTravel = -TRAVEL_RANGE;

    // Power maps to travel distance; idealPower lands exactly on the hole's depth.
    const travelY = interpolate(
      finalPower,
      [0, idealPower, 1],
      [-10, holeY, maxTravel],
      Extrapolate.CLAMP
    );
    const landX = aimOffset * trackHalf;

    ballX.value = withTiming(landX, { duration: 650 });
    ballY.value = withTiming(travelY, { duration: 650 });
    ballScale.value = withTiming(0.7, { duration: 650 });

    setTimeout(() => {
      const dist = Math.sqrt(Math.pow(landX - holeX, 2) + Math.pow(travelY - holeY, 2));
      let result: PuttOutcome;
      if (dist <= HOLE_IN_TOLERANCE) result = "hole";
      else if (dist <= NEAR_TOLERANCE) result = "near";
      else result = "miss";
      setOutcome(result);
      setPhase("result");
      if (result === "hole") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (result === "near") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    }, 700);
  }, [phase, aimOffset, holeOffsetNorm, holeYFrac, idealPower, ballX, ballY, ballScale]);

  const confirmAim = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    powerValueRef.current = 0;
    powerDirection.current = 1;
    setPhase("power");
  }, []);

  const finish = useCallback(() => {
    if (!outcome) return;
    const reward = REWARD[outcome];
    onComplete({ outcome, netWorthBonus: reward.netWorthBonus });
  }, [outcome, onComplete]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ballX.value }, { translateY: ballY.value }, { scale: ballScale.value }],
  }));

  if (!visible) return null;

  const trackHalf = (COURSE_WIDTH - BALL_RADIUS * 2) / 2;
  const holeLeft = COURSE_WIDTH / 2 - HOLE_RADIUS + holeOffsetNorm * trackHalf;
  // Same COURSE_PAD_BOTTOM anchor and TRAVEL_RANGE/holeYFrac used to score the shot above, so
  // the rendered hole always lines up with what "sinking it" actually means.
  const holeBottom = COURSE_PAD_BOTTOM + holeYFrac * TRAVEL_RANGE - HOLE_RADIUS;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>⛳ BONUS PUTT</Text>
          {phase !== "flight" && (
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} testID="putting-close">
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          )}
        </View>
        <Text style={styles.subtitle}>
          {phase === "aim" && "Drag left/right to line up your shot"}
          {phase === "power" && "Tap PUTT when the bar hits your power"}
          {phase === "flight" && "..."}
          {phase === "result" && REWARD[outcome ?? "miss"].subtitle}
        </Text>

        <View style={styles.course}>
          <LinearGradient colors={["#0f3d1f", "#1a5c2e", "#0f3d1f"]} style={StyleSheet.absoluteFillObject} />
          {[...Array(6)].map((_, i) => (
            <View key={i} style={[styles.stripe, { top: (i * COURSE_HEIGHT) / 6 }]} />
          ))}

          <View style={[styles.hole, { left: holeLeft, bottom: holeBottom }]}>
            <Text style={styles.flag}>⛳</Text>
          </View>

          <View style={[styles.ballAnchor, { bottom: COURSE_PAD_BOTTOM }]} {...(phase === "aim" ? aimPanResponder.panHandlers : {})}>
            <Animated.View
              style={[
                styles.ball,
                phase === "aim" ? { transform: [{ translateX: aimOffset * trackHalf }] } : ballStyle,
              ]}
            />
            {phase === "aim" && (
              <View
                pointerEvents="none"
                style={[
                  styles.aimLine,
                  { transform: [{ translateX: aimOffset * trackHalf }, { rotate: `${aimOffset * -18}deg` }] },
                ]}
              />
            )}
          </View>
        </View>

        {phase === "aim" && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ width: "100%" }}>
            <Pressable onPress={confirmAim} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]}>
              <LinearGradient colors={[Colors.gold, Colors.goldDark || "#B8860B"]} style={styles.actionBtnGradient}>
                <Text style={styles.actionBtnText}>LOCK AIM</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {phase === "power" && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ width: "100%" }}>
            <View style={styles.powerTrack}>
              <View style={[styles.powerFill, { width: `${power * 100}%` }]} />
              <View style={[styles.powerIdealMarker, { left: `${idealPower * 100}%` }]} />
            </View>
            <Pressable onPress={lockPower} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]}>
              <LinearGradient colors={["#22C55E", "#16A34A"]} style={styles.actionBtnGradient}>
                <Text style={styles.actionBtnText}>PUTT!</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {phase === "result" && outcome && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ width: "100%", alignItems: "center" }}>
            <Text style={[styles.resultTitle, { color: REWARD[outcome].color }]}>{REWARD[outcome].title}</Text>
            {REWARD[outcome].netWorthBonus > 0 ? (
              <Text style={styles.resultBonus}>+${(REWARD[outcome].netWorthBonus / 1_000_000).toFixed(1)}M net worth</Text>
            ) : (
              <Text style={styles.resultKarma}>No bonus this time</Text>
            )}
            <Pressable onPress={finish} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]}>
              <LinearGradient colors={[Colors.gold, Colors.goldDark || "#B8860B"]} style={styles.actionBtnGradient}>
                <Text style={styles.actionBtnText}>CONTINUE</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#0a0a14",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
    padding: 18,
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  headerTitle: { color: Colors.gold, fontSize: 16, fontWeight: "900" },
  closeBtn: { padding: 4 },
  subtitle: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 4, marginBottom: 14, textAlign: "center" },
  course: {
    width: COURSE_WIDTH,
    height: COURSE_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
  },
  stripe: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.04)" },
  hole: { position: "absolute", width: HOLE_RADIUS * 2, height: HOLE_RADIUS * 2, alignItems: "center", justifyContent: "center" },
  flag: { fontSize: HOLE_RADIUS * 2 },
  ballAnchor: { position: "absolute", left: COURSE_WIDTH / 2 - BALL_RADIUS, alignItems: "center" },
  ball: {
    width: BALL_RADIUS * 2,
    height: BALL_RADIUS * 2,
    borderRadius: BALL_RADIUS,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.2)",
  },
  aimLine: {
    position: "absolute",
    bottom: BALL_RADIUS * 2 + 4,
    width: 2,
    height: 90,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  actionBtn: { width: "100%", borderRadius: 14, overflow: "hidden", marginTop: 6 },
  actionBtnGradient: { paddingVertical: 14, alignItems: "center" },
  actionBtnText: { color: "#000", fontWeight: "900", fontSize: 15, letterSpacing: 0.5 },
  powerTrack: {
    width: "100%",
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    marginBottom: 4,
    position: "relative",
  },
  powerFill: { height: "100%", backgroundColor: Colors.gold },
  powerIdealMarker: {
    position: "absolute",
    top: -3,
    width: 4,
    height: 24,
    backgroundColor: "#22C55E",
    borderRadius: 2,
  },
  resultTitle: { fontSize: 24, fontWeight: "900", marginBottom: 6 },
  resultBonus: { color: Colors.gold, fontSize: 15, fontWeight: "800", marginBottom: 2 },
  resultKarma: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 10 },
});
