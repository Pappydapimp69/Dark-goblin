import Phaser from "phaser";
import { Store } from "../ui/store";
import { COLOR, CSS, HEIGHT, WIDTH, font } from "../ui/theme";

/** Builds the store, then gets out of the way. No assets to load — §9 Phase 4 art is shapes. */
export class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    // One seed per playthrough. Phase 5's save/load will carry it instead.
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.registry.set("store", new Store(seed));

    this.cameras.main.setBackgroundColor(COLOR.night);
    this.add.text(WIDTH / 2, HEIGHT / 2 - 40, "The Dark Goblin", font(52)).setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT / 2 + 60, "tap to begin", font(26, CSS.inkDim))
      .setOrigin(0.5);

    this.input.once("pointerup", () => this.scene.start("Mirror"));
  }
}
