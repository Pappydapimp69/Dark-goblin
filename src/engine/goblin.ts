import { nextInt, pickDistinct } from "./rng";
import type { ClosureEvent, Content, GameState, GoalId, PendingGoblin } from "./types";

/** §5.6. Nightfall fires only when a player- or child-owned goal failed today. */
export function nightfallClosures(state: GameState): ClosureEvent[] {
  return state.closedToday.filter((c) => c.owner === "player" || c.owner === "child");
}

export function breakVisit(
  closure: ClosureEvent,
  content: Content,
  resume: "day" | "endOfDay",
): PendingGoblin {
  const line = content.goblin.breaks.find((b) => b.goalId === closure.goalId);
  return {
    kind: "break",
    lineId: line?.id ?? "",
    goalId: closure.goalId,
    owner: closure.owner,
    questionIds: [],
    cursor: 0,
    closureGoalIds: [closure.goalId],
    resume,
  };
}

/**
 * §5.6. 1–3 questions keyed to the day's closures.
 *
 * The draw count is CONSTANT — one for the question count, then three for the
 * picks whatever that count turned out to be. A branch that drew fewer would
 * shift the shared stream and change unrelated future rolls.
 */
export function nightfallVisit(
  state: GameState,
  closures: readonly ClosureEvent[],
  content: Content,
): { state: GameState; visit: PendingGoblin } {
  const closureGoalIds: GoalId[] = closures.map((c) => c.goalId);

  const keyed = content.goblin.questions.filter(
    (q) => q.forGoals?.some((id) => closureGoalIds.includes(id)) ?? false,
  );
  const generic = content.goblin.questions.filter((q) => q.forGoals === undefined);
  const pool = keyed.length > 0 ? [...keyed, ...generic] : content.goblin.questions;

  const [roll, afterCount] = nextInt(state.rng, 3);
  const count = roll + 1;
  const [chosen, rng] = pickDistinct(afterCount, pool, count, 3);

  return {
    state: { ...state, rng },
    visit: {
      kind: "nightfall",
      questionIds: chosen.map((q) => q.id),
      cursor: 0,
      closureGoalIds,
      resume: "endOfDay",
    },
  };
}
