import { describe, expect, it } from "vitest";
import { content } from "../src/content";
import { interact, newGame, sleep } from "../src/engine/engine";
import { journal } from "../src/ui/journal";
import { HEIGHT, WIDTH } from "../src/ui/theme";
import { BUILDING, FIGURE_HEIGHT, GROUND, HOME, PLACES, standingSpot, townView, walkMs } from "../src/ui/town";
import { acquainted } from "./harness";

const where = new Map(content.npcs.map((n) => [n.id, n.location ?? "market"]));

/** Everyone the Street scene would draw, with the spot it would draw them at. */
const drawn = (state: ReturnType<typeof newGame>) => townView(state, content).people;
void where;

describe("the town you walk", () => {
  it("draws everyone in town, on screen, apart from each other and off the buildings, for every seed", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      let state = newGame(seed, content);
      // the fullest town: Wren and the child at home as well
      state = { ...state, npcs: { ...state.npcs, child: { ...state.npcs["child"]!, present: true } } };
      const people = drawn(state);
      const inTown = Object.values(state.npcs).filter((n) => n.present && n.id !== "player");
      expect(people.map((p) => p.id).sort()).toEqual(inTown.map((n) => n.id).sort());
      for (const p of people) {
        expect(p.x - 50 >= 0 && p.x + 50 <= WIDTH, `${p.id} x on seed ${seed}`).toBe(true);
        expect(p.y - FIGURE_HEIGHT >= GROUND.y1 && p.y + 26 <= HEIGHT - 120, `${p.id} y on seed ${seed}`).toBe(true);
        for (const place of PLACES) {
          const overlaps =
            Math.abs(p.x - place.x) < BUILDING.width / 2 + 40 &&
            p.y - FIGURE_HEIGHT < place.y + BUILDING.height / 2 && p.y > place.y - BUILDING.height / 2;
          expect(overlaps, `${p.id} stands on ${place.id} on seed ${seed}`).toBe(false);
        }
      }
      for (const a of people) for (const b of people) {
        if (a === b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y) >= 100, `${a.id} and ${b.id} overlap on seed ${seed}`).toBe(true);
      }
    }
  });

  it("nobody is more than about two seconds' walk from your door", () => {
    for (const place of PLACES) for (let i = 0; i < 6; i += 1) {
      expect(walkMs(HOME, standingSpot(place.id, i))).toBeLessThanOrEqual(2200);
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
