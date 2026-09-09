import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions, type DimensionValue } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type ThreePointOutcome = "swish" | "rim" | "airball";

export interface ThreePointResult {
  outcome: ThreePointOutcome;
  netWorthBonus: number;
}

interface ThreePointMiniGameProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (result: ThreePointResult) => void;
}

const COURT_WIDTH = Math.min(SCREEN_WIDTH - 72, 280);
const COURT_HEIGHT = 380;
const BALL_RADIUS = 12;
const HOOP_WIDTH = 54;
const HOOP_HEIGHT = 30;

// Unlike the putting green's two-step drag-to-aim-then-tap-power flow, the shot here is a
// single continuous mechanic: one marker sweeps back and forth along a timing bar and the
// player's ONE tap both picks the release moment and the shot's left/right landing spot at
// once. There is no separate aim phase.
const SWEEP_PERIOD_MS = 850;
const SWISH_TOLERANCE = 0.055;
const RIM_TOLERANCE = 0.16;

// Reward tiers mirror the putting mini-game's pattern exactly: small relative to a scenario
// turn's own profit swings (see server/billionaire-game-validation.ts) so this bonus round can
// never substitute for playing turns or push a run across the $1B win threshold on its own —
// GameScreen also clamps the applied bonus so it can never cross that line.
//
// Net-worth only, never karma: the server's anti-cheat bounds a submission's total karma per
// scenario turn (BILLIONAIRE_MAX_KARMA_PER_CHOICE in server/billionaire-game-validation.ts),
// and that bound only accounts for scenario choices, so a karma nudge here could push an
// otherwise-legitimate run over the line and get it rejected on submission.
const REWARD: Record<ThreePointOutcome, { netWorthBonus: number; title: string; subtitle: string; color: string }> = {
  swish: { netWorthBonus: 4_000_000, title: "SWISH!", subtitle: "Nothing but net — bonus deal flow incoming", color: "#22C55E" },
  rim: { netWorthBonus: 1_250_000, title: "RIMMED IN!", subtitle: "Bounced around and dropped — small bonus", color: Colors.gold },
  airball: { netWorthBonus: 0, title: "AIRBALL", subtitle: "Way off — back to business", color: "#8A8A8A" },
};

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function ThreePointMiniGame({ visible, onClose, onComplete }: ThreePointMiniGameProps) {
  const [phase, setPhase] = useState<"timing" | "flight" | "result">("timing");
  const [meterValue, setMeterValue] = useState(0); // 0..1, sweeps back and forth
  const [targetCenter, setTargetCenter] = useState(0.5);
  const [outcome, setOutcome] = useState<ThreePointOutcome | null>(null);

  const sweepRAF = useRef<number | null>(null);
  const sweepDirection = useRef(1);
  const meterValueRef = useRef(0);

  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  const ballScale = useSharedValue(1);
  const ballRotation = useSharedValue(0);
  const netFlash = useSharedValue(0);

  const resetRound = useCallback(() => {
    setPhase("timing");
    setOutcome(null);
    setTargetCenter(randRange(0.3, 0.7));
    meterValueRef.current = 0;
    sweepDirection.current = 1;
    setMeterValue(0);
    ballX.value = 0;
    ballY.value = 0;
    ballScale.value = 1;
    ballRotation.value = 0;
    netFlash.value = 0;
  }, [ballX, ballY, ballScale, ballRotation, netFlash]);

  useEffect(() => {
    if (visible) resetRound();
    return () => {
      if (sweepRAF.current) cancelAnimationFrame(sweepRAF.current);
    };
  }, [visible, resetRound]);

  // Continuous sweep 0 -> 1 -> 0; tapping SHOOT locks whatever value the marker holds at that
  // instant. This single value drives BOTH the shot timing and the ball's left/right landing
  // spot — there's nothing to aim beforehand.
  useEffect(() => {
    // Also gated on `visible`: the overlay is always mounted by GameScreen so it can animate in
    // on open, so the RAF loop must never run while it's hidden (initial mount, or after
    // close/complete) or it would keep re-rendering at ~60Hz in the background for the whole
    // scenario loop.
    if (!visible || phase !== "timing") return;
    let last = Date.now();
    const step = () => {
      const now = Date.now();
      const dt = now - last;
      last = now;
      meterValueRef.current += (dt / SWEEP_PERIOD_MS) * sweepDirection.current;
      if (meterValueRef.current >= 1) {
        meterValueRef.current = 1;
        sweepDirection.current = -1;
      } else if (meterValueRef.current <= 0) {
        meterValueRef.current = 0;
        sweepDirection.current = 1;
      }
      setMeterValue(meterValueRef.current);
      sweepRAF.current = requestAnimationFrame(step);
    };
    sweepRAF.current = requestAnimationFrame(step);
    return () => {
      if (sweepRAF.current) cancelAnimationFrame(sweepRAF.current);
    };
  }, [visible, phase]);

  const shoot = useCallback(() => {
    if (phase !== "timing") return;
    if (sweepRAF.current) cancelAnimationFrame(sweepRAF.current);
    const locked = meterValueRef.current;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPhase("flight");

    const trackHalf = (COURT_WIDTH - BALL_RADIUS * 2) / 2;
    // Landing exactly under the hoop (x = 0) requires locking the meter at targetCenter — a
    // shifting "sweet spot" (defender/wind) rather than a fixed center, so the sweep must be
    // read and timed fresh each round.
    const landX = interpolate(locked, [0, targetCenter, 1], [-trackHalf, 0, trackHalf], Extrapolate.CLAMP);
    const deviation = Math.abs(locked - targetCenter);

    ballX.value = withTiming(landX, { duration: 620 });
    ballY.value = withSequence(
      withTiming(-(COURT_HEIGHT - 70), { duration: 380 }),
      withTiming(-(COURT_HEIGHT - 96), { duration: 240 })
    );
    ballScale.value = withTiming(0.62, { duration: 620 });
    ballRotation.value = withTiming(720, { duration: 620 });

    setTimeout(() => {
      let result: ThreePointOutcome;
      if (deviation <= SWISH_TOLERANCE) result = "swish";
      else if (deviation <= RIM_TOLERANCE) result = "rim";
      else result = "airball";
      setOutcome(result);
      setPhase("result");
      if (result === "swish") {
        netFlash.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 260 }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (result === "rim") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    }, 640);
  }, [phase, targetCenter, ballX, ballY, ballScale, ballRotation, netFlash]);

  const finish = useCallback(() => {
    if (!outcome) return;
    const reward = REWARD[outcome];
    onComplete({ outcome, netWorthBonus: reward.netWorthBonus });
  }, [outcome, onComplete]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ballX.value },
      { translateY: ballY.value },
      { scale: ballScale.value },
      { rotate: `${ballRotation.value}deg` },
    ],
  }));

  const netFlashStyle = useAnimatedStyle(() => ({
    opacity: netFlash.value,
  }));

  if (!visible) return null;

  const hoopLeft = COURT_WIDTH / 2 - HOOP_WIDTH / 2;
  const targetMarkerLeft = `${targetCenter * 100}%` as DimensionValue;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>🏀 BONUS 3-POINTER</Text>
          {phase !== "flight" && (
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} testID="threepoint-close">
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          )}
        </View>
        <Text style={styles.subtitle}>
          {phase === "timing" && "Tap SHOOT when the marker lines up with the target"}
          {phase === "flight" && "..."}
          {phase === "result" && REWARD[outcome ?? "airball"].subtitle}
        </Text>

        <View style={styles.court}>
          <LinearGradient colors={["#5b2a0f", "#7a3a14", "#5b2a0f"]} style={StyleSheet.absoluteFillObject} />
          {[...Array(6)].map((_, i) => (
            <View key={i} style={[styles.plank, { left: (i * COURT_WIDTH) / 6 }]} />
          ))}

          <View style={[styles.hoop, { left: hoopLeft }]}>
            <View style={styles.backboard} />
            <View style={styles.rim} />
            <Animated.View pointerEvents="none" style={[styles.netFlash, netFlashStyle]} />
          </View>

          <View style={styles.ballAnchor}>
            <Animated.View style={[styles.ball, ballStyle]} />
          </View>
        </View>

        {phase === "timing" && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ width: "100%" }}>
            <View style={styles.timingTrack}>
              <View style={[styles.timingTarget, { left: targetMarkerLeft }]} />
              <View style={[styles.timingMarker, { left: `${meterValue * 100}%` }]} />
            </View>
            <Pressable onPress={shoot} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]}>
              <LinearGradient colors={["#EA580C", "#9A3412"]} style={styles.actionBtnGradient}>
                <Text style={styles.actionBtnText}>SHOOT!</Text>
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
  court: {
    width: COURT_WIDTH,
    height: COURT_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
  },
  plank: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(0,0,0,0.08)" },
  hoop: { position: "absolute", top: 26, width: HOOP_WIDTH, alignItems: "center" },
  backboard: { width: HOOP_WIDTH, height: HOOP_HEIGHT, backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 3 },
  rim: {
    width: HOOP_WIDTH * 0.6,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EA580C",
    marginTop: -4,
  },
  netFlash: {
    position: "absolute",
    top: HOOP_HEIGHT - 6,
    width: HOOP_WIDTH * 0.6,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  ballAnchor: { position: "absolute", left: COURT_WIDTH / 2 - BALL_RADIUS, bottom: 36, alignItems: "center" },
  ball: {
    width: BALL_RADIUS * 2,
    height: BALL_RADIUS * 2,
    borderRadius: BALL_RADIUS,
    backgroundColor: "#D97706",
    borderWidth: 2,
    borderColor: "#3F2A0A",
  },
  timingTrack: {
    width: "100%",
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "visible",
    marginBottom: 4,
    position: "relative",
  },
  timingTarget: {
    position: "absolute",
    top: -3,
    width: 26,
    height: 24,
    marginLeft: -13,
    borderRadius: 6,
    backgroundColor: "rgba(34,197,94,0.35)",
    borderWidth: 2,
    borderColor: "#22C55E",
  },
  timingMarker: {
    position: "absolute",
    top: -3,
    width: 4,
    height: 24,
    marginLeft: -2,
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  actionBtn: { width: "100%", borderRadius: 14, overflow: "hidden", marginTop: 6 },
  actionBtnGradient: { paddingVertical: 14, alignItems: "center" },
  actionBtnText: { color: "#000", fontWeight: "900", fontSize: 15, letterSpacing: 0.5 },
  resultTitle: { fontSize: 24, fontWeight: "900", marginBottom: 6 },
  resultBonus: { color: Colors.gold, fontSize: 15, fontWeight: "800", marginBottom: 2 },
  resultKarma: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 10 },
});
