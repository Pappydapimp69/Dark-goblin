import { describe, expect, it } from "vitest";
import { content } from "../src/content";
import { availableChoices, interact, newGame, sleep } from "../src/engine/engine";
import type { GameState } from "../src/engine/types";

// Nobody's choices appear at the first tap. You meet a person on one day and
// again on another; only then do the things you could do for them, or to
// them, appear. The child is yours and needs no introduction.

const offeredFor = (state: GameState, npc: string): string[] =>
  availableChoices(state, content).filter((c) => c.npc === npc).map((c) => c.id);

const gated = content.npcs.filter((n) => typeof n.state["known"] === "number").map((n) => n.id);

describe("getting to know someone", () => {
  it("everyone but the player and the child starts as a stranger", () => {
    expect(gated).not.toContain("child");
    expect(gated).not.toContain("player");
    expect(gated).toHaveLength(content.npcs.length - 2);
  });

  it("on the first morning, a stranger offers only the first meeting", () => {
    for (const seed of [1, 2, 3, 17, 99]) {
      const state = newGame(seed, content);
      for (const id of gated.filter((g) => state.npcs[g]!.present)) {
        expect(offeredFor(state, id)).toEqual([`${id}_meet_1`]);
      }
    }
  });

  it("takes two different days: once met today, there is nothing more until tomorrow", () => {
    let state = newGame(1, content);
    state = interact(state, "baker_meet_1", content);
    expect(offeredFor(state, "baker")).toEqual([]);
    state = sleep(state, content);
    expect(offeredFor(state, "baker")).toEqual(["baker_meet_2"]);
    state = interact(state, "baker_meet_2", content);
    const opened = offeredFor(state, "baker");
    expect(opened).not.toContain("baker_meet_2");
    expect(opened).toEqual(expect.arrayContaining(["baker_help_first", "baker_sell_her_flour", "baker_drive_out"]));
  });

  it("a meeting is a neutral act: it costs the day an action, and scores nothing", () => {
    const state = interact(newGame(1, content), "baker_meet_1", content);
    expect(state.day).toEqual({ score: -1, max: 1, interactions: 1 });
  });

  it("no choice of a gated person except the meetings and the aftermath is reachable before they are known", () => {
    for (const choice of content.choices) {
      if (!gated.includes(choice.npc) || choice.meeting || choice.aftermath) continue;
      const json = JSON.stringify(choice.available);
      expect(json, choice.id).toContain(`{"npc":"${choice.npc}","key":"known","gte":2}`);
    }
  });

  it("every gated person has exactly two meetings", () => {
    for (const id of gated) {
      expect(content.choices.filter((c) => c.npc === id && c.meeting).map((c) => c.id)).toEqual([`${id}_meet_1`, `${id}_meet_2`]);
    }
  });
});
