import type { RngState } from "./types";

/**
 * One seeded stream for the whole game (mulberry32). Every draw returns a NEW
 * RngState rather than mutating, so the stream position is part of GameState
 * and a save restores it in O(1).
 *
 * Ambient `Math.random()` / `Date.now()` are banned everywhere under
 * src/engine and src/sim — tests/no-ambient-randomness.test.ts enforces it.
 */

export function createRng(seed: number): RngState {
  const s = seed >>> 0;
  return { seed: s, state: s, count: 0 };
}

/** One draw in [0, 1). */
export function next(rng: RngState): [number, RngState] {
  const a = (rng.state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, { seed: rng.seed, state: a >>> 0, count: rng.count + 1 }];
}

/** One draw, mapped to [0, bound). Always draws, even when bound < 2. */
export function nextInt(rng: RngState, bound: number): [number, RngState] {
  const [value, advanced] = next(rng);
  if (bound <= 0) return [0, advanced];
  return [Math.floor(value * bound), advanced];
}

/**
 * Pick one item from a pool. ALWAYS consumes exactly one draw, including when
 * the pool is empty or holds a single forced candidate — a draw skipped on a
 * branch shifts the shared stream and desyncs every later consumer.
 */
export function pick<T>(rng: RngState, pool: readonly T[]): [T | null, RngState] {
  const [index, advanced] = nextInt(rng, pool.length);
  if (pool.length === 0) return [null, advanced];
  return [pool[index] ?? null, advanced];
}

/**
 * Pick `count` distinct items. Always consumes exactly `draws` draws whatever
 * the pool's size, so callers keep a constant draw count per decision.
 */
export function pickDistinct<T>(
  rng: RngState,
  pool: readonly T[],
  count: number,
  draws: number,
): [T[], RngState] {
  const remaining = [...pool];
  const chosen: T[] = [];
  let current = rng;
  for (let i = 0; i < draws; i += 1) {
    const [index, advanced] = nextInt(current, remaining.length);
    current = advanced;
    if (chosen.length >= count || remaining.length === 0) continue;
    const [taken] = remaining.splice(index, 1);
    if (taken !== undefined) chosen.push(taken);
  }
  return [chosen, current];
}
