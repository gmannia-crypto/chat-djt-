import assert from "node:assert/strict";
import {
  ARENA_DESIGN_LABELS,
  getArenaSetupPalette,
  isArenaSetupDesign,
  type ArenaSetupDesign,
} from "./arena-setup-design";

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const design of ["classic", "electric", "lavender"] as ArenaSetupDesign[]) {
  assert(isArenaSetupDesign(design));
  assert(ARENA_DESIGN_LABELS[design].length > 0);
  const palette = getArenaSetupPalette(design);
  assert(contrast(palette.ink, palette.surface) >= 4.5, `${design}: body contrast`);
  assert(contrast(palette.muted, palette.surface) >= 4.5, `${design}: secondary contrast`);
  assert(contrast(palette.ink, palette.paper) >= 4.5, `${design}: heading contrast`);
  assert.equal(palette.motion, design !== "classic");
  assert.equal(palette.gloss, design !== "classic");
  for (const gradient of [palette.surfaceGradient, palette.selectedGradient, palette.buttonGradient]) {
    assert.equal(gradient.length, 3);
    assert(gradient.every((color) => /^#[0-9a-f]{6}$/i.test(color)));
  }
}
for (const invalid of [null, undefined, "", "Electric Gloss", "dark", {}, 1, true, " classic "]) {
  assert.equal(isArenaSetupDesign(invalid), false);
}
assert.notEqual(getArenaSetupPalette("electric").surface, getArenaSetupPalette("lavender").surface);
assert.notEqual(getArenaSetupPalette("classic").surface, getArenaSetupPalette("electric").surface);
console.log("Arena design validation, distinct palettes, motion, and text contrast checks passed.");