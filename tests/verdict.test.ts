import { describe, expect, it } from "vitest";
import { newGame } from "../src/engine/engine";
import { computeVerdict } from "../src/engine/verdict";
import type { GameState, LedgerEntry } from "../src/engine/types";
import { testContent } from "./fixtures/content";

const content = testContent();

function withLedger(entries: LedgerEntry[], patch: Partial<GameState> = {}): GameState {
  return { ...newGame(1, content), ledger: entries, ...patch };
}

function impact(kind: "self" | "help" | "harm" | "neutral"): LedgerEntry {
  return { kind: "impact", loop: 1, choiceId: "x", target: "tester", impact: kind, delta: 0 };
}

function goal(owner: string, causedByPlayer = true): LedgerEntry {
  return {
    kind: "goal", loop: 1, goalId: `${owner}_g`, owner, critical: false,
    outcome: "fulfilled", causedByPlayer, delta: 0, maxDelta: 0,
  };
}

describe("§5.7 verdict", () => {
  it("counts self impacts and the player's own fulfilled goals as taken", () => {
    const base = newGame(1, content);
    const state = withLedger([impact("self"), impact("self")], {
      goals: { ...base.goals, player_goal_a: { ...base.goals["player_goal_a"]!, status: "fulfilled" } },
    });

    expect(computeVerdict(state)).toMatchObject({ selfPoints: 3, othersPoints: 0, verdict: "self" });
  });

  it("counts help impacts and player-caused NPC goals as given", () => {
    const state = withLedger([impact("help"), impact("help"), goal("tester")]);
    expect(computeVerdict(state)).toMatchObject({ othersPoints: 3, verdict: "others" });
  });

  it("ignores an NPC goal the player did not cause", () => {
    const state = withLedger([goal("tester", false)]);
    expect(computeVerdict(state).othersPoints).toBe(0);
  });

  it("ignores harm and neutral on both sides of the scale", () => {
    const state = withLedger([impact("harm"), impact("neutral")]);
    expect(computeVerdict(state)).toMatchObject({ selfPoints: 0, othersPoints: 0 });
  });

  it("keeps the child out of both counts and lists them separately", () => {
    const base = newGame(1, content);
    const child = content.goals.find((g) => g.id === "child_goal")!;
    const state = withLedger([impact("self"), goal("child")], {
      goals: { ...base.goals, child_goal: { ...child, status: "fulfilled" } },
    });

    const verdict = computeVerdict(state);
    expect(verdict.selfPoints).toBe(1);
    expect(verdict.othersPoints).toBe(0);
    expect(verdict.childOutcomes).toEqual([
      { goalId: "child_goal", label: child.label, outcome: "fulfilled" },
    ]);
  });

  it("reads back the breaks and the answers, in that order", () => {
    const state = withLedger([], {
      goblinLog: [
        { kind: "break", loop: 2, goalId: "fragile_life", owner: "fragile", lineId: "break_fragile" },
        { kind: "nightfall", loop: 3, questionId: "q_keyed", answerId: "a1", closureGoalIds: ["player_goal_a"] },
      ],
    });

    const verdict = computeVerdict(state);
    expect(verdict.breaks).toHaveLength(1);
    expect(verdict.answers).toHaveLength(1);
  });

  it("falls to others on a tie", () => {
    const state = withLedger([impact("self"), impact("help")]);
    expect(computeVerdict(state).verdict).toBe("others");
  });
});
