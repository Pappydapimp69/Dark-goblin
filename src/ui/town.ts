import { evaluate } from "../engine/conditions";
import type { Content, GameState } from "../engine/types";

/**
 * The town as a tile map you walk. Pure data and arithmetic in game space, so
 * the map can be tested without a browser: every tile, every place, where its
 * people stand, and the paths between them.
 *
 * It fits one screen on purpose (18 x 26 tiles of 40px under a sky band).
 * Hit testing is done in screen space (widgets.ts, D-65); a scrolling camera
 * would put every tap through a second transform that has already failed once
 * on a real phone.
 */

export const TILE = 40;
export const MAP_TOP = 120;
export const COLS = 18;
export const ROWS = 26;

/**
 * The town, one character per tile:
 *   . , grass      = road      # cobbles     b bridge
 *   T tree         ~ river     w the well
 *   S storefront   M market stall   W the wrecked building   H your house
 */
export const GRID: readonly string[] = [
  "TT.T,.T.==.T..T.TT",
  "T....,..==.,...T.T",
  ".SSSSSS.==..T.....",
  ".SSSSSS.==......,.",
  ".SSSSSS.==..,...T.",
  ".SSSSSS.==........",
  ",..=======........",
  "T..,....==..,....T",
  ".....T..==########",
  "........==#MMMM##.",
  ".,......==#MMMM##T",
  "........====######",
  "........==######w#",
  ".WWWWW..==########",
  ".WWWWW..==.,......",
  ".WWWWW====.....T..",
  ".WWWWW..==..,.....",
  "~~~~~~~~bb~~~~~~~~",
  "~~~~~~~~bb~~~~~~~~",
  "..T.....==.HHHH..T",
  ".,......==.HHHH...",
  "T.......==.HHHH.,.",
  "..,.....==.HHHH...",
  ".T......=======...",
  "...T.,.....,...T..",
  "TT.T..T..T..T.TT.T",
];

const WALKABLE = new Set([".", ",", "=", "#", "b"]);

export type Tile = { col: number; row: number };
export type Point = { x: number; y: number };

export function tileAt(t: Tile): string {
  return GRID[t.row]?.[t.col] ?? "T";
}

export function walkable(t: Tile): boolean {
  return WALKABLE.has(tileAt(t));
}

/** Where a figure standing on this tile has its feet. */
export function feet(t: Tile): Point {
  return { x: t.col * TILE + TILE / 2, y: MAP_TOP + t.row * TILE + TILE - 4 };
}

/** The tile under a point on screen (clamped to the map). */
export function tileUnder(p: Point): Tile {
  return {
    col: Math.min(COLS - 1, Math.max(0, Math.floor(p.x / TILE))),
    row: Math.min(ROWS - 1, Math.max(0, Math.floor((p.y - MAP_TOP) / TILE))),
  };
}

export interface Place {
  id: string;
  name: string;
  /** The building's footprint, in tiles. */
  footprint: { col: number; row: number; cols: number; rows: number };
  /** The walkable tile in front of its door. */
  door: Tile;
  /** Where its people stand, nearest the door first. */
  spots: Tile[];
}

export const PLACES: Place[] = [
  {
    id: "storefront", name: "The Storefront",
    footprint: { col: 1, row: 2, cols: 6, rows: 4 }, door: { col: 3, row: 6 },
    spots: [{ col: 2, row: 7 }, { col: 5, row: 7 }, { col: 7, row: 7 }, { col: 1, row: 6 }, { col: 4, row: 1 }, { col: 7, row: 2 }],
  },
  {
    id: "market", name: "The Market",
    footprint: { col: 11, row: 9, cols: 4, rows: 2 }, door: { col: 12, row: 11 },
    spots: [{ col: 11, row: 12 }, { col: 14, row: 12 }, { col: 16, row: 10 }, { col: 10, row: 8 }, { col: 13, row: 8 }, { col: 16, row: 8 }],
  },
  {
    id: "wrecked", name: "The Wrecked Building",
    footprint: { col: 1, row: 13, cols: 5, rows: 4 }, door: { col: 6, row: 15 },
    spots: [{ col: 6, row: 13 }, { col: 7, row: 16 }, { col: 2, row: 12 }, { col: 4, row: 12 }, { col: 0, row: 14 }, { col: 6, row: 11 }],
  },
  {
    id: "room", name: "Your Room",
    footprint: { col: 11, row: 19, cols: 4, rows: 4 }, door: { col: 12, row: 23 },
    spots: [{ col: 10, row: 21 }, { col: 15, row: 21 }, { col: 16, row: 23 }, { col: 10, row: 19 }],
  },
];

