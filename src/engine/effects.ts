import { ContentError } from "./errors";
import type { Effect, EffectSource, GameState, NpcStateValue } from "./types";

/**
 * The effect applier. Every write to GameState goes through here, tagged with
 * the batch's source — that tag is the ONLY attribution mechanism in the
 * engine (§5.4), so no other module may mutate state directly.
 *
 * Pure: returns a new GameState, never mutates the one it is given.
 */
export function applyEffects(
  state: GameState,
  effects: readonly Effect[],
  source: EffectSource,
  where = "effects",
): GameState {
  let next = state;
  effects.forEach((effect, i) => {
    next = applyEffect(next, effect, source, `${where}[${i}]`);
  });
  return next;
}

function applyEffect(
  state: GameState,
  effect: Effect,
  source: EffectSource,
  where: string,
): GameState {
  const e = effect as Record<string, unknown>;

  if ("setFlag" in e) {
    const key = e["setFlag"] as string;
    return { ...state, flags: { ...state.flags, [key]: e["value"] as never } };
  }

  if ("setNpc" in e) {
    const id = e["setNpc"] as string;
    const npc = state.npcs[id];
    if (!npc) throw new ContentError(`unknown npc "${id}"`, where);
    const key = e["key"] as string;
    return {
      ...state,
      npcs: {
        ...state.npcs,
        [id]: { ...npc, state: { ...npc.state, [key]: e["value"] as NpcStateValue } },
      },
    };
  }

  if ("addNpc" in e) {
    const id = e["addNpc"] as string;
    const npc = state.npcs[id];
    if (!npc) throw new ContentError(`unknown npc "${id}"`, where);
    const key = e["key"] as string;
    const current = npc.state[key];
    if (current !== undefined && typeof current !== "number") {
      throw new ContentError(`"${id}.${key}" is not a number, cannot add to it`, where);
    }
    const value = (current ?? 0) + (e["delta"] as number);
    return {
      ...state,
      npcs: { ...state.npcs, [id]: { ...npc, state: { ...npc.state, [key]: value } } },
    };
  }

  if ("moveSlot" in e) {
    const id = e["moveSlot"] as string;
    const slot = state.slots[id];
    if (!slot) throw new ContentError(`unknown slot "${id}"`, where);
    return {
      ...state,
      slots: { ...state.slots, [id]: { ...slot, holder: e["to"] as string | null } },
    };
  }

  if ("createSlot" in e) {
    const id = e["createSlot"] as string;
    const slot = state.slots[id];
    if (!slot) throw new ContentError(`unknown slot "${id}"`, where);
    return { ...state, slots: { ...state.slots, [id]: { ...slot, exists: true } } };
  }

  if ("money" in e) {
    // Never goes negative: affordability belongs in a choice's `available`,
    // and a negative balance would poison the end-of-day bill arithmetic.
    return { ...state, money: Math.max(0, state.money + (e["money"] as number)) };
  }

  if ("schedule" in e) {
    const inLoops = e["inLoops"] as number;
    return {
      ...state,
      scheduled: [
        ...state.scheduled,
        { atLoop: state.loop + inLoops, effect: e["schedule"] as Effect, source },
      ],
    };
  }

  throw new ContentError(`unrecognised effect ${JSON.stringify(effect)}`, where);
}

/** Structural check used by validate.ts. */
export function assertEffect(effect: unknown, where: string): void {
  if (effect === null || typeof effect !== "object") {
    throw new ContentError(`effect must be an object, got ${JSON.stringify(effect)}`, where);
  }
  const e = effect as Record<string, unknown>;

  if ("setFlag" in e) {
    if (typeof e["setFlag"] !== "string") throw new ContentError(`"setFlag" must be a string`, where);
    if (!("value" in e)) throw new ContentError(`"setFlag" needs "value"`, where);
    return;
  }
  if ("setNpc" in e) {
    if (typeof e["setNpc"] !== "string") throw new ContentError(`"setNpc" must be a string`, where);
    if (typeof e["key"] !== "string") throw new ContentError(`"setNpc" needs a string "key"`, where);
    if (!("value" in e)) throw new ContentError(`"setNpc" needs "value"`, where);
    return;
  }
  if ("addNpc" in e) {
    if (typeof e["addNpc"] !== "string") throw new ContentError(`"addNpc" must be a string`, where);
    if (typeof e["key"] !== "string") throw new ContentError(`"addNpc" needs a string "key"`, where);
    if (typeof e["delta"] !== "number") throw new ContentError(`"addNpc" needs a number "delta"`, where);
    return;
  }
  if ("moveSlot" in e) {
    if (typeof e["moveSlot"] !== "string") throw new ContentError(`"moveSlot" must be a string`, where);
    if (!("to" in e)) throw new ContentError(`"moveSlot" needs "to"`, where);
    return;
  }
  if ("createSlot" in e) {
    if (typeof e["createSlot"] !== "string") {
      throw new ContentError(`"createSlot" must be a string`, where);
    }
    return;
  }
  if ("money" in e) {
    if (typeof e["money"] !== "number") throw new ContentError(`"money" must be a number`, where);
    return;
  }
  if ("schedule" in e) {
    if (typeof e["inLoops"] !== "number") {
      throw new ContentError(`"schedule" needs a number "inLoops"`, where);
    }
    assertEffect(e["schedule"], `${where}.schedule`);
    return;
  }

  throw new ContentError(`unrecognised effect ${JSON.stringify(effect)}`, where);
}
