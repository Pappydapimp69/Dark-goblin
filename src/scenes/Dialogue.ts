import Phaser from "phaser";
import type { Store } from "../ui/store";
import { COLOR, CSS, HEIGHT, WIDTH, font } from "../ui/theme";
import { button } from "../ui/widgets";

/** The choice overlay. It dispatches and closes; it decides nothing. */
export class Dialogue extends Phaser.Scene {
  constructor() {
    super("Dialogue");
  }

  create(data: { npcId: string }): void {
    const store = this.registry.get("store") as Store;
    const npc = store.state.npcs[data.npcId];
    const choices = store.choicesFor(data.npcId);
    if (!npc) return this.close();

    this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x120f0d, 0.97).setOrigin(0, 0).setInteractive();

    const trade = typeof npc.state["trade"] === "string" ? npc.state["trade"] : "";
    this.add.text(WIDTH / 2, 150, npc.name, font(40)).setOrigin(0.5);
    if (trade) this.add.text(WIDTH / 2, 200, trade, font(24, CSS.inkDim)).setOrigin(0.5);

    const top = 300;
    let y = top;
    for (const choice of choices) {
      const control = button(this, WIDTH / 2, y, choice.text, () => this.pick(store, choice.id), {
        size: 27,
      });
      y += control.height + 18;
    }

    button(this, WIDTH / 2, Math.min(y + 30, HEIGHT - 110), "Leave them be", () => this.close(), {
      width: 360,
      size: 24,
      tone: COLOR.dusk,
      muted: true,
    });
  }

  private pick(store: Store, choiceId: string): void {
    store.interact(choiceId);
    this.close(true);
  }

  private close(moved = false): void {
    const street = this.scene.get("Street") as Phaser.Scene & { resume(): void };
    this.scene.stop();
    this.scene.resume("Street");
    if (moved) street.resume();
  }
}
