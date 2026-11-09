import type { Content, GameState, Goal, NpcState } from "../engine/types";
import { fateOf } from "./news";

export interface JournalSection {
  heading: string;
  lines: string[];
}

const WANT: Record<Goal["status"], string> = {
  open: "still wanting it",
  fulfilled: "yours now",
  failed: "gone",
};

const CHILD: Record<Goal["status"], string> = {
  open: "not yet",
  fulfilled: "done",
  failed: "it went another way",
};

/**
 * The journal, in words. What you want; then each person you have come to
 * know and the trouble they told you about, or how it ended. Strangers are not
 * in it — you do not know their trouble yet. Read-only: nothing is written
 * back, and no number reaches the page.
 */
export function journal(state: GameState, content: Content): JournalSection[] {
  const sections: JournalSection[] = [];
  const goals = Object.values(state.goals);

  const wants = goals
    .filter((g) => g.owner === "player")
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((g) => `${g.label.charAt(0).toUpperCase()}${g.label.slice(1)} — ${WANT[g.status]}.`);
  sections.push({ heading: "What you want", lines: wants });

  const people: string[] = [];
  const known = Object.values(state.npcs)
    .filter((n) => n.present && n.id !== "player" && n.id !== "child" && n.state["known"] === 2)
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const npc of known) people.push(`${npc.name}: ${troubleOf(npc, state, content)}`);
  sections.push({
    heading: "People you know",
    lines: people.length > 0 ? people : ["Nobody yet. People open up on the second day you stop to talk."],
  });

  const child = state.npcs["child"];
  if (child?.present) {
    const lines = goals
      .filter((g) => g.owner === "child")
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((g) => `${g.label} — ${CHILD[g.status]}.`);
    sections.push({ heading: child.name, lines });
  }
  return sections;
}

function troubleOf(npc: NpcState, state: GameState, content: Content): string {
  // What became of them, in their own words, once something has.
  const fate = fateOf(state, content, npc.id);
  if (fate) return fate;
  const theirs = npc.goalIds.map((id) => state.goals[id]).filter((g): g is Goal => g !== undefined);
  if (npc.broken) return "Ruined. You saw to that.";
  if (theirs.some((g) => g.status === "fulfilled")) return "Settled.";
  if (theirs.length > 0 && theirs.every((g) => g.status === "failed")) return "Too late now.";
  // What they told you on the second day is the trouble, in their own words.
  const told = content.choices.find((c) => c.id === `${npc.id}_meet_2`)?.response;
  return told ?? "Getting by.";
}
