import Phaser from "phaser";
import { brokenKey, figureKey, topdownKey } from "../art";
import { content } from "../content";
import { acquaintance } from "./Dialogue";
import type { NpcState } from "../engine/types";
import { DevOverlay } from "../ui/DevOverlay";
import { sceneFor, type Store } from "../ui/store";
import { CSS, HEIGHT, WIDTH, font } from "../ui/theme";
import {
  COLS, FIGURE_HEIGHT, GRID, HOME_TILE, MAP_TOP, PLACES, ROWS, TILE, TILES_PER_SECOND,
  besideTile, feet, nearestFree, path, tileKey, townView, type Tile,
} from "../ui/town";
import { button, groundSpot, leave, personToken } from "../ui/widgets";

/** A cheap, stable hash of a tile, so grass tufts and ripples sit in the same place every day. */
const speck = (c: number, r: number, salt: number): number => (((c * 73856093) ^ (r * 19349663) ^ (salt * 83492791)) >>> 0) % 1000;

/**
 * The town, walked: a tile map you cross on foot. Tap the ground to go there
 * (round trees, walls and the river, along the roads), tap someone to walk up
 * beside them and talk, tap Sleep to walk home to bed. Walking costs nothing —
 * the day is still counted only in what you do (§5.1) — and nothing here
 * touches the engine except through the store.
 */
export class Street extends Phaser.Scene {
  private overlay?: DevOverlay;
  private you!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private ring!: Phaser.GameObjects.Ellipse;
  private at: Tile = HOME_TILE;
  private occupied = new Set<string>();
  private walking?: Phaser.Tweens.TweenChain;

  constructor() {
    super("Street");
  }

  create(): void {
    const store = this.registry.get("store") as Store;
    const state = store.state;
    const spent = Math.min(1, state.day.interactions / Math.max(1, content.rules.interactionsPerDay));

    this.cameras.main.setBackgroundColor(0x1d1815);
    this.cameras.main.fadeIn(280, 0, 0, 0);
    this.overlay = new DevOverlay(this, store);

    this.drawSky(spent);
    this.drawGround();

    // Open ground first: people and buttons registered after it win their taps.
    groundSpot(this, { x1: 0, y1: MAP_TOP, x2: WIDTH, y2: MAP_TOP + ROWS * TILE }, (x, y) =>
      this.walkTo(nearestFree({ x, y }, this.occupied)),
    );

    const view = townView(state, content);
    for (const place of PLACES) {
      const shown = view.places.find((p) => p.id === place.id)!;
      const f = place.footprint;
      const art = shown.look === "rebuilt" ? topdownKey("rebuilt") : topdownKey(place.id);
      this.add.image(f.col * TILE, MAP_TOP + f.row * TILE, art).setOrigin(0, 0).setDisplaySize(f.cols * TILE, f.rows * TILE);
      const label = this.add.text(f.col * TILE + (f.cols * TILE) / 2, MAP_TOP + f.row * TILE - 2, shown.name, font(17, CSS.ink)).setOrigin(0.5, 1);
      this.add.rectangle(label.x, label.y - label.height / 2, label.width + 14, label.height + 2, 0x120f0d, 0.6).setDepth(label.depth - 1);
      label.setDepth(2);
    }

    // Everyone stands on their own tile, with a shadow under their feet.
    this.occupied = new Set(view.people.map((p) => tileKey(p.tile)));
    for (const person of [...view.people].sort((a, b) => a.y - b.y)) {
      const npc = state.npcs[person.id] as NpcState;
      const height = FIGURE_HEIGHT * (npc.id === "child" ? 0.68 : 1);
      this.add.ellipse(person.x, person.y, 34, 10, 0x000000, 0.35);
      const key = npc.broken ? brokenKey(npc.id) : figureKey(npc.id);
      personToken(
        this, person.x, person.y, npc.name,
        this.textures.exists(key) ? key : figureKey(npc.id),
        () => this.approach(store, npc.id, person.tile),
        { broken: npc.broken, height },
      ).setDepth(3 + person.y / 10000);
    }

    // You: where you were standing, or at your own door on a new morning.
    const kept = this.registry.get("townTile") as (Tile & { loop: number }) | undefined;
    this.at = kept && kept.loop === state.loop && !this.occupied.has(tileKey(kept)) ? { col: kept.col, row: kept.row } : HOME_TILE;
    const start = feet(this.at);
    this.shadow = this.add.ellipse(start.x, start.y, 34, 10, 0x000000, 0.35).setDepth(4);
    this.ring = this.add.ellipse(start.x, start.y, 46, 14, 0xd9a066, 0.5).setDepth(4);
    this.you = this.add.image(start.x, start.y, figureKey("player")).setOrigin(0.5, 1).setDepth(5);
    this.you.setDisplaySize((this.you.width / this.you.height) * FIGURE_HEIGHT, FIGURE_HEIGHT);

    // Dusk comes down over the whole map as the day's acts are spent.
    this.add.rectangle(WIDTH / 2, MAP_TOP + (ROWS * TILE) / 2, WIDTH, ROWS * TILE, 0x0b0c1a, 0.45 * spent).setDepth(6);

    button(this, 140, HEIGHT - 60, "Journal", () => this.openJournal(), { width: 220, size: 24 }).setDepth(7);
    button(this, WIDTH - 140, HEIGHT - 60, "Sleep", () => this.walkTo(HOME_TILE, () => leave(this, "Night")), {
      width: 220,
      size: 24,
    }).setDepth(7);
  }

