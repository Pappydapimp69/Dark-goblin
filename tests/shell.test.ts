import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { content } from "../src/content";
import { availableChoices, interact, newGame } from "../src/engine/engine";
import { Store, sceneFor } from "../src/ui/store";
import type { GameState } from "../src/engine/types";

describe("the aftermath choice", () => {
  // Caught by playing the built game: Aldo was offering "He is sitting on the
  // step. He doesn't look up." on the first morning, before anything happened.
  it("is hidden until the person breaks", () => {
    const state = newGame(1, content);
    const offered = availableChoices(state, content).map((c) => c.id);
    expect(offered).not.toContain("shop_aftermath");
    expect(offered).toContain("shop_listen_first");
  });

  it("is the only thing left once they have", () => {
    const broken = interact(newGame(1, content), "shop_tell_creditor", content);
    const day: GameState = { ...broken, npcs: { ...broken.npcs, shopkeeper: { ...broken.npcs["shopkeeper"]!, broken: true } }, status: "day", pendingGoblin: null };

    const theirs = availableChoices(day, content).filter((c) => c.npc === "shopkeeper");
    expect(theirs.map((c) => c.id)).toEqual(["shop_aftermath"]);
  });
});

describe("everyone can be found", () => {
  // Also caught by playing it: eight people were standing at "street", which
  // the game does not draw. They were in town and on no screen.
  it("stands every townsperson at a location the game draws", () => {
    const drawn = new Set(content.rules.locations);
    for (const npc of content.npcs) {
      expect({ id: npc.id, at: npc.location }).toEqual({ id: npc.id, at: expect.stringMatching(/.+/) });
      expect(drawn.has(npc.location!)).toBe(true);
    }
  });

  it("puts every person in town on the street, not just most of them", () => {
    for (const seed of [1, 2, 3, 11, 42]) {
      const state = newGame(seed, content);
      const town = Object.values(state.npcs).filter((n) => n.present && n.id !== "player");
      const placed = town.filter((n) => {
        const def = content.npcs.find((d) => d.id === n.id)!;
        return def.location !== "room" && content.rules.locations!.includes(def.location!);
      });
      expect(placed).toHaveLength(town.length);
    }
  });
});

describe("the store", () => {
  it("replaces state rather than mutating it", () => {
    const store = new Store(1);
    const before = store.state;
    const snapshot = JSON.stringify(before);

    store.interact(store.choices[0]!.id);

    expect(store.state).not.toBe(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("tells every status which scene it belongs to", () => {
    const base = newGame(1, content);
    const statuses: GameState["status"][] = ["day", "night", "goblin_break", "goblin_nightfall", "review"];
    for (const status of statuses) {
      expect(sceneFor({ ...base, status })).toMatch(/^[A-Z]/);
    }
  });

  it("notifies subscribers once per change", () => {
    const store = new Store(1);
    let seen = 0;
    store.subscribe(() => (seen += 1));
    store.interact(store.choices[0]!.id);
    expect(seen).toBe(1);
  });
});

describe("the engine stays out of the render layer", () => {
  it("imports no Phaser anywhere under src/engine", () => {
    // §2: the engine is pure TypeScript with zero Phaser imports. Rendering
    // dispatches to it; it never reaches back.
    const dir = join(process.cwd(), "src/engine");
    const offenders = readdirSync(dir, { withFileTypes: true, recursive: true })
      .filter((e) => e.isFile() && e.name.endsWith(".ts"))
      .map((e) => join(e.parentPath ?? dir, e.name))
      .filter((file) => /from\s+["']phaser["']|require\(["']phaser["']\)/.test(readFileSync(file, "utf8")));

    expect(offenders).toEqual([]);
  });
});
