import { describe, expect, it } from "vitest";
import { content } from "../src/content";
import { acquainted } from "./harness";
import { acknowledgeGoblin, answerGoblin, availableChoices, interact, newGame, sleep } from "../src/engine/engine";
import type { GameState, Goal } from "../src/engine/types";
import { computeVerdict } from "../src/engine/verdict";

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

function act(state: GameState, ...choiceIds: string[]): GameState {
  let next = state;
  for (const id of choiceIds) {
    next = settle(next);
    expect(availableChoices(next, content).map((c) => c.id)).toContain(id);
    next = interact(next, id, content);
  }
  return settle(next);
}

const night = (state: GameState): GameState => settle(sleep(settle(state), content));
const childGoals = (state: GameState): Goal[] => Object.values(state.goals).filter((g) => g.owner === "child");

/** Court Wren and ask them to stay, all on the first day. */
function moveIn(state: GameState): GameState {
  return act(state, "partner_help_first", "partner_help_again", "partner_ask_stay");
}

/** Fail the player's debt goal outright, as if it had been lost earlier in the life. */
function loseDebtGoal(state: GameState): GameState {
  const template = content.goals.find((g) => g.id === "player_clear_debt")!;
  const goal: Goal = { ...template, status: "failed", paths: template.paths.map((p) => ({ ...p })) };
  return { ...state, goals: { ...state.goals, player_clear_debt: goal } };
}

describe("the partner and the child", () => {
  it("the child is not in town at the start of a life, the partner always is", () => {
    for (const seed of [1, 2, 3, 17, 99]) {
      const state = newGame(seed, content);
      expect(state.npcs["child"]!.present).toBe(false);
      expect(state.npcs["partner"]!.present).toBe(true);
      expect(childGoals(state)).toEqual([]);
    }
  });

  it("asking them to stay brings the child two mornings later, not sooner", () => {
    let state = moveIn(acquainted(newGame(1, content)));
    expect(state.slots["partner"]!.holder).toBe("partner");
    state = night(state);
    expect(state.loop).toBe(2);
    expect(state.npcs["child"]!.present).toBe(false);
    state = night(state);
    expect(state.loop).toBe(3);
    expect(state.npcs["child"]!.present).toBe(true);
    expect(state.npcs["child"]!.state["arrivedOn"]).toBe(3);
    expect(childGoals(state)).toHaveLength(content.rules.childGoalsAtArrival!);
    expect(state.npcs["child"]!.goalIds).toEqual(childGoals(state).map((g) => g.id).sort());
  });

  it("a goal the player lost is handed down to the child first", () => {
    let state = moveIn(loseDebtGoal(acquainted(newGame(1, content))));
    state = night(night(state));
    expect(childGoals(state).map((g) => g.id)).toContain("child_clear_debt");
  });

  it("the arrival draws the same number of times whatever was handed down", () => {
    const drawsAt = (lost: boolean): number => {
      let state = moveIn(lost ? loseDebtGoal(acquainted(newGame(1, content))) : acquainted(newGame(1, content)));
      state = night(state);
      const before = state.rng.count;
      state = act(state);
      const lastNight = sleep(state, content);
      return lastNight.rng.count - before;
    };
    expect(drawsAt(true)).toBe(drawsAt(false));
  });

  it("a child goal fulfilled by the player scores as the player's own: +5, max unchanged", () => {
    let state = night(night(moveIn(acquainted(newGame(1, content)))));
    const goal = childGoals(state).find((g) => g.id === "child_learns" || g.id === "child_known")!;
    const choice = goal.id === "child_learns" ? "child_read" : "child_walk";
    state = act(state, choice, choice);
    const before = state.day;
    state = act(state, choice);
    expect(state.goals[goal.id]!.status).toBe("fulfilled");
    expect(state.day.max).toBe(before.max + 1);
    expect(state.day.score).toBe(Math.min(before.score + 5, before.max + 1));
    const entry = state.ledger.find((e) => e.kind === "goal" && e.goalId === goal.id);
    expect(entry).toMatchObject({ delta: 5, maxDelta: 0, causedByPlayer: true });
  });

  it("three untended days in a row close the child's goals, and the goblin comes that night", () => {
    let state = night(night(moveIn(acquainted(newGame(1, content)))));
    const arrivedOn = state.loop;
    state = night(night(state));
    expect(childGoals(state).every((g) => g.status === "open")).toBe(true);
    const visitsBefore = state.goblinLog.filter((e) => e.kind === "nightfall").length;
    state = night(state);
    expect(state.loop).toBe(arrivedOn + 3);
    expect(childGoals(state).every((g) => g.status === "failed")).toBe(true);
    const visits = state.goblinLog.filter((e) => e.kind === "nightfall");
    expect(visits.length).toBeGreaterThan(visitsBefore);
    // Neglect is the world's doing at the tick, so the meter never saw it.
    const failures = state.ledger.filter((e) => e.kind === "goal" && e.owner === "child");
    expect(failures.every((e) => e.kind === "goal" && !e.causedByPlayer && e.delta === 0)).toBe(true);
  });

  it("one evening with them resets the count, so neglect never dead-ends", () => {
    let state = night(night(moveIn(acquainted(newGame(1, content)))));
    state = night(night(state));
    state = night(act(state, "child_read"));
    state = night(night(state));
    expect(childGoals(state).every((g) => g.status === "open")).toBe(true);
  });

  it("hurting the child twice fails their goals by the player's hand: −3 each, no break", () => {
    let state = night(night(moveIn(acquainted(newGame(1, content)))));
    state = act(state, "child_shout", "child_shout");
    expect(state.status).toBe("day");
    const failed = state.ledger.filter((e) => e.kind === "goal" && e.owner === "child");
    expect(failed).toHaveLength(content.rules.childGoalsAtArrival!);
    for (const e of failed) expect(e).toMatchObject({ outcome: "failed", causedByPlayer: true, delta: -3, maxDelta: 0 });
    expect(state.goblinLog.some((e) => e.kind === "break")).toBe(false);
  });

  it("the verdict leaves the child's goals out and lists them on their own", () => {
    let state = night(night(moveIn(acquainted(newGame(1, content)))));
    const goal = childGoals(state).find((g) => g.id === "child_learns" || g.id === "child_known")!;
    const choice = goal.id === "child_learns" ? "child_read" : "child_walk";
    const before = computeVerdict(state);
    state = act(state, choice, choice, choice);
    const after = computeVerdict(state);
    expect(after.othersPoints - before.othersPoints).toBe(3); // the three helps, not the goal
    expect(after.selfPoints).toBe(before.selfPoints);
    expect(after.childOutcomes.find((c) => c.goalId === goal.id)?.outcome).toBe("fulfilled");
  });

  it("sending Wren away frees the slot and stops the child coming if it was not already due", () => {
    let state = act(acquainted(newGame(1, content)), "partner_help_first", "partner_send_away");
    expect(availableChoices(state, content).some((c) => c.npc === "partner")).toBe(false);
    state = night(night(night(state)));
    expect(state.npcs["child"]!.present).toBe(false);
  });
});
