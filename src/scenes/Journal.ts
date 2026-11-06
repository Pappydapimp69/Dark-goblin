import Phaser from "phaser";
import { content } from "../content";
import { journal } from "../ui/journal";
import type { Store } from "../ui/store";
import { CSS, HEIGHT, WIDTH, font } from "../ui/theme";
import { button } from "../ui/widgets";

/** The journal over the paused town. It reads and closes; it decides nothing. */
export class Journal extends Phaser.Scene {
  constructor() {
    super("Journal");
  }

  create(): void {
    const store = this.registry.get("store") as Store;
    this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x120f0d, 0.94).setOrigin(0, 0).setInteractive();
    this.add.text(WIDTH / 2, 70, "Journal", font(34)).setOrigin(0.5, 0);

    const back = button(this, WIDTH / 2, HEIGHT - 90, "Back", () => this.close(), { width: 300, size: 26 });

    // Stack off measured heights; if the page runs out, the last lines go.
    const bottom = back.y - back.height / 2 - 24;
    let y = 140;
    for (const section of journal(store.state, content)) {
      if (y > bottom - 40) break;
      const heading = this.add.text(60, y, section.heading, font(24, CSS.warm));
      y += heading.height + 10;
      for (const line of section.lines) {
        const text = this.add.text(76, y, line, { ...font(19, CSS.inkDim), wordWrap: { width: WIDTH - 140 } });
        if (y + text.height > bottom) {
          text.destroy();
          break;
        }
        y += text.height + 8;
      }
      y += 18;
    }
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume("Street");
  }
}
