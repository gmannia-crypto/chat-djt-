import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from "react-native";

interface TickerItem {
  emoji: string;
  text: string;
}

interface LiveTickerProps {
  items: TickerItem[];
  speed?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function LiveTicker({ items, speed = 40 }: LiveTickerProps) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const doubled = [...items, ...items];
  const itemWidth = 220;
  const totalWidth = items.length * itemWidth;

  useEffect(() => {
    const duration = (totalWidth / speed) * 1000;
    const animation = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -totalWidth,
        duration,
        useNativeDriver: true,
        isInteraction: false,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [items.length]);

  return (
    <View style={s.container}>
      <Animated.View style={[s.track, { transform: [{ translateX: scrollX }] }]}>
        {doubled.map((item, i) => (
          <View key={i} style={[s.item, { width: itemWidth }]}>
            <Text style={s.emoji}>{item.emoji}</Text>
            <Text style={s.text} numberOfLines={1}>{item.text}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.4)",
    borderRadius: 25,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    overflow: "hidden",
  },
  track: {
    flexDirection: "row",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 6,
  },
  emoji: {
    fontSize: 14,
  },
  text: {
    color: "#ffaa00",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
});
