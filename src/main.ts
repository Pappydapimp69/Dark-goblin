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
