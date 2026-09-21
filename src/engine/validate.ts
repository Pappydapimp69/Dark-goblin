import { assertCondition, evaluate } from "./conditions";
import { assertEffect } from "./effects";
import { ContentError } from "./errors";
import type { Condition, Content, GameState } from "./types";

const FILES = {
  npcs: "content/npcs.json",
  slots: "content/slots.json",
  goals: "content/goals.json",
  choices: "content/choices.json",
  goblin: "content/goblin.json",
  rules: "content/rules.json",
} as const;

/**
 * §7, at content load. Every failure names the file and the id — a silent
 * default here becomes an unreachable goal three hours into playtesting.
 */
export function validateContent(content: Content): void {
  const goalIds = new Set(content.goals.map((g) => g.id));
  const npcIds = new Set(content.npcs.map((n) => n.id));
  const slotIds = new Set(content.slots.map((s) => s.id));

  requireUnique(content.goals.map((g) => g.id), FILES.goals, "goal");
  requireUnique(content.npcs.map((n) => n.id), FILES.npcs, "npc");
  requireUnique(content.slots.map((s) => s.id), FILES.slots, "slot");
  requireUnique(content.choices.map((c) => c.id), FILES.choices, "choice");
  requireUnique(content.goblin.questions.map((q) => q.id), FILES.goblin, "question");

  for (const goal of content.goals) {
    const where = `${FILES.goals} "${goal.id}"`;
    if (goal.paths.length === 0) throw new ContentError("has no paths", where);
    for (const path of goal.paths) {
      assertCondition(path.complete, `${where}.${path.id}.complete`);
      assertCondition(path.closed, `${where}.${path.id}.closed`);
    }
    for (const id of goal.adjacentPool ?? []) {
      if (!goalIds.has(id)) {
        throw new ContentError(`adjacentPool references unknown goal "${id}"`, where);
      }
    }
    if (goal.owner !== "player" && goal.owner !== "child" && !npcIds.has(goal.owner)) {
      throw new ContentError(`owner "${goal.owner}" is not an npc`, where);
    }
  }

  for (const choice of content.choices) {
    const where = `${FILES.choices} "${choice.id}"`;
    if (choice.impacts.length === 0) throw new ContentError("has no impacts", where);
    if (!npcIds.has(choice.npc)) throw new ContentError(`unknown npc "${choice.npc}"`, where);
    assertCondition(choice.available, `${where}.available`);
    choice.effects.forEach((e, i) => assertEffect(e, `${where}.effects[${i}]`));
    for (const impact of choice.impacts) {
      if (impact.target !== "player" && impact.target !== "child" && !npcIds.has(impact.target)) {
        throw new ContentError(`impact targets unknown npc "${impact.target}"`, where);
      }
    }
  }

  for (const npc of content.npcs) {
    for (const id of npc.goalIds) {
      if (!goalIds.has(id)) {
        throw new ContentError(`unknown goal "${id}"`, `${FILES.npcs} "${npc.id}"`);
      }
    }
    for (const rule of npc.tick ?? []) {
      const where = `${FILES.npcs} "${npc.id}".tick "${rule.id}"`;
      assertCondition(rule.when, `${where}.when`);
      rule.effects.forEach((e, i) => assertEffect(e, `${where}.effects[${i}]`));
    }
  }

  for (const modifier of content.rules.rentModifiers) {
    assertCondition(modifier.when, `${FILES.rules} rentModifier "${modifier.id}"`);
  }

  for (const id of content.rules.playerGoalPool) {
    if (!goalIds.has(id)) {
      throw new ContentError(`playerGoalPool references unknown goal "${id}"`, FILES.rules);
    }
  }
  if (content.rules.playerGoalPool.length < content.rules.playerGoalsAtStart) {
    throw new ContentError("playerGoalPool is smaller than playerGoalsAtStart", FILES.rules);
  }

  for (const line of content.goblin.breaks) {
    if (!goalIds.has(line.goalId)) {
      throw new ContentError(`break line "${line.id}" keys unknown goal "${line.goalId}"`, FILES.goblin);
    }
  }
  for (const question of content.goblin.questions) {
    const where = `${FILES.goblin} "${question.id}"`;
    if (question.answers.length < 3 || question.answers.length > 4) {
      throw new ContentError("must offer 3 or 4 answers", where);
    }
    for (const id of question.forGoals ?? []) {
      if (!goalIds.has(id)) throw new ContentError(`keys unknown goal "${id}"`, where);
    }
  }

  for (const slot of content.slots) {
    if (slot.holder !== null && !npcIds.has(slot.holder)) {
      throw new ContentError(`held by unknown npc "${slot.holder}"`, `${FILES.slots} "${slot.id}"`);
    }
  }
  void slotIds;
}

/**
 * §7, at newGame. Every critical goal must start with at least two paths that
 * are not already closed — a critical goal born with one live path is a break
 * waiting to happen through no decision of the player's.
 */
export function validateStart(state: GameState): void {
  for (const goal of Object.values(state.goals)) {
    if (!goal.critical) continue;
    const open = goal.paths.filter((p) => !evaluate(p.closed, state, `${FILES.goals} "${goal.id}"`));
    if (open.length < 2) {
      throw new ContentError(
        `critical goal has ${open.length} path(s) open at game start, needs at least 2`,
        `${FILES.goals} "${goal.id}"`,
      );
    }
  }
}

function requireUnique(ids: readonly string[], file: string, kind: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new ContentError(`duplicate ${kind} id "${id}"`, file);
    seen.add(id);
  }
}

export type { Condition };
