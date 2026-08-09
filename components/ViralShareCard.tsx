import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { shareContent } from "@/lib/track-share";

type Category = "sports" | "realestate" | "game" | "faceoff";

const CATEGORY_CONFIG: Record<Category, { emoji: string; label: string; color: string }> = {
  sports: { emoji: "\uD83C\uDFC8", label: "Sports", color: "#ff4d4d" },
  realestate: { emoji: "\uD83C\uDFE0", label: "Real Estate", color: "#D4AF37" },
  game: { emoji: "\uD83C\uDFAE", label: "Game", color: "#9333EA" },
  faceoff: { emoji: "\u2694\uFE0F", label: "Faceoff", color: "#2563EB" },
};

interface ViralShareCardProps {
  visible: boolean;
  onClose: () => void;
  category: Category;
  headline: string;
  quote: string;
  subtext?: string;
}

export function ViralShareCard({ visible, onClose, category, headline, quote, subtext }: ViralShareCardProps) {
  const config = CATEGORY_CONFIG[category];

  const handleShareX = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const text = `${headline} - ${quote.substring(0, 80)}... Get yours at thearena.rip`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      import("expo-linking").then(L => L.openURL(url));
    }
  };

  const handleCopy = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    shareContent({
      text: `${headline}\n${quote}\n\nGet yours at thearena.rip`,
      feature: category,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.cardOuter} onPress={e => e.stopPropagation()}>
          <LinearGradient colors={["#1a1a1a", "#2d2d2d"]} style={s.card}>
            <View style={[s.badge, { backgroundColor: config.color }]}>
              <Text style={s.badgeText}>{config.emoji} {config.label}</Text>
            </View>

            <Text style={[s.headline, { color: config.color }]}>{headline}</Text>

            <View style={s.quoteBox}>
              <Text style={s.quoteText}>"{quote.length > 150 ? quote.substring(0, 150) + "..." : quote}"</Text>
            </View>

            {subtext && <Text style={s.subtext}>{subtext}</Text>}

            <Text style={s.brand}>— The Arena</Text>

            <View style={s.btnRow}>
              <Pressable onPress={handleShareX} style={({ pressed }) => [s.shareBtn, { backgroundColor: "#1DA1F2" }, pressed && { opacity: 0.8 }]}>
                <Text style={s.shareBtnText}>Share on X</Text>
              </Pressable>
              <Pressable onPress={handleCopy} style={({ pressed }) => [s.shareBtn, { backgroundColor: config.color }, pressed && { opacity: 0.8 }]}>
                <Ionicons name="copy-outline" size={14} color="#fff" />
                <Text style={s.shareBtnText}> Copy</Text>
              </Pressable>
            </View>

            <Pressable onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeBtnText}>Close</Text>
            </Pressable>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  cardOuter: {
    width: "100%",
    maxWidth: 400,
  },
  card: {
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#ff4d4d",
    padding: 25,
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "800",
  },
  headline: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  quoteBox: {
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 15,
    marginVertical: 10,
    width: "100%",
  },
  quoteText: {
    color: "#fff",
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
  },
  subtext: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    marginTop: 4,
  },
  brand: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginVertical: 8,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
  },
  shareBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  closeBtn: {
    marginTop: 15,
    padding: 8,
  },
  closeBtnText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },
});
