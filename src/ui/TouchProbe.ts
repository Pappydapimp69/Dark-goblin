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
  private readonly line: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    this.line = scene.add
      .text(WIDTH / 2, HEIGHT - 120, "", { ...font(19, CSS.inkDim), align: "center" })
      .setOrigin(0.5, 0)
      .setDepth(9998);

    const canvas = scene.game.canvas;
    for (const type of ["pointerdown", "touchstart", "mousedown"]) {
      canvas.addEventListener(type, () => {
        this.dom += 1;
        this.render();
      }, { passive: true });
    }

    scene.input.on("pointerdown", () => {
      this.phaser += 1;
      this.render();
    });

    this.render();
  }

  /** Called from the button's own handler. */
  countHit(): void {
    this.hit += 1;
    this.render();
  }

  private render(): void {
    const game = this.scene.game;
    const rect = game.canvas.getBoundingClientRect();
    const renderer = game.renderer.type === Phaser.WEBGL ? "webgl" : "canvas";
    this.line.setText(
      [
        `${renderer}  canvas ${Math.round(rect.width)}x${Math.round(rect.height)} at ${Math.round(rect.x)},${Math.round(rect.y)}  dpr ${window.devicePixelRatio}`,
        `taps seen —  dom ${this.dom}   phaser ${this.phaser}   button ${this.hit}`,
      ].join("\n"),
    );
  }
}
