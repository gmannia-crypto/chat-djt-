import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import Colors from "@/constants/colors";

export type Mood = "neutral" | "angry" | "flustered" | "shocked" | "smug";

export interface ExpressionSet {
  neutral?: any;
  angry?: any;
  flustered?: any;
  shocked?: any;
  smug?: any;
}

// Persona id → { mood: require() }. Populate this as expression art is added;
// personas without an entry (or without a specific mood) fall back to baseImage.
export const EXPRESSION_SOURCES: Record<string, ExpressionSet> = {};

interface AnimatedDebateFaceProps {
  personaId: string;
  baseImage: any;
  speaking: boolean;
  mood: Mood;
  side: "left" | "right";
  size?: number;
  expressionImages?: ExpressionSet;
}

export default function AnimatedDebateFace({
  personaId,
  baseImage,
  speaking,
  mood,
  side,
  size = 120,
  expressionImages,
}: AnimatedDebateFaceProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const source =
    (expressionImages && expressionImages[mood]) ||
    (expressionImages && expressionImages.neutral) ||
    baseImage;

  useEffect(() => {
    if (speaking) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 260, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 260, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.setValue(1);
    }
  }, [speaking, pulse]);

  const moodBorderColor =
    mood === "angry" ? "#EF4444" :
    mood === "flustered" ? "#F59E0B" :
    mood === "shocked" ? "#22D3EE" :
    mood === "smug" ? "#D4AF37" :
    Colors.border;

  return (
    <View style={[styles.wrap, { alignItems: side === "left" ? "flex-start" : "flex-end" }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: speaking ? "#D4AF37" : moodBorderColor,
            borderWidth: speaking ? 3 : 2,
            transform: [{ scale: pulse }],
          },
        ]}
      >
        {source ? (
          <Image
            source={source}
            style={{ width: size - 6, height: size - 6, borderRadius: (size - 6) / 2 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: size - 6, height: size - 6, borderRadius: (size - 6) / 2, backgroundColor: Colors.card }} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  ring: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#111",
  },
});
