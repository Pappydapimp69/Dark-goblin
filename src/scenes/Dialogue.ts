import Phaser from "phaser";
import type { Store } from "../ui/store";
import { COLOR, CSS, HEIGHT, WIDTH, font } from "../ui/theme";
import { cue, CUES } from "../ui/sound";
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

    const veil = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x120f0d, 0).setOrigin(0, 0).setInteractive();
    this.tweens.add({ targets: veil, fillAlpha: 0.97, duration: 180 });

    // Everything but the veil rises a little as it arrives, so opening a
    // conversation reads as a step toward someone rather than a popup.
    const panel = this.add.container(0, 0).setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, y: 0, duration: 220, ease: "Sine.Out" });
    panel.setY(18);

    const trade = typeof npc.state["trade"] === "string" ? npc.state["trade"] : "";
    panel.add(this.add.text(WIDTH / 2, 150, npc.name, font(40)).setOrigin(0.5));
    if (trade) panel.add(this.add.text(WIDTH / 2, 200, trade, font(24, CSS.inkDim)).setOrigin(0.5));

    const top = 300;
    let y = top;
    for (const choice of choices) {
      const control = button(this, WIDTH / 2, y, choice.text, () => this.pick(store, choice.id), {
        size: 27,
      });
      panel.add(control);
      y += control.height + 18;
    }

    panel.add(
      button(this, WIDTH / 2, Math.min(y + 30, HEIGHT - 110), "Leave them be", () => this.close(), {
        width: 360,
        size: 24,
        tone: COLOR.dusk,
        muted: true,
      }),
    );
  }

  private pick(store: Store, choiceId: string): void {
    const before = store.state.money;
    store.interact(choiceId);
    cue(this, store.state.money === before ? CUES.choice : CUES.coin);
    this.close(true);
  }

  private close(moved = false): void {
    const street = this.scene.get("Street") as Phaser.Scene & { resume(): void };
    this.scene.stop();
    this.scene.resume("Street");
    if (moved) street.resume();
  }
}
