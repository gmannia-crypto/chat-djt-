import React, { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type Props = {
  visible: boolean;
  /** Tooltip sits below the title by default; use "above" when there isn't room underneath. */
  placement?: "below" | "above";
};

/**
 * One-time discovery hint for the header-title long-press → Settings shortcut.
 * Pairs a brief pulsing underline on the title with a small tooltip bubble.
 * Caller supplies `visible` (e.g. from useFirstRunHint) so it only ever shows
 * once per device and leaves no clutter behind afterward.
 */
export default function HeaderSettingsHint({ visible, placement = "below" }: Props) {
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    if (visible) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 650, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.35, { duration: 650, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [visible, pulse]);

  const underlineStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (!visible) return null;

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.underline, underlineStyle]} />
      <Animated.View
        entering={FadeIn.duration(400)}
        exiting={FadeOut.duration(400)}
        pointerEvents="none"
        style={[styles.tooltip, placement === "above" ? styles.tooltipAbove : styles.tooltipBelow]}
      >
        <Text style={styles.tooltipIcon}>👆</Text>
        <Text style={styles.tooltipText}>Long-press for Settings</Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  underline: {
    position: "absolute",
    bottom: -3,
    left: "18%",
    right: "18%",
    height: 2,
    borderRadius: 1,
    backgroundColor: "#FFD700",
  },
  tooltip: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.9)",
    borderWidth: 1.5,
    borderColor: "rgba(255,215,0,0.55)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 999,
  },
  tooltipBelow: { top: "100%", marginTop: 8 },
  tooltipAbove: { bottom: "100%", marginBottom: 8 },
  tooltipIcon: { fontSize: 12 },
  tooltipText: { color: "#FFD700", fontSize: 10, fontWeight: "800" as const, letterSpacing: 0.2 },
});
