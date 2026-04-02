import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { SlideInRight, SlideOutRight, FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEngagement } from "@/lib/engagement-context";

export function StreakToast() {
  const { streak, showStreakToast, dismissStreakToast, newBadge, dismissNewBadge } = useEngagement();
  const insets = useSafeAreaInsets();

  return (
    <>
      {showStreakToast && (
        <Animated.View
          entering={SlideInRight.duration(300)}
          exiting={SlideOutRight.duration(300)}
          style={[styles.toast, { top: insets.top + 12 }]}
        >
          <Pressable onPress={dismissStreakToast} style={styles.toastInner}>
            <Text style={styles.toastEmoji}>🔥</Text>
            <View>
              <Text style={styles.toastTitle}>{streak} DAY STREAK!</Text>
              <Text style={styles.toastSub}>Come back tomorrow for {streak + 1}!</Text>
            </View>
            <Text style={styles.toastEmoji}>🔥</Text>
          </Pressable>
        </Animated.View>
      )}

      {newBadge && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(300)}
          style={[styles.badgeToast, { top: insets.top + (showStreakToast ? 72 : 12) }]}
        >
          <Pressable onPress={dismissNewBadge} style={styles.toastInner}>
            <Text style={styles.badgeIcon}>{newBadge.icon}</Text>
            <View>
              <Text style={styles.badgeTitle}>BADGE UNLOCKED!</Text>
              <Text style={styles.badgeLabel}>{newBadge.label}</Text>
            </View>
            <Text style={styles.badgeIcon}>🏆</Text>
          </Pressable>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    right: 12,
    backgroundColor: "#CC3333",
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 10,
    zIndex: 30000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  toastInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toastEmoji: {
    fontSize: 18,
  },
  toastTitle: {
    color: "#fff",
    fontWeight: "800" as const,
    fontSize: 14,
  },
  toastSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
  },
  badgeToast: {
    position: "absolute",
    right: 12,
    backgroundColor: "#D4A420",
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 10,
    zIndex: 30000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  badgeIcon: {
    fontSize: 18,
  },
  badgeTitle: {
    color: "#000",
    fontWeight: "800" as const,
    fontSize: 14,
  },
  badgeLabel: {
    color: "rgba(0,0,0,0.7)",
    fontSize: 11,
    fontWeight: "600" as const,
  },
});
