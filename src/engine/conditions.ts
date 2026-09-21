import { ContentError } from "./errors";
import type { Condition, GameState } from "./types";

/**
 * The condition evaluator. Exhaustive by construction: a shape that matches no
 * known variant throws rather than defaulting to false, so a typo in content
 * surfaces at validation instead of silently closing a path.
 */
export function evaluate(condition: Condition, state: GameState, where = "condition"): boolean {
  const c = condition as Record<string, unknown>;

  if ("all" in c) {
    const parts = c["all"] as Condition[];
    return parts.every((p, i) => evaluate(p, state, `${where}.all[${i}]`));
  }
  if ("any" in c) {
    const parts = c["any"] as Condition[];
    return parts.some((p, i) => evaluate(p, state, `${where}.any[${i}]`));
  }
  if ("not" in c) {
    return !evaluate(c["not"] as Condition, state, `${where}.not`);
  }
  if ("flag" in c) {
    const value = state.flags[c["flag"] as string];
    if (!("eq" in c)) return value === true;
    return value === c["eq"];
  }
  if ("npc" in c) {
    const id = c["npc"] as string;
    const npc = state.npcs[id];
    if (!npc) throw new ContentError(`unknown npc "${id}"`, where);
    const value = npc.state[c["key"] as string];
    if ("eq" in c && value !== c["eq"]) return false;
    if ("gte" in c) {
      if (typeof value !== "number" || value < (c["gte"] as number)) return false;
    }
    if ("lte" in c) {
      if (typeof value !== "number" || value > (c["lte"] as number)) return false;
    }
    if (!("eq" in c) && !("gte" in c) && !("lte" in c)) return value === true;
    return true;
  }
  if ("slotHolder" in c) {
    const id = c["slotHolder"] as string;
    const slot = state.slots[id];
    if (!slot) throw new ContentError(`unknown slot "${id}"`, where);
    return slot.holder === (c["is"] as string | null);
  }
  if ("slotExists" in c) {
    const id = c["slotExists"] as string;
    const slot = state.slots[id];
    if (!slot) throw new ContentError(`unknown slot "${id}"`, where);
    return slot.exists;
  }
  if ("money" in c) {
    const bounds = c["money"] as { gte?: number; lte?: number };
    if (bounds.gte !== undefined && state.money < bounds.gte) return false;
    if (bounds.lte !== undefined && state.money > bounds.lte) return false;
    return true;
  }
  if ("loopGte" in c) {
    return state.loop >= (c["loopGte"] as number);
  }
  if ("goalStatus" in c) {
    const id = c["goalStatus"] as string;
    const goal = state.goals[id];
    if (!goal) throw new ContentError(`unknown goal "${id}"`, where);
    return goal.status === c["is"];
  }

  throw new ContentError(`unrecognised condition ${JSON.stringify(condition)}`, where);
}

/** Structural check used by validate.ts — no GameState needed. */
export function assertCondition(condition: unknown, where: string): void {
  if (condition === null || typeof condition !== "object") {
    throw new ContentError(`condition must be an object, got ${JSON.stringify(condition)}`, where);
  }
  const c = condition as Record<string, unknown>;

  if ("all" in c || "any" in c) {
    const key = "all" in c ? "all" : "any";
    const parts = c[key];
    if (!Array.isArray(parts)) throw new ContentError(`"${key}" must be an array`, where);
    parts.forEach((p, i) => assertCondition(p, `${where}.${key}[${i}]`));
    return;
  }
  if ("not" in c) return assertCondition(c["not"], `${where}.not`);
  if ("flag" in c) {
    if (typeof c["flag"] !== "string") throw new ContentError(`"flag" must be a string`, where);
    return;
  }
  if ("npc" in c) {
    if (typeof c["npc"] !== "string") throw new ContentError(`"npc" must be a string`, where);
    if (typeof c["key"] !== "string") throw new ContentError(`"npc" needs a string "key"`, where);
    return;
  }
  if ("slotHolder" in c) {
    if (typeof c["slotHolder"] !== "string") {
      throw new ContentError(`"slotHolder" must be a string`, where);
    }
    if (!("is" in c)) throw new ContentError(`"slotHolder" needs "is"`, where);
    return;
  }
  if ("slotExists" in c) {
    if (typeof c["slotExists"] !== "string") {
      throw new ContentError(`"slotExists" must be a string`, where);
    }
    return;
  }
  if ("money" in c) {
    const bounds = c["money"];
    if (bounds === null || typeof bounds !== "object") {
      throw new ContentError(`"money" must be { gte?, lte? }`, where);
    }
    return;
  }
  if ("loopGte" in c) {
    if (typeof c["loopGte"] !== "number") throw new ContentError(`"loopGte" must be a number`, where);
    return;
  }
  if ("goalStatus" in c) {
    if (typeof c["goalStatus"] !== "string") {
      throw new ContentError(`"goalStatus" must be a goal id`, where);
    }
    const is = c["is"];
    if (is !== "open" && is !== "fulfilled" && is !== "failed") {
      throw new ContentError(`"goalStatus" needs is: open|fulfilled|failed`, where);
    }
    return;
  }

  throw new ContentError(`unrecognised condition ${JSON.stringify(condition)}`, where);
}
