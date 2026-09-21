import { describe, expect, it } from "vitest";
import { acknowledgeGoblin, availableChoices, interact, newGame, sleep } from "../src/engine/engine";
import { checkGoals } from "../src/engine/goals";
import type { GameState } from "../src/engine/types";
import { testContent } from "./fixtures/content";

const content = testContent();
const start = (): GameState => newGame(7, content);

function goalEntries(state: GameState) {
  return state.ledger.filter((e) => e.kind === "goal");
}

describe("path checks", () => {
  it("fulfils a goal when any path completes, and scores it to the player", () => {
    const after = interact(start(), "fulfil_tester", content);

    expect(after.goals["tester_goal"]?.status).toBe("fulfilled");
    expect(after.day).toMatchObject({ score: 1, max: 3 }); // -1, help +0, max +1, then +2/+2
  });

  it("fails a goal when every path closes", () => {
    const after = interact(start(), "fail_tester", content);
    expect(after.goals["tester_goal"]?.status).toBe("failed");
  });

  it("records a closure for every failure", () => {
    const after = interact(start(), "fail_tester", content);
    expect(after.closedToday).toEqual([
      { goalId: "tester_goal", owner: "tester", critical: false, causedByPlayer: true },
    ]);
  });
});

describe("non-critical failure", () => {
  it("rolls a replacement from the adjacent pool and the owner keeps going", () => {
    const after = interact(start(), "fail_tester", content);

    expect(after.goals["tester_adjacent"]?.status).toBe("open");
    expect(after.goals["tester_adjacent"]?.owner).toBe("tester");
    expect(after.npcs["tester"]?.goalIds).toContain("tester_adjacent");
    expect(after.npcs["tester"]?.broken).toBe(false);
  });

  it("always consumes a draw, even when the pool cannot supply one", () => {
    // A branch that skips the draw shifts the shared stream and silently
    // changes every later roll in the game.
    const base = start();
    const poolless: GameState = {
      ...base,
      flags: { tester_blocked: true },
      goals: { ...base.goals, tester_goal: { ...base.goals["tester_goal"]!, adjacentPool: [] } },
    };

    const after = checkGoals(poolless, "player", content);

    expect(after.state.goals["tester_goal"]?.status).toBe("failed");
    expect(after.state.rng.count).toBe(poolless.rng.count + 1);
  });
});

describe("critical failure", () => {
  it("breaks the NPC and leaves only their aftermath choice", () => {
    const after = interact(start(), "ruin_fragile", content);

    expect(after.goals["fragile_life"]?.status).toBe("failed");
    expect(after.npcs["fragile"]?.broken).toBe(true);

    const resumed = acknowledgeGoblin(after, content);
    const fragileChoices = availableChoices(resumed, content).filter((c) => c.npc === "fragile");
    expect(fragileChoices.map((c) => c.id)).toEqual(["aftermath"]);
  });

  it("treats a player-owned critical failure as a plain failure, with no break", () => {
    const base = start();
    const critical: GameState = {
      ...base,
      goals: { ...base.goals, player_goal_a: { ...base.goals["player_goal_a"]!, critical: true } },
    };

    const after = interact(critical, "fail_player", content);

    expect(after.goals["player_goal_a"]?.status).toBe("failed");
    expect(after.status).toBe("day");
    expect(after.pendingGoblin).toBeNull();
    expect(goalEntries(after)[0]).toMatchObject({ delta: -3, maxDelta: 0 });
  });
});

describe("attribution", () => {
  it("credits an outcome to the player when their own effect flipped it", () => {
    const after = interact(start(), "fulfil_tester", content);
    expect(goalEntries(after)[0]).toMatchObject({ causedByPlayer: true, delta: 2, maxDelta: 2 });
  });

  it("keeps player attribution on an effect the player scheduled loops earlier", () => {
    const scheduled = interact(start(), "schedule_ruin", content);
    expect(scheduled.scheduled).toHaveLength(1);
    expect(scheduled.scheduled[0]).toMatchObject({ source: "player", atLoop: 2 });

    const night = sleep(scheduled, content);

    expect(night.goals["fragile_life"]?.status).toBe("failed");
    expect(night.status).toBe("goblin_break");
    expect(goalEntries(night).at(-1)).toMatchObject({
      goalId: "fragile_life",
      causedByPlayer: true,
    });
  });

  it("does not credit the player for what the world advanced on its own", () => {
    const nudged = interact(start(), "world_helper", content);
    const night = sleep(nudged, content);

    expect(night.goals["tester_goal"]?.status).toBe("fulfilled");
    expect(goalEntries(night).at(-1)).toMatchObject({
      goalId: "tester_goal",
      causedByPlayer: false,
      delta: 0,
      maxDelta: 0,
    });
  });
});

describe("the world tick", () => {
  it("advances authored NPC tracks each loop", () => {
    const day2 = sleep(start(), content);
    expect(day2.npcs["tester"]?.state["loops"]).toBe(1);
    expect(day2.loop).toBe(2);
  });

  it("stops advancing a broken NPC", () => {
    const broken = acknowledgeGoblin(interact(start(), "ruin_fragile", content), content);
    const day2 = sleep(broken, content);
    expect(day2.npcs["fragile"]?.broken).toBe(true);
  });
});
