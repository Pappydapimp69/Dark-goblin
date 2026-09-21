import Phaser from "phaser";
import { COLOR } from "./theme";

/** §5.8: five stages, and the only lifespan feedback the player ever gets. */
export function portraitStage(current: number, max: number): number {
  const ratio = max <= 0 ? 0 : current / max;
  return Math.min(4, Math.max(0, Math.floor((1 - ratio) * 5)));
}

const SKIN = [0xe8c9a0, 0xdcbb92, 0xcaa982, 0xb59372, 0x9d7d61];
const HAIR = [0x4a3728, 0x51402f, 0x6b5a48, 0x8d8175, 0xa9a29a];

/**
 * A face, drawn from shapes. It does not age by getting a new sprite — it
 * narrows, sinks and greys by degrees, so the change between two neighbouring
 * stages is small enough to be unsettling rather than announced.
 */
export function drawPortrait(
  scene: Phaser.Scene,
  x: number,
  y: number,
  stage: number,
  scale = 1,
): Phaser.GameObjects.Container {
  const s = Math.min(4, Math.max(0, stage));
  const t = s / 4;

  const width = (170 - 26 * t) * scale;
  const height = (210 + 10 * t) * scale;
  const skin = SKIN[s] ?? SKIN[0]!;
  const hair = HAIR[s] ?? HAIR[0]!;

  const parts: Phaser.GameObjects.GameObject[] = [];

  parts.push(scene.add.ellipse(0, 0, width, height, skin));
  // Hair thins back off the brow as the stages pass.
  parts.push(scene.add.ellipse(0, -height / 2 + 26 * scale, width * (1 - 0.22 * t), 62 * scale, hair));

  const eyeY = -22 * scale;
  const eyeX = width * 0.23;
  for (const side of [-1, 1]) {
    // The sockets deepen: a shadow that grows while the eye itself shrinks.
    parts.push(scene.add.ellipse(side * eyeX, eyeY + 6 * scale, (34 - 4 * t) * scale, (22 + 8 * t) * scale, 0x000000, 0.12 + 0.16 * t));
    parts.push(scene.add.ellipse(side * eyeX, eyeY, (22 - 5 * t) * scale, (13 - 3 * t) * scale, COLOR.ink));
    parts.push(scene.add.circle(side * eyeX, eyeY, (6 - 1 * t) * scale, 0x2b2118));
  }

  parts.push(scene.add.rectangle(0, 10 * scale, 7 * scale, (34 + 8 * t) * scale, 0x000000, 0.10));

  // The mouth flattens and turns down.
  const mouth = scene.add.rectangle(0, (62 + 6 * t) * scale, (66 - 18 * t) * scale, (7 + 2 * t) * scale, 0x6d4a3e, 0.8);
  mouth.setAngle(6 * t);
  parts.push(mouth);

  // Lines arrive late and only two of them.
  if (s >= 2) parts.push(scene.add.rectangle(0, -66 * scale, 70 * scale, 3 * scale, 0x000000, 0.10));
  if (s >= 3) parts.push(scene.add.rectangle(0, -54 * scale, 52 * scale, 3 * scale, 0x000000, 0.12));

  return scene.add.container(x, y, parts);
}
