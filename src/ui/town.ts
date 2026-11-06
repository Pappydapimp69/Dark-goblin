import { HEIGHT, WIDTH } from "./theme";

/**
 * The town as a map you walk: where each place stands, where its people
 * stand, and where you start each morning. Pure numbers in game space, so the
 * layout can be tested for every seed without a browser.
 *
 * The whole town fits one screen on purpose. Hit testing is done in screen
 * space (widgets.ts, D-65), and a scrolling camera would put every tap
 * through a second transform that has already failed once on a real phone.
 */
export interface Place {
  id: string;
  name: string;
  /** Centre of the building. */
  x: number;
  y: number;
}

export const PLACES: Place[] = [
  { id: "storefront", name: "The Storefront", x: 200, y: 250 },
  { id: "market", name: "The Market", x: 520, y: 470 },
  { id: "wrecked", name: "The Wrecked Building", x: 200, y: 700 },
  { id: "room", name: "Your Room", x: 510, y: 930 },
];

export const BUILDING = { width: 300, height: 120 };
export const FIGURE_HEIGHT = 88;

/** The walkable ground: everything under the sky band and above the bottom bar. */
export const GROUND = { x1: 24, y1: 150, x2: WIDTH - 24, y2: HEIGHT - 70 };

/** Where you wake up and where you go to sleep: your own door. */
export const HOME = { x: 510, y: 1080 };

const COLUMNS = [-104, 0, 104];
const ROW_GAP = 128;

/**
 * Where the i-th person of a place stands (feet position). Up to three to a
 * row under the building, rows stepping down. Your Room keeps its middle
 * column clear: that is your door, where you stand.
 */
export function standingSpot(placeId: string, index: number): { x: number; y: number } {
  const place = PLACES.find((p) => p.id === placeId) ?? PLACES[1]!;
  const columns = placeId === "room" ? [-150, 150] : COLUMNS;
  const row = Math.floor(index / columns.length);
  const col = index % columns.length;
  return {
    x: place.x + columns[col]!,
    y: place.y + BUILDING.height / 2 + FIGURE_HEIGHT + 22 + row * ROW_GAP,
  };
}

/** Somewhere to stand beside a person to talk: just to their nearer side. */
export function besideSpot(person: { x: number; y: number }, from: { x: number; y: number }): { x: number; y: number } {
  const side = from.x <= person.x ? -1 : 1;
  return clampToGround({ x: person.x + side * 62, y: person.y });
}

export function clampToGround(p: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.min(GROUND.x2, Math.max(GROUND.x1, p.x)),
    y: Math.min(GROUND.y2, Math.max(GROUND.y1 + FIGURE_HEIGHT, p.y)),
  };
}

/** Walking pace in game pixels a second: the far corner of town is about two seconds away. */
export const WALK_SPEED = 560;

export function walkMs(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.round((Math.hypot(to.x - from.x, to.y - from.y) / WALK_SPEED) * 1000);
}
