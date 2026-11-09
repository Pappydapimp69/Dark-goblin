import type { Content, GameState } from "../engine/types";

/**
 * What your acts leave behind in the town, read from the ledger the engine
 * already keeps. Pure presentation: nothing here is written back or scored,
 * and nothing becomes a number on screen — these are pictures (flowers, worn
 * ground, a purse) whose size is the only measure.
 *
 * Brain: a decisive act should leave a token the world keeps
 * (ideas: SONGWRITING/endings/decisive-choice-leaves-a-token), and feedback
 * should land on every input without clutter (GAME-DESIGN/game-feel/juice).
 */
export interface PersonMarks {
  /** Each help you gave them grows a flower at their feet. */
  flowers: number;
  /** Each time you took something for yourself from them, the ground wears bare. */
  worn: number;
  /** Each harm cracks the ground they stand on. */
  cracks: number;
}

export const MAX_MARKS = 16;

export function marksFor(state: GameState, content: Content, npcId: string): PersonMarks {
  const npcOf = new Map(content.choices.map((c) => [c.id, c.npc]));
  let flowers = 0;
  let worn = 0;
  let cracks = 0;
  for (const e of state.ledger) {
    if (e.kind !== "impact" || npcOf.get(e.choiceId) !== npcId) continue;
    if (e.impact === "help") flowers += 1;
    else if (e.impact === "self") worn += 1;
    else if (e.impact === "harm") cracks += 1;
  }
  return { flowers: Math.min(MAX_MARKS, flowers), worn: Math.min(MAX_MARKS, worn), cracks: Math.min(MAX_MARKS, cracks) };
}

/**
 * The purse's fullness, 0 to 1, from what you hold; owing anything empties it
 * and ties a slip to it. A square root, so the first coins show as much as the
 * last.
 */
export function purse(money: number, debt: number): { fullness: number; owing: boolean } {
  const held = Math.max(0, money);
  return { fullness: Math.min(1, Math.sqrt(held) / Math.sqrt(160)), owing: debt > 0 };
}

/** The child grows with every lesson, meal and walk you give them: 0 (new) to 1 (grown as tall as they'll get here). */
export function childGrowth(state: GameState): number {
  const c = state.npcs["child"]?.state;
  if (!c) return 0;
  const given = ["lessons", "fed", "walks"].reduce((sum, k) => sum + (typeof c[k] === "number" ? (c[k] as number) : 0), 0);
  return Math.min(1, given / 12);
}

/** What kind of act it was, for the sign that floats up when it lands. */
export function actSign(kinds: readonly string[]): "warm" | "coin" | "crack" | "word" {
  if (kinds.includes("harm")) return "crack";
  if (kinds.includes("self")) return "coin";
  if (kinds.includes("help")) return "warm";
  return "word";
}
