import Phaser from "phaser";
import { cue, CUES } from "./sound";
import { COLOR, CSS, WIDTH, font } from "./theme";

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

  container.on("pointerover", () => plate.setFillStyle(COLOR.panelLit));
  container.on("pointerout", () => plate.setFillStyle(tone));
  container.on("pointerdown", () => {
    plate.setFillStyle(COLOR.panelLit);
    scene.tweens.add({ targets: container, scale: 0.98, duration: 70, yoyo: true });
  });
  container.on("pointerup", () => {
    plate.setFillStyle(tone);
    cue(scene, CUES.tap);
    onPick();
  });

  return container;
}

/** A person, as a token: initial in a circle. Placeholder art, §9 Phase 4. */
export function personToken(
  scene: Phaser.Scene,
  x: number,
  y: number,
  name: string,
  onPick: () => void,
  opts: { broken?: boolean; radius?: number } = {},
): Phaser.GameObjects.Container {
  const radius = opts.radius ?? 40;
  const tone = opts.broken ? COLOR.cold : COLOR.warm;

  const disc = scene.add.circle(0, 0, radius, tone, opts.broken ? 0.35 : 0.9).setStrokeStyle(2, COLOR.edge);
  const initial = scene.add
    .text(0, -2, name.slice(0, 1).toUpperCase(), font(Math.round(radius * 0.9), "#1a1614"))
    .setOrigin(0.5);
  const label = scene.add
    .text(0, radius + 20, name, { ...font(20, CSS.inkDim), wordWrap: { width: radius * 3 } })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [disc, initial, label]);
  container.setInteractive(new Phaser.Geom.Circle(0, 0, radius), Phaser.Geom.Circle.Contains);
  container.on("pointerover", () => disc.setScale(1.06));
  container.on("pointerout", () => disc.setScale(1));
  container.on("pointerup", () => {
    cue(scene, CUES.tap);
    onPick();
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
