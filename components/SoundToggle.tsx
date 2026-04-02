import React from "react";
import { Pressable, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSound } from "@/lib/sound-context";
import * as Haptics from "expo-haptics";

export function SoundToggle() {
  const { soundEnabled, toggleSound } = useSound();

  return (
    <Pressable
      onPress={() => {
        toggleSound();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      style={({ pressed }) => [
        styles.btn,
        !soundEnabled && styles.btnOff,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons
        name={soundEnabled ? "volume-high" : "volume-mute"}
        size={16}
        color="#fff"
      />
      <Text style={styles.text}>
        {soundEnabled ? "Sound On" : "Sound Off"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 54 : 20,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ff4d4d",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  btnOff: {
    backgroundColor: "#666",
  },
  text: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700" as const,
  },
});
