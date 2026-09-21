import { describe, expect, it } from "vitest";
import { fingerprint } from "../src/engine/canonical";
import { newGame, sleep } from "../src/engine/engine";
import { BOTS, botById } from "../src/sim/bots";
import { playGame, runAll, summarise, toCsv } from "../src/sim/report";
import type { GameState } from "../src/engine/types";
import { testContent } from "./fixtures/content";

const content = testContent();
const SEEDS = [1, 2, 3, 4, 5];

describe("bots", () => {
  it("every bot plays a whole life and reaches the review", () => {
    for (const bot of BOTS) {
      for (const seed of SEEDS) {
        const row = playGame(bot, seed, content);
        expect(row.loops).toBeGreaterThan(0);
        expect(row.verdict === "self" || row.verdict === "others").toBe(true);
      }
    }
  });

  it("plays the same life twice from the same seed", () => {
    for (const bot of BOTS) {
      expect(playGame(bot, 9, content)).toEqual(playGame(bot, 9, content));
    }
  });

  it("keeps the bot's own draws out of the world's stream", () => {
    // `isolated` never touches its own RNG, so its game must be bit-identical
    // to the same life driven by hand. If a bot were drawing from the game's
    // stream, the sim would be measuring a world its strategy had perturbed.
    let byHand: GameState = newGame(4, content);
    while (byHand.status !== "review") byHand = sleep(byHand, content);

    const row = playGame(botById("isolated"), 4, content);
    expect(row.loops).toBe(byHand.loop);
    expect(row.lifespanLeft).toBe(byHand.lifespan.current);
    expect(fingerprint(byHand.ledger)).toBeTruthy();
  });

  it("generous never harms anyone", () => {
    for (const seed of SEEDS) {
      const row = playGame(botById("generous"), seed, content);
      expect(row.breaks).toBe(0);
    }
  });

  it("isolated takes no interactions at all", () => {
    for (const seed of SEEDS) {
      expect(playGame(botById("isolated"), seed, content).interactions).toBe(0);
    }
  });

  it("selfish and generous reach opposite verdicts", () => {
    // §10's definition of done: the ending has to be able to differ.
    const selfish = SEEDS.map((s) => playGame(botById("selfish"), s, content).verdict);
    const generous = SEEDS.map((s) => playGame(botById("generous"), s, content).verdict);

    expect(new Set(selfish)).toEqual(new Set(["self"]));
    expect(new Set(generous)).toEqual(new Set(["others"]));
  });

  it("the human bot lives a different length each seed, unlike the policies", () => {
    // A policy over impact tags plays the same script every time; a person
    // does not. This is the whole reason the fifth bot exists.
    const spread = (id: string) =>
      new Set(SEEDS.map((s) => playGame(botById(id), s, content).loops)).size;

    expect(spread("human")).toBeGreaterThan(1);
    expect(spread("selfish")).toBe(1);
  });

  it("the human bot goes to bed before the day is spent", () => {
    const row = playGame(botById("human"), 2, content);
    expect(row.interactions).toBeLessThan(row.loops * content.rules.interactionsPerDay);
  });
});

describe("the report", () => {
  it("writes one row per game, with a header", () => {
    const rows = runAll(content, 3);
    const csv = toCsv(rows).trimEnd().split("\n");

    expect(rows).toHaveLength(BOTS.length * 3);
    expect(csv).toHaveLength(rows.length + 1);
    expect(csv[0]).toMatch(/^seed,bot,loops,/);
  });

  it("summarises every bot", () => {
    const text = summarise(runAll(content, 2));
    for (const bot of BOTS) expect(text).toContain(bot.id);
  });
});
