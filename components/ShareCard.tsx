import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Share,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useEngagement } from "@/lib/engagement-context";

export function ShareCard() {
  const { shareCard, dismissShareCard, awardBadge } = useEngagement();
  if (!shareCard) return null;

  const shareText = `"${shareCard.quote}"\n\n- The Arena\n\nGet yours at thearena.rip`;

  async function handleNativeShare() {
    try {
      await Share.share({ message: shareText });
      awardBadge("share_first");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }

  function handleTwitter() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    Linking.openURL(url);
    awardBadge("share_first");
  }

  function handleFacebook() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://thearena.rip")}`;
    Linking.openURL(url);
    awardBadge("share_first");
  }

  async function handleCopy() {
    await Clipboard.setStringAsync(shareText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    awardBadge("share_first");
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissShareCard}>
      <Pressable style={styles.overlay} onPress={dismissShareCard}>
        <Pressable onPress={() => {}}>
          <Animated.View entering={ZoomIn.duration(300)} style={styles.card}>
            <Text style={styles.title}>{shareCard.title}</Text>

            <View style={styles.quoteBox}>
              <Text style={styles.quote}>"{shareCard.quote}"</Text>
              <Text style={styles.attribution}>- The Arena</Text>
            </View>

            <Text style={styles.shareLabel}>Share your moment!</Text>

            <View style={styles.buttonRow}>
              <Pressable onPress={handleTwitter} style={[styles.shareBtn, styles.twitterBtn]}>
                <Ionicons name="logo-twitter" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>X</Text>
              </Pressable>
              <Pressable onPress={handleFacebook} style={[styles.shareBtn, styles.facebookBtn]}>
                <Ionicons name="logo-facebook" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>Facebook</Text>
              </Pressable>
              <Pressable onPress={handleCopy} style={[styles.shareBtn, styles.copyBtn]}>
                <Ionicons name="copy" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>Copy</Text>
              </Pressable>
            </View>

            {Platform.OS !== "web" && (
              <Pressable onPress={handleNativeShare} style={styles.nativeShareBtn}>
                <Ionicons name="share-outline" size={18} color="#D4A420" />
                <Text style={styles.nativeShareText}>More Options</Text>
              </Pressable>
            )}

            <Pressable onPress={dismissShareCard} style={styles.closeBtn}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "#D4A420",
    borderRadius: 20,
    padding: 24,
    maxWidth: 420,
    width: "100%",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: "#D4A420",
    marginBottom: 12,
    textAlign: "center",
  },
  quoteBox: {
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    padding: 18,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#D4A420",
    width: "100%",
  },
  quote: {
    color: "#fff",
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 24,
  },
  attribution: {
    color: "#888",
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
  },
  shareLabel: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 8,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  shareBtnText: {
    color: "#fff",
    fontWeight: "700" as const,
    fontSize: 13,
  },
  twitterBtn: {
    backgroundColor: "#1DA1F2",
  },
  facebookBtn: {
    backgroundColor: "#4267B2",
  },
  copyBtn: {
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "#D4A420",
  },
  nativeShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(212,164,32,0.3)",
  },
  nativeShareText: {
    color: "#D4A420",
    fontWeight: "600" as const,
    fontSize: 14,
  },
  closeBtn: {
    marginTop: 14,
    paddingVertical: 8,
  },
  closeText: {
    color: "#666",
    fontSize: 14,
  },
});
