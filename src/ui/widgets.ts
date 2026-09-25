import Phaser from "phaser";
import { cue, CUES } from "./sound";
import { COLOR, CSS, WIDTH, font } from "./theme";

/**
 * Hit testing, done here rather than by Phaser.
 *
 * Measured on a real Android: a tap reported at 354,858 against a button
 * spanning x 60-660, y 808-892 — provably inside — with Phaser seeing both the
 * press and the release, nothing cancelled, and the Container's own handler
 * never firing. Phaser's Container hit test was refusing a point inside its own
 * hit area, on that device only. Rather than keep chasing why, every control
 * registers its rectangle here and one scene-level listener does the
 * containment arithmetic, which is four comparisons and cannot disagree with
 * itself across devices.
 *
 * Controls still call setInteractive so they remain discoverable to the smoke
 * driver, but nothing is bound to their own pointer events: there is exactly
 * one path from a touch to a handler.
 */
interface Hotspot {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  press(): void;
  release(): void;
  pick(): void;
  alive(): boolean;
}

const HOTSPOTS = new WeakMap<Phaser.Scene, Hotspot[]>();

function spotsFor(scene: Phaser.Scene): Hotspot[] {
  const existing = HOTSPOTS.get(scene);
  if (existing) return existing;

  const spots: Hotspot[] = [];
  HOTSPOTS.set(scene, spots);

  // Last registered wins: later controls are drawn on top of earlier ones.
  const at = (p: Phaser.Input.Pointer): Hotspot | undefined => {
    for (let i = spots.length - 1; i >= 0; i -= 1) {
      const s = spots[i]!;
      if (!s.alive()) continue;
      if (p.x >= s.x1 && p.x <= s.x2 && p.y >= s.y1 && p.y <= s.y2) return s;
    }
    return undefined;
  };

  let armed: Hotspot | undefined;

  scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
    armed = at(p);
    armed?.press();
  });

  scene.input.on("pointerup", (p: Phaser.Input.Pointer) => {
    const over = at(p);
    for (const s of spots) if (s.alive()) s.release();
    if (over && over === armed) over.pick();
    armed = undefined;
  });

  scene.input.on("pointermove", (p: Phaser.Input.Pointer) => {
    if (p.isDown) return;
    const over = at(p);
    for (const s of spots) if (s.alive()) (s === over ? s.press : s.release).call(s);
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => HOTSPOTS.delete(scene));
  scene.events.once(Phaser.Scenes.Events.DESTROY, () => HOTSPOTS.delete(scene));
  return spots;
}

/** A tappable slab of text. Tap and click are the same event in Phaser. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onPick: () => void,
  opts: { width?: number; size?: number; tone?: number; muted?: boolean } = {},
): Phaser.GameObjects.Container {
  const width = opts.width ?? WIDTH - 120;
  const size = opts.size ?? 30;
  const tone = opts.tone ?? COLOR.panel;

  const text = scene.add
    .text(0, 0, label, { ...font(size, opts.muted ? CSS.inkDim : CSS.ink), wordWrap: { width: width - 56 } })
    .setOrigin(0.5);

  const height = Math.max(84, text.height + 44);
  const plate = scene.add.rectangle(0, 0, width, height, tone).setStrokeStyle(2, COLOR.edge);

  const container = scene.add.container(x, y, [plate, text]).setSize(width, height);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    Phaser.Geom.Rectangle.Contains,
  );

  spotsFor(scene).push({
    x1: x - width / 2,
    y1: y - height / 2,
    x2: x + width / 2,
    y2: y + height / 2,
    alive: () => container.active,
    press: () => {
      plate.setFillStyle(COLOR.panelLit);
    },
    release: () => {
      plate.setFillStyle(tone);
    },
    pick: () => {
      scene.tweens.add({ targets: container, scale: 0.98, duration: 70, yoyo: true });
      cue(scene, CUES.tap);
      onPick();
    },
  });

  return container;
}

/** A person, printed. The figure is cut from the composition system in src/art. */
export function personToken(
  scene: Phaser.Scene,
  x: number,
  y: number,
  name: string,
  textureKey: string,
  onPick: () => void,
  opts: { broken?: boolean; height?: number } = {},
): Phaser.GameObjects.Container {
  const height = opts.height ?? 150;

  // The container's origin is where the figure's feet meet the ground, so a
  // caller positions a person by the spot they stand on and the label always
  // lands just below it instead of somewhere under the panel's edge.
  const figure = scene.add.image(0, 0, textureKey).setOrigin(0.5, 1);
  figure.setDisplaySize((figure.width / figure.height) * height, height);

  const label = scene.add
    .text(0, 7, name, { ...font(19, CSS.inkDim), wordWrap: { width: 150 } })
    .setOrigin(0.5, 0);

  const container = scene.add.container(x, y, [figure, label]);
  const hit = new Phaser.Geom.Rectangle(-figure.displayWidth / 2, -height, figure.displayWidth, height + 26);
  container.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
  const natural = (): void => {
    figure.setDisplaySize((figure.width / figure.height) * height, height);
  };
  spotsFor(scene).push({
    x1: x - figure.displayWidth / 2,
    y1: y - height,
    x2: x + figure.displayWidth / 2,
    y2: y + 26,
    alive: () => container.active,
    press: () => figure.setDisplaySize((figure.width / figure.height) * height * 1.05, height * 1.05),
    release: natural,
    pick: () => {
      natural();
      cue(scene, CUES.tap);
      onPick();
    },
  });

  return container;
}

/** Fade the whole scene out, then hand over. */
export function leave(scene: Phaser.Scene, to: string, data?: object): void {
  cue(scene, CUES.door, 0.35);
  scene.cameras.main.fadeOut(220, 0, 0, 0);
  scene.cameras.main.once("camerafadeoutcomplete", () => scene.scene.start(to, data));
}

/**
 * Reveal text a character at a time. Tapping anywhere finishes it at once —
 * slow text without a way past it is a tax on anyone who reads quickly, or on
 * anyone reading it a second time.
 */
export function typeOut(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Text,
  full: string,
  opts: { msPerChar?: number; delay?: number; onDone?: () => void } = {},
): () => void {
  const msPerChar = opts.msPerChar ?? 26;
  let index = 0;
  let finished = false;
  target.setText("");

  const finish = (): void => {
    if (finished) return;
    finished = true;
    timer?.remove();
    target.setText(full);
    opts.onDone?.();
  };

  let timer: Phaser.Time.TimerEvent | undefined;
  scene.time.delayedCall(opts.delay ?? 0, () => {
    if (finished) return;
    timer = scene.time.addEvent({
      delay: msPerChar,
      repeat: full.length - 1,
      callback: () => {
        index += 1;
        target.setText(full.slice(0, index));
        if (index >= full.length) finish();
      },
    });
  });

  scene.input.once("pointerdown", finish);
  return finish;
}
