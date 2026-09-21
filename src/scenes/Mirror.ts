import Phaser from "phaser";
import { drawPortrait, portraitStage } from "../ui/portrait";
import type { Store } from "../ui/store";
import { COLOR, CSS, HEIGHT, WIDTH, font } from "../ui/theme";
import { cue, CUES } from "../ui/sound";
import { button, leave } from "../ui/widgets";

/**
 * The morning. §5.8: the portrait is the whole of the lifespan feedback, so
 * this scene says nothing and shows one face.
 */
export class Mirror extends Phaser.Scene {
  constructor() {
    super("Mirror");
  }

  create(): void {
    const store = this.registry.get("store") as Store;
    const state = store.state;
    const stage = portraitStage(state.lifespan.current, state.lifespan.max);

    this.cameras.main.setBackgroundColor(COLOR.night);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    const frame = this.add.rectangle(WIDTH / 2, 520, 340, 440, COLOR.dusk).setStrokeStyle(3, COLOR.edge);
    frame.setAlpha(0.9);
    drawPortrait(this, WIDTH / 2, 520, stage, 1.15);

    this.add.text(WIDTH / 2, 190, "The same morning.", font(34, CSS.inkDim)).setOrigin(0.5);
    cue(this, CUES.mirror, 0.4);

    // No number, no bar, no word for how far along this is.
    button(this, WIDTH / 2, HEIGHT - 260, "Go out", () => leave(this, "Street"));
  }
}
