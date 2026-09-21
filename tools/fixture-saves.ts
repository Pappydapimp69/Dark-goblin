// Writes save files parked on the two states a scripted click-through cannot
// reliably reach: a nightfall visit, and the final review. tools/smoke.mjs
// injects them so those scenes get looked at every run.
import { writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { content } from "../src/content";
import { acknowledgeGoblin, answerGoblin, newGame, sleep } from "../src/engine/engine";
import type { GameState } from "../src/engine/types";

const SCHEMA = 1;

function settleBreaks(state: GameState): GameState {
  let next = state;
  while (next.status === "goblin_break") next = acknowledgeGoblin(next, content);
  return next;
}

/** Sleep through a life, stopping the first time `want` shows up. */
function seek(want: GameState["status"], seed: number): GameState | null {
  let state = newGame(seed, content);
  for (let guard = 0; guard < 400; guard += 1) {
    state = settleBreaks(state);
    if (state.status === want) return state;
    if (state.status === "review") return null;
    if (state.status === "goblin_nightfall") {
      const visit = state.pendingGoblin!;
      const question = content.goblin.questions.find((q) => q.id === visit.questionIds[visit.cursor])!;
      state = answerGoblin(state, question.answers[0]!.id, content);
      continue;
    }
    state = sleep(state, content);
  }
  return null;
}

function find(want: GameState["status"]): GameState {
  for (let seed = 1; seed <= 300; seed += 1) {
    const hit = seek(want, seed);
    if (hit) return hit;
  }
  throw new Error(`no seed under 300 reaches "${want}"`);
}

mkdirSync("smoke-shots", { recursive: true });
for (const status of ["goblin_nightfall", "review"] as const) {
  const state = find(status);
  const envelope = { schema: SCHEMA, savedAt: new Date().toISOString(), state };
  writeFileSync(`smoke-shots/${status}.json`, JSON.stringify(envelope), "utf8");
  process.stdout.write(`${status}: seed ${state.seed}, loop ${state.loop}\n`);
}
