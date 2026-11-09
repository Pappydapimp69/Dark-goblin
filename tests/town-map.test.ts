import { describe, expect, it } from "vitest";
import { content } from "../src/content";
import { interact, newGame, sleep } from "../src/engine/engine";
import { journal } from "../src/ui/journal";
import { WIDTH } from "../src/ui/theme";
import { COLS, GRID, HOME_TILE, PLACES, ROWS, TILE, TILES_PER_SECOND, besideTile, path, tileAt, tileKey, townView, walkable } from "../src/ui/town";
import { acquainted } from "./harness";



describe("the town you walk", () => {
  const LETTER: Record<string, string> = { storefront: "S", market: "M", wrecked: "W", room: "H" };

  it("is a whole grid, and each building's footprint is its own letter", () => {
    expect(GRID).toHaveLength(ROWS);
    for (const row of GRID) expect(row).toHaveLength(COLS);
    expect(COLS * TILE).toBe(WIDTH);
    for (const place of PLACES) {
      const f = place.footprint;
      for (let r = f.row; r < f.row + f.rows; r += 1) for (let c = f.col; c < f.col + f.cols; c += 1) {
        expect(tileAt({ col: c, row: r }), `${place.id} ${c},${r}`).toBe(LETTER[place.id]);
      }
    }
  });

  it("every door and every place to stand can be walked to from your door", () => {
    for (const place of PLACES) {
      expect(path(HOME_TILE, place.door), `${place.id} door`).not.toBeNull();
      for (const s of place.spots) {
        expect(walkable(s), `${place.id} spot ${s.col},${s.row}`).toBe(true);
        expect(path(HOME_TILE, s), `${place.id} spot ${s.col},${s.row}`).not.toBeNull();
      }
    }
    // Your own door is home; every other door and spot is somewhere else.
    expect(tileKey(PLACES.find((p) => p.id === "room")!.door)).toBe(tileKey(HOME_TILE));
    const all = PLACES.flatMap((p) => [...p.spots, ...(p.id === "room" ? [] : [p.door])]).map(tileKey);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain(tileKey(HOME_TILE));
  });

  it("for 300 seeds of the fullest town, everyone is drawn on their own tile and can be walked up to and talked to", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      let state = newGame(seed, content);
      state = { ...state, npcs: { ...state.npcs, child: { ...state.npcs["child"]!, present: true } } };
      const people = townView(state, content).people;
      const inTown = Object.values(state.npcs).filter((n) => n.present && n.id !== "player");
      expect(people.map((p) => p.id).sort()).toEqual(inTown.map((n) => n.id).sort());
      const occupied = new Set(people.map((p) => tileKey(p.tile)));
      expect(occupied.size, `two people on one tile, seed ${seed}`).toBe(people.length);
      for (const p of people) {
        expect(walkable(p.tile), `${p.id} on seed ${seed}`).toBe(true);
        expect(besideTile(p.tile, HOME_TILE, occupied), `${p.id} unreachable on seed ${seed}`).not.toBeNull();
      }
    }
  });

  it("nobody is more than about three seconds' walk from your door", () => {
    for (const place of PLACES) for (const s of place.spots) {
      expect(path(HOME_TILE, s)!.length / TILES_PER_SECOND).toBeLessThanOrEqual(3.2);
    }
  });
});

describe("the journal", () => {
  it("lists only people you have met on two days, and shows no number", () => {
    let state = newGame(1, content);
    expect(journal(state, content).find((s) => s.heading === "People you know")!.lines[0]).toMatch(/Nobody yet/);
    state = sleep(interact(state, "baker_meet_1", content), content);
    state = interact(state, "baker_meet_2", content);
    const people = journal(state, content).find((s) => s.heading === "People you know")!.lines;
    expect(people).toHaveLength(1);
    expect(people[0]).toMatch(/^Ilka: /);
  });

  it("never shows a number, across whole lives", () => {
    for (const seed of [1, 2, 3]) {
      let state = acquainted(newGame(seed, content));
      for (let day = 0; day < 6 && state.status === "day"; day += 1) {
        for (const page of journal(state, content)) for (const line of [page.heading, ...page.lines]) {
          expect(/\d/.test(line), line).toBe(false);
        }
        state = sleep(state, content);
        while (state.status !== "day" && state.status !== "review") break;
      }
    }
  });
});

describe("the map shows the town as it is now", () => {
  const start = () => acquainted(newGame(1, content));

  it("someone harmed into leaving is no longer drawn", () => {
    let state = start();
    const victim = Object.values(state.npcs).find((n) => n.present && content.choices.some((c) => c.id === `${n.id}_harm`))!;
    expect(townView(state, content).people.map((p) => p.id)).toContain(victim.id);
    state = interact(state, `${victim.id}_harm`, content);
    expect(townView(state, content).people.map((p) => p.id)).not.toContain(victim.id);
  });

  it("whoever holds a shop stands at it, and it takes their name", () => {
    const base = start();
    const state = { ...base, slots: { ...base.slots, storefront: { ...base.slots["storefront"]!, holder: "baker" } } };
    const view = townView(state, content);
    expect(view.people.find((p) => p.id === "baker")?.place).toBe("storefront");
    expect(view.places.find((p) => p.id === "storefront")?.name).toBe("Ilka's Shop");
  });

  it("the ruin is drawn rebuilt once the rebuilt shop exists", () => {
    const base = start();
    const state = { ...base, slots: { ...base.slots, wrecked_shop: { ...base.slots["wrecked_shop"]!, exists: true, holder: "baker" } } };
    const wrecked = townView(state, content).places.find((p) => p.id === "wrecked")!;
    expect(wrecked.look).toBe("rebuilt");
    expect(wrecked.name).toBe("Ilka's Shop");
    expect(townView(state, content).people.find((p) => p.id === "baker")?.place).toBe("wrecked");
  });

  it("the ruined shopkeeper stays in town for his aftermath; a retired one has gone", () => {
    const base = start();
    const ruined = { ...base, flags: { ...base.flags, shopkeeper_foreclosed: true } };
    expect(townView(ruined, content).people.map((p) => p.id)).toContain("shopkeeper");
    const retired = { ...base, flags: { ...base.flags, shopkeeper_retired: true } };
    expect(townView(retired, content).people.map((p) => p.id)).not.toContain("shopkeeper");
  });
});
