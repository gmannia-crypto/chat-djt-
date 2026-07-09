import React, { useEffect, useRef, useState } from "react";
import { View, Image, StyleSheet, Animated, Easing } from "react-native";

/**
 * AnimatedDebateFace  (realistic expression-swap version — NO lip-sync)
 * --------------------------------------------------------------------
 * The speaker is conveyed by THREE clean signals:
 *   1. Expression cross-fade  (neutral -> angry / shocked / smug / flustered)
 *   2. Emotion glow ring       (color shifts with mood)
 *   3. Breathing scale-pulse   (the active speaker gently pulses)
 *
 * No fake mouth overlay — on realistic photos it read as out-of-sync, so it's gone.
 * Falls back gracefully: a persona with only a base portrait still gets glow + pulse.
 */

export type Mood =
  | "neutral" | "angry" | "shocked" | "smug" | "flustered" | "dismissive";

const GLOW: Record<Mood, string> = {
  neutral: "#22D3EE",
  angry: "#FF4040",
  shocked: "#A855F7",
  flustered: "#A855F7",
  smug: "#FFD34D",
  dismissive: "#94A3B8",
};

export default function AnimatedDebateFace({
  personaId,
  baseImage,
  speaking = false,
  mood = "neutral",
  side = "left",
  size = 120,
  expressionImages,
}: {
  personaId: string;
  baseImage: any;
  speaking?: boolean;
  mood?: Mood;
  side?: "left" | "right";
  size?: number;
  expressionImages?: Partial<Record<Mood, any>>;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.25)).current;

  const variant = expressionImages?.[mood];
  const activeImage = variant || baseImage;

  const [frontImage, setFrontImage] = useState<any>(activeImage);
  const [backImage, setBackImage] = useState<any>(activeImage);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setBackImage(frontImage);
    setFrontImage(activeImage);
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
    Animated.timing(glowOpacity, {
      toValue: mood === "neutral" ? 0.25 : 0.7, duration: 300, useNativeDriver: false,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, variant]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (speaking) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.045, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
    }
    return () => { if (loop) loop.stop(); };
  }, [speaking]);

  const glowColor = GLOW[mood];

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size, transform: [{ scale }] }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, {
          width: size, height: size, borderRadius: size / 2,
          shadowColor: glowColor, borderColor: glowColor, opacity: glowOpacity,
        }]}
      />
      <Image source={backImage} style={[styles.face, { width: size, height: size, borderRadius: size / 2 }]} />
      <Animated.Image
        source={frontImage}
        style={[styles.face, { width: size, height: size, borderRadius: size / 2, opacity: fade, position: "absolute" }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  glow: {
    position: "absolute", borderWidth: 3,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 14, shadowOpacity: 0.9, zIndex: 2,
  },
  face: { resizeMode: "cover" },
});

/**
 * ── EXPRESSION SOURCES ──
 * Save variant images in assets/images/ with these exact names.
 * Personas not listed here simply use their single base portrait.
 *
 * Trump : neutral default; reactions = angry, shocked
 * Ruckus: neutral default; reactions = angry, smug
 * Elon  : neutral default; reactions = flustered, smug
 */
export const EXPRESSION_SOURCES: Record<string, Partial<Record<Mood, any>>> = {
  trump: {
    neutral: require("@/assets/images/persona-trump-neutral.png"),
    angry:   require("@/assets/images/persona-trump-angry.png"),
    shocked: require("@/assets/images/persona-trump-shocked.png"),
  },
  ruckus: {
    neutral: require("@/assets/images/persona-ruckus-neutral.png"),
    angry:   require("@/assets/images/persona-ruckus-angry.png"),
    smug:    require("@/assets/images/persona-ruckus-smug.png"),
  },
  elon: {
    neutral:   require("@/assets/images/persona-elon-neutral.png"),
    flustered: require("@/assets/images/persona-elon-flustered.png"),
    smug:      require("@/assets/images/persona-elon-smug.png"),
  },
};

/**
 * ── USAGE ──
 * import AnimatedDebateFace, { EXPRESSION_SOURCES, Mood } from "@/components/AnimatedDebateFace";
 *
 * function emotionToMood(e, isSpeaking): Mood {
 *   if (e.anger >= 55) return "angry";
 *   if (e.frantic >= 45) return isSpeaking ? "flustered" : "shocked";
 *   if (!isSpeaking && e.happy >= 40) return "smug";
 *   return "neutral";
 * }
 *
 * <AnimatedDebateFace
 *   personaId={p.id}
 *   baseImage={personaImages[p.id]}
 *   speaking={currentSpeakerId === p.id}
 *   mood={emotionToMood(emotions[p.id], currentSpeakerId === p.id)}
 *   side={p.id === leftPersonaId ? "left" : "right"}
 *   size={120}
 *   expressionImages={EXPRESSION_SOURCES[p.id]}
 * />
 */
