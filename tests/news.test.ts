import { describe, expect, it } from "vitest";
import { content } from "../src/content";
import { interact, newGame } from "../src/engine/engine";
import { journal } from "../src/ui/journal";
import { fateOf, goneFromTown, happenings } from "../src/ui/news";
import { acquainted } from "./harness";

const townsfolk = content.npcs.filter((n) => n.id !== "player" && n.id !== "child");

describe("every consequence is said, with its cause", () => {
  it("everyone who can leave has a reason they left, and everyone has what your help changed", () => {
    expect(townsfolk.filter((n) => !n.outcomes?.left).map((n) => n.id)).toEqual([]);
    expect(townsfolk.filter((n) => !n.outcomes?.settled).map((n) => n.id)).toEqual([]);
    expect(content.npcs.find((n) => n.id === "shopkeeper")?.outcomes?.ruined).toBeTruthy();
    const lines = townsfolk.flatMap((n) => [n.outcomes?.left, n.outcomes?.settled, n.outcomes?.ruined]).filter((l): l is string => !!l);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines.filter((l) => /\d/.test(l))).toEqual([]);
  });

  it("the clockmaker does not just vanish: his leaving is told, its cause named, and the journal keeps it", () => {
    let state = acquainted(newGame(1, content));
    state = { ...state, npcs: { ...state.npcs, nikolas: { ...state.npcs["nikolas"]!, present: true } } };
    state = interact(state, "nikolas_help_first", content);
    const before = state;
    state = interact(state, "nikolas_harm", content);
    const said = happenings(before, state, content);
    expect(said).toEqual([{ kind: "left", npcId: "nikolas", text: content.npcs.find((n) => n.id === "nikolas")!.outcomes!.left }]);
    expect(goneFromTown(state, content).map((g) => g.id)).toEqual(["nikolas"]);
    expect(fateOf(state, content, "nikolas")).toBe(said[0]!.text);
    const people = journal(state, content).find((s) => s.heading === "People you know")!.lines;
    expect(people.find((l) => l.startsWith("Nikolas:"))).toBe(`Nikolas: ${said[0]!.text}`);
  });

  it("help that settles someone's trouble says what it changed", () => {
    const mara = acquainted(newGame(1, content));
    const withMara = { ...mara, npcs: { ...mara.npcs, mara: { ...mara.npcs["mara"]!, present: true } } };
    const helped = interact(interact(withMara, "mara_help_first", content), "mara_help_again", content);
    const said = happenings(withMara, helped, content);
    expect(said.map((h) => h.kind)).toContain("settled");
    expect(said.find((h) => h.kind === "settled")!.text).toBe(content.npcs.find((n) => n.id === "mara")!.outcomes!.settled);
  });
});
