// Rasterises an SVG in the art/ folder to a PNG so it can be looked at.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const name = process.argv[2];
const svg = readFileSync(`art/${name}.svg`, "utf8");
const m = svg.match(/width="(\d+)"\s+height="(\d+)"/);
const [w, h] = [Number(m?.[1] ?? 800), Number(m?.[2] ?? 600)];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: w, height: h } });
await p.setContent(`<body style="margin:0;background:#1a1614">${svg}</body>`);
await p.screenshot({ path: `art/${name}.png` });
await b.close();
console.log(`art/${name}.png  ${w}x${h}`);
