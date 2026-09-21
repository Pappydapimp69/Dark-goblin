// Writes every asset out as a real .svg file, so the art can be opened,
// inspected and edited like art rather than only existing as a data URI
// inside a running game.
//
//   npm run art
import { mkdirSync, writeFileSync } from "node:fs";
import { assetManifest } from "../src/art";
import { content } from "../src/content";

const OUT = "art";
mkdirSync(OUT, { recursive: true });

const assets = assetManifest(content);
for (const asset of assets) {
  writeFileSync(`${OUT}/${asset.key.replace(/:/g, "-")}.svg`, asset.svg, "utf8");
}

// A contact sheet, so the whole cast can be looked at in one go — the only
// way to catch two neighbours who happen to have been cut the same.
const sheet = assets
  .filter((a) => a.key.startsWith("figure:") && !a.key.endsWith(":broken"))
  .map((a, i) => {
    const x = (i % 8) * 130;
    const y = Math.floor(i / 8) * 210;
    const name = a.key.slice("figure:".length);
    return `<g transform="translate(${x},${y})">${a.svg.replace(/<\/?svg[^>]*>/g, "")}
      <text x="60" y="196" font-family="Georgia,serif" font-size="13" fill="#a4907f" text-anchor="middle">${name}</text></g>`;
  })
  .join("\n");
const rows = Math.ceil(assets.filter((a) => a.key.startsWith("figure:") && !a.key.endsWith(":broken")).length / 8);
writeFileSync(
  `${OUT}/contact-sheet.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${8 * 130}" height="${rows * 210}" viewBox="0 0 ${8 * 130} ${rows * 210}">
  <rect width="100%" height="100%" fill="#1a1614"/>
  <defs>
    <pattern id="h1" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2="6" stroke="#12100e" stroke-width="1.6" opacity="0.55"/></pattern>
    <pattern id="h2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2="4" stroke="#12100e" stroke-width="1.8" opacity="0.8"/></pattern>
    <pattern id="h3" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-42)"><line x1="0" y1="0" x2="0" y2="5" stroke="#12100e" stroke-width="1.5" opacity="0.5"/></pattern>
  </defs>
  ${sheet}</svg>`,
  "utf8",
);

process.stdout.write(`${assets.length} assets written to ${OUT}/, plus a contact sheet\n`);
