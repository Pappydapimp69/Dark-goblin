import { evaluate } from "./conditions";
import type { GoalEvent } from "./goals";
import type { Content, DayMeter, GameState, Impact, LedgerEntry } from "./types";

/** §5.2 step 2. One max point per interaction, not per impact. */
export function beginInteraction(state: GameState): GameState {
  return {
    ...state,
    day: { ...state.day, max: state.day.max + 1, interactions: state.day.interactions + 1 },
  };
}

const IMPACT_SCORE: Record<Impact["kind"], number> = {
  self: 1,
  help: 0,
  harm: -1,
  neutral: 0,
};

/** §5.2 step 3. Every impact is scored and appended to the ledger. */
export function scoreImpacts(
  state: GameState,
  choiceId: string,
  impacts: readonly Impact[],
): GameState {
  let score = state.day.score;
  const entries: LedgerEntry[] = [];

  for (const impact of impacts) {
    const delta = IMPACT_SCORE[impact.kind];
    score += delta;
    entries.push({
      kind: "impact",
      loop: state.loop,
      choiceId,
      target: impact.target,
      impact: impact.kind,
      delta,
    });
  }

  return { ...state, day: { ...state.day, score }, ledger: [...state.ledger, ...entries] };
}

/**
 * §5.2 step 4. Goal events not caused by the player change nothing on the
 * meter — they are still recorded, because the verdict and the goblin read
 * the ledger, not the meter.
 */
export function scoreGoalEvents(state: GameState, events: readonly GoalEvent[]): GameState {
  let { score, max } = state.day;
  const entries: LedgerEntry[] = [];

  for (const event of events) {
    const own = event.owner === "player" || event.owner === "child";
    let delta = 0;
    let maxDelta = 0;

    if (event.causedByPlayer) {
      if (own) {
        delta = event.outcome === "fulfilled" ? 5 : -3;
        maxDelta = 0;
      } else {
        delta = event.outcome === "fulfilled" ? 2 : -2;
        maxDelta = 2;
      }
    }

    score += delta;
    max += maxDelta;
    entries.push({
      kind: "goal",
      loop: state.loop,
      goalId: event.goalId,
      owner: event.owner,
      critical: event.critical,
      outcome: event.outcome,
      causedByPlayer: event.causedByPlayer,
      delta,
      maxDelta,
    });
  }

  return { ...state, day: { ...state.day, score, max }, ledger: [...state.ledger, ...entries] };
}

/**
 * §5.2 step 5. A reset, not a lock: the meter can climb again afterwards, so
 * 7/7 followed by a harm is 6/8.
 */
export function clampDay(state: GameState): GameState {
  if (state.day.score <= state.day.max) return state;
  return { ...state, day: { ...state.day, score: state.day.max } };
}

export function billFor(state: GameState, content: Content): number {
  const modifiers = content.rules.rentModifiers
    .filter((m) => evaluate(m.when, state, `rules.json rentModifier "${m.id}"`))
    .reduce((sum, m) => sum + m.amount, 0);
  return content.rules.baseRent + modifiers + state.debt;
}

/** §5.3 step 1. All integer arithmetic — no float ever reaches the meter. */
export function pressureCheck(state: GameState, content: Content): GameState {
  const bill = billFor(state, content);
  const paid = Math.min(state.money, bill);
  const debt = bill - paid;

  let delta: number;
  if (paid === bill) delta = 1;
  else if (paid * 2 >= bill) delta = 0;
  else delta = -1;

  const entry: LedgerEntry = { kind: "pressure", loop: state.loop, bill, paid, delta };

  return {
    ...state,
    money: state.money - paid,
    debt,
    day: { ...state.day, score: state.day.score + delta, max: state.day.max + 1 },
    ledger: [...state.ledger, entry],
  };
}

/** §5.3 step 3. Never negative once the clamp has run. */
export function dayLoss(day: DayMeter): number {
  return Math.max(0, day.max - day.score);
}
