import Phaser from "phaser";
import { CSS, HEIGHT, WIDTH, font } from "./theme";

/**
 * TEMPORARY. A readout on the title screen for diagnosing a device I cannot
 * reproduce on: tapping Begin does nothing on mobile Brave, while every
 * emulated phone, tablet, pixel ratio and real touch event here works.
 *
 * It counts the same tap at three depths, and which of them stop incrementing
 * says where the tap is being lost:
 *   dom    — the browser delivered a pointer/touch event to the canvas at all
 *   phaser — Phaser's input plugin saw it
 *   hit    — Phaser decided it landed ON the button
 *
 * Remove this file and its two lines in Boot once the cause is known.
 */
export class TouchProbe {
  private dom = 0;
  private phaser = 0;
  private hit = 0;
  private where = "-";
  private inside = "-";
  private ups = 0;
  private cancels = 0;
  /** The button's actual extent in game space, not its centre point. */
  target = "-";
  private bounds: { x1: number; y1: number; x2: number; y2: number } | null = null;
  private readonly line: Phaser.GameObjects.Text;

  private readonly detach: (() => void)[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.line = scene.add
      .text(WIDTH / 2, HEIGHT - 120, "", { ...font(19, CSS.inkDim), align: "center" })
      .setOrigin(0.5, 0)
      .setDepth(9998)
      .setName("touch-probe");

    // The canvas outlives the scene: Boot is entered again on a reload and on
    // "Again" from the review. Listeners left on it would fire against this
    // probe's destroyed Text and throw inside Phaser's renderer, so every one
    // of them is torn down when the scene shuts down.
    const canvas = scene.game.canvas;
    const bump = (): void => {
      this.dom += 1;
      this.render();
    };
    for (const type of ["pointerdown", "touchstart", "mousedown"]) {
      canvas.addEventListener(type, bump, { passive: true });
      this.detach.push(() => canvas.removeEventListener(type, bump));
    }

    const seen = (pointer: Phaser.Input.Pointer): void => {
      this.phaser += 1;
      this.where = `${Math.round(pointer.x)},${Math.round(pointer.y)}`;
      // Is that point inside the button, judged independently of whatever
      // Phaser's own hit test concluded? This is the question that separates
      // "mapped to the wrong place" from "mapped fine, lost afterwards".
      const b = this.bounds;
      this.inside = b
        ? pointer.x >= b.x1 && pointer.x <= b.x2 && pointer.y >= b.y1 && pointer.y <= b.y2
          ? "YES"
          : "no"
        : "-";
      this.render();
    };
    scene.input.on("pointerdown", seen);
    this.detach.push(() => scene.input.off("pointerdown", seen));

    // Does Phaser ever see the release at all? The button fires on pointerup,
    // and Android cancels a touch it decides was a gesture.
    const up = (): void => {
      this.ups += 1;
      this.render();
    };
    scene.input.on("pointerup", up);
    this.detach.push(() => scene.input.off("pointerup", up));

    const cancelled = (): void => {
      this.cancels += 1;
      this.render();
    };
    for (const type of ["pointercancel", "touchcancel"]) {
      canvas.addEventListener(type, cancelled, { passive: true });
      this.detach.push(() => canvas.removeEventListener(type, cancelled));
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());

    this.render();
  }

  destroy(): void {
    for (const off of this.detach.splice(0)) off();
  }

  /** The button's real extent, so the readout shows a range and not a point. */
  setTarget(x: number, y: number, width: number, height: number): void {
    this.bounds = { x1: x - width / 2, y1: y - height / 2, x2: x + width / 2, y2: y + height / 2 };
    this.target = `x ${Math.round(this.bounds.x1)}-${Math.round(this.bounds.x2)}  y ${Math.round(this.bounds.y1)}-${Math.round(this.bounds.y2)}`;
    this.render();
  }

  /** Called from the button's own handler. */
  countHit(): void {
    this.hit += 1;
    this.render();
  }

  private render(): void {
    // A stale callback can still arrive between shutdown and teardown.
    if (!this.line.scene || !this.line.active) return;
    const game = this.scene.game;
    const rect = game.canvas.getBoundingClientRect();
    const renderer = game.renderer.type === Phaser.WEBGL ? "webgl" : "canvas";
    this.line.setText(
      [
        `${renderer}  canvas ${Math.round(rect.width)}x${Math.round(rect.height)} at ${Math.round(rect.x)},${Math.round(rect.y)}  dpr ${window.devicePixelRatio}`,
        `down ${this.dom}  phaser ${this.phaser}  up ${this.ups}  cancel ${this.cancels}  button ${this.hit}`,
        `tap at ${this.where}   inside button: ${this.inside}`,
        `button ${this.target}`,
        `scale ${game.scale.displayScale.x.toFixed(3)},${game.scale.displayScale.y.toFixed(3)}   true ${(game.scale.gameSize.width / rect.width).toFixed(3)},${(game.scale.gameSize.height / rect.height).toFixed(3)}`,
      ].join("\n"),
    );
  }
}
