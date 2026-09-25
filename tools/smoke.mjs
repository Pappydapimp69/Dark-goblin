// Drives the BUILT game through a whole loop in a real browser and fails on
// any console error. Unit tests cover the rules; this covers the thing people
// actually touch — it is what found the aftermath choice appearing before the
// break, eight people standing at a location the game does not draw, and a
// dialogue overlay you could read the street through.
//
//   npm run build && npx vite preview --port 4173 &
//   npm run smoke
//
// It POLLS the live scene rather than sleeping for fixed durations. A headless
// browser renders slowly and Phaser clamps its frame delta, so in-game time can
// run at a third of wall-clock — any fixed wait is a guess that rots.
//
// CHROMIUM and SMOKE_URL override the defaults.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "smoke-shots";
const URL = process.env.SMOKE_URL ?? "http://localhost:4173/";
const EXE = process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const KEY = "darkgoblin:v1:save";

// A REAL viewport, not the game's own 720x1280. At that exact size Phaser's
// scale factor is 1 and the canvas sits at 0,0, so game coordinates and page
// coordinates coincide — which silently excused this driver from ever testing
// the scaling and letterboxing every actual player gets. SMOKE_VIEWPORT
// overrides it (e.g. "390x844" for a phone).
const [VW, VH] = (process.env.SMOKE_VIEWPORT ?? "1440x900").split("x").map(Number);

// SMOKE_TOUCH=1 drives the whole run with taps and NEVER touches the mouse.
// A phone-shaped viewport only proves the layout survives; it proves nothing
// about whether a touch-only player can press anything. Each input the game
// claims to support needs one run forbidden from using any other one's API.
const TOUCH = process.env.SMOKE_TOUCH === "1";

const browser = await chromium.launch({ executablePath: EXE });
const context = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: TOUCH ? 3 : 1,
  hasTouch: TOUCH,
  isMobile: TOUCH,
});
const page = await context.newPage();

/** The only place input is produced. Under SMOKE_TOUCH the mouse is unreachable. */
const poke = (x, y) => (TOUCH ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));

const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

// §10's first line: a player goes from the first morning to the final review
// with no numbers visible. Every string the game draws is collected as it is
// drawn, and checked at the end.
const everythingSeen = new Set();

/** What the running game is doing right now, read off the live scene graph. */
const peek = async () => {
  const seen = await page.evaluate(() => {
    const game = globalThis.darkGoblin;
    if (!game) return { scenes: [] };
    const scenes = game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key);
    // Buttons are Containers holding their label, so this has to recurse.
    // The temporary touch probe prints diagnostics, digits included. It is
    // named so the "no numbers reach the player" check can skip it, and that
    // exemption disappears with the probe rather than weakening the check.
    const collect = (nodes) =>
      nodes.flatMap((n) =>
        n.name === "touch-probe" ? [] :
        n.type === "Text" ? [n.text] : Array.isArray(n.list) ? collect(n.list) : [],
      );
    const texts = game.scene.scenes
      .filter((s) => s.scene.isActive())
      .flatMap((s) => collect(s.children.list))
      .filter((t) => t.length > 0);
    const settling = game.scene.scenes
      .filter((s) => s.scene.isActive())
      .some((s) => s.cameras?.main?.fadeEffect?.isRunning || s.cameras?.main?.panEffect?.isRunning);
    let save = null;
    try { save = JSON.parse(localStorage.getItem("darkgoblin:v1:save")); } catch { /* blocked */ }
    return { scenes, texts, settling, loop: save?.state?.loop ?? null, status: save?.state?.status ?? null };
  });
  for (const text of seen.texts) everythingSeen.add(text);
  return seen;
};

async function until(what, predicate, ms = 25_000) {
  const deadline = Date.now() + ms;
  for (;;) {
    const seen = await peek();
    if (predicate(seen)) return seen;
    if (Date.now() > deadline) {
      errors.push(`timed out waiting for ${what}; saw ${JSON.stringify(seen).slice(0, 300)}`);
      return seen;
    }
    await page.waitForTimeout(150);
  }
}

const on = (key) => (s) => s.scenes.includes(key) && !s.settling;
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

/**
 * Click a thing by its LABEL, not by where it was last time. The town is dealt
 * fresh each run, so a panel can hold two people or five and every fixed
 * coordinate is a guess about a world that has already changed.
 */
