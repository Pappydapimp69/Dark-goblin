import { evaluate } from "./conditions";
import { applyEffects } from "./effects";
import { RuleError } from "./errors";
import { breakVisit, nightfallClosures, nightfallVisit } from "./goblin";
import { checkGoals, type GoalEvent } from "./goals";
import { worldTick as worldTickImpl } from "./world";
import { createRng, pickDistinct } from "./rng";
import { beginInteraction, clampDay, dayLoss, pressureCheck, scoreGoalEvents, scoreImpacts } from "./scoring";
import type {
  Choice,
  ClosureEvent,
  Content,
  GameState,
  Goal,
  NpcState,
  RngState,
  Slot,
} from "./types";
import { validateContent, validateStart } from "./validate";

/**
 * The engine's whole public surface. Every function is pure:
 * (state, input) -> state. Nothing here touches Phaser, the DOM, the clock, or
 * ambient randomness — the render layer dispatches these and draws the result.
 */

export function newGame(seed: number, content: Content): GameState {
  validateContent(content);

  // Deal the town before anything else touches the stream, so the same seed
  // always assembles the same cast.
  const rngStart = createRng(seed);
  const [present, afterTown] = rollTown(rngStart, content);

  const npcs: Record<string, NpcState> = {};
  for (const def of content.npcs) {
    npcs[def.id] = {
      id: def.id,
      name: def.name,
      state: { ...def.state },
      broken: false,
      goalIds: [...def.goalIds],
      present: present.has(def.id),
    };
  }

  const slots: Record<string, Slot> = {};
  for (const def of content.slots) {
    slots[def.id] = { id: def.id, kind: def.kind, holder: def.holder, exists: def.exists };
  }

  // The whole roster's goals are instantiated, not just the town's: a
  // condition may name anyone, and an absent person's goal simply never moves
  // because nothing in play touches their state.
  const goals: Record<string, Goal> = {};
  for (const def of content.npcs) {
    for (const id of def.goalIds) {
      const template = content.goals.find((g) => g.id === id);
      if (template) goals[id] = { ...template, status: "open", paths: template.paths.map((p) => ({ ...p })) };
    }
  }

  // The player's opening goals are rolled from the pool with the seeded
  // stream, so the same seed always deals the same life.
  const pool = content.rules.playerGoalPool
    .map((id) => content.goals.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => g !== undefined);
  const [rolled, rng] = pickDistinct(
    afterTown,
    pool,
    content.rules.playerGoalsAtStart,
    content.rules.playerGoalsAtStart,
  );
  for (const template of rolled) {
    goals[template.id] = { ...template, status: "open", paths: template.paths.map((p) => ({ ...p })) };
  }

  const state: GameState = {
    seed,
    rng,
    loop: 1,
    lifespan: { current: content.rules.lifespanMax, max: content.rules.lifespanMax },
    day: { score: -1, max: 0, interactions: 0 },
    money: content.rules.startingMoney,
    debt: content.rules.startingDebt,
    npcs,
    slots,
    goals,
    flags: {},
    scheduled: [],
    closedToday: [],
    ledger: [],
    goblinLog: [],
    status: "day",
    pendingGoblin: null,
  };

  validateStart(state);
  return state;
}

/** §5.4: a broken NPC offers only their single authored aftermath choice. */
export function availableChoices(state: GameState, content: Content): Choice[] {
  if (state.status !== "day") return [];
  return content.choices.filter((choice) => {
    const npc = state.npcs[choice.npc];
    if (!npc || !npc.present) return false;
    // A broken person offers only their aftermath line — and that line does
    // not exist until they break.
    if (npc.broken !== (choice.aftermath === true)) return false;
    return evaluate(choice.available, state, `choices.json "${choice.id}".available`);
  });
}

/** §5.2, applied in the order the spec lists. */
export function interact(state: GameState, choiceId: string, content: Content): GameState {
  if (state.status !== "day") throw new RuleError(`cannot interact while status is "${state.status}"`);
  if (state.day.interactions >= content.rules.interactionsPerDay) {
    throw new RuleError("no interactions left today");
  }

  const choice = content.choices.find((c) => c.id === choiceId);
  if (!choice) throw new RuleError(`unknown choice "${choiceId}"`);
  if (!availableChoices(state, content).some((c) => c.id === choiceId)) {
    throw new RuleError(`choice "${choiceId}" is not available`);
  }

  // 1. effects, tagged player — this tag is what makes the outcome the
  //    player's doing, including for anything it schedules.
  let next = applyEffects(state, choice.effects, "player", `choices.json "${choiceId}".effects`);

  // 2-3. the meter, then every impact.
  next = beginInteraction(next);
  next = scoreImpacts(next, choiceId, choice.impacts);

  // 4. the goal check runs against this batch's source.
  const checked = checkGoals(next, "player", content);
  next = scoreGoalEvents(checked.state, checked.events);

  // 5. clamp.
  next = clampDay(next);

  // 6. a player-caused critical NPC failure stops the day.
  const broke = firstBreak(checked.events);
  if (broke) return openBreak(next, broke, content, "day");

  if (next.day.interactions >= content.rules.interactionsPerDay) return endDay(next, content);
  return next;
}

export function sleep(state: GameState, content: Content): GameState {
  if (state.status !== "day") throw new RuleError(`cannot sleep while status is "${state.status}"`);
  return endDay(state, content);
}

