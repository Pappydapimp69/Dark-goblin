import { describe, expect, it } from "vitest";
import { content } from "../src/content";
import { interact, newGame, sleep } from "../src/engine/engine";
import { journal } from "../src/ui/journal";
import { HEIGHT, WIDTH } from "../src/ui/theme";
import { BUILDING, FIGURE_HEIGHT, GROUND, HOME, PLACES, standingSpot, walkMs } from "../src/ui/town";
import { acquainted } from "./harness";

const where = new Map(content.npcs.map((n) => [n.id, n.location ?? "market"]));

/** Everyone the Street scene would draw, with the spot it would draw them at. */
function drawn(state: ReturnType<typeof newGame>) {
  const out: { id: string; x: number; y: number }[] = [];
  for (const place of PLACES) {
    const here = Object.values(state.npcs).filter((n) => n.present && n.id !== "player" && where.get(n.id) === place.id);
    here.forEach((n, i) => out.push({ id: n.id, ...standingSpot(place.id, i) }));
  }
  return out;
}

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
