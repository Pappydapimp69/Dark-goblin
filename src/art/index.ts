import type { Content, NpcDef } from "../engine/types";
import { BUILDS, HEADS, PROPS, figureSvg, type FigureSpec } from "./figure";
import { TONES, hatch, svgDoc } from "./ink";
import { portraitSvg } from "./portrait";

export const PORTRAIT_STAGES = 5;
export const GOBLIN_KEY = "goblin";

export interface Asset {
  key: string;
  svg: string;
  uri: string;
}

export function figureKey(id: string): string {
  return `figure:${id}`;
}

export function brokenKey(id: string): string {
  return `figure:${id}:broken`;
}

export function placeKey(id: string): string {
  return `place:${id}`;
}

export function buildingKey(id: string): string {
  return `building:${id}`;
}

export function portraitKey(stage: number): string {
  return `portrait:${stage}`;
}

export function portraitStage(current: number, max: number): number {
  if (max <= 1) return PORTRAIT_STAGES - 1;
  return Math.max(0, Math.min(PORTRAIT_STAGES - 1, Math.floor((current / max) * PORTRAIT_STAGES)));
}

function has<T extends readonly string[]>(items: T, value: unknown): value is T[number] {
  return typeof value === "string" && (items as readonly string[]).includes(value);
}

export function readSpec(id: string, art: NpcDef["art"]): FigureSpec {
  if (!art) throw new Error(`${id} has no art spec`);
  if (!has(BUILDS, art.build)) throw new Error(`${id} has unknown build "${art.build}"`);
  if (!has(HEADS, art.head)) throw new Error(`${id} has unknown head "${art.head}"`);
  if (!has(PROPS, art.prop)) throw new Error(`${id} has unknown prop "${art.prop}"`);
  if (!(art.tone in TONES)) throw new Error(`${id} has unknown tone "${art.tone}"`);
  return art as FigureSpec;
}

function uri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function asset(key: string, svg: string): Asset {
  return { key, svg, uri: uri(svg) };
}

function placeSvg(id: string): string {
  const label = id === "storefront" ? "STORE" : id === "wrecked" ? "RUIN" : id === "room" ? "ROOM" : "MARKET";
  const roof = id === "wrecked" ? "#4a3930" : "#563b2d";
  return svgDoc(
    900,
    190,
    `<rect width="900" height="190" fill="#211a17"/>
    <rect y="132" width="900" height="58" fill="#2f2924"/>
    <path d="M0 132 Q140 108 300 132 T620 132 T900 132 V190 H0 Z" fill="#3a332d"/>
    <path d="M70 118 H270 L248 64 H92 Z" fill="${roof}" stroke="#15110f" stroke-width="5"/>
    <rect x="103" y="89" width="46" height="43" fill="#d7b982" opacity="0.32"/>
    <rect x="170" y="83" width="50" height="49" fill="#d7b982" opacity="0.22"/>
    <text x="450" y="93" text-anchor="middle" font-family="Georgia,serif" font-size="42" fill="#b89f86" opacity="0.24">${label}</text>
    <path d="M590 124 Q690 78 800 121" fill="none" stroke="#16110f" stroke-width="8" opacity="0.35"/>`,
  );
}

/**
 * The town map's buildings, one per place, in the same cut as the people:
 * flat ink, a hatch for shade, the palette from ink.ts. 300 x 120.
 */
