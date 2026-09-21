import { describe, expect, it } from "vitest";
import { newGame } from "../src/engine/engine";
import type { GoalEvent } from "../src/engine/goals";
import {
  beginInteraction,
  billFor,
  clampDay,
  dayLoss,
  pressureCheck,
  scoreGoalEvents,
  scoreImpacts,
} from "../src/engine/scoring";
import type { GameState, ImpactKind } from "../src/engine/types";
import { testContent } from "./fixtures/content";

const content = testContent();
const broke = testContent({ startingMoney: 0 });

function start(state = content): GameState {
  return newGame(1, state);
}

/** One interaction: max +1, the impacts, then the clamp (§5.2 steps 2-5). */
function take(state: GameState, kind: ImpactKind, times = 1): GameState {
  let next = state;
  for (let i = 0; i < times; i += 1) {
    next = beginInteraction(next);
    next = scoreImpacts(next, `${kind}_${i}`, [{ target: "tester", kind }]);
    next = clampDay(next);
  }
  return next;
}

function goal(
  owner: string,
  outcome: "fulfilled" | "failed",
  causedByPlayer = true,
): GoalEvent {
  return { goalId: `${owner}_${outcome}`, owner, critical: false, outcome, causedByPlayer };
}

function meter(state: GameState): string {
  return `${state.day.score}/${state.day.max}`;
}

describe("§8 scoring table", () => {
  it("10 self-helps → 9/10, 10/11 after bills, loss 1", () => {
    const day = take(start(), "self", 10);
    expect(meter(day)).toBe("9/10");

    const night = clampDay(pressureCheck(day, content));
    expect(meter(night)).toBe("10/11");
    expect(dayLoss(night.day)).toBe(1);
  });

  it("10 self-helps + player goal fulfilled → 10/10, 11/11 after bills, loss 0", () => {
    let day = take(start(), "self", 10);
    day = clampDay(scoreGoalEvents(day, [goal("player", "fulfilled")]));
    expect(meter(day)).toBe("10/10");

    const night = clampDay(pressureCheck(day, content));
    expect(meter(night)).toBe("11/11");
    expect(dayLoss(night.day)).toBe(0);
  });

  it("10 NPC helps → −1/10, 0/11 after bills, loss 11", () => {
    const day = take(start(), "help", 10);
    expect(meter(day)).toBe("-1/10");

    const night = clampDay(pressureCheck(day, content));
    expect(meter(night)).toBe("0/11");
    expect(dayLoss(night.day)).toBe(11);
  });

  it("10 NPC helps + 2 player-caused NPC goals fulfilled → 3/14, 4/15, loss 11", () => {
    let day = take(start(), "help", 10);
    day = clampDay(
      scoreGoalEvents(day, [goal("tester", "fulfilled"), goal("fragile", "fulfilled")]),
    );
    expect(meter(day)).toBe("3/14");

    const night = clampDay(pressureCheck(day, content));
    expect(meter(night)).toBe("4/15");
    expect(dayLoss(night.day)).toBe(11);
  });

  it("5 harms + 1 player-caused NPC goal failed → −8/7, −7/8, loss 15", () => {
    let day = take(start(), "harm", 5);
    day = clampDay(scoreGoalEvents(day, [goal("tester", "failed")]));
    expect(meter(day)).toBe("-8/7");

    const night = clampDay(pressureCheck(day, content));
    expect(meter(night)).toBe("-7/8");
    expect(dayLoss(night.day)).toBe(15);
  });

  it("0 interactions, bill missed → −1/0, −2/1, loss 3", () => {
    const day = start(broke);
    expect(meter(day)).toBe("-1/0");

    const night = clampDay(pressureCheck(day, broke));
    expect(meter(night)).toBe("-2/1");
    expect(dayLoss(night.day)).toBe(3);
  });

  it("clamp: at 7/7, one harm → 6/8", () => {
    const at77: GameState = { ...start(), day: { score: 7, max: 7, interactions: 7 } };
    expect(meter(take(at77, "harm"))).toBe("6/8");
  });
});

describe("the clamp", () => {
  it("runs after every interaction, so a later interaction still counts", () => {
    // +5 pushes the score over the max; the clamp resets it, it does not lock.
    let state = take(start(), "self", 3);
    state = clampDay(scoreGoalEvents(state, [goal("player", "fulfilled")]));
    expect(meter(state)).toBe("3/3");

    state = take(state, "self");
    expect(meter(state)).toBe("4/4");

    state = take(state, "harm");
    expect(meter(state)).toBe("3/5");
  });

  it("runs again after the pressure check", () => {
    const over: GameState = { ...start(), day: { score: 12, max: 10, interactions: 10 } };
    const night = clampDay(pressureCheck(over, content));
    expect(meter(night)).toBe("11/11");
  });
});

describe("pressure", () => {
  it("carries an unpaid bill into the next day's debt", () => {
    const poor: GameState = { ...start(), money: 2 };
    const night = pressureCheck(poor, content);

    expect(night.money).toBe(0);
    expect(night.debt).toBe(3);
    expect(night.day.score).toBe(-2); // paid 2 of 5 is under half, so -1 on top of the day's -1
    expect(billFor(night, content)).toBe(8); // 5 base + 3 carried
  });

  it("scores +0 at exactly half the bill and −1 below it", () => {
    const half = pressureCheck({ ...start(), money: 3, day: { score: 0, max: 0, interactions: 0 } }, content);
    expect(half.day.score).toBe(0);

    const under = pressureCheck({ ...start(), money: 2, day: { score: 0, max: 0, interactions: 0 } }, content);
    expect(under.day.score).toBe(-1);
  });

  it("applies rent modifiers from content, not from code", () => {
    const withModifier = testContent({
      rentModifiers: [{ id: "holds_storefront", when: { slotHolder: "storefront", is: "player" }, amount: 3 }],
    });
    const state = start(withModifier);
    expect(billFor(state, withModifier)).toBe(5);

    const holding: GameState = {
      ...state,
      slots: { ...state.slots, storefront: { ...state.slots["storefront"]!, holder: "player" } },
    };
    expect(billFor(holding, withModifier)).toBe(8);
  });
});

describe("attribution on the meter", () => {
  it("ignores goal outcomes the player did not cause, but still ledgers them", () => {
    const before = take(start(), "help", 2);
    const after = scoreGoalEvents(before, [
      goal("tester", "fulfilled", false),
      goal("player", "failed", false),
    ]);

    expect(meter(after)).toBe(meter(before));
    expect(after.ledger.filter((e) => e.kind === "goal")).toHaveLength(2);
    expect(after.ledger.every((e) => e.kind !== "goal" || e.delta === 0)).toBe(true);
  });
});
