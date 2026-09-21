import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { content } from "../src/content";
import { canonical, fingerprint } from "../src/engine/canonical";
import { acknowledgeGoblin, answerGoblin, interact, newGame, sleep } from "../src/engine/engine";
import { SCHEMA, clear, hasSave, isGameState, load, save } from "../src/ui/save";
import { Store } from "../src/ui/store";
import type { GameState } from "../src/engine/types";

const KEY = "darkgoblin:v1:save";

class FakeStorage {
  private readonly bag = new Map<string, string>();
  constructor(private readonly mode: "ok" | "throws" | "fullOnWrite" = "ok") {}
  getItem(key: string): string | null {
    if (this.mode === "throws") throw new DOMException("denied");
    return this.bag.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.mode === "throws" || this.mode === "fullOnWrite") throw new DOMException("quota");
    this.bag.set(key, value);
  }
  removeItem(key: string): void {
    if (this.mode === "throws") throw new DOMException("denied");
    this.bag.delete(key);
  }
  raw(key: string): string | null {
    return this.bag.get(key) ?? null;
  }
  put(key: string, value: string): void {
    this.bag.set(key, value);
  }
}

let fake: FakeStorage;

function install(mode: "ok" | "throws" | "fullOnWrite" = "ok"): FakeStorage {
  fake = new FakeStorage(mode);
  Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true, writable: true });
  return fake;
}

beforeEach(() => install());
afterEach(() => {
  Reflect.deleteProperty(globalThis as object, "localStorage");
});

const start = (): GameState => newGame(7, content);

/** Sleep through a whole day, letting the goblin have his turn if he comes. */
function rest(state: GameState): GameState {
  let next = sleep(settle(state), content);
  next = settle(next);
  return next;
}

function settle(state: GameState): GameState {
  let next = state;
  while (next.status === "goblin_break" || next.status === "goblin_nightfall") {
    if (next.status === "goblin_break") {
      next = acknowledgeGoblin(next, content);
      continue;
    }
    const visit = next.pendingGoblin!;
    const question = content.goblin.questions.find((q) => q.id === visit.questionIds[visit.cursor])!;
    next = answerGoblin(next, question.answers[0]!.id, content);
  }
  return next;
}

describe("a round trip", () => {
  it("comes back through the real persistence format, not just in memory", () => {
    // `undefined` survives a property read and vanishes at JSON.stringify, so
    // the check has to cross the actual serialization boundary.
    const state = rest(interact(start(), "shop_listen_first", content));
    expect(save(state)).toBe(true);

    const loaded = load();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(canonical(loaded.state)).toBe(canonical(state));
  });

  it("stores the RNG's words in a form that survives reloading unchanged", () => {
    // A generator whose step ends `| 0` can store signed words and read them
    // back unsigned: behaviour identical, bytes different, save hashing broken.
    let state = start();
    for (let i = 0; i < 12; i += 1) state = rest(state);

    save(state);
    const first = load();
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    save(first.state);
    const second = load();
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(canonical(second.state)).toBe(canonical(state));
    expect(state.rng.state).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(state.rng.state)).toBe(true);
  });

  it("resumes the same life it left", () => {
    let state = start();
    for (let i = 0; i < 4; i += 1) state = rest(state);
    save(state);

    const loaded = load();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    let resumed = loaded.state;
    let straight = state;
    for (let i = 0; i < 6; i += 1) {
      resumed = rest(resumed);
      straight = rest(straight);
    }
    expect(fingerprint(resumed)).toBe(fingerprint(straight));
  });
});

