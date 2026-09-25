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
 * `updateBounds()`, not `refresh()`. Refresh re-runs the whole scale pass and
 * emits RESIZE, which on WebGL drops and rebuilds textures — called on every
 * tap that throws "reading 'glTexture'" mid-frame. Only the cached canvas
 * rectangle needs to be honest, and that is all this touches.
 */
const rebound = (): void => {
  game.scale.updateBounds();
};

/** A genuine layout change does want the full pass. */
const refit = (): void => {
  game.scale.refresh();
};

for (const event of ["resize", "orientationchange"]) {
  window.addEventListener(event, refit);
}
for (const event of ["scroll", "pageshow", "focus"]) {
  window.addEventListener(event, rebound, { passive: true });
}
document.addEventListener("visibilitychange", rebound);

// The load-bearing one. Phaser queues input events and maps them on the next
// step through a CACHED copy of the canvas's on-screen rectangle. On a phone
// that rectangle moves whenever the URL bar collapses, so the cache goes stale
// and a tap is mapped tens of pixels from where the finger landed. Recomputing
// it in the capture phase means the mapping uses a rect measured this instant.
// Invisible on desktop and in emulation: neither has a chrome bar that moves.
game.canvas.addEventListener("pointerdown", rebound, { capture: true, passive: true });
game.canvas.addEventListener("touchstart", rebound, { capture: true, passive: true });
