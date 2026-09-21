import Phaser from "phaser";
import { CSS, WIDTH, font } from "./theme";
import type { Store } from "./store";

/**
 * Everything §0 forbids showing the player, behind the backtick key.
 * Never opens on touch: a phone has no backtick and the player must not find
 * this by accident.
 */
export class DevOverlay {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Text;
  private open = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly store: Store,
  ) {
    const plate = scene.add.rectangle(0, 0, WIDTH - 40, 560, 0x000000, 0.86).setOrigin(0, 0);
    this.body = scene.add.text(18, 16, "", font(19, CSS.warm)).setOrigin(0, 0);
    this.panel = scene.add.container(20, 20, [plate, this.body]).setDepth(9999).setVisible(false);
    this.panel.setScrollFactor?.(0);

    scene.input.keyboard?.on("keydown-BACKTICK", () => this.toggle());
    store.subscribe(() => this.refresh());
  }

  private toggle(): void {
    this.open = !this.open;
    this.panel.setVisible(this.open);
    if (this.open) this.refresh();
  }

  private refresh(): void {
    if (!this.open) return;
    const s = this.store.state;
    const town = Object.values(s.npcs)
      .filter((n) => n.present && n.id !== "player")
      .map((n) => `${n.name}${n.broken ? "†" : ""}`)
      .join(", ");
    const goals = Object.values(s.goals)
      .filter((g) => g.status !== "open" || g.owner === "player")
      .map((g) => `  ${g.status.padEnd(9)} ${g.id}`)
      .join("\n");

    this.body.setText(
      [
        `loop ${s.loop}   status ${s.status}`,
        `lifespan ${s.lifespan.current}/${s.lifespan.max}   stage ${Math.floor((1 - s.lifespan.current / s.lifespan.max) * 5)}`,
        `day ${s.day.score}/${s.day.max}   interactions ${s.day.interactions}`,
        `money ${s.money}   debt ${s.debt}`,
        `rng ${s.rng.count} draws   seed ${s.seed}`,
        `town: ${town}`,
        `goals:`,
        goals,
      ].join("\n"),
    );
  }

  destroy(): void {
    this.scene.input.keyboard?.off("keydown-BACKTICK");
    this.panel.destroy();
  }
}
