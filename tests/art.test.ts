import { describe, expect, it } from "vitest";
import { GOBLIN_KEY, PORTRAIT_STAGES, assetManifest, brokenKey, figureKey, placeKey, portraitKey, readSpec } from "../src/art";
import { BUILDS, HEADS, PROPS, figureSvg } from "../src/art/figure";
import { TONES, luminance } from "../src/art/ink";
import { portraitSvg } from "../src/art/portrait";
import { content } from "../src/content";

const manifest = assetManifest(content);
const folk = content.npcs.filter((n) => n.role !== "player");

describe("every person can be drawn", () => {
  // A presentation-side lookup that falls back to a placeholder gives no
  // signal when an entry is missing — the figure just draws as something
  // generic and nobody notices. So the spec throws, and the whole cast is
  // walked through it here, exactly as content validation walks the sim ids.
  it("has an art spec that resolves, for all forty-two", () => {
    expect(folk).toHaveLength(42);
    for (const npc of folk) {
      expect(() => readSpec(npc.id, npc.art)).not.toThrow();
    }
  });

  it("refuses a spec naming something the block set does not have", () => {
    expect(() => readSpec("x", { build: "looming", head: "cap", prop: "rope", tone: "ash" })).toThrow(/build/);
    expect(() => readSpec("x", { build: "tall", head: "crown", prop: "rope", tone: "ash" })).toThrow(/head/);
    expect(() => readSpec("x", { build: "tall", head: "cap", prop: "sword", tone: "ash" })).toThrow(/prop/);
    expect(() => readSpec("x", { build: "tall", head: "cap", prop: "rope", tone: "puce" })).toThrow(/tone/);
    expect(() => readSpec("x", undefined)).toThrow(/no art spec/);
  });

  it("puts a figure in the manifest for each of them", () => {
    const keys = new Set(manifest.map((a) => a.key));
    for (const npc of folk) expect(keys.has(figureKey(npc.id))).toBe(true);
  });

  it("cuts a worn-out block only for someone who can actually break", () => {
    const keys = new Set(manifest.map((a) => a.key));
    expect(keys.has(brokenKey("shopkeeper"))).toBe(true);
    expect(keys.has(brokenKey("mara"))).toBe(false);
  });
});

describe("every place can be drawn", () => {
  it("has a backdrop for each location the rules declare", () => {
    const keys = new Set(manifest.map((a) => a.key));
    for (const id of content.rules.locations!) expect(keys.has(placeKey(id))).toBe(true);
  });

  it("refuses a location with no backdrop", () => {
    const broken = { ...content, rules: { ...content.rules, locations: ["storefront", "harbour"] } };
    expect(() => assetManifest(broken)).toThrow(/harbour/);
  });
});

describe("the rest of the set", () => {
  it("cuts all five portrait stages and the goblin", () => {
    const keys = new Set(manifest.map((a) => a.key));
    for (let s = 0; s < PORTRAIT_STAGES; s += 1) expect(keys.has(portraitKey(s))).toBe(true);
    expect(keys.has(GOBLIN_KEY)).toBe(true);
  });

  it("ages the portrait by degree — every stage differs from its neighbour, none is a repeat", () => {
    const stages = [0, 1, 2, 3, 4].map(portraitSvg);
    expect(new Set(stages).size).toBe(5);
  });
});

describe("the blocks themselves", () => {
  // Paths are computed, and a single NaN in a `d` attribute makes the browser
  // drop the whole shape with no error anywhere.
  it("contain no NaN, undefined or empty coordinate", () => {
    const bad = manifest.filter((a) => /NaN|undefined|="\s*"/.test(a.svg)).map((a) => a.key);
    expect(bad).toEqual([]);
  });

  it("are well-formed documents with a viewBox", () => {
    for (const a of manifest) {
      expect(a.svg.startsWith("<svg")).toBe(true);
      expect(a.svg.endsWith("</svg>")).toBe(true);
      expect(a.svg).toContain("viewBox=");
      expect(a.uri.startsWith("data:image/svg+xml,")).toBe(true);
    }
  });

  it("can cut every combination the system allows, not just the ones in use", () => {
    for (const build of BUILDS) {
      for (const head of HEADS) {
        for (const prop of PROPS) {
          const svg = figureSvg({ build, head, prop, tone: "ash" });
          expect(/NaN|undefined/.test(svg)).toBe(false);
        }
      }
    }
  });
});

describe("the palette", () => {
  // Two tones chosen independently can land on the red-green confusion axis at
  // nearly the same luminance, and then only silhouette separates them. This
  // does not fail the build — it records what the palette is relying on.
  it("separates its tones by luminance, or leans on silhouette where it does not", () => {
    const tones = Object.entries(TONES);
    const tight: string[] = [];
    for (let i = 0; i < tones.length; i += 1) {
      for (let j = i + 1; j < tones.length; j += 1) {
        const [an, ah] = tones[i]!;
        const [bn, bh] = tones[j]!;
        if (Math.abs(luminance(ah) - luminance(bh)) < 0.06) tight.push(`${an}/${bn}`);
      }
    }
    // Recorded, not forbidden: the cast is told apart by build and prop first.
    expect(tight.length).toBeLessThanOrEqual(4);
  });

  it("keeps every tone dark enough for pale ink to sit on the night behind it", () => {
    for (const [name, hex] of Object.entries(TONES)) {
      const l = luminance(hex);
      expect(l, name).toBeGreaterThan(0.3);
      expect(l, name).toBeLessThan(0.85);
    }
  });
});
