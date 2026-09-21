import { availableChoices, interact } from "../engine/engine";
import { next, nextInt, pick } from "../engine/rng";
import type { Choice, Content, GameState, ImpactKind, RngState } from "../engine/types";

/**
 * Bots draw from their OWN stream, never the game's. A bot that consumed the
 * world's RNG would make its own strategy perturb the world it is measuring.
 */
export interface BotContext {
  state: GameState;
  choices: Choice[];
  content: Content;
  rng: RngState;
  /** Per-run scratch the bot keeps between turns (visits, today's bedtime). */
  memory: Record<string, number>;
}

export interface BotMove {
  /** A choice id, or "sleep". */
  move: string;
  rng: RngState;
}

export interface Bot {
  id: string;
  describe: string;
  move(ctx: BotContext): BotMove;
}

function has(choice: Choice, kind: ImpactKind): boolean {
  return choice.impacts.some((i) => i.kind === kind);
}

function prefer(choices: Choice[], ...order: ImpactKind[]): Choice[] {
  for (const kind of order) {
    const matches = choices.filter((c) => has(c, kind));
    if (matches.length > 0) return matches;
  }
  return choices;
}

/** Take the first candidate, or sleep when there is nothing left to take. */
function take(candidates: Choice[], rng: RngState): BotMove {
  const [chosen, advanced] = pick(rng, candidates);
  return { move: chosen?.id ?? "sleep", rng: advanced };
}

/**
 * Does this choice complete a player goal? Only the simulator can ask — it
 * costs a throwaway `interact`, which is free because the engine is pure.
 */
function unlocksPlayerGoal(state: GameState, choice: Choice, content: Content): boolean {
  let after: GameState;
  try {
    after = interact(state, choice.id, content);
  } catch {
    return false;
  }
  return Object.values(after.goals).some(
    (g) => g.owner === "player" && g.status === "fulfilled" && state.goals[g.id]?.status !== "fulfilled",
  );
}

// ------------------------------------------------------------ §9's four bots

const selfish: Bot = {
  id: "selfish",
  describe: "prefers self; harms when it unlocks a player goal",
  move({ state, choices, content, rng }) {
    if (choices.length === 0) return { move: "sleep", rng };

    const mine = choices.filter((c) => has(c, "self"));
    if (mine.length > 0) return take(mine, rng);

    const usefulHarm = choices.filter((c) => has(c, "harm") && unlocksPlayerGoal(state, c, content));
    if (usefulHarm.length > 0) return take(usefulHarm, rng);

    return take(prefer(choices, "neutral", "help", "harm"), rng);
  },
};

const generous: Bot = {
  id: "generous",
  describe: "prefers help; never harms",
  move({ choices, rng }) {
    const kind = choices.filter((c) => !has(c, "harm"));
    if (kind.length === 0) return { move: "sleep", rng };
    return take(prefer(kind, "help", "neutral", "self"), rng);
  },
};

const WEIGHTS: Record<ImpactKind, number> = { self: 3, help: 3, neutral: 2, harm: 1 };

const mixed: Bot = {
  id: "mixed",
  describe: "weighted random",
  move({ choices, rng }) {
    if (choices.length === 0) return { move: "sleep", rng };

    const weights = choices.map((c) =>
      Math.max(...c.impacts.map((i) => WEIGHTS[i.kind])),
    );
    const total = weights.reduce((a, b) => a + b, 0);

    const [roll, advanced] = next(rng);
    let cursor = roll * total;
    for (const [i, weight] of weights.entries()) {
      cursor -= weight;
      if (cursor <= 0) return { move: choices[i]!.id, rng: advanced };
    }
    return { move: choices.at(-1)!.id, rng: advanced };
  },
};

const isolated: Bot = {
  id: "isolated",
  describe: "sleeps immediately every day",
  move({ rng }) {
    return { move: "sleep", rng };
  },
};

// ------------------------------------------------------------- the fifth bot

/** How often you go back to the same person rather than whoever is in front of you. */
const STICKINESS = 0.6;

/** §5.8: the portrait is the only lifespan feedback a player ever gets. */
function portraitStage(state: GameState): number {
  const ratio = state.lifespan.current / state.lifespan.max;
  return Math.min(4, Math.max(0, Math.floor((1 - ratio) * 5)));
}

/**
 * A person, rather than a strategy.
 *
 * The four bots above are policies over impact tags. This one is built from
 * what a player can actually act on: the fiction tells them kindness from
 * cruelty, so it reads impact kinds too — but it can see no score, no max, no
 * lifespan number. Only the five-stage portrait (§5.8).
 *
 * Three human things it does that a policy does not. It keeps going back to
 * whoever it has been spending time with, because attachment beats
 * optimisation. It goes to bed before the day is spent. And as the face in the
 * mirror gets older it starts looking after itself — self-preservation arrives
 * late and gradually, which is the trade the game is actually about.
 *
 * It never looks ahead. No player can.
 */
const human: Bot = {
  id: "human",
  describe: "plays on the portrait and on habit; no lookahead, no meter",
  move({ state, choices, content, rng, memory }) {
    if (choices.length === 0) return { move: "sleep", rng };

    // People go to bed. Bedtime is set once per day, between 4 and 9 calls.
    let current = rng;
    const bedtimeKey = `bedtime:${state.loop}`;
    if (memory[bedtimeKey] === undefined) {
      const [roll, advanced] = nextInt(current, 6);
      current = advanced;
      memory[bedtimeKey] = 4 + roll;
    }
    if (state.day.interactions >= memory[bedtimeKey]!) return { move: "sleep", rng: current };

    // Stick with whoever you have been seeing — but stickiness, not a lock.
    // People drift: someone catches your eye on the way past.
    const visits = (id: string) => memory[`visits:${id}`] ?? 0;
    const cast = [...new Set(choices.map((c) => c.npc))].sort();
    const most = Math.max(...cast.map(visits));
    const familiar = cast.filter((id) => visits(id) === most);

    const [drift, afterDrift] = next(current);
    current = afterDrift;
    const [focus, afterFocus] = pick(current, drift < STICKINESS ? familiar : cast);
    current = afterFocus;

    const theirs = choices.filter((c) => c.npc === focus);
    const candidates = theirs.length > 0 ? theirs : choices;

    // The older the face in the mirror, the more you look after yourself.
    const pressure = portraitStage(state) / 4;
    const [roll, afterRoll] = next(current);
    current = afterRoll;

    const order: ImpactKind[] =
      roll < 0.1 + 0.55 * pressure
        ? ["self", "neutral", "help"]
        : ["help", "neutral", "self"];

    const move = take(prefer(candidates, ...order), current);
    if (move.move !== "sleep") {
      memory[`visits:${focus}`] = visits(focus ?? "") + 1;
    }
    void content;
    return move;
  },
};

export const BOTS: Bot[] = [selfish, generous, mixed, isolated, human];

export function botById(id: string): Bot {
  const bot = BOTS.find((b) => b.id === id);
  if (!bot) throw new Error(`unknown bot "${id}"`);
  return bot;
}

export { availableChoices };
