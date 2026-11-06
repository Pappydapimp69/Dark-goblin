import Phaser from "phaser";
import type { Store } from "../ui/store";
import { COLOR, CSS, HEIGHT, WIDTH, font } from "../ui/theme";
import { cue, CUES } from "../ui/sound";
import { button, typeOut } from "../ui/widgets";
import { reactionFor } from "../ui/reaction";
import type { Choice, NpcState } from "../engine/types";

/**
 * The greeting is presentational only: read from npc.state, never written
 * back, and never scored. It makes a trusted return read differently without
 * teaching the engine that "greeting" is a rule.
 */
const OPENING = [
  "{name} looks up as you come in.",
  "{name} is in the middle of something, and doesn't stop.",
  "{name} glances at you, then back to the work.",
  "{name} straightens up when they see it's you.",
];
const WARM = [
  "{name}'s face eases, seeing you.",
  "{name} doesn't need to ask why you're here anymore.",
  "There's an ease between you now that wasn't there before.",
  "{name} makes room without being asked.",
];

// Before you know someone, there is nothing to do with them but get to know
// them — and only once a day. These read off the same npc.state keys the
// meeting choices write (known, met_today); nothing here writes back.
const STRANGER = [
  "{name} doesn't know your face.",
  "{name} looks at you the way you look at weather.",
  "{name} nods, the way people nod at strangers.",
  "{name} waits to see what you want.",
];
const MET = [
  "{name} half-remembers you.",
  "{name} seems to place you, after a moment.",
  "{name} gives you the beginning of a smile.",
  "{name} knows your face now, if not much else.",
];
const LATER = [
  "{name} nods. You've already talked today.",
  "{name} is busy. Tomorrow, maybe.",
  "{name} has said what they had to say for today.",
  "{name} lifts a hand. Another day.",
];

/** How well you know someone, from the meeting keys. Undefined `known` means no gate. */
export function acquaintance(npc: NpcState): "stranger" | "met" | "later" | "known" {
  const known = npc.state["known"];
  if (typeof known !== "number" || known >= 2) return "known";
  if (npc.state["met_today"] === true) return "later";
  return known === 0 ? "stranger" : "met";
}

function pick(pool: string[], key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i)) | 0;
  return pool[Math.abs(hash) % pool.length]!;
}

function greetingFor(npc: NpcState): string {
  const stage = acquaintance(npc);
  const pool =
    stage === "stranger" ? STRANGER
    : stage === "met" ? MET
    : stage === "later" ? LATER
    : npc.state["trusts_player"] === true ? WARM : OPENING;
  return pick(pool, npc.id).replace("{name}", npc.name);
}

/** The choice overlay. It dispatches and closes; it decides nothing. */
export class Dialogue extends Phaser.Scene {
  private buttons: Phaser.GameObjects.Container[] = [];
  private responseLine!: Phaser.GameObjects.Text;

  constructor() {
    super("Dialogue");
  }

  create(data: { npcId: string }): void {
    const store = this.registry.get("store") as Store;
    const npc = store.state.npcs[data.npcId];
    const choices = store.choicesFor(data.npcId);
    if (!npc) return this.close();

    const veil = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x120f0d, 0).setOrigin(0, 0).setInteractive();
    this.tweens.add({ targets: veil, fillAlpha: 0.97, duration: 180 });

    // Everything but the veil rises a little as it arrives, so opening a
    // conversation reads as a step toward someone rather than a popup.
    const panel = this.add.container(0, 0).setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, y: 0, duration: 220, ease: "Sine.Out" });
    panel.setY(18);

    const trade = typeof npc.state["trade"] === "string" ? npc.state["trade"] : "";
    panel.add(this.add.text(WIDTH / 2, 150, npc.name, font(40)).setOrigin(0.5));
    if (trade) panel.add(this.add.text(WIDTH / 2, 200, trade, font(24, CSS.inkDim)).setOrigin(0.5));

    if (!npc.broken) {
      panel.add(
        this.add
          .text(WIDTH / 2, 244, greetingFor(npc), { ...font(22, CSS.inkDim), align: "center" })
          .setOrigin(0.5, 0),
      );
    }

    this.responseLine = this.add
      .text(WIDTH / 2, 300, "", { ...font(25, CSS.warm), align: "center" })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    panel.add(this.responseLine);

    const top = 340;
    let y = top;
    for (const choice of choices) {
      const control = button(this, WIDTH / 2, y, choice.text, () => this.pick(store, choice), {
        size: 27,
      });
      panel.add(control);
      this.buttons.push(control);
      y += control.height + 18;
    }

    const leaveButton = button(this, WIDTH / 2, Math.min(y + 30, HEIGHT - 110), "Leave them be", () => this.close(), {
      width: 360,
      size: 24,
      tone: COLOR.dusk,
      muted: true,
    });
    panel.add(leaveButton);
    this.buttons.push(leaveButton);
  }

  private pick(store: Store, choice: Choice): void {
    const before = store.state.money;
    store.interact(choice.id);
    cue(this, store.state.money === before ? CUES.choice : CUES.coin);

    for (const control of this.buttons) control.setVisible(false).setActive(false);

    const line = reactionFor(choice, store.state);
    if (!line) {
      this.close(true);
      return;
    }

    this.responseLine.setAlpha(1);
    typeOut(this, this.responseLine, line, {
      msPerChar: 24,
      onDone: () => {
        this.time.delayedCall(260, () => {
          this.input.once("pointerdown", () => this.close(true));
        });
      },
    });
  }

  private close(moved = false): void {
    const street = this.scene.get("Street") as Phaser.Scene & { resume(): void };
    this.scene.stop();
    this.scene.resume("Street");
    if (moved) street.resume();
  }
}
