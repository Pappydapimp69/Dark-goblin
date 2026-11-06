import { describe, expect, it } from "vitest";
import { content } from "../src/content";
import { interact, newGame, sleep } from "../src/engine/engine";
import type { Choice, GameState } from "../src/engine/types";
import { reactionFor } from "../src/ui/reaction";
import { acquainted } from "./harness";

const take = (state: GameState, id: string): GameState => interact(state, id, content);

describe("which reaction line a choice gets", () => {
  it("first, second, then the habit line, then nothing", () => {
    const real = content.choices.find((c) => c.id === "baker_sell_her_flour")!;
    const choice: Choice = { ...real, again: ["second time", "by now it is a habit"] };
    let state = acquainted(newGame(1, content));
    const seen: (string | null)[] = [];
    for (let day = 0; day < 4; day += 1) {
      state = take(state, choice.id);
      seen.push(reactionFor(choice, state));
      state = sleep(state, content);
    }
    expect(seen).toEqual([choice.response, choice.again![0], choice.again![1], null]);
  });

  it("counts takes, not ledger rows, for a choice that touches two people", () => {
    const choice: Choice = {
      id: "x", npc: "baker", text: "", available: { loopGte: 1 }, effects: [],
      impacts: [{ target: "player", kind: "self" }, { target: "baker", kind: "harm" }],
      response: "one", again: ["two", "three"],
    };
    const row = (n: number) => ({ kind: "impact" as const, loop: 1, choiceId: "x", target: "player", impact: "self" as const, delta: n });
    const base = newGame(1, content);
    const after = (takes: number): GameState => ({ ...base, ledger: Array.from({ length: takes * 2 }, (_, i) => row(i)) });
    expect([1, 2, 3, 4].map((n) => reactionFor(choice, after(n)))).toEqual(["one", "two", "three", null]);
  });

  it("a choice with no further lines keeps its one line every time", () => {
    const real = content.choices.find((c) => c.id === "baker_sell_her_flour")!;
    const choice: Choice = { ...real, again: undefined };
    let state = acquainted(newGame(1, content));
    for (let day = 0; day < 3; day += 1) {
      state = take(state, choice.id);
      expect(reactionFor(choice, state)).toBe(choice.response);
      state = sleep(state, content);
    }
  });
});