/** The break has no questions (§5.6) — he says his piece and leaves. */
export function acknowledgeGoblin(state: GameState, content: Content): GameState {
  const visit = state.pendingGoblin;
  if (state.status !== "goblin_break" || !visit) {
    throw new RuleError(`no break to acknowledge (status "${state.status}")`);
  }

  const next: GameState = { ...state, pendingGoblin: null, status: "day" };
  if (visit.resume === "endOfDay") return afterWorldTick(next, content);
  if (next.day.interactions >= content.rules.interactionsPerDay) return endDay(next, content);
  return next;
}

/**
 * §5.6: answers never change score or state. The only thing that moves is the
 * log and the cursor — verified by a snapshot test.
 */
export function answerGoblin(state: GameState, answerId: string, content: Content): GameState {
  const visit = state.pendingGoblin;
  if (state.status !== "goblin_nightfall" || !visit) {
    throw new RuleError(`no nightfall question waiting (status "${state.status}")`);
  }

  const questionId = visit.questionIds[visit.cursor];
  if (questionId === undefined) throw new RuleError("no question left to answer");

  const question = content.goblin.questions.find((q) => q.id === questionId);
  if (!question?.answers.some((a) => a.id === answerId)) {
    throw new RuleError(`"${answerId}" is not an answer to "${questionId}"`);
  }

  const cursor = visit.cursor + 1;
  const next: GameState = {
    ...state,
    goblinLog: [
      ...state.goblinLog,
      {
        kind: "nightfall",
        loop: state.loop,
        questionId,
        answerId,
        closureGoalIds: visit.closureGoalIds,
      },
    ],
    pendingGoblin: { ...visit, cursor },
  };

  if (cursor < visit.questionIds.length) return next;
  return finishDay({ ...next, pendingGoblin: null }, content);
}

/**
 * Who is in town this life. The pinned are always here — §10's three routes
 * need their three people — and the rest of the town is dealt from the roster.
 * The draw count is fixed by the rules, never by how the deal goes.
 */
function rollTown(rng: RngState, content: Content): [Set<string>, RngState] {
  const townspeople = content.npcs.filter((n) => n.role !== "player");
  const present = new Set(content.npcs.filter((n) => n.role === "player").map((n) => n.id));

  const size = content.rules.townSize ?? townspeople.length;
  const pinned = new Set(content.rules.pinnedNpcs ?? []);
  const seated = townspeople.filter((n) => pinned.has(n.id));
  for (const n of seated) present.add(n.id);

  const rollable = townspeople
    .map((n) => n.id)
    .filter((id) => !present.has(id))
    .sort();

  const seats = Math.max(0, size - seated.length);
  const [dealt, advanced] = pickDistinct(rng, rollable, seats, seats);
  for (const id of dealt) present.add(id);

  return [present, advanced];
}

// ------------------------------------------------------------------ internals

/** §5.3, in the order the spec lists it. */
function endDay(state: GameState, content: Content): GameState {
  // 1-2. the bill, then the clamp.
  let next = pressureCheck(state, content);
  next = clampDay(next);

  // 3. what the day cost. The meter is cashed out here, before the world
  //    moves — so nothing the world tick raises can change this number.
  const loss = dayLoss(next.day);
  next = { ...next, lifespan: { ...next.lifespan, current: next.lifespan.current - loss } };

  // 4. the world moves.
  const ticked = worldTickWithScoring(next, content);
  next = ticked.state;

  // A foreclosure the player set in motion lands here, not mid-day — it is
  // still their doing, so it still breaks him.
  const broke = firstBreak(ticked.events);
  if (broke) return openBreak(next, broke, content, "endOfDay");

  return afterWorldTick(next, content);
}

/** §5.3 steps 5-7, reachable directly or after a break interrupts them. */
function afterWorldTick(state: GameState, content: Content): GameState {
  const closures = nightfallClosures(state);
  if (closures.length > 0) {
    const visit = nightfallVisit(state, closures, content);
    if (visit.visit.questionIds.length > 0) {
      return { ...visit.state, status: "goblin_nightfall", pendingGoblin: visit.visit };
    }
    return finishDay(visit.state, content);
  }
  return finishDay(state, content);
}

function finishDay(state: GameState, _content: Content): GameState {
  if (state.lifespan.current <= 0) return { ...state, status: "review", pendingGoblin: null };

  return {
    ...state,
    loop: state.loop + 1,
    day: { score: -1, max: 0, interactions: 0 },
    closedToday: [],
    status: "day",
    pendingGoblin: null,
  };
}

/**
 * The world tick's goal events are ledgered (the verdict counts a goal the
 * player's scheduled effect fulfilled) but cannot change lifespan: §5.3 cashes
 * the meter out at step 3, before the tick at step 4.
 */
function worldTickWithScoring(
  state: GameState,
  content: Content,
): { state: GameState; events: GoalEvent[] } {
  const ticked = worldTickImpl(state, content);
  return { state: scoreGoalEvents(ticked.state, ticked.events), events: ticked.events };
}

function firstBreak(events: readonly GoalEvent[]): ClosureEvent | null {
  const event = events.find(
    (e) =>
      e.outcome === "failed" &&
      e.critical &&
      e.causedByPlayer &&
      e.owner !== "player" &&
      e.owner !== "child",
  );
  if (!event) return null;
  return { goalId: event.goalId, owner: event.owner, critical: true, causedByPlayer: true };
}

function openBreak(
  state: GameState,
  closure: ClosureEvent,
  content: Content,
  resume: "day" | "endOfDay",
): GameState {
  const visit = breakVisit(closure, content, resume);
  return {
    ...state,
    status: "goblin_break",
    pendingGoblin: visit,
    goblinLog: [
      ...state.goblinLog,
      {
        kind: "break",
        loop: state.loop,
        goalId: closure.goalId,
        owner: closure.owner,
        lineId: visit.lineId ?? "",
      },
    ],
  };
}
