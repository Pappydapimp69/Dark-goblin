/**
 * How often does a life hear the same reaction line from two different
 * people? Plays every bot over the sim seeds and, for each response shown,
 * asks whether its template (the line with names masked) was already shown
 * by someone else. Run: npx vite-node tools/repeat-audit.ts
 */
import { acknowledgeGoblin, answerGoblin, availableChoices, interact, newGame, sleep } from "../src/engine/engine";
import { createRng, pick } from "../src/engine/rng";
import type { Choice, Content, RngState } from "../src/engine/types";
import { BOTS } from "../src/sim/bots";
import { content } from "../src/content";

const GAMES = Number(process.env["SIM_GAMES"] ?? 100);

export function templateOf(line: string, names: string[]): string {
  let out = line;
  for (const name of names) out = out.split(name).join("NAME");
  return out;
}

export interface Audit { shown: number; crossRepeats: number; }

export function auditLife(botIndex: number, seed: number, c: Content): Audit {
  const bot = BOTS[botIndex]!;
  const names = Object.values(newGame(seed, c).npcs).map((n) => n.name).filter(Boolean);
  const byId = new Map<string, Choice>(c.choices.map((ch) => [ch.id, ch]));
  let state = newGame(seed, c);
  let rng: RngState = createRng(seed * 7919 + botIndex);
  const memory: Record<string, number> = {};
  const seenBy = new Map<string, Set<string>>();
  let shown = 0, crossRepeats = 0, turns = 0;
  while (state.status !== "review" && turns++ < 20_000) {
    if (state.status === "goblin_break") { state = acknowledgeGoblin(state, c); continue; }
    if (state.status === "goblin_nightfall") {
      const v = state.pendingGoblin!;
      const q = c.goblin.questions.find((x) => x.id === v.questionIds[v.cursor])!;
      const [a, r] = pick(rng, q.answers); rng = r;
      state = answerGoblin(state, a!.id, c); continue;
    }
    const d = bot.move({ state, choices: availableChoices(state, c), content: c, rng, memory });
    rng = d.rng;
    if (d.move === "sleep") { state = sleep(state, c); continue; }
    const ch = byId.get(d.move)!;
    state = interact(state, d.move, c);
    if (!ch.response) continue;
    shown += 1;
    const t = templateOf(ch.response, names);
    const who = seenBy.get(t) ?? new Set<string>();
    if ([...who].some((npc) => npc !== ch.npc)) crossRepeats += 1;
    who.add(ch.npc); seenBy.set(t, who);
  }
  return { shown, crossRepeats };
}

{
  BOTS.forEach((bot, i) => {
    let shown = 0, cross = 0;
    for (let s = 1; s <= GAMES; s += 1) { const a = auditLife(i, s, content); shown += a.shown; cross += a.crossRepeats; }
    const pct = shown ? ((100 * cross) / shown).toFixed(1) : "-";
    console.log(`${bot.id.padEnd(10)} lines/life ${(shown / GAMES).toFixed(1).padStart(6)}  heard from someone else first ${pct}%`);
  });
}
