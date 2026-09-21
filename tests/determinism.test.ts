import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonical, fingerprint } from "../src/engine/canonical";
import { newGame } from "../src/engine/engine";
import type { GameState } from "../src/engine/types";
import { testContent } from "./fixtures/content";
import { play } from "./harness";

const content = testContent();

const SCRIPT = [
  "self_job", "help", "fail_tester", "self_job", "harm",
  "sleep",
  "help", "world_helper", "self_job", "fail_player",
  "sleep",
  "schedule_ruin", "help", "sleep",
  "self_job", "sleep",
];

describe("determinism", () => {
  it("same seed and same inputs give an identical final state", () => {
    const a = play(newGame(11, content), SCRIPT, content).at(-1)!;
    const b = play(newGame(11, content), SCRIPT, content).at(-1)!;
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(canonical(a)).toBe(canonical(b));
  });

  it("agrees at every step, not only at the end", () => {
    // An end-state match can hide a divergence that happened mid-run and
    // washed out, so the whole trace is compared.
    const a = play(newGame(11, content), SCRIPT, content).map(fingerprint);
    const b = play(newGame(11, content), SCRIPT, content).map(fingerprint);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(SCRIPT.length);
  });

  it("gives different seeds different lives", () => {
    const seeds = [1, 2, 3, 4, 5].map((s) => fingerprint(play(newGame(s, content), SCRIPT, content).at(-1)!));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it("survives a save and reload mid-run", () => {
    const half = Math.floor(SCRIPT.length / 2);
    const first = play(newGame(11, content), SCRIPT.slice(0, half), content).at(-1)!;

    const reloaded = JSON.parse(JSON.stringify(first)) as GameState;
    const resumed = play(reloaded, SCRIPT.slice(half), content).at(-1)!;
    const straight = play(newGame(11, content), SCRIPT, content).at(-1)!;

    expect(fingerprint(resumed)).toBe(fingerprint(straight));
  });

  it("puts the RNG's own position in the saved state", () => {
    const state = play(newGame(11, content), SCRIPT, content).at(-1)!;
    const reloaded = JSON.parse(JSON.stringify(state)) as GameState;
    expect(reloaded.rng).toEqual(state.rng);
    expect(state.rng.count).toBeGreaterThan(0);
  });
});

describe("no ambient randomness", () => {
  const BANNED = /Math\.random|Date\.now|performance\.now|crypto\.getRandomValues|new Date\(\)/;

  function sources(dir: string): string[] {
    const here = join(process.cwd(), dir);
    return readdirSync(here, { withFileTypes: true, recursive: true })
      .filter((e) => e.isFile() && e.name.endsWith(".ts"))
      .map((e) => join(e.parentPath ?? here, e.name));
  }

  it("keeps the engine and the simulator off the ambient clock and RNG", () => {
    // One seeded stream is what makes save/load, replay and the sim reports
    // reproducible. A single Math.random() anywhere in here breaks all three.
    const offenders: string[] = [];
    for (const dir of ["src/engine", "src/sim"]) {
      for (const file of sources(dir)) {
        const text = readFileSync(file, "utf8");
        const code = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
        if (BANNED.test(code)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
