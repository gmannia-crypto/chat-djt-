import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import {
  ARENA_MYSTERY_PERSONA_AVATARS,
  ARENA_MYSTERY_PERSONA_IDS,
  ARENA_MYSTERY_PERSONA_NAMES,
  ARENA_MYSTERY_PERSONAS_SEEN_KEY,
  ARENA_MYSTERY_UNLOCK_KEY,
  PERSONA_UNLOCKS,
  PersonaUnlockModal,
  MysteryPersonaTeaser,
  getMysteryTeaserPalettes,
  type MysteryTeaserPalette,
} from "@/lib/persona-unlocks";

const WEB_TOP_INSET = 67;
const WEB_BOTTOM_INSET = 34;

// Module-level cache so that React StrictMode's synchronous double-mount
// (cleanup → remount in the same microtask) on the trophy room screen reuses
// the baseline captured by the first mount, instead of reading back the
// just-written "seen" value as the new baseline (which would hide all NEW
// badges). The cache is cleared a short moment after a real blur, so a
// genuine revisit reads fresh state from storage.
let mysteryBaselineCache: { seen: string[] } | null = null;
let mysteryBaselineClearTimer: ReturnType<typeof setTimeout> | null = null;

function NewBadge({ testID }: { testID?: string }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 520 }),
        withTiming(1, { duration: 520 }),
      ),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View
      pointerEvents="none"
      style={styles.newBadgeAnchor}
      testID={testID}
    >
      <Animated.View style={[styles.newBadge, animStyle]}>
        <Text style={styles.newBadgeText}>NEW</Text>
      </Animated.View>
    </View>
  );
}

