import Phaser from "phaser";
import { content } from "../content";
import { sceneFor, type Store } from "../ui/store";
import { COLOR, HEIGHT, WIDTH, font } from "../ui/theme";
import { button, leave, typeOut } from "../ui/widgets";

/** He waits this long, saying nothing, before he starts. */
const PAUSE = 1400;

/**
 * Both visits.
 *
 * The pause is the whole effect: he arrives, and then there is a silence
 * long enough to be uncomfortable before a word appears. A break states what
 * happened and asks nothing; nightfall asks one to three questions whose
 * answers change nothing but the record.
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
    this.cameras.main.fadeIn(900, 0, 0, 0);

    const body = this.add.ellipse(WIDTH / 2, 270, 130, 165, 0x171310).setStrokeStyle(2, COLOR.edge);
    const eyes = [-1, 1].map((side) =>
      this.add.ellipse(WIDTH / 2 + side * 28, 254, 22, 12, COLOR.warm, 0),
    );

    // The eyes open during the silence. Nothing else happens in it.
    this.tweens.add({ targets: eyes, fillAlpha: 0.9, duration: 900, delay: 300 });
    this.tweens.add({ targets: body, y: 262, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    const line = this.add.text(WIDTH / 2, 470, "", font(28)).setOrigin(0.5, 0);

    if (visit.kind === "break") {
      const spoken = content.goblin.breaks.find((b) => b.id === visit.lineId);
      typeOut(this, line, spoken?.text ?? "He looks at you, and says nothing.", {
        delay: PAUSE,
        msPerChar: 30,
        onDone: () => {
          const control = button(this, WIDTH / 2, HEIGHT - 220, "He leaves.", () => {
            store.acknowledge();
            leave(this, sceneFor(store.state));
          });
          control.setAlpha(0);
          this.tweens.add({ targets: control, alpha: 1, duration: 600 });
        },
      });
      return;
    }

    const questionId = visit.questionIds[visit.cursor];
    const question = content.goblin.questions.find((q) => q.id === questionId);
    if (!question) return leave(this, sceneFor(store.state));

    typeOut(this, line, question.text, {
      delay: visit.cursor === 0 ? PAUSE : 500,
      msPerChar: 34,
      onDone: () => this.offer(store, question.answers),
    });
  }

  private offer(store: Store, answers: { id: string; text: string }[]): void {
    let y = 700;
    for (const answer of answers) {
      const control = button(this, WIDTH / 2, y, answer.text, () => this.pick(store, answer.id), {
        size: 25,
      });
      control.setAlpha(0);
      this.tweens.add({ targets: control, alpha: 1, duration: 450, delay: 120 });
      y += control.height + 16;
    }
  }

  private pick(store: Store, answerId: string): void {
    store.answer(answerId);
    const next = store.state;
    if (next.status === "goblin_nightfall") {
      this.scene.restart();
      return;
    }
    leave(this, sceneFor(next) === "Street" ? "Mirror" : sceneFor(next));
  }
}
