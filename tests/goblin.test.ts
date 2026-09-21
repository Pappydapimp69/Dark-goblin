import { describe, expect, it } from "vitest";
import { canonical } from "../src/engine/canonical";
import { acknowledgeGoblin, answerGoblin, interact, newGame, sleep } from "../src/engine/engine";
import type { Content, GameState } from "../src/engine/types";
import { testContent } from "./fixtures/content";

const content = testContent();
const start = (seed = 3): GameState => newGame(seed, content);

/** Answer every question the goblin asks, taking his first offered answer. */
function answerAll(state: GameState, c: Content = content): GameState {
  let next = state;
  while (next.status === "goblin_nightfall") {
    const visit = next.pendingGoblin!;
    const question = c.goblin.questions.find((q) => q.id === visit.questionIds[visit.cursor])!;
    next = answerGoblin(next, question.answers[0]!.id, c);
  }
  return next;
}

describe("the break", () => {
  it("fires on a player-caused critical failure and asks nothing", () => {
    const after = interact(start(), "ruin_fragile", content);

    expect(after.status).toBe("goblin_break");
    expect(after.pendingGoblin?.kind).toBe("break");
    expect(after.pendingGoblin?.questionIds).toEqual([]);
    expect(after.goblinLog).toEqual([
      { kind: "break", loop: 1, goalId: "fragile_life", owner: "fragile", lineId: "break_fragile" },
    ]);
  });

  it("does not fire when the world, not the player, ruined them", () => {
    const nudged = interact(start(), "world_ruiner", content);
    const night = sleep(nudged, content);

    expect(night.npcs["fragile"]?.broken).toBe(true); // the NPC still breaks (§5.4)
    expect(night.goblinLog.filter((e) => e.kind === "break")).toEqual([]); // he just doesn't come (§5.6)
  });

  it("hands the day back when he leaves", () => {
    const resumed = acknowledgeGoblin(interact(start(), "ruin_fragile", content), content);
    expect(resumed.status).toBe("day");
    expect(resumed.pendingGoblin).toBeNull();
  });
});

describe("nightfall", () => {
  it("fires when a player goal failed that day", () => {
    const night = sleep(interact(start(), "fail_player", content), content);

    expect(night.status).toBe("goblin_nightfall");
    expect(night.pendingGoblin?.kind).toBe("nightfall");
    expect(night.pendingGoblin?.closureGoalIds).toContain("player_goal_a");
  });

  it("does not fire when only an NPC goal failed", () => {
    const night = sleep(interact(start(), "fail_tester", content), content);
    expect(night.status).toBe("day");
    expect(night.goblinLog).toEqual([]);
  });

  it("does not fire on a quiet day", () => {
    expect(sleep(start(), content).status).toBe("day");
  });

  it("asks between one and three questions, keyed to the closure", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const night = sleep(interact(start(seed), "fail_player", content), content);
      const asked = night.pendingGoblin?.questionIds ?? [];

      expect(asked.length).toBeGreaterThanOrEqual(1);
      expect(asked.length).toBeLessThanOrEqual(3);
      expect(new Set(asked).size).toBe(asked.length);
    }
  });

  it("costs the same number of draws however many questions he asks", () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const day = interact(start(seed), "fail_player", content);
      const night = sleep(day, content);
      counts.add(night.rng.count - day.rng.count);
    }
    expect([...counts]).toEqual([4]); // 1 for the count, 3 for the picks
  });
});

describe("answers", () => {
  it("change neither score nor state", () => {
    const base = sleep(interact(start(), "fail_player", content), content);
    const twoQuestions: GameState = {
      ...base,
      pendingGoblin: { ...base.pendingGoblin!, questionIds: ["q_keyed", "q_open_1"], cursor: 0 },
    };

    const after = answerGoblin(twoQuestions, "a1", content);

    // Everything except the log and the cursor is untouched.
    const strip = (s: GameState) => canonical({ ...s, goblinLog: [], pendingGoblin: null });
    expect(strip(after)).toBe(strip(twoQuestions));
    expect(after.goblinLog.at(-1)).toMatchObject({ questionId: "q_keyed", answerId: "a1" });
    expect(after.pendingGoblin?.cursor).toBe(1);
  });

  it("rejects an answer that belongs to another question", () => {
    const night = sleep(interact(start(), "fail_player", content), content);
    expect(() => answerGoblin(night, "not_an_answer", content)).toThrow();
  });

  it("releases the day once the last one is given", () => {
    const night = sleep(interact(start(), "fail_player", content), content);
    const next = answerAll(night);

    expect(next.status).toBe("day");
    expect(next.loop).toBe(2);
    expect(next.closedToday).toEqual([]);
  });
});

describe("the last day", () => {
  it("lets him finish speaking before the review", () => {
    const dying: GameState = { ...start(), lifespan: { current: 1, max: 75 } };
    const night = sleep(interact(dying, "fail_player", content), content);

    expect(night.status).toBe("goblin_nightfall");
    expect(answerAll(night).status).toBe("review");
  });
});
