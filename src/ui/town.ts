import { evaluate } from "../engine/conditions";
import type { Content, GameState } from "../engine/types";
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

// ---------------------------------------------------------------- the view

/** Which drawing of a building, by what has happened to it. */
export type BuildingLook = "standing" | "rebuilt";

export interface TownView {
  places: { id: string; name: string; look: BuildingLook; x: number; y: number }[];
  people: { id: string; place: string; x: number; y: number }[];
}

/** Each held slot is a place you can stand at: whoever holds it stands there. */
const SLOT_PLACE: Record<string, string> = { storefront: "storefront", wrecked_shop: "wrecked" };

/**
 * The town as it is today, not as it was authored: §1 says the town changes,
 * so the map has to show it. Someone who has gone is not drawn; whoever holds
 * a shop stands at it and the place takes their name; the ruin is drawn
 * rebuilt once the rebuilt shop exists. Pure: reads state, writes nothing.
 */
export function townView(state: GameState, content: Content): TownView {
  const home = new Map(content.npcs.map((n) => [n.id, n.location ?? "market"]));
  for (const [slotId, placeId] of Object.entries(SLOT_PLACE)) {
    const holder = state.slots[slotId]?.holder;
    if (holder && holder !== "player" && state.slots[slotId]?.exists) home.set(holder, placeId);
  }

  const gone = (id: string): boolean => {
    const away = content.npcs.find((n) => n.id === id)?.away;
    return away !== undefined && evaluate(away, state, `npcs.json "${id}".away`);
  };

  const people: TownView["people"] = [];
  for (const place of PLACES) {
    const here = Object.values(state.npcs)
      .filter((n) => n.present && n.id !== "player" && !gone(n.id) && home.get(n.id) === place.id)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    here.forEach((n, i) => people.push({ id: n.id, place: place.id, ...standingSpot(place.id, i) }));
  }

  const nameOf = (id: string | null | undefined): string | undefined =>
    id === "player" ? "Yours" : id ? state.npcs[id]?.name : undefined;
  const places = PLACES.map((p) => {
    let name = p.name;
    let look: BuildingLook = "standing";
    if (p.id === "storefront") {
      const holder = state.slots["storefront"]?.holder;
      const original = content.slots.find((s) => s.id === "storefront")?.holder;
      if (holder !== original) name = holder === "player" ? "The Storefront — yours now" : holder ? `${nameOf(holder)}'s Shop` : "The Storefront, empty";
    }
    if (p.id === "wrecked" && state.slots["wrecked_shop"]?.exists) {
      look = "rebuilt";
      const holder = state.slots["wrecked_shop"]?.holder;
      name = holder === "player" ? "The Rebuilt Shop — yours" : holder ? `${nameOf(holder)}'s Shop` : "The Rebuilt Shop";
    }
    return { id: p.id, name, look, x: p.x, y: p.y };
  });

  return { places, people };
}
