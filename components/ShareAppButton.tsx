import React, { useState, useMemo } from "react";
import { View, Text, Pressable, Modal, Share, ScrollView, Platform, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

const SHARE_URL = "https://thearena.rip";

type Template = {
  id: string;
  label: string;
  emoji: string;
  message: string;
};

const TEMPLATES: Template[] = [
  {
    id: "djt",
    label: "Chat with DJT",
    emoji: "🇺🇸",
    message: `I just chatted with Donald Trump on The Arena — TREMENDOUS app, the BEST! Try it 👉 ${SHARE_URL}`,
  },
  {
    id: "arena",
    label: "The Arena",
    emoji: "🥊",
    message: `Trump just DEMOLISHED the entire cabinet in a live debate on The Arena 😂 Pick your team 👉 ${SHARE_URL}/arena`,
  },
  {
    id: "sports",
    label: "Sports Picks",
    emoji: "🏈",
    message: `Trump's giving sports picks on The Arena and trash-talking like a champ 🏆 Get in 👉 ${SHARE_URL}/sports`,
  },
  {
    id: "therapy",
    label: "Therapy Session",
    emoji: "🛋️",
    message: `Got therapy from Donald J. Trump himself 💆 You won't believe what he said. Try it 👉 ${SHARE_URL}/therapy`,
  },
  {
    id: "fortune",
    label: "Fortune Teller",
    emoji: "🔮",
    message: `Trump just predicted my future on The Arena — wildly accurate 🔮 Get yours 👉 ${SHARE_URL}/fortune`,
  },
  {
    id: "realestate",
    label: "Real Estate Mogul",
    emoji: "🏢",
    message: `Trump's analyzing real estate deals on The Arena — TREMENDOUS deals only 🏢 Try it 👉 ${SHARE_URL}/real-estate`,
  },
  {
    id: "billionaires",
    label: "Billionaires Game",
    emoji: "💎",
    message: `I'm running with the billionaires on The Arena 💎 Think you got what it takes? 👉 ${SHARE_URL}/game`,
  },
  {
    id: "viral",
    label: "Just Try It",
    emoji: "🚀",
    message: `Yo you HAVE to try The Arena — chat with DJT, debate the cabinet, get sports picks. Free 👉 ${SHARE_URL}`,
  },
];

export function ShareAppButton({
  variant = "icon",
  area,
  style,
}: {
  variant?: "icon" | "pill" | "tile";
  area?: string;
  style?: any;
}) {
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const ordered = useMemo(() => {
    if (!area) return TEMPLATES;
    const idx = TEMPLATES.findIndex((t) => t.id === area);
    if (idx <= 0) return TEMPLATES;
    return [TEMPLATES[idx], ...TEMPLATES.slice(0, idx), ...TEMPLATES.slice(idx + 1)];
  }, [area]);

  const handleNativeShare = async (msg: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({ message: msg, url: SHARE_URL });
    } catch {}
  };

  const handleCopy = async (id: string, msg: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Clipboard.setStringAsync(msg);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {}
  };

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen(true);
        }}
        hitSlop={10}
        style={[
          variant === "pill" && styles.pill,
          variant === "tile" && styles.tile,
          variant === "icon" && styles.iconBtn,
          style,
        ]}
        testID="share-app-button"
      >
        {variant === "tile" ? (
          <>
            <Ionicons name="share-social" size={22} color="#FFD700" />
            <Text style={styles.tileText}>Share App</Text>
          </>
        ) : variant === "pill" ? (
          <>
            <Ionicons name="share-social" size={14} color="#FFD700" />
            <Text style={styles.pillText}>Share</Text>
          </>
        ) : (
          <Ionicons name="share-social" size={22} color="#FFD700" />
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Share The Arena</Text>
                <Text style={styles.subtitle}>Pick a template — tap to share</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {ordered.map((t) => (
                <View key={t.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardEmoji}>{t.emoji}</Text>
                    <Text style={styles.cardLabel}>{t.label}</Text>
                  </View>
                  <Text style={styles.cardMsg} numberOfLines={3}>{t.message}</Text>
                  <View style={styles.cardActions}>
                    <Pressable onPress={() => handleNativeShare(t.message)} style={[styles.actionBtn, styles.shareBtn]}>
                      <Ionicons name="share-outline" size={14} color="#000" />
                      <Text style={styles.shareBtnText}>Share</Text>
                    </Pressable>
                    <Pressable onPress={() => handleCopy(t.id, t.message)} style={[styles.actionBtn, styles.copyBtn]}>
                      <Ionicons name={copiedId === t.id ? "checkmark" : "copy-outline"} size={14} color="#FFD700" />
                      <Text style={styles.copyBtnText}>{copiedId === t.id ? "Copied" : "Copy"}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              <View style={{ height: Platform.OS === "web" ? 34 : 12 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: 1, borderColor: "rgba(255,215,0,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: 1, borderColor: "rgba(255,215,0,0.3)",
  },
  pillText: { color: "#FFD700", fontSize: 12, fontWeight: "800" as const },
  tile: {
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: 1, borderColor: "rgba(255,215,0,0.3)",
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  tileText: { color: "#FFD700", fontSize: 14, fontWeight: "800" as const },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0F0F12", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 18, borderTopWidth: 1, borderColor: "rgba(255,215,0,0.2)",
    paddingBottom: Platform.OS === "web" ? 34 : 18,
  },
  handle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  title: { color: "#fff", fontSize: 20, fontWeight: "900" as const },
  subtitle: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },

  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,215,0,0.15)",
    borderRadius: 14, padding: 12, marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  cardEmoji: { fontSize: 18 },
  cardLabel: { color: "#FFD700", fontSize: 13, fontWeight: "800" as const, letterSpacing: 0.3 },
  cardMsg: { color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10 },
  shareBtn: { backgroundColor: "#FFD700" },
  shareBtnText: { color: "#000", fontSize: 13, fontWeight: "800" as const },
  copyBtn: { backgroundColor: "rgba(255,215,0,0.1)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  copyBtnText: { color: "#FFD700", fontSize: 13, fontWeight: "700" as const },
});

export default ShareAppButton;
