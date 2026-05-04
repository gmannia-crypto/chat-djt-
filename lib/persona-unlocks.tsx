import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type MciIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
type IonIconName = React.ComponentProps<typeof Ionicons>["name"];
type Fa5IconName = React.ComponentProps<typeof FontAwesome5>["name"];

export type PersonaUnlockIcon =
  | { kind: "mci"; name: MciIconName; size: number; color: string; anim?: "pulse" | "wiggle"; rotate?: string; xBadge?: { bg: string; iconColor?: string } }
  | { kind: "ion"; name: IonIconName; size: number; color: string; anim?: "pulse" | "wiggle"; rotate?: string }
  | { kind: "fa5"; name: Fa5IconName; size: number; color: string; anim?: "pulse" | "wiggle"; rotate?: string }
  | { kind: "emoji"; char: string; size: number; anim?: "pulse" | "wiggle" };

export interface PersonaUnlockConfig {
  gradient: [string, string, string];
  borderColor: string;
  badge: { text: string; bg: string; textColor: string; borderColor: string; shadowColor: string };
  overline: string;
  overlineColor: string;
  title: string;
  titleColor: string;
  icons: PersonaUnlockIcon[];
  quote: string;
  quoteColor: string;
  description: string;
  descColor?: string;
  dismiss: { text: string; bg: string; textColor: string; borderColor: string };
}

export const ARENA_MYSTERY_PERSONA_IDS = ["alexjones", "obama", "melania", "schumer", "odonnell", "kamala", "mtg", "rfk"] as const;

export const ARENA_MYSTERY_UNLOCK_KEY = "arena_mystery_unlocked";

export const ARENA_MYSTERY_PERSONAS_SEEN_KEY = "arena_mystery_personas_seen";

export const ARENA_MYSTERY_PERSONA_NAMES: Record<string, string> = {
  alexjones: "Alex Jones",
  obama: "Barack Obama",
  melania: "Melania Trump",
  schumer: "Chuck Schumer",
  odonnell: "Lawrence O'Donnell",
  kamala: "Kamala Harris",
  mtg: "Marjorie Taylor Greene",
  rfk: "Robert F. Kennedy Jr.",
};

export const ARENA_MYSTERY_PERSONA_AVATARS: Record<string, number> = {
  alexjones: require("@/assets/images/persona-alexjones.png"),
  obama: require("@/assets/images/persona-obama.png"),
  melania: require("@/assets/images/persona-melania.png"),
  schumer: require("@/assets/images/persona-schumer.png"),
  odonnell: require("@/assets/images/persona-odonnell.png"),
  kamala: require("@/assets/images/persona-kamala.png"),
  mtg: require("@/assets/images/persona-mtg.png"),
  rfk: require("@/assets/images/persona-rfk.png"),
};

