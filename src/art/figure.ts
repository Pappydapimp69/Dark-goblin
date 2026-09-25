import { TONES, type Tone, hatch, svgDoc } from "./ink";

export const BUILDS = ["bent", "broad", "round", "slight", "small", "tall"] as const;
export const HEADS = ["bare", "cap", "hat", "hood", "scarf", "tied"] as const;
export const PROPS = ["apron", "basket", "book", "cloth", "fish", "lamp", "ledger", "none", "plank", "rope", "tool", "vessel"] as const;

export type Build = (typeof BUILDS)[number];
export type Head = (typeof HEADS)[number];
export type Prop = (typeof PROPS)[number];

export interface FigureSpec {
  build: Build;
  head: Head;
  prop: Prop;
  tone: Tone;
}

const BODY: Record<Build, { x: number; y: number; w: number; h: number; lean: number }> = {
  bent: { x: 52, y: 88, w: 56, h: 76, lean: -9 },
  broad: { x: 42, y: 78, w: 76, h: 88, lean: 0 },
  round: { x: 45, y: 82, w: 70, h: 84, lean: 0 },
  slight: { x: 58, y: 78, w: 44, h: 90, lean: 4 },
  small: { x: 54, y: 100, w: 52, h: 66, lean: 0 },
  tall: { x: 54, y: 62, w: 52, h: 106, lean: 0 },
};

function headSvg(head: Head): string {
  const cap = {
    bare: `<circle cx="80" cy="58" r="22" fill="#d8b48c" stroke="#1a1411" stroke-width="3"/>`,
    cap: `<circle cx="80" cy="60" r="21" fill="#d8b48c" stroke="#1a1411" stroke-width="3"/><path d="M54 51 Q80 26 108 52 L101 42 Q80 33 60 43 Z" fill="#2f2926"/>`,
    hat: `<circle cx="80" cy="62" r="20" fill="#d8b48c" stroke="#1a1411" stroke-width="3"/><path d="M42 47 H118 L104 58 H56 Z" fill="#2d2621"/><path d="M63 45 L70 22 H93 L100 45 Z" fill="#3d342d"/>`,
    hood: `<path d="M52 72 Q57 34 80 29 Q106 34 111 72 Q97 57 80 57 Q63 57 52 72 Z" fill="#362f2b" stroke="#171210" stroke-width="3"/><circle cx="80" cy="62" r="18" fill="#d8b48c"/>`,
    scarf: `<circle cx="80" cy="57" r="21" fill="#d8b48c" stroke="#1a1411" stroke-width="3"/><path d="M55 76 Q80 91 106 75 L102 91 Q80 100 57 91 Z" fill="#42342e"/>`,
    tied: `<circle cx="80" cy="58" r="21" fill="#d8b48c" stroke="#1a1411" stroke-width="3"/><path d="M57 46 Q80 34 103 46 Q96 29 80 31 Q63 29 57 46 Z" fill="#2f2926"/>`,
  } satisfies Record<Head, string>;
  return cap[head];
}

function propSvg(prop: Prop): string {
  const props = {
    apron: `<path d="M60 103 H100 L95 158 H65 Z" fill="#d7c7a2" opacity="0.68"/><path d="M60 104 H100" stroke="#231a15" stroke-width="3"/>`,
    basket: `<ellipse cx="116" cy="137" rx="20" ry="15" fill="#8a603a" stroke="#1a1411" stroke-width="3"/><path d="M98 134 Q116 105 134 134" fill="none" stroke="#1a1411" stroke-width="4"/>`,
    book: `<path d="M105 116 L138 123 L134 151 L101 143 Z" fill="#75563f" stroke="#1a1411" stroke-width="3"/><path d="M119 119 L115 146" stroke="#d5c099" stroke-width="2"/>`,
    cloth: `<path d="M105 108 Q132 118 128 153 Q112 146 99 158 Q104 130 105 108 Z" fill="#b69b78" stroke="#1a1411" stroke-width="3"/>`,
    fish: `<path d="M104 128 Q126 110 146 127 Q126 145 104 128 Z" fill="#8aa3a6" stroke="#1a1411" stroke-width="3"/><path d="M146 127 L158 117 L158 138 Z" fill="#6f888c" stroke="#1a1411" stroke-width="3"/>`,
    lamp: `<path d="M111 101 V136" stroke="#1a1411" stroke-width="4"/><path d="M96 136 H126 L121 164 H101 Z" fill="#d5a64f" opacity="0.72" stroke="#1a1411" stroke-width="3"/>`,
    ledger: `<rect x="101" y="113" width="34" height="42" rx="2" fill="#654b39" stroke="#1a1411" stroke-width="3"/><path d="M109 126 H128 M109 137 H126" stroke="#cbb891" stroke-width="2"/>`,
    none: ``,
    plank: `<rect x="103" y="98" width="16" height="78" transform="rotate(64 111 137)" fill="#775438" stroke="#1a1411" stroke-width="3"/>`,
    rope: `<path d="M111 107 Q142 129 113 151 Q91 139 111 122 Q127 134 110 144" fill="none" stroke="#b3915e" stroke-width="6"/>`,
    tool: `<path d="M103 156 L139 107" stroke="#1a1411" stroke-width="5"/><path d="M130 101 L151 110" stroke="#77706a" stroke-width="7"/>`,
    vessel: `<path d="M102 122 H137 L130 160 H109 Z" fill="#8f8171" stroke="#1a1411" stroke-width="3"/><ellipse cx="119" cy="122" rx="18" ry="6" fill="#b8ab98" stroke="#1a1411" stroke-width="3"/>`,
  } satisfies Record<Prop, string>;
  return props[prop];
}

export function figureSvg(spec: FigureSpec, broken = false): string {
  const b = BODY[spec.build];
  const fill = broken ? "#4b4641" : TONES[spec.tone];
  const pattern = `h${spec.build}${spec.head}${spec.prop}`;
  return svgDoc(
    160,
    190,
    `${hatch(pattern)}
    <rect width="160" height="190" fill="transparent"/>
    <path d="M${b.x + b.lean} ${b.y} Q80 ${b.y - 16} ${b.x + b.w - b.lean} ${b.y} L${b.x + b.w} ${b.y + b.h} Q80 ${b.y + b.h + 14} ${b.x} ${b.y + b.h} Z" fill="${fill}" stroke="#171210" stroke-width="4"/>
    <path d="M${b.x + 6} ${b.y + 8} H${b.x + b.w - 6} V${b.y + b.h - 8} H${b.x + 6} Z" fill="url(#${pattern})" opacity="0.7"/>
    ${headSvg(spec.head)}
    <path d="M60 78 Q80 91 100 78" fill="none" stroke="#171210" stroke-width="3" opacity="0.45"/>
    <path d="M63 166 L57 186 M97 166 L103 186" stroke="#171210" stroke-width="5"/>
    <path d="M57 186 H72 M88 186 H106" stroke="#171210" stroke-width="5"/>
    ${propSvg(spec.prop)}
    ${broken ? `<path d="M48 80 L112 164 M110 82 L51 160" stroke="#1a1411" stroke-width="4" opacity="0.55"/>` : ``}`,
  );
}
