import { evaluate } from "./conditions";
import { ContentError } from "./errors";
import { pick } from "./rng";
import type { ClosureEvent, Content, EffectSource, GameState, Goal, GoalId } from "./types";

export interface GoalEvent {
  goalId: GoalId;
  owner: string;
  critical: boolean;
  outcome: "fulfilled" | "failed";
  causedByPlayer: boolean;
}

/**
 * §5.4. Runs immediately after every effect batch and after the world tick,
 * tagged with that batch's source — which is how `causedByPlayer` is decided.
 *
 * Goals can gate each other through `{ goalStatus }`, so the sweep repeats to
 * a fixpoint. Ids are visited in sorted order every pass: iteration order must
 * not depend on insertion order, or a replacement goal could shift results.
 */
export function checkGoals(
  state: GameState,
  source: EffectSource,
  content: Content,
): { state: GameState; events: GoalEvent[] } {
  const causedByPlayer = source === "player";
  const events: GoalEvent[] = [];
  let next = state;

  const limit = Object.keys(next.goals).length + content.goals.length + 2;
  for (let pass = 0; pass < limit; pass += 1) {
    const open = Object.keys(next.goals)
      .sort()
      .filter((id) => next.goals[id]?.status === "open");

    let changed = false;
    for (const id of open) {
      const goal = next.goals[id];
      if (!goal || goal.status !== "open") continue;

      const where = `goal "${id}"`;
      const complete = goal.paths.some((p) => evaluate(p.complete, next, `${where}.${p.id}.complete`));

      if (complete) {
        next = setStatus(next, id, "fulfilled");
        events.push({ goalId: id, owner: goal.owner, critical: goal.critical, outcome: "fulfilled", causedByPlayer });
        changed = true;
        continue;
      }

      const closed =
        goal.paths.length > 0 &&
        goal.paths.every((p) => evaluate(p.closed, next, `${where}.${p.id}.closed`));

      if (closed) {
        next = setStatus(next, id, "failed");
        events.push({ goalId: id, owner: goal.owner, critical: goal.critical, outcome: "failed", causedByPlayer });
        const closure: ClosureEvent = {
          goalId: id,
          owner: goal.owner,
          critical: goal.critical,
          causedByPlayer,
        };
        next = { ...next, closedToday: [...next.closedToday, closure] };
        next = handleFailure(next, goal, content);
        changed = true;
      }
    }

    if (!changed) return { state: next, events };
  }

  throw new ContentError("goal check did not settle — circular goalStatus conditions?", "goals");
}

function setStatus(state: GameState, id: GoalId, status: Goal["status"]): GameState {
  const goal = state.goals[id];
  if (!goal) throw new ContentError(`unknown goal "${id}"`, "goals");
  return { ...state, goals: { ...state.goals, [id]: { ...goal, status } } };
}

/**
 * §5.4's three failure routes. The adjacent roll ALWAYS draws — including for
 * an empty pool or a single forced candidate. Skipping the draw on those
 * branches would shift the shared stream and silently desync every later
 * consumer, which is the exact bug this discipline exists to prevent.
 */
function handleFailure(state: GameState, goal: Goal, content: Content): GameState {
  if (!goal.critical) {
    const pool = goal.adjacentPool ?? [];
    const [rolled, rng] = pick(state.rng, pool);
    let next: GameState = { ...state, rng };
    if (rolled !== null) next = addReplacementGoal(next, rolled, goal.owner, content);
    return next;
  }

  // Critical, NPC owner: their story is over except for one aftermath choice.
  // Critical, player or child owner: scored as a failure, but no break.
  const npc = state.npcs[goal.owner];
  if (goal.owner === "player" || goal.owner === "child" || !npc) return state;
  return { ...state, npcs: { ...state.npcs, [goal.owner]: { ...npc, broken: true } } };
}

function addReplacementGoal(
  state: GameState,
  templateId: GoalId,
  owner: string,
  content: Content,
): GameState {
  if (state.goals[templateId]) return state; // already live; the draw still happened
  const template = content.goals.find((g) => g.id === templateId);
  if (!template) throw new ContentError(`adjacentPool references unknown goal "${templateId}"`, "goals.json");

  const goal: Goal = { ...template, owner, status: "open", paths: template.paths.map((p) => ({ ...p })) };
  const npc = state.npcs[owner];
  const npcs = npc
    ? { ...state.npcs, [owner]: { ...npc, goalIds: [...npc.goalIds, templateId] } }
    : state.npcs;

  return { ...state, goals: { ...state.goals, [templateId]: goal }, npcs };
}
