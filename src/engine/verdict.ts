import type { GameState, GoalId, GoblinEntry } from "./types";

export interface ChildOutcome {
  goalId: GoalId;
  label: string;
  outcome: "fulfilled" | "failed" | "open";
}

export interface VerdictResult {
  verdict: "self" | "others";
  /** Engine-internal. The player is never shown a number (§0). */
  selfPoints: number;
  othersPoints: number;
  breaks: Extract<GoblinEntry, { kind: "break" }>[];
  answers: Extract<GoblinEntry, { kind: "nightfall" }>[];
  childOutcomes: ChildOutcome[];
}

/**
 * §5.7. Read back in order: the breaks, the answers given, what was taken
 * against what was given, the child's outcomes kept separate, then one verdict.
 */
export function computeVerdict(state: GameState): VerdictResult {
  let selfImpacts = 0;
  let helpImpacts = 0;
  let npcGoalsFulfilledByPlayer = 0;

  for (const entry of state.ledger) {
    if (entry.kind === "impact") {
      if (entry.impact === "self") selfImpacts += 1;
      if (entry.impact === "help") helpImpacts += 1;
      continue;
    }
    if (entry.kind === "goal") {
      const own = entry.owner === "player" || entry.owner === "child";
      if (!own && entry.outcome === "fulfilled" && entry.causedByPlayer) {
        npcGoalsFulfilledByPlayer += 1;
      }
    }
  }

  const playerGoalsFulfilled = Object.values(state.goals).filter(
    (g) => g.owner === "player" && g.status === "fulfilled",
  ).length;

  const selfPoints = selfImpacts + playerGoalsFulfilled;
  const othersPoints = helpImpacts + npcGoalsFulfilledByPlayer;

  const childOutcomes: ChildOutcome[] = Object.values(state.goals)
    .filter((g) => g.owner === "child")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((g) => ({ goalId: g.id, label: g.label, outcome: g.status }));

  return {
    verdict: selfPoints > othersPoints ? "self" : "others",
    selfPoints,
    othersPoints,
    breaks: state.goblinLog.filter((e): e is Extract<GoblinEntry, { kind: "break" }> => e.kind === "break"),
    answers: state.goblinLog.filter(
      (e): e is Extract<GoblinEntry, { kind: "nightfall" }> => e.kind === "nightfall",
    ),
    childOutcomes,
  };
}
