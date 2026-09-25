import { svgDoc } from "./ink";

export function portraitSvg(stage: number): string {
  const s = Math.max(0, Math.min(4, stage));
  const wrinkle = 2 + s * 3;
  const shade = ["#c49b77", "#bd9270", "#b18667", "#a6785c", "#95694f"][s]!;
  return svgDoc(
    240,
    320,
    `<rect width="240" height="320" fill="#191411"/>
    <path d="M57 157 Q64 70 120 59 Q176 70 183 157 Q181 238 120 263 Q59 238 57 157 Z" fill="${shade}" stroke="#100c0a" stroke-width="6"/>
    <path d="M65 139 Q120 98 176 139" fill="none" stroke="#2a201b" stroke-width="10" opacity="0.45"/>
    <circle cx="92" cy="148" r="${8 - Math.min(s, 3)}" fill="#17110f"/>
    <circle cx="148" cy="148" r="${8 - Math.min(s, 3)}" fill="#17110f"/>
    <path d="M120 154 L109 194 H129 Z" fill="#8b5f4c" opacity="0.55"/>
    <path d="M88 221 Q120 ${235 + s * 4} 152 221" fill="none" stroke="#251b17" stroke-width="5"/>
    ${Array.from({ length: s + 1 }, (_, i) => `<path d="M78 ${174 + i * wrinkle} Q120 ${166 + i * wrinkle} 162 ${174 + i * wrinkle}" fill="none" stroke="#261b16" stroke-width="2" opacity="0.32"/>`).join("")}
    <path d="M56 102 Q120 19 184 102 Q161 67 120 67 Q79 67 56 102 Z" fill="#251f1c"/>`,
  );
}
