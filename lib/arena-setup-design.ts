export const ARENA_DESIGN_STORAGE_KEY = "arena_setup_design";
export type ArenaSetupDesign = "classic" | "electric" | "lavender";

export function isArenaSetupDesign(value: unknown): value is ArenaSetupDesign {
  return value === "classic" || value === "electric" || value === "lavender";
}

export const ARENA_DESIGN_LABELS: Record<ArenaSetupDesign, string> = {
  classic: "Classic Arena",
  electric: "Electric Gloss",
  lavender: "Lavender Electric",
};

// Only the new setup surfaces use these tokens; existing gameplay colors stay intact.
export function getArenaSetupPalette(design: ArenaSetupDesign) {
  const lavender = design === "lavender";
  const classic = design === "classic";
  return {
    paper: lavender ? "#b4a2e1" : classic ? "#0a0a0a" : "#151412",
    ink: lavender ? "#202954" : "#f5eee3",
    muted: lavender ? "#4b5276" : "#c2b7a6",
    accent: lavender ? "#5531b5" : "#e8bf66",
    red: lavender ? "#345fe3" : "#e65b48",
    line: lavender ? "rgba(61,42,113,0.22)" : "rgba(232,191,102,0.22)",
    border: lavender ? "rgba(255,255,255,0.72)" : "rgba(237,212,172,0.3)",
    surface: lavender ? "#e9defb" : classic ? "#171717" : "#2b241e",
    selectedSurface: lavender ? "#d6c7f4" : classic ? "#282116" : "#3b2c22",
    receipt: lavender ? "rgba(74,51,141,0.08)" : "rgba(0,0,0,0.22)",
    // Advanced controls retain their original dark sub-panels and contrast.
    controlsSurface: "#211d18",
    gloss: !classic,
    motion: !classic,
    surfaceGradient: (lavender
      ? ["#ffffff", "#f1e9ff", "#e3d6f8"]
      : classic
        ? ["#171717", "#171717", "#171717"]
        : ["#504234", "#2b241e", "#191816"]) as [string, string, string],
    selectedGradient: (lavender
      ? ["#ffffff", "#ede5ff", "#d6c7f4"]
      : classic
        ? ["#282116", "#282116", "#282116"]
        : ["#66503a", "#3b2c22", "#1c1915"]) as [string, string, string],
    buttonGradient: (lavender
      ? ["#7284ee", "#5262d6", "#5633b3"]
      : classic
        ? ["#e65b48", "#e65b48", "#e65b48"]
        : ["#f9977c", "#dc6550", "#cc4937"]) as [string, string, string],
  };
}