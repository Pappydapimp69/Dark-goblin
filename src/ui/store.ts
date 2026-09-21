import { content } from "../content";
import {
  acknowledgeGoblin,
  answerGoblin,
  availableChoices,
  interact,
  newGame,
  sleep,
} from "../engine/engine";
import type { Choice, GameState } from "../engine/types";

export type Listener = (state: GameState) => void;

/**
 * The one seam between the game and the screen.
 *
 * Scenes read `state` and call these methods. Nothing in /scenes may touch
 * GameState directly — every change is an engine call whose result replaces
 * the old state wholesale, which is what keeps the render layer unable to
 * quietly invent a rule.
 */
export class Store {
  private current: GameState;
  private readonly listeners = new Set<Listener>();

  constructor(readonly seed: number) {
    this.current = newGame(seed, content);
  }

  get state(): GameState {
    return this.current;
  }

  get choices(): Choice[] {
    return availableChoices(this.current, content);
  }

  choicesFor(npcId: string): Choice[] {
    return this.choices.filter((c) => c.npc === npcId);
  }

  interact(choiceId: string): void {
    this.commit(interact(this.current, choiceId, content));
  }

  sleep(): void {
    this.commit(sleep(this.current, content));
  }

  answer(answerId: string): void {
    this.commit(answerGoblin(this.current, answerId, content));
  }

  acknowledge(): void {
    this.commit(acknowledgeGoblin(this.current, content));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private commit(next: GameState): void {
    this.current = next;
    for (const listener of [...this.listeners]) listener(next);
  }
}

/** Which scene belongs to a given status. Exhaustive — a new status must land somewhere. */
export function sceneFor(state: GameState): string {
  switch (state.status) {
    case "day":
      return "Street";
    case "night":
      return "Night";
    case "goblin_break":
    case "goblin_nightfall":
      return "Goblin";
    case "review":
      return "Review";
  }
}
