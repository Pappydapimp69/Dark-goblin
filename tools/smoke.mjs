// Drives the BUILT game through one whole loop in a real browser and fails on
// any console error. Tests cover the rules; this covers the thing people
// actually touch — it is what found the aftermath choice appearing before the
// break, eight people standing at a location the game does not draw, and a
// dialogue overlay you could read the street through.
//
//   npm run build && npx vite preview --port 4173 &
//   npm run smoke
//
// CHROMIUM and SMOKE_URL override the defaults.
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "smoke-shots";
const URL = process.env.SMOKE_URL ?? "http://localhost:4173/";
const EXE = process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });

const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/01-boot.png` });

// Boot: tap anywhere
await page.mouse.click(360, 640);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/02-mirror.png` });

// Mirror: "Go out" sits at HEIGHT-260
await page.mouse.click(360, 1280 - 260);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/03-street.png` });

// Street: first location panel's first token. top=90, panelHeight=(1280-90-120-48)/4=255.5
const panelH = (1280 - 90 - 120 - 48) / 4;
const firstPanelY = 90 + panelH / 2;
await page.mouse.click(360, firstPanelY + 16);
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/04-dialogue.png` });

// Dialogue: first choice button at y=300
await page.mouse.click(360, 300);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/05-after-choice.png` });

// Back on Street: go to Your Room (4th panel) and sleep
const fourthY = 90 + 3 * (panelH + 16) + panelH / 2;
await page.mouse.click(360, fourthY + 22);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/06-night.png` });

await page.mouse.click(360, 1280 - 300);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/07-slept.png` });

await browser.close();

if (errors.length) {
  console.error("CONSOLE ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`clean run — ${OUT}/01-boot.png through 07-slept.png`);
