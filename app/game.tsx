import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <Text style={styles.title}>Game Loading...</Text>
      <Pressable onPress={() => router.back()} style={styles.btn}>
        <Text style={styles.btnText}>Go Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center" },
  title: { color: "#D4A420", fontSize: 24, fontWeight: "bold" },
  btn: { marginTop: 20, padding: 12, backgroundColor: "#D4A420", borderRadius: 8 },
  btnText: { color: "#000", fontWeight: "bold" },
});
