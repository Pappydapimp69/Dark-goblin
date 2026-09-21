import Phaser from "phaser";
import { load, type LoadFailure } from "../ui/save";
import { sceneFor, Store } from "../ui/store";
import { COLOR, CSS, HEIGHT, WIDTH, font } from "../ui/theme";
import { button, leave } from "../ui/widgets";

/**
 * A player who had a save and is silently given a fresh start reads that as
 * lost data rather than as a save this build cannot open. So it is said, once,
 * quietly, and only when there was actually something there.
 */
const EXCUSE: Partial<Record<LoadFailure, string>> = {
  older: "A save from an earlier version could not be opened.",
  newer: "A save from a later version was left untouched.",
  unreadable: "A save was found, but could not be read.",
  invalid: "A save was found, but no longer fits the town.",
};

/** Builds the store, then gets out of the way. No assets — §9 Phase 4 art is shapes. */
export class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLOR.night);
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.add.text(WIDTH / 2, 420, "The Dark Goblin", font(52)).setOrigin(0.5);

    const found = load();
    const excuse = found.ok ? undefined : EXCUSE[found.reason];
    if (excuse) {
      this.add.text(WIDTH / 2, 500, excuse, font(21, CSS.inkDim)).setOrigin(0.5);
    }

    if (found.ok) {
      const store = new Store(found.state);
      this.registry.set("store", store);

      button(this, WIDTH / 2, HEIGHT - 480, "Go on", () => {
        const next = sceneFor(store.state);
        leave(this, next === "Street" ? "Mirror" : next);
      });
      button(this, WIDTH / 2, HEIGHT - 370, "Start again", () => this.fresh(), {
        tone: COLOR.dusk,
        muted: true,
        size: 25,
      });
      return;
    }

    button(this, WIDTH / 2, HEIGHT - 430, "Begin", () => this.fresh());
  }

  private fresh(): void {
    // The one place ambient randomness is right: a life has to start somewhere
    // unrepeatable. From here on the seed is in the save and everything is
    // derived from it.
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.registry.set("store", new Store(seed));
    leave(this, "Mirror");
  }
}
