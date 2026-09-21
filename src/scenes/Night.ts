import Phaser from "phaser";
import { sceneFor, type Store } from "../ui/store";
import { COLOR, CSS, HEIGHT, WIDTH, font } from "../ui/theme";
import { cue, CUES } from "../ui/sound";
import { button, leave } from "../ui/widgets";

/**
 * Bills, then sleep. §0 forbids the figure, so the bill is reported in words
 * — and the words are deliberately the only thing the player gets to know
 * about a day that has already been scored against them.
 */
export class Night extends Phaser.Scene {
  constructor() {
    super("Night");
  }

  create(): void {
    const store = this.registry.get("store") as Store;

    this.cameras.main.setBackgroundColor(COLOR.night);
    this.cameras.main.fadeIn(280, 0, 0, 0);

    this.add.rectangle(WIDTH / 2, 470, WIDTH - 140, 260, COLOR.dusk, 0.75).setStrokeStyle(2, COLOR.edge);
    this.add.text(WIDTH / 2, 420, "The rent is due.", font(34)).setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 490, "You count out what you have.", font(24, CSS.inkDim))
      .setOrigin(0.5);

    button(this, WIDTH / 2, HEIGHT - 300, "Sleep", () => this.rest(store));
  }

  private rest(store: Store): void {
    cue(this, CUES.sleep);
    store.sleep();

    const last = [...store.state.ledger].reverse().find((e) => e.kind === "pressure");
    const line =
      last?.kind !== "pressure"
        ? "You sleep."
        : last.paid === last.bill
          ? "You settled it, and slept."
          : last.paid * 2 >= last.bill
            ? "You settled most of it. The rest waits."
            : "You could not settle it. It waits, and grows.";

    this.children.removeAll();
    this.add.text(WIDTH / 2, 470, line, font(30)).setOrigin(0.5);

    const next = sceneFor(store.state);
    button(this, WIDTH / 2, HEIGHT - 300, next === "review" ? "…" : "Morning", () =>
      leave(this, next === "Street" ? "Mirror" : next),
    );
  }
}
