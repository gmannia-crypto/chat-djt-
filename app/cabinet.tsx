import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

interface CabinetMember {
  name: string;
  title: string;
  image: string;
  rating: number;
  reason: string;
  heat: string;
}

const RATING_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "LOYAL", color: "#22C55E", bg: "rgba(34, 197, 94, 0.15)" },
  2: { label: "SOLID", color: "#86EFAC", bg: "rgba(134, 239, 172, 0.12)" },
  3: { label: "NEUTRAL", color: "#FBBF24", bg: "rgba(251, 191, 36, 0.12)" },
  4: { label: "THIN ICE", color: "#F97316", bg: "rgba(249, 115, 22, 0.15)" },
  5: { label: "HOT SEAT", color: "#EF4444", bg: "rgba(239, 68, 68, 0.18)" },
  6: { label: "FIRED", color: "#000000", bg: "rgba(255, 255, 255, 0.08)" },
};

function getRatingConfig(rating: number) {
  return RATING_CONFIG[rating] || RATING_CONFIG[3];
}

function SatisfactionBar({ rating }: { rating: number }) {
  const config = getRatingConfig(rating);
  const isFired = rating === 6;

  return (
    <View style={styles.satisfactionContainer}>
      <View style={styles.barTrack}>
        {[1, 2, 3, 4, 5].map((level) => (
          <View
            key={level}
            style={[
              styles.barSegment,
              {
                backgroundColor: level <= rating && !isFired
                  ? getRatingConfig(level).color
                  : isFired
                    ? "#1A1A1A"
                    : "rgba(255, 255, 255, 0.08)",
              },
            ]}
          />
        ))}
      </View>
      <View style={[styles.ratingBadge, { backgroundColor: config.bg, borderColor: config.color }]}>
        <Text style={[styles.ratingLabel, { color: isFired ? "#FFFFFF" : config.color }]}>
          {config.label}
        </Text>
      </View>
    </View>
  );
}

