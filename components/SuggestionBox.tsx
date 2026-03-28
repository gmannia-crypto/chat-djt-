import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";
import { useTokens } from "@/lib/token-context";

export function SuggestionBox() {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { deviceId } = useTokens();

  async function handleSubmit() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(new URL("/api/suggestions", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, name: name.trim() || "Anonymous", message: message.trim() }),
      });
      if (res.ok) {
        setSent(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          setVisible(false);
          setSent(false);
          setName("");
          setMessage("");
        }, 2000);
      } else {
        Alert.alert("Error", "Failed to send. Please try again.");
      }
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={() => {
          setVisible(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="chatbox-ellipses" size={16} color="#fff" />
        <Text style={styles.fabText}>Suggest</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.card}>
            {sent ? (
              <View style={styles.sentContainer}>
                <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                <Text style={styles.sentText}>Thank you for your suggestion!</Text>
              </View>
            ) : (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>Suggestion Box</Text>
                  <Pressable onPress={() => setVisible(false)} style={styles.closeBtn}>
                    <Ionicons name="close" size={22} color="#999" />
                  </Pressable>
                </View>
                <Text style={styles.subtitle}>Tell us what features you'd like to see or how we can improve</Text>

                <Text style={styles.label}>Your Name (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Anonymous"
                  placeholderTextColor="#555"
                  value={name}
                  onChangeText={setName}
                  maxLength={50}
                />

                <Text style={styles.label}>Your Suggestion</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="I'd love to see..."
                  placeholderTextColor="#555"
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />

                <Pressable
                  onPress={handleSubmit}
                  disabled={sending || !message.trim()}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    (!message.trim() || sending) && styles.submitBtnDisabled,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator color="#0a0a0a" size="small" />
                  ) : (
                    <Text style={styles.submitText}>Send Suggestion</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 54 : 20,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2196F3",
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
  fabText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700" as const,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#1a1a2e",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "rgba(33,150,243,0.2)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: "#fff",
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#aaa",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0d0d1a",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 16,
  },
  textArea: {
    minHeight: 120,
  },
  submitBtn: {
    backgroundColor: "#2196F3",
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  sentContainer: {
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  sentText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700" as const,
    textAlign: "center",
  },
});
