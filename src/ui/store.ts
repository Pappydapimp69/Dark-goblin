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
import { save } from "./save";

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

  constructor(seedOrState: number | GameState) {
    this.current =
      typeof seedOrState === "number" ? newGame(seedOrState, content) : seedOrState;
    save(this.current);
  }

  get seed(): number {
    return this.current.seed;
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
    // Every change is a save point. There is one slot and the game is a loop;
    // a player who closes the tab mid-afternoon should come back to that
    // afternoon, not to the morning.
    save(next);
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
