import { content } from "../content";
import { availableChoices } from "../engine/engine";
import type { GameState } from "../engine/types";

/**
 * One slot, in localStorage, per §2.
 *
 * The key is namespaced because itch.io and GitHub Pages serve every project
 * of one account from a single origin — the project name is a path, and
 * storage is scoped to the origin, not the path. Without the namespace two
 * games by the same author share a save.
 *
 * Every access is wrapped: in a private window, an embedded webview, or with
 * site data blocked, `localStorage` can throw on the ACCESS, not just on the
 * parse. An unreadable or corrupt save degrades to a clean first morning,
 * never to a white screen.
 */
const KEY = "darkgoblin:v1:save";
export const SCHEMA = 1;

interface Envelope {
  schema: number;
  savedAt: string;
  state: GameState;
}

export type LoadFailure = "none" | "unavailable" | "unreadable" | "older" | "newer" | "invalid";
export type LoadResult = { ok: true; state: GameState } | { ok: false; reason: LoadFailure };

function storage(): Storage | null {
  try {
    const probe = globalThis.localStorage;
    if (!probe) return null;
    // Touch it: availability is not the same as usability.
    probe.getItem(KEY);
    return probe;
  } catch {
    return null;
  }
}

export function save(state: GameState): boolean {
  const store = storage();
  if (!store) return false;
  try {
    const envelope: Envelope = { schema: SCHEMA, savedAt: new Date().toISOString(), state };
    store.setItem(KEY, JSON.stringify(envelope));
    return true;
  } catch {
    // Quota, private mode, anything. A game that cannot save still plays.
    return false;
  }
}

export function clear(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    /* nothing to do and nothing worth saying */
  }
}

export function hasSave(): boolean {
  return load().ok;
}

export function load(): LoadResult {
  const store = storage();
  if (!store) return { ok: false, reason: "unavailable" };

  let raw: string | null;
  try {
    raw = store.getItem(KEY);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (raw === null) return { ok: false, reason: "none" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  // Three distinct branches, not one `<` comparison: a missing version and a
  // version from a future build both fail `version < LATEST` and would fall
  // through as "already current", handing unmigrated or unknown data onward.
  const envelope = parsed as Partial<Envelope>;
  if (typeof envelope?.schema !== "number" || !Number.isInteger(envelope.schema)) {
    return { ok: false, reason: "invalid" };
  }
  if (envelope.schema > SCHEMA) return { ok: false, reason: "newer" };
  if (envelope.schema < SCHEMA) return { ok: false, reason: "older" }; // no migrations exist yet
  if (!isGameState(envelope.state)) return { ok: false, reason: "invalid" };

  return { ok: true, state: envelope.state };
}

/**
 * Structural check, then a check that the values still MEAN something. A
 * round trip proves the serialiser agrees with itself; it does not prove the
 * restored ids still resolve against today's content.
 */
export function isGameState(value: unknown): value is GameState {
  if (value === null || typeof value !== "object") return false;
  const s = value as Partial<GameState>;

  const numbers = [s.seed, s.loop, s.money, s.debt];
  if (numbers.some((n) => typeof n !== "number" || !Number.isFinite(n))) return false;

  if (!s.rng || typeof s.rng !== "object") return false;
  const rng = s.rng;
  if (![rng.seed, rng.state, rng.count].every((n) => Number.isInteger(n) && n >= 0)) return false;

  if (!s.lifespan || typeof s.lifespan.current !== "number" || typeof s.lifespan.max !== "number") return false;
  if (!s.day || typeof s.day.score !== "number" || typeof s.day.max !== "number") return false;

  for (const key of ["npcs", "slots", "goals", "flags"] as const) {
    const bag = s[key];
    if (bag === null || typeof bag !== "object") return false;
  }
  for (const key of ["scheduled", "closedToday", "ledger", "goblinLog"] as const) {
    if (!Array.isArray(s[key])) return false;
  }

  const statuses = ["day", "night", "goblin_nightfall", "goblin_break", "review"];
  if (typeof s.status !== "string" || !statuses.includes(s.status)) return false;

  // Do the ids still point at real people, places and goals?
  const npcIds = new Set(content.npcs.map((n) => n.id));
  const slotIds = new Set(content.slots.map((n) => n.id));
  const goalIds = new Set(content.goals.map((g) => g.id));
  if (!Object.keys(s.npcs!).every((id) => npcIds.has(id))) return false;
  if (!Object.keys(s.slots!).every((id) => slotIds.has(id))) return false;
  if (!Object.keys(s.goals!).every((id) => goalIds.has(id))) return false;

  // And does the engine still accept it? Cheapest end-to-end proof there is.
  try {
    availableChoices(value as GameState, content);
  } catch {
    return false;
  }
  return true;
}