function buildingSvg(id: string): string {
  const ink = "#120f0d";
  const shade = `${hatch(`h-${id}`)}`;
  const bodies: Record<string, string> = {
    storefront: `
      <rect x="40" y="38" width="220" height="78" fill="#4a3a30" stroke="${ink}" stroke-width="4"/>
      <path d="M28 40 L150 6 L272 40 Z" fill="#563b2d" stroke="${ink}" stroke-width="4"/>
      <path d="M44 58 H256 L246 74 H54 Z" fill="#b66e4f" stroke="${ink}" stroke-width="3"/>
      <path d="M74 58 L68 74 M104 58 L100 74 M134 58 L132 74 M166 58 L168 74 M196 58 L200 74 M226 58 L232 74" stroke="#d7b982" stroke-width="5" opacity="0.7"/>
      <rect x="66" y="80" width="80" height="30" fill="#d7b982" opacity="0.45" stroke="${ink}" stroke-width="3"/>
      <rect x="170" y="78" width="40" height="38" fill="#2a211c" stroke="${ink}" stroke-width="3"/>
      <rect x="110" y="44" width="80" height="12" fill="#2a211c"/>
      <rect x="40" y="38" width="220" height="78" fill="url(#h-${id})"/>`,
    market: `
      <ellipse cx="236" cy="92" rx="34" ry="16" fill="#3a332d" stroke="${ink}" stroke-width="4"/>
      <ellipse cx="236" cy="88" rx="22" ry="9" fill="#1b2a2f"/>
      <path d="M212 88 V58 M260 88 V58 M206 58 H266" stroke="${ink}" stroke-width="5"/>
      <rect x="34" y="64" width="150" height="46" fill="#4a3a30" stroke="${ink}" stroke-width="4"/>
      <path d="M24 66 L44 22 H174 L194 66 Z" fill="#5f854f" stroke="${ink}" stroke-width="4"/>
      <path d="M66 22 L58 66 M98 22 L96 66 M130 22 L132 66 M162 22 L170 66" stroke="#d7b982" stroke-width="6" opacity="0.55"/>
      <rect x="50" y="80" width="30" height="22" fill="#b8a982" stroke="${ink}" stroke-width="3"/>
      <rect x="92" y="80" width="30" height="22" fill="#b66e4f" stroke="${ink}" stroke-width="3"/>
      <rect x="134" y="80" width="30" height="22" fill="#b8a982" stroke="${ink}" stroke-width="3"/>
      <rect x="34" y="64" width="150" height="46" fill="url(#h-${id})"/>`,
    wrecked: `
      <path d="M40 116 V52 L84 34 L98 60 L132 30 V116 Z" fill="#4a3930" stroke="${ink}" stroke-width="4"/>
      <path d="M160 116 V66 L198 48 L214 74 L250 56 V116 Z" fill="#4a3930" stroke="${ink}" stroke-width="4"/>
      <path d="M70 116 L118 66 M150 40 L236 104 M120 30 L176 60" stroke="#78543e" stroke-width="9" stroke-linecap="round"/>
      <path d="M30 116 Q90 100 140 112 T270 112" fill="none" stroke="#2f2924" stroke-width="10"/>
      <rect x="60" y="72" width="26" height="22" fill="#120f0d"/>
      <rect x="186" y="82" width="24" height="20" fill="#120f0d"/>
      <path d="M40 116 V52 L84 34 L98 60 L132 30 V116 Z" fill="url(#h-${id})"/>`,
    room: `
      <rect x="70" y="50" width="160" height="66" fill="#4a3a30" stroke="${ink}" stroke-width="4"/>
      <path d="M56 54 L150 10 L244 54 Z" fill="#563b2d" stroke="${ink}" stroke-width="4"/>
      <rect x="196" y="16" width="20" height="30" fill="#3a2c24" stroke="${ink}" stroke-width="3"/>
      <rect x="92" y="66" width="40" height="30" fill="#d9a066" opacity="0.85" stroke="${ink}" stroke-width="3"/>
      <path d="M112 66 V96 M92 81 H132" stroke="${ink}" stroke-width="3"/>
      <rect x="160" y="70" width="36" height="46" fill="#2a211c" stroke="${ink}" stroke-width="3"/>
      <circle cx="188" cy="94" r="3" fill="#d7b982"/>
      <rect x="70" y="50" width="160" height="66" fill="url(#h-${id})"/>`,
  };
  return svgDoc(300, 120, `${shade}<rect width="300" height="120" fill="transparent"/>${bodies[id] ?? bodies["market"]!}`);
}

function goblinSvg(): string {
  return svgDoc(
    240,
    320,
    `<rect width="240" height="320" fill="transparent"/>
    <path d="M67 88 Q120 18 173 88 L205 246 Q168 300 120 300 Q72 300 35 246 Z" fill="#171310" stroke="#080605" stroke-width="8"/>
    <path d="M65 91 L33 41 L92 72 M175 91 L207 41 L148 72" fill="#201915" stroke="#080605" stroke-width="7"/>
    <ellipse cx="107" cy="104" rx="10" ry="7" fill="#d7b982"/>
    <ellipse cx="133" cy="104" rx="10" ry="7" fill="#d7b982"/>
    <path d="M101 159 Q120 174 139 159" fill="none" stroke="#6f4b3d" stroke-width="5"/>
    <path d="M72 205 Q120 231 168 205" fill="none" stroke="#0c0908" stroke-width="10" opacity="0.55"/>`,
  );
}

export function assetManifest(content: Content): Asset[] {
  const out: Asset[] = [];
  for (const npc of content.npcs) {
    // The player is drawn only once they have an art spec: they walk the town.
    if (npc.role === "player" && !npc.art) continue;
    const spec = readSpec(npc.id, npc.art);
    out.push(asset(figureKey(npc.id), figureSvg(spec)));
    if (content.choices.some((choice) => choice.npc === npc.id && choice.aftermath)) {
      out.push(asset(brokenKey(npc.id), figureSvg(spec, true)));
    }
  }
  for (const id of content.rules.locations ?? []) {
    if (!["storefront", "market", "wrecked", "room"].includes(id)) throw new Error(`no backdrop for ${id}`);
    out.push(asset(placeKey(id), placeSvg(id)));
    out.push(asset(buildingKey(id), buildingSvg(id)));
  }
  for (let stage = 0; stage < PORTRAIT_STAGES; stage += 1) out.push(asset(portraitKey(stage), portraitSvg(stage)));
  out.push(asset(GOBLIN_KEY, goblinSvg()));
  return out;
}

export { BUILDS, HEADS, PROPS, TONES, figureSvg, portraitSvg };
