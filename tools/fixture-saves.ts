// Writes save files parked on the two states a scripted click-through cannot
// reliably reach: a nightfall visit, and the final review. tools/smoke.mjs
// injects them so those scenes get looked at every run.
import { writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { content } from "../src/content";
import { acknowledgeGoblin, answerGoblin, interact, newGame, sleep } from "../src/engine/engine";
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

/**
 * The family line: Wren moves in on the first day, and the child arrives two
 * mornings later. "family_morning" parks on that first morning (the Mirror's
 * one line about it); "family_review" is the same life read back at its end,
 * with one of the child's goals met, so the review's child lines are drawn.
 */
function settle(state: GameState): GameState {
  let next = settleBreaks(state);
  while (next.status === "goblin_nightfall") {
    const visit = next.pendingGoblin!;
    const question = content.goblin.questions.find((q) => q.id === visit.questionIds[visit.cursor])!;
    next = settleBreaks(answerGoblin(next, question.answers[0]!.id, content));
  }
  return next;
}
let family = newGame(1, content);
for (const id of ["partner_help_first", "partner_help_again", "partner_ask_stay"]) family = interact(family, id, content);
family = settle(sleep(settle(family), content));
family = settle(sleep(family, content));
const morning = family;
const firstGoal = Object.values(family.goals).find((g) => g.owner === "child" && (g.id === "child_learns" || g.id === "child_known"))!;
const tend = firstGoal.id === "child_learns" ? "child_read" : "child_walk";
for (let i = 0; i < 3; i += 1) family = settle(interact(family, tend, content));
for (let guard = 0; guard < 400 && family.status !== "review"; guard += 1) {
  family = settle(family.status === "day" ? interact(family, tend, content) : family);
  if (family.status === "day" && family.day.interactions >= 1) family = settle(sleep(family, content));
}
for (const [name, state] of [["family_morning", morning], ["family_review", family]] as const) {
  const envelope = { schema: SCHEMA, savedAt: new Date().toISOString(), state };
  writeFileSync(`smoke-shots/${name}.json`, JSON.stringify(envelope), "utf8");
  process.stdout.write(`${name}: seed ${state.seed}, loop ${state.loop}, status ${state.status}\n`);
}
