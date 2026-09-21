import Phaser from "phaser";
import { Boot } from "./scenes/Boot";
import { Dialogue } from "./scenes/Dialogue";
import { Goblin } from "./scenes/Goblin";
import { Mirror } from "./scenes/Mirror";
import { Night } from "./scenes/Night";
import { Review } from "./scenes/Review";
import { Street } from "./scenes/Street";
import { COLOR, HEIGHT, WIDTH } from "./ui/theme";

new Phaser.Game({
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
