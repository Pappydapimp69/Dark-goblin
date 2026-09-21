import { describe, expect, it } from "vitest";
import { content } from "../src/content";
import { acknowledgeGoblin, answerGoblin, availableChoices, interact, newGame, sleep } from "../src/engine/engine";
import type { GameState } from "../src/engine/types";

/** Play a scripted day: the listed choices, then bed. Goblins resolved as met. */
function day(state: GameState, ...choiceIds: string[]): GameState {
  let next = state;
  for (const id of choiceIds) {
    next = settle(next);
    expect(availableChoices(next, content).map((c) => c.id)).toContain(id);
    next = interact(next, id, content);
  }
  next = settle(next);
  return settle(sleep(next, content));
}

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

const start = (): GameState => newGame(1, content);

/**
 * §10: the storefront has to reach the baker by all three routes. These are
 * the definition of done, so they are driven by hand rather than left to the
 * simulator to stumble across.
 */
describe("the three routes to the storefront", () => {
  it("shift — he leaves willingly, and his critical goal ends in peace", () => {
    let state = start();
    state = day(state, "baker_help_first", "shop_listen_first");
    state = day(state, "baker_help_again", "shop_listen_again");
    state = day(state, "baker_help_again", "shop_help_him_go");

    expect(state.flags["shopkeeper_retired"]).toBe(true);
    expect(state.goals["shopkeeper_retire"]?.status).toBe("fulfilled");
    expect(state.goals["shopkeeper_income"]?.status).toBe("fulfilled");
    expect(state.npcs["shopkeeper"]?.broken).toBe(false);
    expect(state.goblinLog.filter((e) => e.kind === "break")).toEqual([]);

    state = day(state, "baker_takes_storefront");
    expect(state.slots["storefront"]?.holder).toBe("baker");
    expect(state.goals["baker_shop"]?.status).toBe("fulfilled");
  });

  it("hurt — the creditor takes it, and the goblin comes for it", () => {
    let state = start();
    state = day(state, "baker_help_first", "shop_tell_creditor");

    // The foreclosure was scheduled, so it lands in the world tick — and it is
    // still the player's doing when it does.
    expect(state.flags["shopkeeper_foreclosed"]).toBe(true);
    expect(state.goals["shopkeeper_income"]?.status).toBe("failed");
    expect(state.npcs["shopkeeper"]?.broken).toBe(true);
    expect(state.goblinLog.filter((e) => e.kind === "break")).toHaveLength(1);

    state = day(state, "baker_help_again");
    state = day(state, "baker_help_again");
    state = day(state, "baker_takes_storefront");

    expect(state.slots["storefront"]?.holder).toBe("baker");
    expect(state.goals["baker_shop"]?.status).toBe("fulfilled");
  });

  it("help — the ruin is rebuilt and she takes that one instead", () => {
    let state = start();
    state = day(state, "baker_help_first", "builder_tools_first");
    state = day(state, "baker_help_again", "builder_encourage");
    state = day(state, "baker_help_again", "builder_first_job");

    expect(state.goals["builder_work"]?.status).toBe("fulfilled");
    expect(state.slots["wrecked_shop"]?.exists).toBe(false); // two loops out

    state = day(state);
    expect(state.slots["wrecked_shop"]?.exists).toBe(true);

    state = day(state, "baker_takes_wrecked");
    expect(state.slots["wrecked_shop"]?.holder).toBe("baker");
    expect(state.goals["baker_shop"]?.status).toBe("fulfilled");
    expect(state.slots["storefront"]?.holder).toBe("shopkeeper"); // Aldo keeps his
  });

  it("taking a shop for yourself closes that path for her", () => {
    let state = start();
    state = day(state, "baker_help_first", "shop_listen_first");
    state = day(state, "baker_help_again", "shop_listen_again");
    state = day(state, "baker_help_again", "shop_help_him_go");
    state = day(state, "baker_shop_for_self");

    expect(state.slots["storefront"]?.holder).toBe("player");
    // Her other path is still open: the ruin could still be rebuilt.
    expect(state.goals["baker_shop"]?.status).toBe("open");
  });
});
