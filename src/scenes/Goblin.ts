import Phaser from "phaser";
import { content } from "../content";
import { sceneFor, type Store } from "../ui/store";
import { COLOR, HEIGHT, WIDTH, font } from "../ui/theme";
import { button, leave } from "../ui/widgets";

/**
 * Both visits. A break states what happened and asks nothing; nightfall asks
 * one to three questions whose answers change nothing but the record.
 *
 * Phase 5 gives him the slow text and the pause before he speaks.
 */
export class Goblin extends Phaser.Scene {
  constructor() {
    super("Goblin");
  }

  create(): void {
    const store = this.registry.get("store") as Store;
    const visit = store.state.pendingGoblin;
    if (!visit) return leave(this, sceneFor(store.state));

    this.cameras.main.setBackgroundColor(0x0d0b0a);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    this.add.ellipse(WIDTH / 2, 260, 120, 150, 0x171310).setStrokeStyle(2, COLOR.edge);
    for (const side of [-1, 1]) {
      this.add.ellipse(WIDTH / 2 + side * 26, 246, 20, 11, COLOR.warm, 0.85);
    }

    if (visit.kind === "break") {
      const line = content.goblin.breaks.find((b) => b.id === visit.lineId);
      this.add
        .text(WIDTH / 2, 520, line?.text ?? "He looks at you, and says nothing.", font(28))
        .setOrigin(0.5, 0);
      button(this, WIDTH / 2, HEIGHT - 220, "He leaves.", () => {
        store.acknowledge();
        leave(this, sceneFor(store.state) === "Street" ? "Street" : sceneFor(store.state));
      });
      return;
    }

    const questionId = visit.questionIds[visit.cursor];
    const question = content.goblin.questions.find((q) => q.id === questionId);
    if (!question) return leave(this, sceneFor(store.state));

    this.add.text(WIDTH / 2, 480, question.text, font(32)).setOrigin(0.5, 0);

    let y = 660;
    for (const answer of question.answers) {
      const control = button(this, WIDTH / 2, y, answer.text, () => {
        store.answer(answer.id);
        const next = store.state;
        if (next.status === "goblin_nightfall") this.scene.restart();
        else leave(this, sceneFor(next) === "Street" ? "Mirror" : sceneFor(next));
      }, { size: 25 });
      y += control.height + 16;
    }
  }
}