async function press(label) {
  const spot = await page.evaluate((wanted) => {
    const game = globalThis.darkGoblin;
    const labelsOf = (node) => {
      if (node.type === "Text") return [node.text];
      if (Array.isArray(node.list)) return node.list.flatMap(labelsOf);
      return [];
    };
    // Walk the whole tree, not just the top of it — a control may be nested in
    // a container for animation, and its x/y is then LOCAL. Ask the object for
    // its world transform rather than assuming it is already world space.
    const find = (nodes) => {
      for (const node of nodes) {
        if (node.input && labelsOf(node).includes(wanted)) return node;
        if (Array.isArray(node.list)) {
          const deeper = find(node.list);
          if (deeper) return deeper;
        }
      }
      return null;
    };
    for (const scene of game.scene.scenes.filter((s) => s.scene.isActive()).reverse()) {
      const node = find(scene.children.list);
      if (!node) continue;
      // Game space -> page space. The canvas is scaled and offset by the
      // Scale Manager, so a game coordinate is not a page coordinate.
      const m = node.getWorldTransformMatrix();
      const rect = game.canvas.getBoundingClientRect();
      return {
        x: rect.x + m.tx * (rect.width / game.scale.gameSize.width),
        y: rect.y + m.ty * (rect.height / game.scale.gameSize.height),
      };
    }
    return null;
  }, label);

  if (!spot) {
    errors.push(`nothing labelled "${label}" to press`);
    return false;
  }
  await poke(spot.x, spot.y);
  return true;
}

/** The name of someone actually standing in the street this run. */
const someoneOut = () =>
  page.evaluate(() => {
    const game = globalThis.darkGoblin;
    const street = game.scene.getScene("Street");
    // A person token is an interactive container holding a figure image and
    // one name label. The Sleep button is the other interactive container in
    // the street, so it is named and skipped rather than counted on shape.
    const named = street.children.list
      .filter((n) => n.input && Array.isArray(n.list))
      .flatMap((n) => n.list.filter((c) => c.type === "Text").map((c) => c.text))
      .filter((label) => label && label !== "Sleep");
    return named[0] ?? null;
  });

await page.goto(URL, { waitUntil: "networkidle" });

// Always drive the fresh-start path: a save left over from a previous run puts
// "Go on" where "Begin" is expected.
await page.evaluate(() => { try { localStorage.clear(); } catch { /* blocked */ } });
await page.reload({ waitUntil: "networkidle" });
await until("the title", on("Boot"));
await shot("01-boot");

await press("Begin");
await until("the mirror", on("Mirror"));
await shot("02-mirror");

await press("Go out");
await until("the street", on("Street"));
await shot("03-street");

const neighbour = await someoneOut();
if (!neighbour) errors.push("nobody was standing in the street");
await press(neighbour);
await until(`a conversation with ${neighbour}`, on("Dialogue"));
await shot("04-dialogue");

const offered = (await peek()).texts;
const firstChoice = offered.find((t) => t.length > 12 && t !== "Leave them be");
await press(firstChoice);
await until("the street again", (s) => on("Street")(s) && !on("Dialogue")(s));
await shot("05-after-choice");

await press("Sleep"); // in Your Room
await until("nightfall", on("Night"));
await shot("06-night");

await press("Sleep");
await until("a new morning", (s) => s.loop === 2);
await shot("07-slept");

const stored = await page.evaluate((k) => { try { return localStorage.getItem(k); } catch { return null; } }, KEY);
if (!stored) errors.push("no save was written after a full day");
else if (JSON.parse(stored).schema !== 1) errors.push(`save schema is ${JSON.parse(stored).schema}, expected 1`);

// The save has to survive the thing people actually do: close it and come back.
await page.reload({ waitUntil: "networkidle" });
await until("the title, with a save waiting", on("Boot"));
await shot("08-returned");

await press("Go on");
await until("the life continuing", (s) => !on("Boot")(s) && s.loop === 2);
await shot("09-resumed");

/** Park the game on a state a scripted click-through cannot reliably reach. */
async function parkOn(name) {
  const envelope = readFileSync(`${OUT}/${name}.json`, "utf8");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, envelope]);
  await page.reload({ waitUntil: "networkidle" });
  await until("the title", on("Boot"));
  await press("Go on");
}

await parkOn("goblin_nightfall");
await until("the goblin", on("Goblin"));
// He is there and has not spoken yet — the pause is the whole effect.
const silent = await peek();
if (silent.texts.length > 0) errors.push(`the goblin spoke before his pause: ${silent.texts.join(" | ")}`);
await shot("10-goblin-pause");

// Wait for the line to SETTLE, not for its first character — polling catches
// a typewriter mid-word and any assertion on that first sighting is a lie.
const spoken = await until(
  "his question and his answers",
  (s) => on("Goblin")(s) && s.texts.filter((t) => t.length > 8).length >= 3,
);
await shot("11-goblin-spoken");
if (!spoken.texts.some((t) => t.endsWith("?"))) {
  errors.push(`the goblin's question never finished: ${JSON.stringify(spoken.texts)}`);
}

await parkOn("review");
await until("the review", on("Review"));
await poke(VW / 2, VH / 2); // one tap brings the rest of the reading
await until("the verdict", (s) => s.texts.some((t) => /lived for/.test(t)));
await shot("12-review");

const numbers = [...everythingSeen].filter((t) => /\d/.test(t));
if (numbers.length > 0) {
  errors.push(`a number reached the player: ${JSON.stringify(numbers)}`);
}
console.log(`${everythingSeen.size} distinct strings drawn, none of them numeric`);

await browser.close();

if (errors.length) {
  console.error("SMOKE FAILURES:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`clean run at ${VW}x${VH} via ${TOUCH ? "TOUCH" : "mouse"} — ${OUT}/01-boot.png through 12-review.png`);
