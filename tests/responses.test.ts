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
    expect(content.choices.filter((c) => /\d/.test(c.response ?? "")).map((c) => c.id)).toEqual([]);
  });
});
