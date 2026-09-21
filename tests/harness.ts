import { acknowledgeGoblin, answerGoblin, interact, sleep } from "../src/engine/engine";
import type { Content, GameState } from "../src/engine/types";

/**
 * Drives a scripted game. A script is choice ids plus "sleep"; goblin visits
 * are resolved as they come (he never takes a turn from the script, because
 * whether he appears is itself an outcome under test).
 */
export function step(state: GameState, token: string, content: Content): GameState {
  if (state.status === "goblin_break") return acknowledgeGoblin(state, content);
  if (state.status === "goblin_nightfall") {
    const visit = state.pendingGoblin!;
    const question = content.goblin.questions.find((q) => q.id === visit.questionIds[visit.cursor])!;
    return answerGoblin(state, question.answers[0]!.id, content);
  }
  if (state.status === "review") return state;
  if (token === "sleep") return sleep(state, content);
  return interact(state, token, content);
}

export function play(state: GameState, script: readonly string[], content: Content): GameState[] {
  const trace: GameState[] = [state];
  let current = state;
  for (const token of script) {
    // A goblin visit consumes a turn of its own before the scripted move lands.
    while (current.status === "goblin_break" || current.status === "goblin_nightfall") {
      current = step(current, token, content);
      trace.push(current);
    }
    if (current.status === "review") break;
    current = step(current, token, content);
    trace.push(current);
  }
  return trace;
}
