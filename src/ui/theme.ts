import type Phaser from "phaser";

/** One warm, tired palette. Placeholder art, but not ugly placeholder art. */
export const COLOR = {
  night: 0x1a1614,
  dusk: 0x2a2320,
  panel: 0x3d332c,
  panelLit: 0x51443a,
  edge: 0x77604d,
  ink: 0xefe4d4,
  inkDim: 0xb8a899,
  warm: 0xd9a066,
  cold: 0x6e7f8d,
  blood: 0x8d4a42,
} as const;

export const CSS = {
  ink: "#efe4d4",
  inkDim: "#b8a899",
  warm: "#d9a066",
} as const;

export const WIDTH = 720;
export const HEIGHT = 1280;

export function font(size: number, color: string = CSS.ink): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: `${size}px`,
    color,
    wordWrap: { width: WIDTH - 120 },
    lineSpacing: Math.round(size * 0.45),
  };
}
