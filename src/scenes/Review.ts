import Phaser from "phaser";
import { content } from "../content";
import { computeVerdict } from "../engine/verdict";
import { clear } from "../ui/save";
import type { Store } from "../ui/store";
import { COLOR, CSS, HEIGHT, WIDTH, font } from "../ui/theme";
import { cue, CUES } from "../ui/sound";
import { button } from "../ui/widgets";

/** How much of a life that was, in words. §5.7 forbids the number. */
function inWords(part: number, whole: number): string {
  if (whole === 0) return "nothing at all";
  const share = part / whole;
  if (share >= 0.85) return "almost all of it";
  if (share >= 0.6) return "most of it";
  if (share >= 0.4) return "about half of it";
  if (share >= 0.15) return "some of it";
  return "very little of it";
}

/**
 * §5.7, read back in order: the breaks, the answers, what was taken against
 * what was given, the child kept separate, then one verdict.
 *
 * Paced, one line at a time. Tapping brings the rest at once.
 */
export class Review extends Phaser.Scene {
  private pending: Phaser.Time.TimerEvent[] = [];

  constructor() {
    super("Review");
  }

  create(): void {
    const store = this.registry.get("store") as Store;
    const verdict = computeVerdict(store.state);
    const total = verdict.selfPoints + verdict.othersPoints;

    this.cameras.main.setBackgroundColor(0x0d0b0a);
    this.cameras.main.fadeIn(1200, 0, 0, 0);
    cue(this, CUES.end, 0.5);

    const lines: string[] = [];
    for (const entry of verdict.breaks) {
      const spoken = content.goblin.breaks.find((b) => b.id === entry.lineId);
      const first = spoken?.text.split(". ")[0];
      lines.push(first ? `${first}.` : "Someone here was ruined, and you did it.");
    }
    for (const entry of verdict.answers) {
      const question = content.goblin.questions.find((q) => q.id === entry.questionId);
      const answer = question?.answers.find((a) => a.id === entry.answerId);
      if (question && answer) lines.push(`“${question.text}”\n“${answer.text}”`);
    }
    lines.push(`You kept ${inWords(verdict.selfPoints, total)} for yourself.`);
    lines.push(`You gave ${inWords(verdict.othersPoints, total)} away.`);
    // §5.7 step 4: the child's outcomes, read apart from the verdict. The
    // engine's words for an outcome never reach the player — each goal
    // carries its own line for each ending.
    for (const child of verdict.childOutcomes) {
      const template = content.goals.find((g) => g.id === child.goalId);
      lines.push(template?.childLine?.[child.outcome] ?? `${child.label}.`);
    }

    const shown = lines.slice(-7); // he reads back a life, not a transcript
    const objects = shown.map((text) =>
      this.add
        .text(WIDTH / 2, 0, text, { ...font(23, CSS.inkDim), align: "center" })
        .setOrigin(0.5, 0)
        .setAlpha(0),
    );

    const ending = this.add
      .text(WIDTH / 2, 0, content.goblin.verdicts[verdict.verdict].join("\n"), {
        ...font(29),
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);

    // Sit the ending and the button off the MEASURED height: the verdict lines
    // wrap differently per ending, and a fixed y put "Again" through the last
    // sentence of one of them.
    const again = button(this, WIDTH / 2, 0, "Again", () => this.restart(), {
      tone: COLOR.dusk,
    }).setAlpha(0);
    again.y = HEIGHT - 110;
    ending.y = again.y - again.height / 2 - 40 - ending.height;

    // The read-back stacks off measured heights too: the child's lines wrap
    // to two or three rows. If the page runs out, the oldest lines go first.
    const gap = 26;
    const room = ending.y - 40 - 130;
    const heightOf = (list: Phaser.GameObjects.Text[]): number =>
      list.reduce((sum, o) => sum + o.height, 0) + gap * Math.max(0, list.length - 1);
    while (objects.length > 1 && heightOf(objects) > room) objects.shift()!.destroy();
    let y = 130;
    for (const object of objects) {
      object.y = y;
      y += object.height + gap;
    }

    const reveal = [...objects, ending, again];
    reveal.forEach((object, i) => {
      this.pending.push(
        this.time.delayedCall(700 + i * 900, () =>
          this.tweens.add({ targets: object, alpha: 1, duration: 700 }),
        ),
      );
    });

    // Tap once and the rest of the reading arrives together.
    this.input.once("pointerdown", () => {
      for (const timer of this.pending) timer.remove();
      this.tweens.add({ targets: reveal, alpha: 1, duration: 300 });
    });
  }

  private restart(): void {
    // The life is over and the slot holds its last moment. Starting again
    // means starting again.
    clear();
    this.registry.remove("store");
    this.scene.start("Boot");
  }
}
