import React from "react";
import { View, Text, Image, Pressable, Linking, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const CASHAPP_URL = "https://cash.app/$CrypyoG";
const QR_URL = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fcash.app%2F%24CrypyoG&bgcolor=0a0a0a&color=FFD700&margin=4";

export function CashAppDonate() {
  return (
    <Pressable
      onPress={() => Linking.openURL(CASHAPP_URL)}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.header}>
        <Ionicons name="heart" size={14} color="#00D632" />
        <Text style={styles.headerText}>SUPPORT THE CREATOR</Text>
        <Ionicons name="heart" size={14} color="#00D632" />
      </View>
      <View style={styles.body}>
        <Image
          source={{ uri: QR_URL }}
          style={styles.qr}
          resizeMode="contain"
        />
        <View style={styles.info}>
          <Text style={styles.label}>Donate via CashApp</Text>
          <View style={styles.handleRow}>
            <Text style={styles.handle}>$CrypyoG</Text>
          </View>
          <Text style={styles.sub}>Scan QR or tap to open CashApp</Text>
          <View style={styles.cta}>
            <Ionicons name="logo-usd" size={12} color="#000" />
            <Text style={styles.ctaText}>SEND A TIP</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#00D632",
    backgroundColor: "rgba(0,214,50,0.06)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,214,50,0.2)",
    backgroundColor: "rgba(0,214,50,0.08)",
  },
  headerText: {
    color: "#00D632",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 14,
  },
  qr: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,214,50,0.3)",
    backgroundColor: "#0a0a0a",
  },
  info: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "600",
  },
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  handle: {
    color: "#00D632",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  sub: {
    color: "#666",
    fontSize: 10,
    marginTop: 2,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#00D632",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  ctaText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
