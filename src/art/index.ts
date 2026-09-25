import type { Content, NpcDef } from "../engine/types";
import { BUILDS, HEADS, PROPS, figureSvg, type FigureSpec } from "./figure";
import { TONES, svgDoc } from "./ink";
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
    if (npc.role === "player") continue;
    const spec = readSpec(npc.id, npc.art);
    out.push(asset(figureKey(npc.id), figureSvg(spec)));
    if (content.choices.some((choice) => choice.npc === npc.id && choice.aftermath)) {
      out.push(asset(brokenKey(npc.id), figureSvg(spec, true)));
    }
  }
  for (const id of content.rules.locations ?? []) {
    if (!["storefront", "market", "wrecked", "room"].includes(id)) throw new Error(`no backdrop for ${id}`);
    out.push(asset(placeKey(id), placeSvg(id)));
  }
  for (let stage = 0; stage < PORTRAIT_STAGES; stage += 1) out.push(asset(portraitKey(stage), portraitSvg(stage)));
  out.push(asset(GOBLIN_KEY, goblinSvg()));
  return out;
}

export { BUILDS, HEADS, PROPS, TONES, figureSvg, portraitSvg };
