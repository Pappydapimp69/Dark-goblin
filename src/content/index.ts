import { validateContent } from "../engine/validate";
import type { Content } from "../engine/types";
import choices from "./choices.json";
import goals from "./goals.json";
import goblin from "./goblin.json";
import npcs from "./npcs.json";
import rules from "./rules.json";
import slots from "./slots.json";

/**
 * The prototype's content, assembled from the JSON in this folder.
 *
 * The roster is 42 townspeople; a town is 8 of them. Ilka, Aldo and Ves are
 * pinned, because §10's three routes to the storefront need those three
 * people; the other five are dealt from the remaining 39 by the game's seed,
 * so no two lives are lived among the same neighbours.
 */
export const content: Content = {
  npcs, slots, goals, choices, goblin, rules,
} as unknown as Content;

// §7: validate at load, not at first use.
validateContent(content);

export const LOCATIONS = ["storefront", "market", "wrecked", "room"] as const;
export type Location = (typeof LOCATIONS)[number];
