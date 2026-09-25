export const TONES = {
  ash: "#6d7470",
  bone: "#b8a982",
  moss: "#5f854f",
  rust: "#b66e4f",
  umber: "#78543e",
} as const;

export type Tone = keyof typeof TONES;

export function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function svgDoc(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

export function hatch(id: string): string {
  return `<defs><pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2="7" stroke="#120f0d" stroke-width="1.4" opacity="0.38"/></pattern></defs>`;
}
