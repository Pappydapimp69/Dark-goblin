import Phaser from "phaser";
import { figureKey, portraitKey, portraitStage } from "../art";
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

    this.add.rectangle(WIDTH / 2, 520, 372, 468, 0x171310).setStrokeStyle(4, COLOR.edge);
    this.add.rectangle(WIDTH / 2, 520, 348, 444).setStrokeStyle(2, COLOR.edge).setAlpha(0.6);
    const face = this.add.image(WIDTH / 2, 520, portraitKey(stage));
    face.setDisplaySize(318, 402);
    // The glass is never quite clean.
    this.add.rectangle(WIDTH / 2, 520, 348, 444, 0x9fb4c4, 0.05);

    this.add.text(WIDTH / 2, 190, "The same morning.", font(34, CSS.inkDim)).setOrigin(0.5);

    // You never change. The people who live with you do: whoever shares the
    // room stands either side of the glass. Nothing here is a number.
    const partner = state.slots["partner"]?.holder === "partner" ? state.npcs["partner"] : undefined;
    const child = state.npcs["child"]?.present ? state.npcs["child"] : undefined;
    if (partner && this.textures.exists(figureKey(partner.id))) {
      this.add.image(96, 700, figureKey(partner.id)).setOrigin(0.5, 1).setDisplaySize(120, 170);
    }
    if (child && this.textures.exists(figureKey(child.id))) {
      this.add.image(WIDTH - 96, 700, figureKey(child.id)).setOrigin(0.5, 1).setDisplaySize(84, 118);
      if (child.state["arrivedOn"] === state.loop) {
        this.add
          .text(WIDTH / 2, 240, "Someone small is asleep in the corner.", font(24, CSS.warm))
          .setOrigin(0.5);
      }
    }
    cue(this, CUES.mirror, 0.4);

    // No number, no bar, no word for how far along this is.
    button(this, WIDTH / 2, HEIGHT - 260, "Go out", () => leave(this, "Street"));
  }
}