function MemberCard({ member, index, onSpeak, isSpeaking, speakingName }: { member: CabinetMember; index: number; onSpeak: (m: CabinetMember) => void; isSpeaking: boolean; speakingName: string | null }) {
  const config = getRatingConfig(member.rating);
  const isFired = member.rating === 6;
  const isThisSpeaking = isSpeaking && speakingName === member.name;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSpeak(member);
        }}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={[styles.memberCard, isFired && styles.firedCard, isThisSpeaking && styles.speakingCard]}>
          <View style={styles.memberHeader}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberEmoji}>{member.image}</Text>
              <View style={styles.memberText}>
                <Text style={[styles.memberName, isFired && styles.firedName]}>
                  {member.name}
                </Text>
                <Text style={styles.memberTitle}>{member.title}</Text>
              </View>
            </View>
            <View style={styles.speakRow}>
              {isThisSpeaking ? (
                <ActivityIndicator size="small" color={Colors.gold} />
              ) : (
                <Ionicons name="volume-high" size={18} color={Colors.goldDim || "rgba(212,164,32,0.5)"} />
              )}
              <View style={[styles.ratingNumber, { borderColor: config.color }]}>
                <Text style={[styles.ratingNumberText, { color: isFired ? "#FFF" : config.color }]}>
                  {member.rating}
                </Text>
              </View>
            </View>
          </View>
          <SatisfactionBar rating={member.rating} />
          <Text style={[styles.memberReason, isFired && styles.firedReason]}>
            "{member.reason}"
          </Text>
          {isThisSpeaking && (
            <View style={styles.speakingBadge}>
              <Ionicons name="mic" size={12} color={Colors.gold} />
              <Text style={styles.speakingBadgeText}>Trump is speaking...</Text>
            </View>
          )}
          {!isThisSpeaking && (
            <Text style={styles.tapHint}>Tap to hear Trump's take</Text>
          )}
          {isFired && (
            <View style={styles.firedStamp}>
              <Text style={styles.firedStampText}>YOU'RE FIRED!</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function CabinetHotSeat() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const [speakingName, setSpeakingName] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["cabinet-hotseat"],
    queryFn: async () => {
      const baseUrl = getApiUrl();
      const resp = await globalThis.fetch(`${baseUrl}/api/cabinet-hotseat`);
      if (!resp.ok) throw new Error("Failed to fetch");
      return resp.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const members: CabinetMember[] = data?.members || [];
  const sorted = [...members].sort((a, b) => b.rating - a.rating);

  const handleSpeak = async (member: CabinetMember) => {
    if (speakingName) return;
    setSpeakingName(member.name);
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const baseUrl = getApiUrl();
      const speakResp = await globalThis.fetch(`${baseUrl}/api/cabinet-speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: member.name, title: member.title, rating: member.rating, reason: member.reason }),
      });
      if (!speakResp.ok) throw new Error("Failed");
      const { commentary } = await speakResp.json();
      const ttsResp = await globalThis.fetch(`${baseUrl}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commentary, mood: member.rating >= 4 ? "FIRED_UP" : "CALM" }),
      });
      if (!ttsResp.ok) throw new Error("TTS failed");
      if (Platform.OS === "web") {
        const blob = await ttsResp.blob();
        const url = URL.createObjectURL(blob);
        const audio = new window.Audio(url);
        audio.onended = () => { setSpeakingName(null); URL.revokeObjectURL(url); };
        audio.onerror = () => { setSpeakingName(null); URL.revokeObjectURL(url); };
        audio.play();
      } else {
        const blob = await ttsResp.blob();
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64 = (reader.result as string).split(",")[1];
            const fileUri = FileSystem.cacheDirectory + "cabinet_speak.mp3";
            await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
            const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
            soundRef.current = sound;
            sound.setOnPlaybackStatusUpdate((status) => {
              if (status.isLoaded && status.didJustFinish) {
                setSpeakingName(null);
              }
            });
            await sound.playAsync();
          } catch { setSpeakingName(null); }
        };
        reader.onerror = () => setSpeakingName(null);
        reader.readAsDataURL(blob);
      }
    } catch {
      setSpeakingName(null);
    }
  };

  const hotSeatCount = members.filter(m => m.rating >= 4).length;
  const firedCount = members.filter(m => m.rating === 6).length;
  const avgRating = members.length > 0
    ? (members.reduce((sum, m) => sum + Math.min(m.rating, 5), 0) / members.length).toFixed(1)
    : "0";

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient
        colors={["rgba(212, 164, 32, 0.08)", "transparent"]}
        style={styles.headerGradient}
      />
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.gold} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>CABINET HOT SEAT</Text>
          <Text style={styles.headerSubtitle}>Chat DJT Satisfaction Ratings</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            refetch();
          }}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh" size={20} color={Colors.gold} />
        </Pressable>
      </View>

      <View style={styles.legendRow}>
        {[
          { n: 1, label: "1", color: "#22C55E" },
          { n: 2, label: "2", color: "#86EFAC" },
          { n: 3, label: "3", color: "#FBBF24" },
          { n: 4, label: "4", color: "#F97316" },
          { n: 5, label: "5", color: "#EF4444" },
          { n: 6, label: "6", color: "#000000" },
        ].map(item => (
          <View key={item.n} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color, borderWidth: item.n === 6 ? 1 : 0, borderColor: "#555" }]} />
            <Text style={styles.legendText}>
              {item.n === 1 ? "Safe" : item.n === 5 ? "Hot" : item.n === 6 ? "Fired" : item.label}
            </Text>
          </View>
        ))}
      </View>

      {!isLoading && members.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{hotSeatCount}</Text>
            <Text style={styles.statLabel}>On Hot Seat</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: Colors.gold }]}>{avgRating}</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: "#EF4444" }]}>{firedCount}</Text>
            <Text style={styles.statLabel}>Fired</Text>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Trump is reviewing his cabinet...</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.name}
          renderItem={({ item, index }) => <MemberCard member={item} index={index} onSpeak={handleSpeak} isSpeaking={!!speakingName} speakingName={speakingName} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + webBottomInset + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.gold}
            />
          }
          scrollEnabled={!!sorted.length}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.gold,
    letterSpacing: 2,
    fontFamily: "PlayfairDisplay_900Black",
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.whiteDim,
    marginTop: 2,
    letterSpacing: 1,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 10,
    color: Colors.whiteMuted,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statBox: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: "#EF4444",
  },
  statLabel: {
    fontSize: 10,
    color: Colors.whiteMuted,
    marginTop: 2,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: Colors.whiteDim,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 10,
  },
  memberCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  firedCard: {
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "rgba(20, 0, 0, 0.8)",
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  memberEmoji: {
    fontSize: 28,
  },
  memberText: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.white,
  },
  firedName: {
    textDecorationLine: "line-through",
    color: "rgba(255, 255, 255, 0.5)",
  },
  memberTitle: {
    fontSize: 11,
    color: Colors.whiteMuted,
    marginTop: 1,
  },
  ratingNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  ratingNumberText: {
    fontSize: 16,
    fontWeight: "900",
  },
  satisfactionContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  barTrack: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
    height: 8,
  },
  barSegment: {
    flex: 1,
    borderRadius: 4,
  },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  ratingLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  memberReason: {
    fontSize: 13,
    color: Colors.whiteDim,
    fontStyle: "italic",
    lineHeight: 18,
  },
  firedReason: {
    color: "rgba(255, 255, 255, 0.4)",
  },
  firedStamp: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -60 }, { translateY: -15 }, { rotate: "-12deg" }],
    borderWidth: 3,
    borderColor: "#EF4444",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 4,
  },
  firedStampText: {
    color: "#EF4444",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
  },
  speakingCard: {
    borderColor: Colors.gold,
    borderWidth: 1.5,
  },
  speakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  speakingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "rgba(212, 164, 32, 0.12)",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  speakingBadgeText: {
    fontSize: 11,
    color: Colors.gold,
    fontWeight: "700",
  },
  tapHint: {
    fontSize: 10,
    color: "rgba(212, 164, 32, 0.35)",
    marginTop: 6,
    textAlign: "right",
    fontStyle: "italic",
  },
});
