import { applyEffects } from "./effects";
import { checkGoals, type GoalEvent } from "./goals";
import { evaluate } from "./conditions";
import type { Content, Effect, GameState, ScheduledEffect } from "./types";

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

  return { state: next, events };
}

/** Authored per-NPC advancement (§5.5), gathered in a stable order. */
function npcTickEffects(state: GameState, content: Content): Effect[] {
  const effects: Effect[] = [];
  for (const npc of [...content.npcs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const live = state.npcs[npc.id];
    if (!live || live.broken) continue;
    for (const rule of npc.tick ?? []) {
      if (evaluate(rule.when, state, `npcs.json "${npc.id}".tick "${rule.id}"`)) {
        effects.push(...rule.effects);
      }
    }
  }
  return effects;
}
