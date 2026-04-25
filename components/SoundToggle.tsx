import React from "react";
import { Pressable, Text, StyleSheet, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSound } from "@/lib/sound-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

export function SoundToggle() {
  const { soundEnabled, toggleSound } = useSound();

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.row}>
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
        <Pressable
          testID="open-voice-mixer"
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/voice-mixer");
          }}
          style={({ pressed }) => [
            styles.mixerBtn,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={6}
        >
          <Ionicons name="options" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 54 : 20,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ff4d4d",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
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
  mixerBtn: {
    backgroundColor: "#1a1a1a",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
