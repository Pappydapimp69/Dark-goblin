import { describe, expect, it } from "vitest";
import { newGame } from "../src/engine/engine";
import { validateContent } from "../src/engine/validate";
import type { Content } from "../src/engine/types";
import { testContent } from "./fixtures/content";

/** §7: every failure names the file and the id. */
function expectRejected(mutate: (c: Content) => void, naming: RegExp): void {
  const content = testContent();
  mutate(content);
  expect(() => newGame(1, content)).toThrow(naming);
}

describe("content validation", () => {
  it("accepts the prototype fixture", () => {
    expect(() => validateContent(testContent())).not.toThrow();
  });

  it("rejects an adjacentPool pointing at a goal that does not exist", () => {
    expectRejected(
      (c) => { c.goals[0]!.adjacentPool = ["ghost_goal"]; },
      /goals\.json "tester_goal".*ghost_goal/,
    );
  });

  it("rejects a choice with no impacts", () => {
    expectRejected((c) => { c.choices[0]!.impacts = []; }, /choices\.json "self_job".*no impacts/);
  });

  it("rejects a condition the DSL does not recognise", () => {
    expectRejected(
      (c) => { c.choices[0]!.available = { mood: "sunny" } as never; },
      /choices\.json "self_job"\.available/,
    );
  });

  it("rejects an effect the DSL does not recognise", () => {
    expectRejected(
      (c) => { c.choices[0]!.effects = [{ teleport: "away" } as never]; },
      /choices\.json "self_job"\.effects\[0\]/,
    );
  });

  it("rejects a critical goal that starts with fewer than two open paths", () => {
    expectRejected(
      (c) => {
        const fragile = c.goals.find((g) => g.id === "fragile_life")!;
        fragile.paths = [fragile.paths[0]!];
      },
      /goals\.json "fragile_life".*at least 2/,
    );
  });

  it("rejects a critical goal whose paths are already closed at game start", () => {
    expectRejected(
      (c) => {
        const fragile = c.goals.find((g) => g.id === "fragile_life")!;
        for (const path of fragile.paths) path.closed = { all: [] };
      },
      /goals\.json "fragile_life".*0 path/,
    );
  });

  it("rejects duplicate ids", () => {
    expectRejected((c) => { c.choices.push({ ...c.choices[0]! }); }, /duplicate choice id "self_job"/);
  });

  it("rejects a goblin question that does not offer 3 or 4 answers", () => {
    expectRejected(
      (c) => { c.goblin.questions[0]!.answers = c.goblin.questions[0]!.answers.slice(0, 2); },
      /goblin\.json "q_keyed".*3 or 4/,
    );
  });

  it("rejects a player goal pool smaller than the number rolled at start", () => {
    expectRejected((c) => { c.rules.playerGoalsAtStart = 5; }, /rules\.json.*playerGoalPool/);
  });
});
