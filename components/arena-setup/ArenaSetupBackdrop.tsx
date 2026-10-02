import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { getArenaSetupPalette, type ArenaSetupDesign } from "@/lib/arena-setup-design";

const LOGO_SOURCE = require("../../assets/images/dynamic-creations-transparent.png");
const BOLT_PATH = "M552 282 L433 335 L469 282 L365 573";
const AnimatedPath = Animated.createAnimatedComponent(Path);

export function ArenaSetupBackdrop({ design = "electric" }: { design?: ArenaSetupDesign }) {
  const { width: viewportWidth } = useWindowDimensions();
  const [viewportHeight, setViewportHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const palette = getArenaSetupPalette(design);
  const classic = design === "classic";
  const lavender = design === "lavender";

  const travel = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0.72)).current;
  const liquidOneDrift = useRef(new Animated.Value(0)).current;
  const liquidTwoDrift = useRef(new Animated.Value(0)).current;
  const boltOffset = useRef(new Animated.Value(0)).current;
  const boltCoreOffset = useRef(new Animated.Value(-218)).current;

  const logoSize = Math.min(340, viewportWidth * 0.68);
  const travelX = travel.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(0, viewportWidth - logoSize - 20), 20],
  });
  const travelY = travel.interpolate({
    inputRange: [0, 1],
    outputRange: [18, Math.max(18, viewportHeight - logoSize - 20)],
  });
  const travelRotation = travel.interpolate({
    inputRange: [0, 1],
    outputRange: ["-8deg", "8deg"],
  });
  const liquidOneX = liquidOneDrift.interpolate({ inputRange: [0, 1], outputRange: [-8, 17] });
  const liquidOneY = liquidOneDrift.interpolate({ inputRange: [0, 1], outputRange: [-5, 14] });
  const liquidOneScale = liquidOneDrift.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] });
  const liquidTwoX = liquidTwoDrift.interpolate({ inputRange: [0, 1], outputRange: [14, -14] });
  const liquidTwoY = liquidTwoDrift.interpolate({ inputRange: [0, 1], outputRange: [10, -12] });
  const liquidTwoScale = liquidTwoDrift.interpolate({ inputRange: [0, 1], outputRange: [1.04, 0.95] });

  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!palette.motion || reduceMotion !== false || viewportHeight <= 0) {
      travel.setValue(0);
      shimmer.setValue(classic ? 1 : 0.72);
      liquidOneDrift.setValue(0);
      liquidTwoDrift.setValue(0);
      boltOffset.setValue(0);
      boltCoreOffset.setValue(-218);
      return;
    }

    const logoTravel = Animated.loop(Animated.sequence([
      Animated.timing(travel, { toValue: 1, duration: 32_000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(travel, { toValue: 0, duration: 32_000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const logoShimmer = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 4_500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0.72, duration: 4_500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const firstLiquid = Animated.loop(Animated.sequence([
      Animated.timing(liquidOneDrift, { toValue: 1, duration: 19_000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(liquidOneDrift, { toValue: 0, duration: 19_000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const secondLiquid = Animated.loop(Animated.sequence([
      Animated.timing(liquidTwoDrift, { toValue: 1, duration: 23_000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(liquidTwoDrift, { toValue: 0, duration: 23_000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const boltCurrent = Animated.loop(
      Animated.timing(boltOffset, { toValue: -528, duration: 6_800, easing: Easing.linear, useNativeDriver: false }),
    );
    const coreCurrent = Animated.loop(
      Animated.timing(boltCoreOffset, { toValue: -746, duration: 6_800, easing: Easing.linear, useNativeDriver: false }),
    );

    logoTravel.start();
    logoShimmer.start();
    firstLiquid.start();
    secondLiquid.start();
    boltCurrent.start();
    coreCurrent.start();
    return () => {
      logoTravel.stop();
      logoShimmer.stop();
      firstLiquid.stop();
      secondLiquid.stop();
      boltCurrent.stop();
      coreCurrent.stop();
    };
  }, [design, palette.motion, reduceMotion, viewportHeight, travel, shimmer, liquidOneDrift, liquidTwoDrift, boltOffset, boltCoreOffset, classic]);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      style={[styles.root, { backgroundColor: palette.paper }]}
    >
      {classic ? (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.paper }]} />
      ) : lavender ? (
        <>
          <LinearGradient
            colors={["#c7b6ed", "#b4a2e1", "#a996d7"]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.08, y: 0 }}
            end={{ x: 0.96, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.21)", "rgba(255,255,255,0.04)", "transparent"]}
            locations={[0, 0.33, 0.4, 1]}
            start={{ x: 0, y: 0.1 }}
            end={{ x: 1, y: 0.9 }}
            style={styles.gloss}
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={["#211812", "#151412", "#191310", "#151412"]}
            locations={[0, 0.36, 0.72, 1]}
            start={{ x: 0.04, y: 0 }}
            end={{ x: 0.94, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={["rgba(255,239,213,0)", "rgba(255,239,213,0.018)", "rgba(255,239,213,0.065)", "rgba(255,239,213,0.012)", "rgba(255,239,213,0)"]}
            locations={[0, 0.33, 0.38, 0.43, 1]}
            start={{ x: 0, y: 0.1 }}
            end={{ x: 1, y: 0.9 }}
            style={styles.gloss}
          />
        </>
      )}

      {!classic && (
        <>
          <Animated.View style={[styles.liquidOne, { transform: [{ translateX: liquidOneX }, { translateY: liquidOneY }, { scale: liquidOneScale }] }]}>
            <LinearGradient
              colors={lavender ? ["rgba(85,49,181,0.24)", "rgba(52,95,227,0.15)", "rgba(85,49,181,0)"] : ["rgba(230,91,72,0.25)", "rgba(202,132,73,0.13)", "rgba(230,91,72,0)"]}
              locations={[0, 0.56, 1]} start={{ x: 0.15, y: 0.1 }} end={{ x: 0.86, y: 0.9 }} style={styles.liquidFill}
            />
          </Animated.View>
          <Animated.View style={[styles.liquidTwo, { transform: [{ translateX: liquidTwoX }, { translateY: liquidTwoY }, { scale: liquidTwoScale }] }]}>
            <LinearGradient
              colors={lavender ? ["rgba(52,95,227,0.24)", "rgba(143,120,243,0.14)", "rgba(52,95,227,0)"] : ["rgba(232,191,102,0.2)", "rgba(173,98,55,0.1)", "rgba(232,191,102,0)"]}
              locations={[0, 0.58, 1]} start={{ x: 0.16, y: 0.2 }} end={{ x: 0.9, y: 0.86 }} style={styles.liquidFill}
            />
          </Animated.View>
        </>
      )}

      <Animated.View
        style={[
          styles.watermark,
          {
            width: logoSize,
            height: logoSize,
            opacity: classic ? 0.16 : 0.28,
            transform: classic
              ? [{ translateX: 20 }, { translateY: 18 }, { rotate: "0deg" }]
              : [{ translateX: travelX }, { translateY: travelY }, { rotate: travelRotation }],
          },
        ]}
      >
        <Animated.Image
          source={LOGO_SOURCE}
          resizeMode="contain"
          style={[StyleSheet.absoluteFillObject, { opacity: classic ? 1 : shimmer, ...(lavender ? { mixBlendMode: "multiply" } as any : {}) }]}
        />
        {!classic && (
          <Svg viewBox="0 0 896 896" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={StyleSheet.absoluteFillObject}>
            <Path d={BOLT_PATH} fill="none" stroke={lavender ? "#5531b5" : "#e65b48"} strokeWidth={16} strokeLinecap="round" strokeLinejoin="bevel" opacity={0.54} />
            <AnimatedPath
              d={BOLT_PATH}
              fill="none"
              stroke={lavender ? "#345fe3" : "#ffe08b"}
              strokeWidth={10}
              strokeLinecap="round"
              strokeLinejoin="bevel"
              strokeDasharray={[38, 490]}
              strokeDashoffset={palette.motion && reduceMotion === false ? boltOffset : 0}
              opacity={0.96}
            />
            <AnimatedPath
              d={BOLT_PATH}
              fill="none"
              stroke={lavender ? "#f4efff" : "#fff6dc"}
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="bevel"
              strokeDasharray={[23, 505]}
              strokeDashoffset={palette.motion && reduceMotion === false ? boltCoreOffset : -218}
              opacity={0.94}
            />
          </Svg>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden", zIndex: 0 },
  gloss: { position: "absolute", top: 0, bottom: 0, left: "-24%", width: "148%" },
  liquidOne: { position: "absolute", top: 88, right: -150, width: 440, height: 440, borderRadius: 220, overflow: "hidden" },
  liquidTwo: { position: "absolute", top: 420, left: -150, width: 360, height: 360, borderRadius: 180, overflow: "hidden" },
  liquidFill: { ...StyleSheet.absoluteFillObject, borderRadius: 999 },
  watermark: { position: "absolute", top: 0, left: 0 },
});