  /** The day's clock: the sun crosses the sky as the day's acts are spent. A position, not a number. */
  private drawSky(t: number): void {
    const sky = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x4a4a5c),
      Phaser.Display.Color.ValueToColor(0x15121a),
      100,
      Math.round(t * 100),
    );
    this.add.rectangle(WIDTH / 2, MAP_TOP / 2, WIDTH, MAP_TOP, Phaser.Display.Color.GetColor(sky.r, sky.g, sky.b));
    const angle = Math.PI * (1 - t);
    this.add.circle(WIDTH / 2 + Math.cos(angle) * (WIDTH / 2 - 60), MAP_TOP - 14 - Math.sin(angle) * 70, 20, 0xd9a066, t < 1 ? 0.95 : 0.4);
  }

  /** Every tile, drawn once: grass, road, cobbles, river, bridge, trees, the well. */
  private drawGround(): void {
    const g = this.add.graphics();
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const ch = GRID[row]![col]!;
        const x = col * TILE;
        const y = MAP_TOP + row * TILE;
        const s = speck(col, row, 1);
        const base: Record<string, number> = { "=": 0x5b4a3a, "#": 0x4f4944, "~": 0x1e3440, b: 0x2a3d45, w: 0x4f4944 };
        g.fillStyle(base[ch] ?? (s % 2 ? 0x34402b : 0x37442d), 1).fillRect(x, y, TILE, TILE);

        if (ch === "." || ch === "," || "SMWHT".includes(ch)) {
          g.fillStyle(0x465a37, 0.8);
          if (s % 3 === 0) g.fillRect(x + (s % 29) + 3, y + (s % 23) + 8, 2, 6);
          if (s % 5 === 0) g.fillRect(x + ((s >> 3) % 31) + 3, y + ((s >> 2) % 27) + 6, 2, 5);
          if (ch === ",") {
            g.fillStyle(0xd9a066, 0.8).fillCircle(x + 12 + (s % 14), y + 14 + (s % 11), 2.5);
            g.fillStyle(0xb8a982, 0.8).fillCircle(x + 24 + (s % 9), y + 26 - (s % 7), 2);
          }
        } else if (ch === "=") {
          g.fillStyle(0x6b5845, 0.7).fillRect(x + (s % 30) + 2, y + (s % 25) + 6, 5, 3);
          g.fillStyle(0x4a3c2f, 0.7).fillRect(x + ((s >> 2) % 30) + 2, y + ((s >> 3) % 28) + 4, 3, 3);
        } else if (ch === "#" || ch === "w") {
          g.lineStyle(1, 0x3a3532, 0.9);
          g.strokeRect(x + 1, y + 1, 19, 19).strokeRect(x + 20, y + 1, 19, 19).strokeRect(x + 10, y + 20, 19, 19);
        } else if (ch === "~") {
          g.lineStyle(2, 0x3b5d6b, 0.7);
          const o = (s % 18) + 4;
          g.lineBetween(x + o, y + 12 + (s % 8), x + o + 12, y + 12 + (s % 8));
          g.lineBetween(x + ((o + 15) % 28), y + 28, x + ((o + 15) % 28) + 9, y + 28);
        } else if (ch === "b") {
          g.fillStyle(0x6b5240, 1).fillRect(x, y + 2, TILE, TILE - 4);
          g.lineStyle(2, 0x3a2c24, 1);
          for (let k = 0; k < TILE; k += 10) g.lineBetween(x + k, y + 2, x + k, y + TILE - 2);
          g.lineBetween(x, y + 3, x + TILE, y + 3).lineBetween(x, y + TILE - 3, x + TILE, y + TILE - 3);
        }
        if (ch === "w") {
          g.fillStyle(0x000000, 0.3).fillEllipse(x + 20, y + 32, 34, 10);
          g.fillStyle(0x6d7470, 1).fillCircle(x + 20, y + 20, 15);
          g.fillStyle(0x15232a, 1).fillCircle(x + 20, y + 20, 9);
          g.lineStyle(3, 0x120f0d, 1).strokeCircle(x + 20, y + 20, 15);
        }
      }
    }
    // Trees last, so their crowns lap over the tiles behind them.
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (GRID[row]![col] !== "T") continue;
        const x = col * TILE + TILE / 2;
        const y = MAP_TOP + row * TILE + TILE / 2;
        const s = speck(col, row, 7);
        g.fillStyle(0x000000, 0.35).fillEllipse(x + 4, y + 16, 34, 12);
        g.fillStyle(0x3a2c24, 1).fillRect(x - 3, y + 4, 6, 12);
        g.fillStyle(s % 2 ? 0x2d4428 : 0x324b2c, 1).fillCircle(x, y - 4, 17);
        g.fillStyle(0x3f5c36, 1).fillCircle(x - 6, y - 9, 8).fillCircle(x + 6, y - 2, 6);
        g.lineStyle(2, 0x120f0d, 0.8).strokeCircle(x, y - 4, 17);
      }
    }
  }

  /** Walk the grid to a tile, one tile at a time, round anything in the way. */
  private walkTo(target: Tile, then?: () => void): void {
    const steps = path(this.at, target, this.occupied);
    if (steps === null) return;
    this.walking?.stop();
    const store = this.registry.get("store") as Store;
    const arrive = (): void => {
      this.registry.set("townTile", { loop: store.state.loop, col: this.at.col, row: this.at.row });
      then?.();
    };
    if (steps.length === 0) {
      arrive();
      return;
    }
    const ms = 1000 / TILES_PER_SECOND;
    this.walking = this.tweens.chain({
      tweens: steps.map((tile) => {
        const to = feet(tile);
        return {
          targets: [this.you, this.shadow, this.ring],
          x: to.x,
          y: to.y,
          duration: ms,
          onStart: () => {
            this.you.setFlipX(to.x < this.you.x);
          },
          onComplete: () => {
            this.at = tile;
          },
        };
      }),
      onComplete: arrive,
    });
  }

  /** Walk up beside someone, then talk — if there is anything to say. */
  private approach(store: Store, npcId: string, where: Tile): void {
    const npc = store.state.npcs[npcId];
    const gettingToKnow = npc !== undefined && acquaintance(npc) !== "known";
    if (store.choicesFor(npcId).length === 0 && !gettingToKnow) return;
    const beside = besideTile(where, this.at, this.occupied);
    if (!beside) return;
    this.walkTo(beside.tile, () => {
      this.you.setFlipX(feet(where).x < this.you.x);
      this.scene.pause();
      this.scene.launch("Dialogue", { npcId });
    });
  }

  private openJournal(): void {
    this.scene.pause();
    this.scene.launch("Journal");
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