describe("the version gate", () => {
  // A dispatcher gated on one `version < LATEST` treats a MISSING version and
  // a FUTURE version the same as "already current", and passes both onward.
  it("tells a missing version apart from an old one", () => {
    fake.put(KEY, JSON.stringify({ state: start() }));
    expect(load()).toEqual({ ok: false, reason: "invalid" });
  });

  it("tells a future version apart from an old one, and leaves it alone", () => {
    fake.put(KEY, JSON.stringify({ schema: SCHEMA + 1, state: start() }));
    expect(load()).toEqual({ ok: false, reason: "newer" });
    expect(fake.raw(KEY)).not.toBeNull();
  });

  it("reports an older version as older, not as absent", () => {
    fake.put(KEY, JSON.stringify({ schema: SCHEMA - 1, state: start() }));
    expect(load()).toEqual({ ok: false, reason: "older" });
  });

  it("rejects a non-integer version", () => {
    fake.put(KEY, JSON.stringify({ schema: "1", state: start() }));
    expect(load()).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("when storage will not cooperate", () => {
  it("reports no save rather than throwing when reading is denied", () => {
    install("throws");
    expect(load()).toEqual({ ok: false, reason: "unavailable" });
    expect(hasSave()).toBe(false);
    expect(() => clear()).not.toThrow();
  });

  it("still plays when writing is denied", () => {
    install("fullOnWrite");
    const store = new Store(3);
    expect(() => store.interact(store.choices[0]!.id)).not.toThrow();
    expect(store.state.day.interactions).toBe(1);
  });

  it("survives storage being absent entirely", () => {
    Reflect.deleteProperty(globalThis as object, "localStorage");
    expect(load()).toEqual({ ok: false, reason: "unavailable" });
    expect(save(start())).toBe(false);
  });

  it("reads an empty slot as nothing, not as damage", () => {
    expect(load()).toEqual({ ok: false, reason: "none" });
  });

  it("reads corrupt bytes as unreadable", () => {
    fake.put(KEY, "{not json at all");
    expect(load()).toEqual({ ok: false, reason: "unreadable" });
  });
});

describe("a save that no longer fits", () => {
  it("is rejected when it names someone the town has never heard of", () => {
    const state = start();
    const stranger = { ...state, npcs: { ...state.npcs, nobody: state.npcs["baker"]! } };
    fake.put(KEY, JSON.stringify({ schema: SCHEMA, state: stranger }));
    expect(load()).toEqual({ ok: false, reason: "invalid" });
  });

  it("is rejected when a field the engine needs has gone", () => {
    const state = start() as Partial<GameState>;
    delete state.rng;
    fake.put(KEY, JSON.stringify({ schema: SCHEMA, state }));
    expect(load()).toEqual({ ok: false, reason: "invalid" });
  });

  it("is rejected when the status is not one the game has", () => {
    fake.put(KEY, JSON.stringify({ schema: SCHEMA, state: { ...start(), status: "breakfast" } }));
    expect(isGameState({ ...start(), status: "breakfast" })).toBe(false);
    expect(load().ok).toBe(false);
  });
});

describe("the slot", () => {
  it("is written on every change, not only at bedtime", () => {
    const store = new Store(5);
    const morning = load();
    store.interact(store.choices[0]!.id);
    const after = load();

    expect(morning.ok && after.ok).toBe(true);
    if (!morning.ok || !after.ok) return;
    expect(after.state.day.interactions).toBe(1);
    expect(morning.state.day.interactions).toBe(0);
  });

  it("is namespaced, because one origin serves every game an author ships", () => {
    save(start());
    expect(fake.raw("darkgoblin:v1:save")).not.toBeNull();
    expect(fake.raw("save")).toBeNull();
  });

  it("is the only thing in the codebase that touches storage", () => {
    // A stray key written outside the save module is how a "seen it once"
    // flag leaks across saves and across sibling games on a shared origin.
    const roots = ["src"];
    const offenders: string[] = [];
    for (const root of roots) {
      const dir = join(process.cwd(), root);
      for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
        const file = join(entry.parentPath ?? dir, entry.name);
        if (file.endsWith(join("ui", "save.ts"))) continue;
        if (/localStorage|sessionStorage|indexedDB/.test(readFileSync(file, "utf8"))) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
