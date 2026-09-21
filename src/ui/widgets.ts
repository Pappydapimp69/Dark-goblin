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
  container.on("pointerover", () => figure.setScale(figure.scaleX * 1.05, figure.scaleY * 1.05));
  container.on("pointerout", () => figure.setDisplaySize((figure.width / figure.height) * height, height));
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
