import Phaser from "phaser";
import { brokenKey, buildingKey, figureKey } from "../art";
import { content } from "../content";
import { acquaintance } from "./Dialogue";
import type { NpcState } from "../engine/types";
import { DevOverlay } from "../ui/DevOverlay";
import { sceneFor, type Store } from "../ui/store";
import { COLOR, CSS, HEIGHT, WIDTH, font } from "../ui/theme";
import { BUILDING, FIGURE_HEIGHT, GROUND, HOME, PLACES, besideSpot, clampToGround, townView, walkMs } from "../ui/town";
import { button, groundSpot, leave, personToken } from "../ui/widgets";

type Point = { x: number; y: number };

/**
 * The town, walked. You are a figure on the map: tap the ground to go there,
 * tap someone to walk up and talk, tap Sleep to go home to bed. Nothing here
 * touches the engine except through the store, and walking costs nothing —
 * the day is still counted only in what you do (§5.1).
 */
export class Street extends Phaser.Scene {
  private overlay?: DevOverlay;
  private you!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Ellipse;
  private walking?: Phaser.Tweens.Tween;

  constructor() {
    super("Street");
  }

  create(): void {
    const store = this.registry.get("store") as Store;
    const state = store.state;

    this.cameras.main.setBackgroundColor(0x1d1815);
    this.cameras.main.fadeIn(280, 0, 0, 0);
    this.overlay = new DevOverlay(this, store);

    this.drawSky(state.day.interactions / Math.max(1, content.rules.interactionsPerDay));

    // Open ground first: people and buttons registered after it win their taps.
    groundSpot(this, GROUND, (x, y) => this.walkTo(clampToGround({ x, y })));

    this.drawPaths();

    // The town as it is today: who has gone, who holds which shop, what was rebuilt.
    const view = townView(state, content);
    for (const place of view.places) {
      const art = place.look === "rebuilt" ? buildingKey("rebuilt") : buildingKey(place.id);
      this.add.image(place.x, place.y, art).setDisplaySize(BUILDING.width, BUILDING.height);
      this.add.text(place.x, place.y - BUILDING.height / 2 - 2, place.name, font(20, CSS.inkDim)).setOrigin(0.5, 1);
    }
    for (const person of view.people) {
      const npc = state.npcs[person.id] as NpcState;
      const key = npc.broken ? brokenKey(npc.id) : figureKey(npc.id);
      personToken(
        this,
        person.x,
        person.y,
        npc.name,
        this.textures.exists(key) ? key : figureKey(npc.id),
        () => this.approach(store, npc.id, person),
        // The child stands at about two-thirds of an adult's height.
        { broken: npc.broken, height: FIGURE_HEIGHT * (npc.id === "child" ? 0.68 : 1) },
      );
    }

    // You, where you were standing — or at your own door, if it is a new morning.
    const kept = this.registry.get("townPos") as (Point & { loop: number }) | undefined;
    const start = kept && kept.loop === state.loop ? kept : HOME;
    // A warm ring at your feet: in a town of figures, this one is you.
    this.ring = this.add.ellipse(start.x, start.y, 64, 18, 0xd9a066, 0.45).setDepth(9);
    this.you = this.add.image(start.x, start.y, figureKey("player")).setOrigin(0.5, 1).setDepth(10);
    this.you.setDisplaySize((this.you.width / this.you.height) * FIGURE_HEIGHT, FIGURE_HEIGHT);

    button(this, 140, HEIGHT - 70, "Journal", () => this.openJournal(), { width: 220, size: 24 });
    button(this, WIDTH - 140, HEIGHT - 70, "Sleep", () => this.walkTo(HOME, () => leave(this, "Night")), {
      width: 220,
      size: 24,
    });
  }

  /** The day's light: the sun crosses the sky as the day's acts are spent. No number, just where it hangs. */
  private drawSky(spent: number): void {
    const t = Math.min(1, Math.max(0, spent));
    const sky = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x3b3a46),
      Phaser.Display.Color.ValueToColor(0x15121a),
      100,
      Math.round(t * 100),
    );
    this.add.rectangle(WIDTH / 2, 70, WIDTH, 140, Phaser.Display.Color.GetColor(sky.r, sky.g, sky.b));
    const angle = Math.PI * (1 - t);
    const sunX = WIDTH / 2 + Math.cos(angle) * (WIDTH / 2 - 70);
    const sunY = 128 - Math.sin(angle) * 92;
    this.add.circle(sunX, sunY, 22, t < 1 ? 0xd9a066 : 0x8a6a4a, 0.9);
    this.add.rectangle(WIDTH / 2, 140, WIDTH, 4, COLOR.edge, 0.6);
  }

  /** The road that joins the places, ending at your door. */
  private drawPaths(): void {
    const road = this.add.graphics();
    road.lineStyle(26, 0x2c2520, 1);
    const stops: Point[] = [...PLACES.map((p) => ({ x: p.x, y: p.y + 80 })), HOME];
    road.beginPath();
    road.moveTo(stops[0]!.x, stops[0]!.y);
    for (const s of stops.slice(1)) road.lineTo(s.x, s.y);
    road.strokePath();
  }

  private walkTo(target: Point, then?: () => void): void {
    this.walking?.stop();
    const from = { x: this.you.x, y: this.you.y };
    const duration = walkMs(from, target);
    this.you.setFlipX(target.x < from.x);
    const done = (): void => {
      this.registry.set("townPos", { loop: (this.registry.get("store") as Store).state.loop, x: this.you.x, y: this.you.y });
      then?.();
    };
    if (duration < 16) {
      done();
      return;
    }
    this.walking = this.tweens.add({
      targets: [this.you, this.ring],
      x: target.x,
      y: target.y,
      duration,
      ease: "Sine.easeInOut",
      onComplete: done,
    });
  }

  /** Walk up beside someone, then talk — if there is anything to say. */
  private approach(store: Store, npcId: string, where: Point): void {
    const npc = store.state.npcs[npcId];
    const gettingToKnow = npc !== undefined && acquaintance(npc) !== "known";
    if (store.choicesFor(npcId).length === 0 && !gettingToKnow) return;
    this.walkTo(besideSpot(where, { x: this.you.x, y: this.you.y }), () => {
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
