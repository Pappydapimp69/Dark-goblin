import Phaser from "phaser";
import { content } from "../content";
import type { NpcState } from "../engine/types";
import { DevOverlay } from "../ui/DevOverlay";
import { sceneFor, type Store } from "../ui/store";
import { COLOR, CSS, HEIGHT, WIDTH, font } from "../ui/theme";
import { button, leave, personToken } from "../ui/widgets";

const PLACES: { id: string; name: string }[] = [
  { id: "storefront", name: "The Storefront" },
  { id: "market", name: "The Market" },
  { id: "wrecked", name: "The Wrecked Building" },
  { id: "room", name: "Your Room" },
];

/** The four locations and whoever is in town today. */
export class Street extends Phaser.Scene {
  private overlay?: DevOverlay;

  constructor() {
    super("Street");
  }

  create(): void {
    const store = this.registry.get("store") as Store;

    this.cameras.main.setBackgroundColor(COLOR.night);
    this.cameras.main.fadeIn(280, 0, 0, 0);
    this.overlay = new DevOverlay(this, store);

    const where = new Map<string, string>();
    for (const def of content.npcs) where.set(def.id, def.location ?? "market");

    const top = 90;
    const gap = 16;
    const panelHeight = (HEIGHT - top - 120 - gap * 3) / PLACES.length;

    PLACES.forEach((place, index) => {
      const y = top + index * (panelHeight + gap) + panelHeight / 2;

      this.add.rectangle(WIDTH / 2, y, WIDTH - 60, panelHeight, COLOR.panel, 0.9)
        .setStrokeStyle(2, COLOR.edge);
      this.add.text(50, y - panelHeight / 2 + 22, place.name, font(24, CSS.inkDim)).setOrigin(0, 0);

      const here = Object.values(store.state.npcs).filter(
        (npc): npc is NpcState => npc.present && npc.id !== "player" && where.get(npc.id) === place.id,
      );

      const spread = Math.min(here.length, 5);
      here.slice(0, 5).forEach((npc, i) => {
        const x = WIDTH / 2 + (i - (spread - 1) / 2) * 130;
        personToken(this, x, y + 16, npc.name, () => this.open(store, npc.id), {
          broken: npc.broken,
          radius: 36,
        });
      });

      if (place.id === "room") {
        button(this, WIDTH / 2, y + 22, "Sleep", () => leave(this, "Night"), {
          width: 300,
          size: 26,
        });
      }
    });
  }

  private open(store: Store, npcId: string): void {
    if (store.choicesFor(npcId).length === 0) return;
    this.scene.pause();
    this.scene.launch("Dialogue", { npcId });
  }

  /** Called by Dialogue when an interaction moved the game on. */
  resume(): void {
    const store = this.registry.get("store") as Store;
    const next = sceneFor(store.state);
    if (next !== "Street") {
      leave(this, next);
      return;
    }
    this.scene.restart();
  }

  shutdown(): void {
    this.overlay?.destroy();
  }
}
