import React from "react";
import { Image, StyleSheet, View } from "react-native";

const LOGO_SOURCE = require("../../assets/images/dynamic-creations-transparent.png");
const BOLT_PATH = "M552 282 L433 335 L469 282 L365 573";

const BACKDROP_STYLES = `
.arenaSetupBackdropRoot {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  height: 100dvh !important;
  overflow: hidden !important;
  pointer-events: none !important;
  z-index: 0 !important;
  background:
    radial-gradient(ellipse at 12% 0%, rgba(232,191,102,.12), transparent 26rem),
    linear-gradient(125deg, transparent 12%, rgba(255,239,213,.035) 22%, rgba(255,239,213,.12) 23%, rgba(255,239,213,.015) 25%, transparent 38%),
    radial-gradient(ellipse at 82% 7%, rgba(141,49,38,.28), transparent 31rem),
    radial-gradient(ellipse at 6% 48%, rgba(127,86,33,.1), transparent 28rem),
    #151412 !important;
}
.arenaSetupBackdropAtmosphere {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.arenaSetupBackdropLiquid {
  position: absolute;
  border-radius: 50%;
  opacity: .42;
  will-change: transform;
}
.arenaSetupBackdropLiquidOne {
  top: 110px;
  right: -130px;
  width: 420px;
  height: 420px;
  background: radial-gradient(circle at 37% 35%, rgba(212,99,73,.28), rgba(202,132,73,.14) 55%, transparent 72%);
  animation: arenaSetupBackdropDriftOne 19s ease-in-out infinite alternate;
}
.arenaSetupBackdropLiquidTwo {
  top: 470px;
  left: -130px;
  width: 340px;
  height: 340px;
  background: radial-gradient(circle at 55% 50%, rgba(232,191,102,.24), rgba(173,98,55,.12) 58%, transparent 73%);
  animation: arenaSetupBackdropDriftTwo 23s ease-in-out infinite alternate-reverse;
}
.arenaSetupBackdropGloss {
  position: absolute;
  inset: -10% -25%;
  background: linear-gradient(125deg, transparent 12%, rgba(255,239,213,.018) 22%, rgba(255,239,213,.058) 23%, rgba(255,239,213,.008) 25%, transparent 38%);
}
.arenaSetupBackdropMark {
  position: fixed;
  top: 0;
  left: 0;
  width: min(340px, 68vw);
  aspect-ratio: 1;
  opacity: .28;
  mix-blend-mode: screen;
  will-change: transform;
  animation: arenaSetupBackdropTravel 32s ease-in-out infinite alternate;
}
.arenaSetupBackdropLogo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  animation: arenaSetupBackdropShimmer 9s ease-in-out infinite;
}
.arenaSetupBackdropBolt {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.arenaSetupBackdropBolt path {
  fill: none;
  stroke: #ffe08b;
  stroke-width: 10;
  stroke-linecap: round;
  stroke-linejoin: bevel;
  stroke-dasharray: 38 490;
  stroke-dashoffset: 0;
  filter: drop-shadow(0 0 3px #f6bc52) drop-shadow(0 0 10px rgba(230,91,72,.9));
  animation: arenaSetupBackdropCurrent 6.8s linear infinite;
}
.arenaSetupBackdropBolt .arenaSetupBackdropGlow {
  stroke: #e65b48;
  stroke-width: 16;
  stroke-dasharray: none;
  opacity: .54;
  filter: drop-shadow(0 0 7px rgba(230,91,72,.9));
  animation: none;
}
.arenaSetupBackdropBolt .arenaSetupBackdropCore {
  stroke: #fff6dc;
  stroke-width: 3.2;
  stroke-dasharray: 23 505;
  animation-delay: -2.8s;
}
@keyframes arenaSetupBackdropTravel {
  from { transform: translate3d(calc(100vw - 100% - 20px), 18px, 0) rotate(-8deg); }
  to { transform: translate3d(20px, calc(100dvh - 100% - 20px), 0) rotate(8deg); }
}
@keyframes arenaSetupBackdropShimmer {
  0%,100% { opacity: .72; filter: brightness(.98) saturate(.95); }
  50% { opacity: 1; filter: brightness(1.14) saturate(1.13); }
}
@keyframes arenaSetupBackdropCurrent { to { stroke-dashoffset: -528; } }
@keyframes arenaSetupBackdropDriftOne {
  from { transform: translate3d(-8px,-5px,0) scale(.96); }
  to { transform: translate3d(17px,14px,0) scale(1.06); }
}
@keyframes arenaSetupBackdropDriftTwo {
  from { transform: translate3d(14px,10px,0) scale(1.04); }
  to { transform: translate3d(-14px,-12px,0) scale(.95); }
}
@media (prefers-reduced-motion: reduce) {
  .arenaSetupBackdropLiquid,
  .arenaSetupBackdropMark,
  .arenaSetupBackdropLogo,
  .arenaSetupBackdropBolt path {
    animation: none !important;
    will-change: auto;
  }
  .arenaSetupBackdropMark {
    transform: translate3d(calc(100vw - 100% - 20px), 18px, 0) rotate(-8deg);
  }
}
`;

export function ArenaSetupBackdrop() {
  return React.createElement(
    View,
    {
      pointerEvents: "none",
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: "no-hide-descendants",
      className: "arenaSetupBackdropRoot",
      style: [StyleSheet.absoluteFillObject, { backgroundColor: "#151412", zIndex: 0 }],
    } as any,
    React.createElement(
      React.Fragment,
      null,
      React.createElement("style", null, BACKDROP_STYLES),
      React.createElement(
        "div",
        { className: "arenaSetupBackdropAtmosphere", "aria-hidden": "true" },
        React.createElement("div", { className: "arenaSetupBackdropLiquid arenaSetupBackdropLiquidOne" }),
        React.createElement("div", { className: "arenaSetupBackdropLiquid arenaSetupBackdropLiquidTwo" }),
        React.createElement("div", { className: "arenaSetupBackdropGloss" }),
        React.createElement(
          "div",
          { className: "arenaSetupBackdropMark" },
          React.createElement(Image, {
            source: LOGO_SOURCE,
            resizeMode: "contain",
            className: "arenaSetupBackdropLogo",
            style: styles.logo,
          } as any),
          React.createElement(
            "svg",
            {
              className: "arenaSetupBackdropBolt",
              viewBox: "0 0 896 896",
              preserveAspectRatio: "xMidYMid meet",
              "aria-hidden": "true",
            },
            React.createElement("path", { className: "arenaSetupBackdropGlow", d: BOLT_PATH }),
            React.createElement("path", { d: BOLT_PATH }),
            React.createElement("path", { className: "arenaSetupBackdropCore", d: BOLT_PATH }),
          ),
        ),
      ),
    ),
  );
}

const styles = StyleSheet.create({
  logo: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
});