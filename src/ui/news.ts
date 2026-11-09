import { evaluate } from "../engine/conditions";
import type { Content, GameState } from "../engine/types";

/**
 * What happened in town between two moments, said plainly and with its cause.
 * Pure: compares two states, writes nothing. The same list feeds the notice on
 * the map (right after an act), the morning's news on the Mirror (everything
 * since the last morning) and, through `fateOf`, the journal.
 *
 * Brain: an explanation has to name the real cause, not the kind of event
 * (sandbox-combined-narrative-flags#E1, sandbox-worldgen-coherence-fork#E1) —
 * so every line here is authored per person, about the act that did it.
 */
export interface Happening {
  kind: "left" | "settled" | "ruined" | "shop" | "rebuilt" | "arrived";
  npcId?: string;
  text: string;
}

const gone = (state: GameState, content: Content, id: string): boolean => {
  const away = content.npcs.find((n) => n.id === id)?.away;
  return away !== undefined && evaluate(away, state, `npcs.json "${id}".away`);
};

/** Their own trouble: the first goal they started the life with. */
const needOf = (content: Content, id: string): string | undefined => content.npcs.find((n) => n.id === id)?.goalIds[0];

export function happenings(before: GameState, after: GameState, content: Content): Happening[] {
  const out: Happening[] = [];
  for (const def of content.npcs) {
    const was = before.npcs[def.id];
    const now = after.npcs[def.id];
    if (!was || !now || def.id === "player") continue;

    if (now.present && !was.present && def.id === "child") {
      out.push({ kind: "arrived", npcId: def.id, text: `${now.name} has come to live with you. Someone small is asleep in the corner.` });
    }
    if (!now.present) continue;
    if (!was.broken && now.broken) {
      out.push({ kind: "ruined", npcId: def.id, text: def.outcomes?.ruined ?? `${now.name} has lost everything.` });
    }
    if (!gone(before, content, def.id) && gone(after, content, def.id)) {
      out.push({ kind: "left", npcId: def.id, text: def.outcomes?.left ?? `${now.name} has left town.` });
      continue;
    }
    const need = needOf(content, def.id);
    if (need && before.goals[need]?.status === "open" && after.goals[need]?.status === "fulfilled" && def.outcomes?.settled) {
      out.push({ kind: "settled", npcId: def.id, text: def.outcomes.settled });
    }
  }

  const holderName = (id: string | null | undefined): string | null =>
    id === "player" ? "You" : id ? (after.npcs[id]?.name ?? null) : null;
  for (const [slot, place] of [["storefront", "the storefront"], ["wrecked_shop", "the rebuilt shop"]] as const) {
    const a = before.slots[slot];
    const b = after.slots[slot];
    if (!a || !b) continue;
    if (!a.exists && b.exists) out.push({ kind: "rebuilt", text: "The ruin by the river has been rebuilt. There is a shop there now, with a door that shuts." });
    if (b.exists && a.holder !== b.holder) {
      const who = holderName(b.holder);
      const text = who === "You" ? `You have ${place} now. The rent is yours to find, too.` : who ? `${who} has ${place} now.` : `${place.charAt(0).toUpperCase()}${place.slice(1)} stands empty.`;
      out.push({ kind: "shop", npcId: b.holder ?? undefined, text });
    }
  }
  return out;
}

/** What became of someone, for the journal: why they left, or what your help changed — or nothing yet. */
export function fateOf(state: GameState, content: Content, id: string): string | null {
  const def = content.npcs.find((n) => n.id === id);
  const npc = state.npcs[id];
  if (!def || !npc) return null;
  if (npc.broken) return def.outcomes?.ruined ?? null;
  if (gone(state, content, id)) return def.outcomes?.left ?? null;
  const need = needOf(content, id);
  if (need && state.goals[need]?.status === "fulfilled") return def.outcomes?.settled ?? null;
  return null;
}

/** Gone, but once stood here: the map keeps a shut sign where they were, tappable for why. */
export function goneFromTown(state: GameState, content: Content): { id: string; place: string; text: string }[] {
  return content.npcs
    .filter((d) => state.npcs[d.id]?.present && gone(state, content, d.id))
    .map((d) => ({ id: d.id, place: d.location ?? "market", text: d.outcomes?.left ?? `${state.npcs[d.id]!.name} has left town.` }));
}
