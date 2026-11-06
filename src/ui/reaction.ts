import type { Choice, GameState } from "../engine/types";

/**
 * Which reaction line a choice gets, read from the ledger the engine already
 * keeps (one impact entry per impact, per take). The first take shows
 * `response`, the next ones walk `again`, and once those are spent the act
 * happens without comment: Brain 0101#E99 measured that no pool keeps up with
 * a choice taken every day (pool 5 still 84% stale), so a habit gets a last
 * line that names it as a habit, then silence. Pure; nothing is written back.
 *
 * `state` is the state AFTER the interaction, so the take just made is counted.
 */
export function reactionFor(choice: Choice, state: GameState): string | null {
  const perTake = Math.max(1, choice.impacts.length);
  const entries = state.ledger.filter((e) => e.kind === "impact" && e.choiceId === choice.id).length;
  const before = Math.max(0, Math.ceil(entries / perTake) - 1);
  // A choice nobody has written more for keeps its one line: silence is only
  // earned once the habit line has been said.
  if (!choice.again || choice.again.length === 0) return choice.response ?? null;
  const lines = [choice.response, ...choice.again].filter((l): l is string => typeof l === "string");
  return lines[before] ?? null;
}
