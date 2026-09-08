import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useTokens } from "@/lib/token-context";

export function SaveChatsModal() {
  const { showSaveModal, dismissSaveModal, requestVerificationCode, verifyAccount } = useTokens();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [bonusGranted, setBonusGranted] = useState(false);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!codeSent) {
        await requestVerificationCode(name.trim(), email.trim());
        setCodeSent(true);
        return;
      }
      if (!/^\d{6}$/.test(code.trim())) {
        setError("Enter the 6-digit code from your email.");
        return;
      }
      const result = await verifyAccount(email.trim(), code.trim());
      setBonusGranted(result.bonusGranted);
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismissSaveModal();
    router.push("/subscribe");
  }

  function handleClose() {
    dismissSaveModal();
    if (!success) {
      setCodeSent(false);
      setCode("");
      setError(null);
    }
  }

  if (!showSaveModal) return null;

  return (
    <Modal
      visible={showSaveModal}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
          {/* Close button */}
          <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={20} color="#666" />
          </Pressable>

          {success ? (
            /* ── Success State ── */
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={52} color="#4ADE80" />
              </View>
              <Text style={styles.successTitle}>You're in!</Text>
              {bonusGranted && (
                <View style={styles.bonusPill}>
                  <MaterialCommunityIcons name="lightning-bolt" size={14} color="#000" />
                  <Text style={styles.bonusPillText}>+5 tokens added to your wallet</Text>
                </View>
              )}
              <Text style={styles.successSub}>
                Your chats are saved. We'll send you smart updates at {email}.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={handleClose}>
                <Text style={styles.primaryBtnText}>Keep Chatting</Text>
              </Pressable>
            </View>
          ) : (
            /* ── Form State ── */
            <>
              {/* Icon + heading */}
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="content-save-outline" size={32} color={Colors.gold} />
              </View>
              <Text style={styles.headline}>Save Your Conversation</Text>
              <Text style={styles.sub}>
                {codeSent
                  ? `We sent a 6-digit code to ${email}. Enter it below to verify your account.`
                  : <>Your 15 free tokens are up.{"\n"}Sign up in 10 seconds — get{" "}<Text style={styles.bonusHighlight}>5 bonus tokens</Text> and keep your chat history.</>}
              </Text>

              {/* Value props */}
              <View style={styles.props}>
                {[
                  { icon: "history", label: "Chat history saved across sessions" },
                  { icon: "lightning-bolt", label: "5 bonus tokens on sign-up" },
                  { icon: "bell-ring-outline", label: "Smart deal alerts by email" },
                ].map((p) => (
                  <View key={p.icon} style={styles.propRow}>
                    <MaterialCommunityIcons name={p.icon as any} size={15} color={Colors.gold} />
                    <Text style={styles.propText}>{p.label}</Text>
                  </View>
                ))}
              </View>

              {/* Form */}
              <TextInput
                style={styles.input}
                placeholder="Your name (optional)"
                placeholderTextColor="#555"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#555"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!codeSent}
              />
              {codeSent && (
                <TextInput
                  style={styles.input}
                  placeholder="6-digit verification code"
                  placeholderTextColor="#555"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#000" size="small" />
                  : (
                    <View style={styles.primaryBtnInner}>
                      <MaterialCommunityIcons name="lightning-bolt" size={16} color="#000" />
                      <Text style={styles.primaryBtnText}>{codeSent ? "Verify & Save" : "Email Me a Code"}</Text>
                    </View>
                  )
                }
              </Pressable>

              {/* Social stubs */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign in with</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                {[
                  { icon: "logo-google", label: "Google", color: "#DB4437" },
                  { icon: "logo-apple", label: "Apple", color: "#fff" },
                  { icon: "logo-twitter", label: "X", color: "#1DA1F2" },
                ].map((s) => (
                  <Pressable
                    key={s.label}
                    style={styles.socialBtn}
                    onPress={() => setError("Social login coming soon — use email for now.")}
                  >
                    <Ionicons name={s.icon as any} size={20} color={s.color} />
                    <Text style={styles.socialLabel}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Skip */}
              <Pressable style={styles.skipBtn} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip — buy tokens instead</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#111",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(212,164,32,0.25)",
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(212,164,32,0.1)",
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    alignSelf: "center",
  },
  headline: {
    fontSize: 22,
    fontWeight: "900" as const,
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  bonusHighlight: {
    color: Colors.gold,
    fontWeight: "800" as const,
  },
  props: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  propRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  propText: {
    fontSize: 13,
    color: "#ccc",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#fff",
    marginBottom: 10,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    minHeight: 50,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  primaryBtnText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "900" as const,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dividerText: {
    fontSize: 11,
    color: "#555",
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingVertical: 11,
  },
  socialLabel: {
    fontSize: 12,
    color: "#ccc",
    fontWeight: "600" as const,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 12,
    color: "#555",
    textDecorationLine: "underline",
  },
  // Success state
  successContainer: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },
  successIcon: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "900" as const,
    color: "#fff",
    marginBottom: 10,
  },
  bonusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.gold,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
  },
  bonusPillText: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "#000",
  },
  successSub: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
});