/** Where you wake up and where you go to sleep: in front of your own door. */
export const HOME_TILE: Tile = { col: 12, row: 23 };
export const HOME: Point = feet(HOME_TILE);

export const FIGURE_HEIGHT = 74;

/** Walking pace: tiles a second. The far corner of town is about three seconds away. */
export const TILES_PER_SECOND = 12;

const key = (t: Tile): string => `${t.col},${t.row}`;
const STEPS: Tile[] = [{ col: 1, row: 0 }, { col: -1, row: 0 }, { col: 0, row: 1 }, { col: 0, row: -1 }];

/**
 * Shortest walk on the grid, four directions, around anything not walkable and
 * any tile someone is standing on. Returns the tiles after `from`, ending at
 * `to`; [] when already there; null when there is no way.
 */
export function path(from: Tile, to: Tile, occupied: ReadonlySet<string> = new Set()): Tile[] | null {
  if (key(from) === key(to)) return [];
  const prev = new Map<string, Tile | null>([[key(from), null]]);
  const queue: Tile[] = [from];
  while (queue.length > 0) {
    const here = queue.shift()!;
    for (const s of STEPS) {
      const next = { col: here.col + s.col, row: here.row + s.row };
      const k = key(next);
      if (prev.has(k) || !walkable(next) || (occupied.has(k) && k !== key(to))) continue;
      prev.set(k, here);
      if (k === key(to)) {
        const out: Tile[] = [next];
        let back = here;
        while (key(back) !== key(from)) {
          out.unshift(back);
          back = prev.get(key(back))!;
        }
        return out;
      }
      queue.push(next);
    }
  }
  return null;
}

/** The free walkable tile nearest a point — where a tap on a tree or a roof sends you. */
export function nearestFree(p: Point, occupied: ReadonlySet<string> = new Set()): Tile {
  let best: Tile = HOME_TILE;
  let bestD = Infinity;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const t = { col, row };
      if (!walkable(t) || occupied.has(key(t))) continue;
      const f = feet(t);
      const d = Math.hypot(f.x - p.x, f.y - TILE / 2 - p.y);
      if (d < bestD) { bestD = d; best = t; }
    }
  }
  return best;
}

/**
 * Where to stand to talk to someone: a free tile beside them (Brain 0101#E1:
 * walk to the target's free neighbour, never onto the target). The one with
 * the shortest walk wins.
 */
export function besideTile(person: Tile, from: Tile, occupied: ReadonlySet<string>): { tile: Tile; walk: Tile[] } | null {
  let best: { tile: Tile; walk: Tile[] } | null = null;
  for (const s of STEPS) {
    const t = { col: person.col + s.col, row: person.row + s.row };
    if (!walkable(t) || (occupied.has(key(t)) && key(t) !== key(from))) continue;
    const walk = path(from, t, occupied);
    if (walk && (!best || walk.length < best.walk.length)) best = { tile: t, walk };
  }
  return best;
}

export function tileKey(t: Tile): string {
  return key(t);
}

// ---------------------------------------------------------------- the view

export type BuildingLook = "standing" | "rebuilt";

export interface TownView {
  places: { id: string; name: string; look: BuildingLook }[];
  people: { id: string; place: string; tile: Tile; x: number; y: number }[];
}

/** Each held slot is a place you can stand at: whoever holds it stands there. */
const SLOT_PLACE: Record<string, string> = { storefront: "storefront", wrecked_shop: "wrecked" };

/**
 * The town as it is today, not as it was authored (D-82): someone who has gone
 * is not drawn; whoever holds a shop stands at it and it takes their name; the
 * ruin is drawn rebuilt once the rebuilt shop exists. Pure.
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
    here.forEach((n, i) => {
      const tile = place.spots[i] ?? overflowSpot(place, i);
      people.push({ id: n.id, place: place.id, tile, ...feet(tile) });
    });
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
    return { id: p.id, name, look };
  });
  return { places, people };
}

/** Past the authored spots: the next free grass tile out from the door. */
function overflowSpot(place: Place, index: number): Tile {
  const taken = new Set(place.spots.map(key));
  let n = index - place.spots.length;
  for (let r = 1; r < 6; r += 1) {
    for (let dr = -r; dr <= r; dr += 1) for (let dc = -r; dc <= r; dc += 1) {
      const t = { col: place.door.col + dc, row: place.door.row + dr };
      if (!walkable(t) || taken.has(key(t)) || key(t) === key(place.door)) continue;
      if (n === 0) return t;
      n -= 1;
      taken.add(key(t));
    }
  }
  return place.door;
}