export const PERSONA_UNLOCKS: Record<string, PersonaUnlockConfig> = {
  rfk: {
    gradient: ["#0a3d1f", "#1f6b3a", "#3d2914"],
    borderColor: "#7ed957",
    badge: { text: "MAHA", bg: "#f4e9c1", textColor: "#0a3d1f", borderColor: "#3d2914", shadowColor: "#7ed957" },
    overline: "MAKE AMERICA HEALTHY AGAIN",
    overlineColor: "#7ed957",
    title: "RFK JR. UNLOCKED",
    titleColor: "#fff",
    icons: [
      { kind: "mci", name: "needle", size: 64, color: "#f4e9c1", anim: "pulse", rotate: "-32deg", xBadge: { bg: "#c0392b" } },
      { kind: "emoji", char: "\uD83E\uDEB1", size: 52, anim: "wiggle" },
      { kind: "mci", name: "leaf", size: 56, color: "#7ed957" },
    ],
    quote: "\u201CA worm ate part of my brain\u201D",
    quoteColor: "#f4e9c1",
    description: "Robert F. Kennedy Jr. has joined the Political Arena. Debate vaccines, raw milk, and the deep state \u2014 if you dare.",
    dismiss: { text: "ENTER THE ARENA", bg: "#0a3d1f", textColor: "#7ed957", borderColor: "#7ed957" },
  },
  alexjones: {
    gradient: ["#1a0000", "#4a0000", "#8b0000"],
    borderColor: "#ff4500",
    badge: { text: "INFOWARS", bg: "#ff4500", textColor: "#000", borderColor: "#fff", shadowColor: "#ff4500" },
    overline: "PRISON PLANET",
    overlineColor: "#ff4500",
    title: "ALEX JONES UNLOCKED",
    titleColor: "#fff",
    icons: [
      { kind: "mci", name: "bullhorn", size: 64, color: "#ff4500", anim: "pulse", rotate: "-18deg" },
      { kind: "emoji", char: "\uD83D\uDC38", size: 52, anim: "wiggle" },
      { kind: "mci", name: "brain", size: 56, color: "#ffd700" },
    ],
    quote: "\u201CThey\u2019re turning the friggin\u2019 frogs gay!\u201D",
    quoteColor: "#ffd700",
    description: "Alex Jones has burst into the Political Arena. Brace for tin-foil truth bombs and frog-related conspiracies.",
    dismiss: { text: "GO LIVE", bg: "#000", textColor: "#ff4500", borderColor: "#ff4500" },
  },
  obama: {
    gradient: ["#0a3161", "#1f4d8a", "#b22234"],
    borderColor: "#f4e9c1",
    badge: { text: "HOPE", bg: "#b22234", textColor: "#f4e9c1", borderColor: "#0a3161", shadowColor: "#f4e9c1" },
    overline: "YES WE CAN",
    overlineColor: "#f4e9c1",
    title: "OBAMA UNLOCKED",
    titleColor: "#fff",
    icons: [
      { kind: "mci", name: "microphone", size: 64, color: "#f4e9c1", anim: "pulse" },
      { kind: "emoji", char: "\uD83D\uDD4A\uFE0F", size: 52, anim: "wiggle" },
      { kind: "mci", name: "basketball", size: 56, color: "#d4762a" },
    ],
    quote: "\u201CLet me be clear\u2026\u201D",
    quoteColor: "#f4e9c1",
    description: "Barack Obama strolls into the Political Arena. Bring your A-game \u2014 he\u2019s about to drop a measured, eight-minute response.",
    dismiss: { text: "ENTER THE ARENA", bg: "#0a3161", textColor: "#f4e9c1", borderColor: "#f4e9c1" },
  },
  melania: {
    gradient: ["#1a1a1a", "#3a2c0e", "#7a5d10"],
    borderColor: "#d4af37",
    badge: { text: "BE BEST", bg: "#f5f5dc", textColor: "#1a1a1a", borderColor: "#d4af37", shadowColor: "#d4af37" },
    overline: "FIRST LADY",
    overlineColor: "#d4af37",
    title: "MELANIA UNLOCKED",
    titleColor: "#f5f5dc",
    icons: [
      { kind: "mci", name: "crown", size: 64, color: "#d4af37", anim: "pulse" },
      { kind: "emoji", char: "\uD83D\uDD76\uFE0F", size: 52, anim: "wiggle" },
      { kind: "emoji", char: "\uD83D\uDC60", size: 50 },
    ],
    quote: "\u201CI really don\u2019t care, do u?\u201D",
    quoteColor: "#f5f5dc",
    description: "Melania Trump glides into the Political Arena. Approach with caution \u2014 her shade levels are diplomatic-incident grade.",
    dismiss: { text: "STRIKE A POSE", bg: "#1a1a1a", textColor: "#d4af37", borderColor: "#d4af37" },
  },
  schumer: {
    gradient: ["#0a1a3d", "#1f3d6b", "#102a55"],
    borderColor: "#c9a227",
    badge: { text: "SENATE", bg: "#c9a227", textColor: "#0a1a3d", borderColor: "#fff", shadowColor: "#c9a227" },
    overline: "MAJORITY LEADER",
    overlineColor: "#c9a227",
    title: "SCHUMER UNLOCKED",
    titleColor: "#fff",
    icons: [
      { kind: "mci", name: "glasses", size: 64, color: "#c9a227", anim: "wiggle" },
      { kind: "mci", name: "gavel", size: 56, color: "#c9a227", anim: "pulse" },
      { kind: "mci", name: "script-text-outline", size: 56, color: "#f4e9c1" },
    ],
    quote: "\u201CI rise in strong opposition.\u201D",
    quoteColor: "#c9a227",
    description: "Chuck Schumer takes the floor in the Political Arena. Expect long sentences, longer pauses, and the occasional finger-wag.",
    dismiss: { text: "TAKE THE FLOOR", bg: "#0a1a3d", textColor: "#c9a227", borderColor: "#c9a227" },
  },
  odonnell: {
    gradient: ["#1a1a1a", "#3a1212", "#b22234"],
    borderColor: "#c0c0c0",
    badge: { text: "MSNBC", bg: "#b22234", textColor: "#fff", borderColor: "#c0c0c0", shadowColor: "#b22234" },
    overline: "THE LAST WORD",
    overlineColor: "#c0c0c0",
    title: "O\u2019DONNELL UNLOCKED",
    titleColor: "#fff",
    icons: [
      { kind: "mci", name: "television-classic", size: 64, color: "#c0c0c0", anim: "pulse" },
      { kind: "mci", name: "microphone", size: 56, color: "#b22234", anim: "wiggle" },
      { kind: "mci", name: "book-open-page-variant", size: 56, color: "#f4e9c1" },
    ],
    quote: "\u201CLet me explain.\u201D",
    quoteColor: "#c0c0c0",
    description: "Lawrence O\u2019Donnell turns on the cameras in the Political Arena. He\u2019ll have the last word \u2014 even if it takes the full segment.",
    dismiss: { text: "GO ON AIR", bg: "#1a1a1a", textColor: "#c0c0c0", borderColor: "#c0c0c0" },
  },
  kamala: {
    gradient: ["#3d0a55", "#6a0dad", "#1a1a1a"],
    borderColor: "#d4af37",
    badge: { text: "MADAM VP", bg: "#d4af37", textColor: "#3d0a55", borderColor: "#fff", shadowColor: "#d4af37" },
    overline: "WE DID IT, JOE",
    overlineColor: "#d4af37",
    title: "KAMALA UNLOCKED",
    titleColor: "#fff",
    icons: [
      { kind: "emoji", char: "\uD83E\uDD65", size: 52, anim: "wiggle" },
      { kind: "mci", name: "scale-balance", size: 64, color: "#d4af37", anim: "pulse" },
      { kind: "mci", name: "microphone", size: 56, color: "#fff" },
    ],
    quote: "\u201CYou think you just fell out of a coconut tree?\u201D",
    quoteColor: "#d4af37",
    description: "Kamala Harris cackles into the Political Arena. The context is unburdened by what has been.",
    dismiss: { text: "UNBURDENED", bg: "#3d0a55", textColor: "#d4af37", borderColor: "#d4af37" },
  },
  mtg: {
    gradient: ["#1a0000", "#4a0000", "#1a1a1a"],
    borderColor: "#ffd700",
    badge: { text: "MAGA", bg: "#b22234", textColor: "#fff", borderColor: "#ffd700", shadowColor: "#ffd700" },
    overline: "JEWISH SPACE LASERS",
    overlineColor: "#ffd700",
    title: "MTG UNLOCKED",
    titleColor: "#fff",
    icons: [
      { kind: "ion", name: "flash", size: 64, color: "#ffd700", anim: "pulse" },
      { kind: "mci", name: "eye", size: 56, color: "#ff4d4d", anim: "wiggle" },
      { kind: "emoji", char: "\uD83D\uDD25", size: 52 },
    ],
    quote: "\u201CIt was the space lasers!\u201D",
    quoteColor: "#ffd700",
    description: "Marjorie Taylor Greene barges into the Political Arena. Reality is optional. Lasers are not.",
    dismiss: { text: "OPEN FIRE", bg: "#1a0000", textColor: "#ffd700", borderColor: "#ffd700" },
  },
};

