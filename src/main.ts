import Phaser from "phaser";
import { assetManifest } from "./art";
import { rasterizeAll } from "./art/raster";
import { content } from "./content";
import { Boot } from "./scenes/Boot";
import { Dialogue } from "./scenes/Dialogue";
import { Goblin } from "./scenes/Goblin";
import { Mirror } from "./scenes/Mirror";
import { Night } from "./scenes/Night";
import { Review } from "./scenes/Review";
import { Street } from "./scenes/Street";
import { COLOR, HEIGHT, WIDTH } from "./ui/theme";

// The blocks are cut before the press starts. Rasterising forty-odd small
// SVGs takes a moment, and index.html is already the game's own dark, so
// there is nothing to see during it.
export const CUT = await rasterizeAll(assetManifest(content));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: COLOR.night,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WIDTH,
    height: HEIGHT,
  },
  scene: [Boot, Mirror, Street, Dialogue, Night, Goblin, Review],
});

// A handle for tools/smoke.mjs, which asserts on live scene state rather than
// on pixels. The dev overlay already exposes far more than this does.
(globalThis as Record<string, unknown>)["darkGoblin"] = game;

/**
 * Phaser maps a pointer into game space through a CACHED copy of the canvas's
 * on-screen rectangle. On a phone that rectangle moves whenever the browser's
 * URL bar collapses or expands, and the cache is not always refreshed in time —
 * so a tap is mapped tens of pixels away from where the finger actually landed
 * and misses whatever it was aimed at. Invisible on desktop and in emulation,
 * because neither has a chrome bar that moves.
 *
 * The capture-phase refresh is the load-bearing one: Phaser queues input events
 * and processes them on the next step, so recomputing the bounds as the event
 * arrives means the mapping uses a rect measured this instant.
 */
/**
 * Keeping the pointer mapping honest on a phone.
 *
 * Phaser turns a finger into game units with `displayScale`, which is
 * gameSize / canvasBounds — and BOTH halves are cached. `updateBounds()`
 * refreshes the rectangle but leaves displayScale stale, which is worth
 * knowing because it fixes nothing on its own: measured on a real Android,
 * a tap on a button at x=360 reported x=455, the y being correct and the x
 * scaled by about 1.27. Only `refresh()` recomputes the scale.
 *
 * But refresh() re-runs the whole scale pass and emits RESIZE, and on WebGL
 * that drops and rebuilds textures — called on every tap it throws on
 * glTexture mid-frame. So: measure the rectangle on every touch, and pay for
 * a refresh only when it has actually moved. On a still page that is never;
 * when the address bar collapses it is once.
 */
let lastRect = "";
const refitIfMoved = (): void => {
  const r = game.canvas.getBoundingClientRect();
  const now = `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
  if (now === lastRect) return;
  lastRect = now;
  game.scale.refresh();
};

for (const event of ["resize", "orientationchange", "pageshow", "focus"]) {
  window.addEventListener(event, refitIfMoved);
}
window.addEventListener("scroll", refitIfMoved, { passive: true });
document.addEventListener("visibilitychange", refitIfMoved);

// Capture phase: Phaser queues input and maps it on the next step, so a rect
// measured as the event arrives is the one the mapping will use.
game.canvas.addEventListener("pointerdown", refitIfMoved, { capture: true, passive: true });
game.canvas.addEventListener("touchstart", refitIfMoved, { capture: true, passive: true });

// The address bar can settle after first paint without firing anything useful.
for (const delay of [100, 400, 1200]) window.setTimeout(refitIfMoved, delay);
