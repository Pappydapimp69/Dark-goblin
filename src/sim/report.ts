import {
  acknowledgeGoblin,
  answerGoblin,
  availableChoices,
  interact,
  newGame,
  sleep,
} from "../engine/engine";
import { createRng, pick } from "../engine/rng";
import type { Content, RngState } from "../engine/types";
import { computeVerdict } from "../engine/verdict";
import { BOTS, type Bot } from "./bots";

export const DEFAULT_GAMES = 100;
const MAX_TURNS = 20_000;

export interface Row {
  seed: number;
  bot: string;
  loops: number;
  lifespanLeft: number;
  npcGoalsFulfilled: number;
  playerGoalsFulfilled: number;
  goalsFailed: number;
  breaks: number;
  nightfalls: number;
  interactions: number;
  finalDebt: number;
  verdict: string;
}

/**
 * The bot's stream is derived from the game seed but kept separate, so two
 * bots played on the same seed meet the same world.
 */
function botSeed(seed: number, bot: string): number {
  let hash = seed >>> 0;
  for (const char of bot) {
    hash = (Math.imul(hash ^ char.charCodeAt(0), 0x01000193) + 0x9e3779b9) >>> 0;
  }
  return hash;
}

export function playGame(bot: Bot, seed: number, content: Content): Row {
  let state = newGame(seed, content);
  let rng: RngState = createRng(botSeed(seed, bot.id));
  const memory: Record<string, number> = {};

  let interactions = 0;
  let turns = 0;

  while (state.status !== "review" && turns < MAX_TURNS) {
    turns += 1;

    if (state.status === "goblin_break") {
      state = acknowledgeGoblin(state, content);
      continue;
    }

    if (state.status === "goblin_nightfall") {
      const visit = state.pendingGoblin!;
      const question = content.goblin.questions.find((q) => q.id === visit.questionIds[visit.cursor])!;
      const [answer, advanced] = pick(rng, question.answers);
      rng = advanced;
      state = answerGoblin(state, answer!.id, content);
      continue;
    }

    const choices = availableChoices(state, content);
    const decision = bot.move({ state, choices, content, rng, memory });
    rng = decision.rng;

    if (decision.move === "sleep") {
      state = sleep(state, content);
    } else {
      state = interact(state, decision.move, content);
      interactions += 1;
    }
  }

  if (turns >= MAX_TURNS) throw new Error(`${bot.id} on seed ${seed} never reached the review`);

  const goals = Object.values(state.goals);
  const verdict = computeVerdict(state);

  return {
    seed,
    bot: bot.id,
    loops: state.loop,
    lifespanLeft: state.lifespan.current,
    npcGoalsFulfilled: goals.filter(
      (g) => g.status === "fulfilled" && g.owner !== "player" && g.owner !== "child",
    ).length,
    playerGoalsFulfilled: goals.filter((g) => g.status === "fulfilled" && g.owner === "player").length,
    goalsFailed: goals.filter((g) => g.status === "failed").length,
    breaks: state.goblinLog.filter((e) => e.kind === "break").length,
    nightfalls: state.goblinLog.filter((e) => e.kind === "nightfall").length,
    interactions,
    finalDebt: state.debt,
    verdict: verdict.verdict,
  };
}

export function runAll(content: Content, games = DEFAULT_GAMES): Row[] {
  const rows: Row[] = [];
  for (const bot of BOTS) {
    for (let seed = 1; seed <= games; seed += 1) rows.push(playGame(bot, seed, content));
  }
  return rows;
}

// ------------------------------------------------------------------ reporting

const HEADERS: (keyof Row)[] = [
  "seed", "bot", "loops", "lifespanLeft", "npcGoalsFulfilled", "playerGoalsFulfilled",
  "goalsFailed", "breaks", "nightfalls", "interactions", "finalDebt", "verdict",
];

export const CSV_HEADERS = HEADERS;

export function toCsv(rows: readonly Row[]): string {
  const lines = [HEADERS.join(",")];
  for (const row of rows) lines.push(HEADERS.map((h) => String(row[h])).join(","));
  return `${lines.join("\n")}\n`;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(part: number, whole: number): string {
  return whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;
}

export function summarise(rows: readonly Row[]): string {
  const lines: string[] = [];
  lines.push(
    ["bot", "loops", "range", "saw a goal", "breaks", "nightfalls", "verdict self"]
      .map((h, i) => (i === 0 ? h.padEnd(10) : h.padStart(12)))
      .join(""),
  );

  for (const bot of BOTS) {
    const mine = rows.filter((r) => r.bot === bot.id);
    if (mine.length === 0) continue;
    const loops = mine.map((r) => r.loops);
    const sawGoal = mine.filter((r) => r.npcGoalsFulfilled > 0).length;
    const selfVerdicts = mine.filter((r) => r.verdict === "self").length;

    lines.push(
      [
        bot.id.padEnd(10),
        mean(loops).toFixed(1).padStart(12),
        `${Math.min(...loops)}-${Math.max(...loops)}`.padStart(12),
        pct(sawGoal, mine.length).padStart(12),
        mean(mine.map((r) => r.breaks)).toFixed(2).padStart(12),
        mean(mine.map((r) => r.nightfalls)).toFixed(1).padStart(12),
        pct(selfVerdicts, mine.length).padStart(12),
      ].join(""),
    );
  }
  return lines.join("\n");
}

/**
 * §9's balance target. It reports; it does not tune. Changing a rule to make
 * this pass needs approval, so the check never edits anything.
 */
export function balanceReport(rows: readonly Row[]): string {
  const generous = rows.filter((r) => r.bot === "generous");
  const sawGoal = generous.filter((r) => r.npcGoalsFulfilled > 0);
  const ok = sawGoal.length > 0;

  const lines = [
    `balance target — the generous bot survives long enough to see an NPC goal fulfilled`,
    `  ${ok ? "MET" : "NOT MET"}: ${sawGoal.length}/${generous.length} games (${pct(sawGoal.length, generous.length)}), ` +
      `median ${median(generous.map((r) => r.loops))} loops`,
  ];
  if (!ok) lines.push(`  reporting only — no rule is changed without approval (§9)`);
  return lines.join("\n");
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}