export interface MysteryTeaserPalette {
  gradient: [string, string, string];
  borderColor: string;
  accent: string;
  badgeText: string;
}

export function getMysteryTeaserPalettes(
  finalPersonaId: string,
  lockedIds: readonly string[],
  count = 3,
): MysteryTeaserPalette[] {
  const finalCfg = PERSONA_UNLOCKS[finalPersonaId];
  const decoyIds = lockedIds.filter(
    (id) => id !== finalPersonaId && PERSONA_UNLOCKS[id],
  );
  const shuffled = [...decoyIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const decoyCount = Math.max(0, Math.min(count - 1, shuffled.length));
  const sequence: MysteryTeaserPalette[] = [];
  for (let i = 0; i < decoyCount; i++) {
    const cfg = PERSONA_UNLOCKS[shuffled[i]];
    if (!cfg) continue;
    sequence.push({
      gradient: cfg.gradient,
      borderColor: cfg.borderColor,
      accent: cfg.overlineColor,
      badgeText: cfg.badge.text,
    });
  }
  if (finalCfg) {
    sequence.push({
      gradient: finalCfg.gradient,
      borderColor: finalCfg.borderColor,
      accent: finalCfg.overlineColor,
      badgeText: finalCfg.badge.text,
    });
  }
  return sequence;
}

export function MysteryPersonaTeaser({
  state,
}: {
  state: { palette: MysteryTeaserPalette; step: number; total: number } | null;
}) {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.5);

  useEffect(() => {
    if (state) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 360 }),
          withTiming(1, { duration: 360 }),
        ),
        -1,
        true,
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 460 }),
          withTiming(0.4, { duration: 460 }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1);
      glow.value = withTiming(0.5);
    }
  }, [!!state]);

  const silhouetteStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    shadowOpacity: glow.value,
    shadowRadius: 18 + glow.value * 16,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.65 + glow.value * 0.35,
  }));

  const palette = state?.palette ?? null;

  return (
    <Modal visible={!!state} animationType="fade" transparent onRequestClose={() => {}}>
      <View style={teaserStyles.overlay} pointerEvents="none">
        {state && palette && (
          <Animated.View
            key={`teaser-${state.step}-${palette.badgeText}`}
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(180)}
            style={[teaserStyles.card, { borderColor: palette.borderColor }]}
          >
            <LinearGradient
              colors={palette.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={teaserStyles.gradient}
            >
              <Animated.Text
                style={[teaserStyles.label, { color: palette.accent }, labelStyle]}
              >
                WHO COULD IT BE?
              </Animated.Text>

              <Animated.View
                style={[
                  teaserStyles.silhouette,
                  {
                    backgroundColor: palette.accent,
                    shadowColor: palette.accent,
                    borderColor: palette.borderColor,
                  },
                  silhouetteStyle,
                ]}
              >
                <MaterialCommunityIcons name="incognito" size={92} color="#0a0a0a" />
              </Animated.View>

              <View style={teaserStyles.dotsRow}>
                {Array.from({ length: state.total }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      teaserStyles.dot,
                      {
                        backgroundColor:
                          i <= state.step ? palette.accent : "rgba(255,255,255,0.25)",
                      },
                    ]}
                  />
                ))}
              </View>
            </LinearGradient>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const teaserStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 2,
  },
  gradient: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 3,
    textAlign: "center",
  },
  silhouette: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export function PersonaUnlockIconView({
  icon,
  wormStyle,
  syringeStyle,
}: {
  icon: PersonaUnlockIcon;
  wormStyle: StyleProp<ViewStyle>;
  syringeStyle: StyleProp<ViewStyle>;
}) {
  const animStyle =
    icon.anim === "wiggle" ? wormStyle : icon.anim === "pulse" ? syringeStyle : null;
  const rotate = "rotate" in icon && icon.rotate ? icon.rotate : null;
  const rotateStyle: StyleProp<ViewStyle> = rotate ? { transform: [{ rotate }] } : null;

  let inner: React.ReactNode = null;
  if (icon.kind === "mci") {
    inner = (
      <>
        <MaterialCommunityIcons name={icon.name} size={icon.size} color={icon.color} />
        {icon.xBadge && (
          <View style={[personaUnlockStyles.xBadge, { backgroundColor: icon.xBadge.bg }]}>
            <Ionicons name="close" size={28} color={icon.xBadge.iconColor || "#fff"} />
          </View>
        )}
      </>
    );
  } else if (icon.kind === "ion") {
    inner = <Ionicons name={icon.name} size={icon.size} color={icon.color} />;
  } else if (icon.kind === "fa5") {
    inner = <FontAwesome5 name={icon.name} size={icon.size} color={icon.color} />;
  } else if (icon.kind === "emoji") {
    inner = <Text style={{ fontSize: icon.size }}>{icon.char}</Text>;
  }

  if (animStyle) {
    return (
      <View style={[personaUnlockStyles.iconWrap, rotateStyle]}>
        <Animated.View style={animStyle}>{inner}</Animated.View>
      </View>
    );
  }
  return <View style={[personaUnlockStyles.iconWrap, rotateStyle]}>{inner}</View>;
}

