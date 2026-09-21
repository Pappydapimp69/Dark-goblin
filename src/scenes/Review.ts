import Phaser from "phaser";
import { content } from "../content";
import { computeVerdict } from "../engine/verdict";
import type { Store } from "../ui/store";
import { COLOR, CSS, HEIGHT, WIDTH, font } from "../ui/theme";
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

/** §5.7, read back in order. Phase 5 slows it down and gives it its pauses. */
export class Review extends Phaser.Scene {
  constructor() {
    super("Review");
  }

  create(): void {
    const store = this.registry.get("store") as Store;
    const verdict = computeVerdict(store.state);
    const total = verdict.selfPoints + verdict.othersPoints;

    this.cameras.main.setBackgroundColor(0x0d0b0a);
    this.cameras.main.fadeIn(900, 0, 0, 0);

    const lines: string[] = [];

    for (const entry of verdict.breaks) {
      const line = content.goblin.breaks.find((b) => b.id === entry.lineId);
      const first = line?.text.split(". ")[0];
      lines.push(first ? `${first}.` : "Someone here was ruined, and you did it.");
    }

    for (const entry of verdict.answers) {
      const question = content.goblin.questions.find((q) => q.id === entry.questionId);
      const answer = question?.answers.find((a) => a.id === entry.answerId);
      if (question && answer) lines.push(`"${question.text}"  —  "${answer.text}"`);
    }

    lines.push("");
    lines.push(`You kept ${inWords(verdict.selfPoints, total)} for yourself.`);
    lines.push(`You gave ${inWords(verdict.othersPoints, total)} away.`);

    if (verdict.childOutcomes.length > 0) {
      lines.push("");
      for (const child of verdict.childOutcomes) {
        lines.push(`The child: ${child.label} — ${child.outcome}.`);
      }
    }

    this.add
      .text(WIDTH / 2, 120, lines.join("\n\n"), { ...font(24, CSS.inkDim), align: "center" })
      .setOrigin(0.5, 0);

    const ending = content.goblin.verdicts[verdict.verdict].join("\n");
    this.add
      .text(WIDTH / 2, HEIGHT - 430, ending, { ...font(29), align: "center" })
      .setOrigin(0.5, 0);

    button(this, WIDTH / 2, HEIGHT - 140, "Again", () => {
      this.registry.remove("store");
      this.scene.start("Boot");
    }, { tone: COLOR.dusk });
  }
}
