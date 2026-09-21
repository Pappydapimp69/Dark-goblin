import type Phaser from "phaser";

/**
 * Sound hooks, with no sound.
 *
 * §9 Phase 6 asks for the hooks and no assets. Every beat that will want audio
 * calls `cue()` now, so adding the files later is a matter of loading them
 * under these keys in Boot — no scene changes, no hunting for the right
 * moment months after writing it.
 *
 * `cue()` is silent and harmless until a sound is actually loaded under the
 * key, so the game sounds exactly as it does today until someone drops files
 * in and never crashes if they drop in only half of them.
 */
export const CUES = {
  /** A control was pressed. */
  tap: "tap",
  /** A choice was taken — the moment a day is spent. */
  choice: "choice",
  /** Money changed hands, either way. */
  coin: "coin",
  /** Moving between places. */
  door: "door",
  /** The day ends. */
  sleep: "sleep",
  /** A face in the mirror, one stage older. */
  mirror: "mirror",
  /** He is here. */
  goblin: "goblin",
  /** Something became permanent. */
  broke: "broke",
  /** The last morning. */
  end: "end",
} as const;

export type Cue = (typeof CUES)[keyof typeof CUES];

export function cue(scene: Phaser.Scene, name: Cue, volume = 0.6): void {
  try {
    if (!scene.sound || !scene.cache.audio.exists(name)) return;
    scene.sound.play(name, { volume });
  } catch {
    // Audio is a courtesy. A browser that refuses it does not stop the game.
  }
}
