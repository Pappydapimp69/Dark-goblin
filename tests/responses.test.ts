import { describe, expect, it } from "vitest";
import { content } from "../src/content";

// A reaction line belongs to the person and the act. Measured before this
// guard existed: 175 lines came from 29 shared templates, and 36-64% of the
// lines a life heard (by bot) were ones it had already heard from someone
// else. See D-69.
const names = content.npcs.map((n) => n.name).filter(Boolean);
const templateOf = (line: string): string => names.reduce((t, name) => t.split(name).join("NAME"), line);

describe("reaction lines", () => {
  it("every choice except an aftermath has one", () => {
    const missing = content.choices.filter((c) => !c.aftermath && !c.response).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it("no two people share a line, even with names masked", () => {
    const owner = new Map<string, string>();
    const shared: string[] = [];
    for (const c of content.choices) {
      if (!c.response) continue;
      const t = templateOf(c.response);
      const first = owner.get(t);
      if (first !== undefined && first !== c.npc) shared.push(`${c.id} repeats ${first}`);
      else owner.set(t, c.npc);
    }
    expect(shared).toEqual([]);
  });

  it("no line shows a number", () => {
    const lines = content.choices.flatMap((c) => [c.response ?? "", ...(c.again ?? [])].map((l) => [c.id, l] as const));
    expect(lines.filter(([, l]) => /\d/.test(l)).map(([id]) => id)).toEqual([]);
  });

  // Repeats of the SAME person's same line were 33-86% of what a life heard
  // (Brain training, same-person-line-repeats). Every repeatable choice now
  // has a second line and a habit line, and then goes quiet (src/ui/reaction.ts).
  it("every repeatable choice has a second line and a habit line, each its own", () => {
    const repeatable = content.choices.filter((c) => !c.meeting && !c.aftermath);
    expect(repeatable.filter((c) => c.again?.length !== 2).map((c) => c.id)).toEqual([]);
    const all = content.choices.flatMap((c) => [c.response, ...(c.again ?? [])]).filter((l): l is string => !!l);
    const masked = all.map(templateOf);
    expect(masked.length - new Set(masked).size).toBe(0);
  });
});