export default function PersonasTrophyScreen() {
  const insets = useSafeAreaInsets();
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [seenBaseline, setSeenBaseline] = useState<string[]>([]);
  const [previewPersonaId, setPreviewPersonaId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [replayTeaser, setReplayTeaser] = useState<{
    palette: MysteryTeaserPalette;
    step: number;
    total: number;
  } | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const validIds = ARENA_MYSTERY_PERSONA_IDS as readonly string[];

      // If a previous focus left a pending cache-clear scheduled (e.g. from a
      // StrictMode unmount), cancel it so this re-focus reuses the cached
      // baseline.
      if (mysteryBaselineClearTimer) {
        clearTimeout(mysteryBaselineClearTimer);
        mysteryBaselineClearTimer = null;
      }

      (async () => {
        let unlockedSafe: string[] = [];
        try {
          const stored = await AsyncStorage.getItem(ARENA_MYSTERY_UNLOCK_KEY);
          const parsed = stored ? JSON.parse(stored) : [];
          unlockedSafe = Array.isArray(parsed)
            ? parsed.filter(
                (id): id is string =>
                  typeof id === "string" && validIds.includes(id),
              )
            : [];
        } catch {
          unlockedSafe = [];
        }
        if (cancelled) return;
        setUnlocked(unlockedSafe);
        setLoaded(true);

        // Determine the "seen" baseline that drives the NEW badges. Prefer
        // the module-level cache so dev-mode double-mounts don't read back
        // the just-persisted value and accidentally hide all badges.
        let seenBaselineNow: string[];
        if (mysteryBaselineCache) {
          seenBaselineNow = mysteryBaselineCache.seen;
        } else {
          let safeSeen: string[] = [];
          try {
            const storedSeen = await AsyncStorage.getItem(
              ARENA_MYSTERY_PERSONAS_SEEN_KEY,
            );
            const parsedSeen = storedSeen ? JSON.parse(storedSeen) : [];
            safeSeen = Array.isArray(parsedSeen)
              ? parsedSeen.filter(
                  (id): id is string =>
                    typeof id === "string" && validIds.includes(id),
                )
              : [];
          } catch {
            safeSeen = [];
          }
          mysteryBaselineCache = { seen: safeSeen };
          seenBaselineNow = safeSeen;

          // Persist the current unlocked set as "seen" right away so even a
          // brief visit clears the badges on next entry. The badge UI uses
          // the captured baseline state and is unaffected by this write.
          try {
            await AsyncStorage.setItem(
              ARENA_MYSTERY_PERSONAS_SEEN_KEY,
              JSON.stringify(unlockedSafe),
            );
          } catch {
            // Non-fatal — badges will simply re-appear on next focus.
          }
        }
        if (cancelled) return;
        setSeenBaseline(seenBaselineNow);
      })();

      return () => {
        cancelled = true;
        // Schedule the cache clear so that synchronous StrictMode remounts
        // still hit the cache, but a real navigation away (followed by a
        // later revisit) reads fresh storage state.
        if (mysteryBaselineClearTimer) {
          clearTimeout(mysteryBaselineClearTimer);
        }
        mysteryBaselineClearTimer = setTimeout(() => {
          mysteryBaselineCache = null;
          mysteryBaselineClearTimer = null;
        }, 50);
      };
    }, []),
  );

  const playReveal = useCallback(
    async (personaId: string) => {
      if (replayingId) return;
      const cfg = PERSONA_UNLOCKS[personaId];
      if (!cfg) return;
      setReplayingId(personaId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        // Decoy pool = every other persona that has a config (regardless of
        // unlock state) so the teaser still feels suspenseful on replay.
        const decoyPool = (ARENA_MYSTERY_PERSONA_IDS as readonly string[]).filter(
          (id) => id !== personaId && PERSONA_UNLOCKS[id],
        );
        const teaserSeq = getMysteryTeaserPalettes(personaId, decoyPool, 3);
        const decoyMs = 440;
        const finalMs = Math.max(560, 1100 - decoyMs * (teaserSeq.length - 1));
        for (let i = 0; i < teaserSeq.length; i++) {
          setReplayTeaser({ palette: teaserSeq[i], step: i, total: teaserSeq.length });
          try { Haptics.selectionAsync(); } catch {}
          const isFinal = i === teaserSeq.length - 1;
          await new Promise((r) => setTimeout(r, isFinal ? finalMs : decoyMs));
        }
      } finally {
        setReplayTeaser(null);
        setPreviewPersonaId(personaId);
        setReplayingId(null);
      }
    },
    [replayingId],
  );

  const topPad = (Platform.OS === "web" ? WEB_TOP_INSET : insets.top) + 12;
  const bottomPad = (Platform.OS === "web" ? WEB_BOTTOM_INSET : insets.bottom) + 24;

  const total = ARENA_MYSTERY_PERSONA_IDS.length;
  const ownedCount = unlocked.length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          testID="trophy-back"
          hitSlop={10}
        >
          <Feather name="chevron-left" size={22} color={Colors.gold} />
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={styles.countBadge}>
          <MaterialCommunityIcons name="trophy" size={14} color="#FFD700" />
          <Text style={styles.countText}>
            {ownedCount}/{total}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>PERSONAS TROPHY ROOM</Text>
        <Text style={styles.subtitle}>
          Every mystery debater you&rsquo;ve unlocked from the Mystery Box. Tap one to replay their
          signature reveal.
        </Text>

        <View style={styles.grid}>
          {ARENA_MYSTERY_PERSONA_IDS.map((personaId, i) => {
            const isUnlocked = unlocked.includes(personaId);
            const cfg = PERSONA_UNLOCKS[personaId];
            const name = ARENA_MYSTERY_PERSONA_NAMES[personaId] || personaId;
            const isNew = isUnlocked && !seenBaseline.includes(personaId);
            return (
              <Animated.View
                key={personaId}
                entering={FadeInDown.delay(80 + i * 40).duration(360)}
                style={styles.cardWrap}
              >
                <Pressable
                  disabled={!isUnlocked || !cfg || !!replayingId}
                  onPress={() => {
                    if (!isUnlocked || !cfg) return;
                    playReveal(personaId);
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    isUnlocked && cfg
                      ? { borderColor: cfg.borderColor }
                      : styles.cardLocked,
                    pressed && isUnlocked && { transform: [{ scale: 0.97 }] },
                  ]}
                  testID={`persona-card-${personaId}`}
                >
                  {isUnlocked && cfg ? (
                    <LinearGradient
                      colors={cfg.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardInner}
                    >
                      <View style={styles.avatarWrap}>
                        <Image
                          source={ARENA_MYSTERY_PERSONA_AVATARS[personaId]}
                          style={styles.avatar}
                          resizeMode="cover"
                        />
                      </View>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {name}
                      </Text>
                      <View
                        style={[
                          styles.cardBadge,
                          {
                            backgroundColor: cfg.badge.bg,
                            borderColor: cfg.badge.borderColor,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.cardBadgeText, { color: cfg.badge.textColor }]}
                          numberOfLines={1}
                        >
                          {cfg.badge.text}
                        </Text>
                      </View>
                      <View style={styles.replayRow}>
                        <Ionicons name="play-circle" size={14} color="#fff" />
                        <Text style={styles.replayText}>REPLAY REVEAL</Text>
                      </View>
                      {isNew && <NewBadge testID={`persona-new-${personaId}`} />}
                    </LinearGradient>
                  ) : (
                    <View style={[styles.cardInner, styles.lockedInner]}>
                      <View style={styles.silhouette}>
                        <Text style={styles.silhouetteMark}>?</Text>
                      </View>
                      <Text style={styles.lockedName}>LOCKED</Text>
                      <View style={styles.lockedHintRow}>
                        <MaterialCommunityIcons
                          name="gift-outline"
                          size={12}
                          color={Colors.whiteMuted}
                        />
                        <Text style={styles.lockedHint} numberOfLines={2}>
                          Mystery Box reward
                        </Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {loaded && ownedCount === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyText}>
              No mystery debaters unlocked yet. Open the daily Mystery Box on the home screen for a
              chance to add one to your trophy room.
            </Text>
          </View>
        )}

        {loaded && ownedCount === total && (
          <View style={styles.completeHint}>
            <MaterialCommunityIcons name="crown" size={18} color="#FFD700" />
            <Text style={styles.completeText}>
              {"Champion status \u2014 every mystery debater is in your trophy room!"}
            </Text>
          </View>
        )}
      </ScrollView>

      <MysteryPersonaTeaser state={replayTeaser} />

      <PersonaUnlockModal
        personaId={previewPersonaId}
        onDismiss={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setPreviewPersonaId(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingRight: 8,
  },
  backText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1.4,
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.35)",
  },
  countText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 1.6,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.whiteMuted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  cardWrap: {
    width: "48%",
  },
  card: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
  },
  cardLocked: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  cardInner: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    minHeight: 196,
    justifyContent: "space-between",
  },
  lockedInner: {
    backgroundColor: "rgba(15,15,20,0.6)",
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  cardName: {
    fontSize: 13,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginTop: 10,
    letterSpacing: 0.5,
  },
  cardBadge: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  replayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  replayText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1.2,
  },
  newBadgeAnchor: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 10,
    elevation: 10,
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FFD700",
    borderWidth: 1.5,
    borderColor: "#fff",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#0a0a0a",
    letterSpacing: 1.4,
  },
  silhouette: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  silhouetteMark: {
    fontSize: 36,
    fontWeight: "900",
    color: "rgba(255,255,255,0.35)",
  },
  lockedName: {
    fontSize: 13,
    fontWeight: "900",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1.4,
    marginTop: 10,
  },
  lockedHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  lockedHint: {
    fontSize: 11,
    color: Colors.whiteMuted,
    textAlign: "center",
  },
  emptyHint: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  emptyText: {
    fontSize: 13,
    color: Colors.whiteMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  completeHint: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255, 215, 0, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  completeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFD700",
    textAlign: "center",
    flex: 1,
  },
});