export function PersonaUnlockModal({
  personaId,
  onDismiss,
}: {
  personaId: string | null;
  onDismiss: () => void;
}) {
  const wormWiggle = useSharedValue(0);
  const syringePulse = useSharedValue(1);
  const mahaGlow = useSharedValue(0.6);

  useEffect(() => {
    if (personaId && PERSONA_UNLOCKS[personaId]) {
      wormWiggle.value = withRepeat(
        withSequence(withTiming(1, { duration: 380 }), withTiming(-1, { duration: 380 })),
        -1,
        true,
      );
      syringePulse.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 520 }), withTiming(1, { duration: 520 })),
        -1,
        true,
      );
      mahaGlow.value = withRepeat(
        withSequence(withTiming(1, { duration: 700 }), withTiming(0.55, { duration: 700 })),
        -1,
        true,
      );
    } else {
      wormWiggle.value = withTiming(0);
      syringePulse.value = withTiming(1);
      mahaGlow.value = withTiming(0.6);
    }
  }, [personaId]);

  const wormStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: wormWiggle.value * 18 },
      { rotate: `${wormWiggle.value * 14}deg` },
    ],
  }));

  const syringeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: syringePulse.value }],
  }));

  const mahaBadgeStyle = useAnimatedStyle(() => ({
    shadowOpacity: mahaGlow.value,
    shadowRadius: 14 + mahaGlow.value * 10,
  }));

  const cfg = personaId ? PERSONA_UNLOCKS[personaId] : null;

  return (
    <Modal
      visible={!!personaId && !!cfg}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}
    >
      <Pressable style={personaUnlockStyles.overlay} onPress={onDismiss}>
        {cfg && (
          <Animated.View
            entering={FadeIn.duration(420)}
            style={[personaUnlockStyles.card, { borderColor: cfg.borderColor }]}
          >
            <Pressable onPress={() => {}}>
              <LinearGradient
                colors={cfg.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={personaUnlockStyles.gradient}
              >
                <Animated.View
                  style={[
                    personaUnlockStyles.badge,
                    {
                      backgroundColor: cfg.badge.bg,
                      borderColor: cfg.badge.borderColor,
                      shadowColor: cfg.badge.shadowColor,
                    },
                    mahaBadgeStyle,
                  ]}
                >
                  <Text style={[personaUnlockStyles.badgeText, { color: cfg.badge.textColor }]}>
                    {cfg.badge.text}
                  </Text>
                </Animated.View>

                <Text style={[personaUnlockStyles.overline, { color: cfg.overlineColor }]}>
                  {cfg.overline}
                </Text>
                <Text style={[personaUnlockStyles.title, { color: cfg.titleColor }]}>
                  {cfg.title}
                </Text>

                <View style={personaUnlockStyles.iconRow}>
                  {cfg.icons.map((icon, i) => (
                    <PersonaUnlockIconView
                      key={i}
                      icon={icon}
                      wormStyle={wormStyle}
                      syringeStyle={syringeStyle}
                    />
                  ))}
                </View>

                <Text style={[personaUnlockStyles.quote, { color: cfg.quoteColor }]}>
                  {cfg.quote}
                </Text>
                <Text
                  style={[
                    personaUnlockStyles.desc,
                    cfg.descColor ? { color: cfg.descColor } : null,
                  ]}
                >
                  {cfg.description}
                </Text>

                <Pressable
                  onPress={onDismiss}
                  style={[
                    personaUnlockStyles.dismiss,
                    { backgroundColor: cfg.dismiss.bg, borderColor: cfg.dismiss.borderColor },
                  ]}
                >
                  <Text style={[personaUnlockStyles.dismissText, { color: cfg.dismiss.textColor }]}>
                    {cfg.dismiss.text}
                  </Text>
                </Pressable>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </Pressable>
    </Modal>
  );
}

const personaUnlockStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 2,
  },
  gradient: {
    padding: 24,
    alignItems: "center",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    borderWidth: 2,
  },
  badgeText: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 4,
  },
  overline: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.5,
    marginBottom: 6,
    textAlign: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: 18,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginVertical: 14,
    height: 84,
  },
  iconWrap: {
    position: "relative",
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  xBadge: {
    position: "absolute",
    top: 6,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  quote: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 6,
  },
  desc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  dismiss: {
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderWidth: 2,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
});
