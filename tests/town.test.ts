import { describe, expect, it } from "vitest";
import { content } from "../src/content";
import { availableChoices, newGame, sleep } from "../src/engine/engine";
import { evaluate } from "../src/engine/conditions";
import type { Content, GameState, NpcId } from "../src/engine/types";

const roster = content.npcs.filter((n) => n.role !== "player");
const townOf = (state: GameState): NpcId[] =>
  Object.values(state.npcs).filter((n) => n.present && n.id !== "player").map((n) => n.id).sort();

describe("the roster and the town", () => {
  it("holds 42 townspeople plus the player", () => {
    expect(roster).toHaveLength(42);
    expect(content.npcs.filter((n) => n.role === "player")).toHaveLength(1);
  });

  it("deals a town of the size the rules ask for", () => {
    for (const seed of [1, 2, 3, 17, 99]) {
      expect(townOf(newGame(seed, content))).toHaveLength(content.rules.townSize!);
    }
  });

  it("always seats the three the routes need", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const town = townOf(newGame(seed, content));
      expect(town).toEqual(expect.arrayContaining(["baker", "shopkeeper", "builder"]));
    }
  });

  it("deals a different town to different seeds, and the same one twice", () => {
    const towns = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => townOf(newGame(s, content)).join(",")));
    expect(towns.size).toBeGreaterThan(1);
    expect(townOf(newGame(5, content))).toEqual(townOf(newGame(5, content)));
  });

  it("spends the same number of draws whoever it deals", () => {
    const counts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => newGame(s, content).rng.count));
    expect(counts.size).toBe(1);
  });
});

describe("people who are not in town", () => {
  const state = newGame(1, content);
  const absent = roster.find((n) => !state.npcs[n.id]!.present)!;

  it("exist in state, so a condition can still ask about them", () => {
    expect(state.npcs[absent.id]).toBeDefined();
    // Resolves to false rather than throwing: they are real, just not here.
    expect(evaluate({ npc: absent.id, key: "trusts_player", eq: true }, state)).toBe(false);
  });

  it("offer nothing to do", () => {
    const offered = availableChoices(state, content).map((c) => c.npc);
    expect(offered).not.toContain(absent.id);
    expect(new Set(offered).size).toBeLessThanOrEqual(content.rules.townSize!);
  });

  it("do not advance while they are away", () => {
    // Baker unpinned so some seed leaves her out of town; her banked help must
    // not accrue in a life she is not part of.
    const unpinned: Content = { ...content, rules: { ...content.rules, pinnedNpcs: [] } };
    let seed = 1;
    let away = newGame(seed, unpinned);
    while (away.npcs["baker"]!.present && seed < 200) away = newGame((seed += 1), unpinned);
    expect(away.npcs["baker"]!.present).toBe(false);

    const primed: GameState = {
      ...away,
      npcs: {
        ...away.npcs,
        baker: { ...away.npcs["baker"]!, state: { ...away.npcs["baker"]!.state, helped_this_loop: 1 } },
      },
    };

    expect(sleep(primed, unpinned).npcs["baker"]?.state["readiness"]).toBe(0);
  });

  it("never have their goals fulfilled or failed behind your back", () => {
    let next = state;
    for (let i = 0; i < 5; i += 1) next = sleep(next, content);
    expect(next.goals[`${absent.id}_need`]?.status).toBe("open");
  });
});
