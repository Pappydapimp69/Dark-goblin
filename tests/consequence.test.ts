import { describe, expect, it } from "vitest";
import { content } from "../src/content";
import { interact, newGame, sleep } from "../src/engine/engine";
import { actSign, childGrowth, marksFor, purse } from "../src/ui/marks";
import { townView } from "../src/ui/town";
import { acquainted } from "./harness";

// Every act answers back: a sign over the person at once, and a mark that stays.

describe("what acts leave in the town", () => {
  it("a help grows a flower, a taking wears the ground, both stay", () => {
    let state = acquainted(newGame(1, content));
    state = interact(state, "baker_help_first", content);
    expect(marksFor(state, content, "baker")).toEqual({ flowers: 1, worn: 0, cracks: 0 });
    state = interact(state, "baker_sell_her_flour", content);
    state = sleep(state, content);
    expect(marksFor(state, content, "baker")).toEqual({ flowers: 1, worn: 1, cracks: 0 });
  });

  it("the purse swells with money and hangs empty with a slip when you owe", () => {
    expect(purse(0, 0)).toEqual({ fullness: 0, owing: false });
    expect(purse(40, 0).fullness).toBeGreaterThan(purse(10, 0).fullness);
    expect(purse(0, 5).owing).toBe(true);
  });

  it("the child grows with what you give them", () => {
    const base = newGame(1, content);
    const fed = { ...base, npcs: { ...base.npcs, child: { ...base.npcs["child"]!, state: { ...base.npcs["child"]!.state, lessons: 3, fed: 3 } } } };
    expect(childGrowth(fed)).toBeGreaterThan(childGrowth(base));
  });

  it("every kind of act has its sign", () => {
    expect(actSign(["help"])).toBe("warm");
    expect(actSign(["self"])).toBe("coin");
    expect(actSign(["self", "harm"])).toBe("crack");
    expect(actSign(["neutral"])).toBe("word");
  });

  it("a stranger is known on the map only by their trade, until you meet them", () => {
    let state = newGame(1, content);
    const label = () => townView(state, content).people.find((p) => p.id === "baker")!.label;
    expect(label()).toBe("the baker");
    state = interact(state, "baker_meet_1", content);
    expect(label()).toBe("Ilka");
  });
});

describe("nothing goes unanswered", () => {
  it("the goblin answers every answer, each in his own words", () => {
    const answers = content.goblin.questions.flatMap((q) => q.answers);
    expect(answers.filter((a) => !a.reply).map((a) => a.id)).toEqual([]);
    const replies = answers.map((a) => a.reply);
    expect(new Set(replies).size).toBe(replies.length);
    expect(replies.filter((r) => /\d/.test(r ?? ""))).toEqual([]);
  });

  it("every choice has something to say the first time", () => {
    expect(content.choices.filter((c) => !c.response).map((c) => c.id)).toEqual([]);
  });
});
