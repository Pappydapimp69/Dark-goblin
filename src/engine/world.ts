import { applyEffects } from "./effects";
import { checkGoals, type GoalEvent } from "./goals";
import { evaluate } from "./conditions";
import { pickDistinct } from "./rng";
import type { Content, Effect, GameState, Goal, GoalId, ScheduledEffect } from "./types";

/**
 * §5.5. Scheduled effects keep the source they were created with, so a
 * foreclosure the player set in motion two loops ago is still the player's
 * doing when it lands. Player-sourced and world-sourced effects are therefore
 * applied as separate batches, each followed by its own goal check.
 */
export function worldTick(
  state: GameState,
  content: Content,
): { state: GameState; events: GoalEvent[] } {
  const due: ScheduledEffect[] = [];
  const held: ScheduledEffect[] = [];
  for (const entry of state.scheduled) {
    (entry.atLoop <= state.loop + 1 ? due : held).push(entry);
  }

  let next: GameState = { ...state, scheduled: held };
  const events: GoalEvent[] = [];

  const playerEffects = due.filter((d) => d.source === "player").map((d) => d.effect);
  if (playerEffects.length > 0) {
    next = applyEffects(next, playerEffects, "player", "scheduled(player)");
    const checked = checkGoals(next, "player", content);
    next = checked.state;
    events.push(...checked.events);
  }

  const worldEffects: Effect[] = due.filter((d) => d.source === "world").map((d) => d.effect);
  worldEffects.push(...npcTickEffects(next, content));

  next = applyEffects(next, worldEffects, "world", "worldTick");
  const checked = checkGoals(next, "world", content);
  next = checked.state;
  events.push(...checked.events);

  // Arrivals come last, so they see everything the night has already done,
  // and the goals they bring are checked once before the morning.
  const arrived = arrivals(next, content);
  if (arrived !== next) {
    const settled = checkGoals(arrived, "world", content);
    next = settled.state;
    events.push(...settled.events);
  }

  return { state: next, events };
}

/**
 * Anyone absent whose `arrives` condition now holds comes into town. The
 * child's goals are dealt on arrival: first the child versions of goals the
 * player has already lost (handed down, in goal-id order), then the rest
 * drawn from rules.childGoalPool. The draw always happens, even when the
 * handed-down goals fill every place, so the stream never depends on what
 * the player lost.
 */
function arrivals(state: GameState, content: Content): GameState {
  let next = state;
  for (const def of [...content.npcs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const live = next.npcs[def.id];
    if (!def.arrives || !live || live.present) continue;
    if (!evaluate(def.arrives, next, `npcs.json "${def.id}".arrives`)) continue;
    // The tick runs before the loop advances, so they are first seen tomorrow.
    const arrived = { ...live, present: true, state: { ...live.state, arrivedOn: next.loop + 1 } };
    next = { ...next, npcs: { ...next.npcs, [def.id]: arrived } };
    if (def.id === "child") next = dealChildGoals(next, content);
  }
  return next;
}

function dealChildGoals(state: GameState, content: Content): GameState {
  const count = content.rules.childGoalsAtArrival ?? 2;
  const handedDown: GoalId[] = Object.values(state.goals)
    .filter((g) => g.owner === "player" && g.status === "failed")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((g) => content.goals.find((t) => t.id === g.id)?.childVariant)
    .filter((id): id is GoalId => id !== undefined && state.goals[id] === undefined);
  const chosen = [...new Set(handedDown)].slice(0, count);

  const rest = (content.rules.childGoalPool ?? []).filter((id) => !chosen.includes(id) && !state.goals[id]);
  const want = Math.min(count - chosen.length, rest.length);
  const [drawn, rng] = pickDistinct(state.rng, rest, want, count);
  chosen.push(...drawn);

  const goals = { ...state.goals };
  for (const id of chosen) {
    const template = content.goals.find((t) => t.id === id)!;
    const goal: Goal = { ...template, owner: "child", status: "open", paths: template.paths.map((p) => ({ ...p })) };
    goals[id] = goal;
  }
  const child = state.npcs["child"]!;
  return {
    ...state,
    rng,
    goals,
    npcs: { ...state.npcs, child: { ...child, goalIds: [...child.goalIds, ...chosen] } },
  };
}

/** Authored per-NPC advancement (§5.5), gathered in a stable order. */
function npcTickEffects(state: GameState, content: Content): Effect[] {
  const effects: Effect[] = [];
  for (const npc of [...content.npcs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const live = state.npcs[npc.id];
    if (!live || live.broken || !live.present) continue;
    for (const rule of npc.tick ?? []) {
      if (evaluate(rule.when, state, `npcs.json "${npc.id}".tick "${rule.id}"`)) {
        effects.push(...rule.effects);
      }
    }
  }
  return effects;
}
