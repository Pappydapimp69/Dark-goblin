import type { Condition, Content } from "../../src/engine/types";

/** Always true. `every` over an empty list is true, so this needs no new DSL. */
export const ALWAYS: Condition = { all: [] };

/**
 * A deliberately bare content set. Phase 1 proves the RULES, so the fixture
 * gives each rule a single obvious lever rather than a playable town — the
 * real content arrives in Phase 3 and runs against these same tests.
 */
export function testContent(overrides: Partial<Content["rules"]> = {}): Content {
  return {
    npcs: [
      {
        id: "tester",
        name: "Tester",
        state: { loops: 0 },
        goalIds: ["tester_goal"],
        tick: [
          {
            id: "world_helps",
            when: { flag: "world_should_help" },
            effects: [{ setFlag: "tester_helped", value: true }],
          },
          { id: "count", when: ALWAYS, effects: [{ addNpc: "tester", key: "loops", delta: 1 }] },
        ],
      },
      {
        id: "fragile",
        name: "Fragile",
        state: {},
        goalIds: ["fragile_life"],
        tick: [
          {
            id: "world_ruins",
            when: { flag: "world_should_ruin" },
            effects: [{ setFlag: "fragile_ruined", value: true }],
          },
        ],
      },
    ],
    slots: [
      { id: "storefront", kind: "storefront", holder: "tester", exists: true },
      { id: "wrecked_shop", kind: "storefront", holder: null, exists: false },
    ],
    goals: [
      {
        id: "tester_goal",
        owner: "tester",
        critical: false,
        label: "tester wants a thing",
        paths: [{ id: "only", complete: { flag: "tester_helped" }, closed: { flag: "tester_blocked" } }],
        adjacentPool: ["tester_adjacent"],
      },
      {
        id: "tester_adjacent",
        owner: "tester",
        critical: false,
        label: "tester settles for less",
        paths: [{ id: "only", complete: { flag: "never_true" }, closed: { flag: "never_true_either" } }],
      },
      {
        id: "fragile_life",
        owner: "fragile",
        critical: true,
        label: "fragile keeps going",
        paths: [
          { id: "hold", complete: { flag: "fragile_safe" }, closed: { flag: "fragile_ruined" } },
          { id: "peace", complete: { flag: "fragile_peace" }, closed: { flag: "fragile_ruined" } },
        ],
      },
      {
        id: "player_goal_a",
        owner: "player",
        critical: false,
        label: "the player wants a thing",
        paths: [{ id: "only", complete: { flag: "player_a_done" }, closed: { flag: "player_a_lost" } }],
      },
      {
        id: "child_goal",
        owner: "child",
        critical: false,
        label: "the child wants a thing",
        paths: [{ id: "only", complete: { flag: "child_done" }, closed: { flag: "child_lost" } }],
      },
    ],
    choices: [
      { id: "self_job", npc: "tester", text: "Take the odd job.", available: ALWAYS, effects: [{ money: 2 }], impacts: [{ target: "player", kind: "self" }] },
      { id: "help", npc: "tester", text: "Lend a hand.", available: ALWAYS, effects: [], impacts: [{ target: "tester", kind: "help" }] },
      { id: "harm", npc: "tester", text: "Take what she needs.", available: ALWAYS, effects: [], impacts: [{ target: "tester", kind: "harm" }] },
      { id: "neutral", npc: "tester", text: "Talk about the weather.", available: ALWAYS, effects: [], impacts: [{ target: "tester", kind: "neutral" }] },
      { id: "fulfil_tester", npc: "tester", text: "Give her what she needs.", available: ALWAYS, effects: [{ setFlag: "tester_helped", value: true }], impacts: [{ target: "tester", kind: "help" }] },
      { id: "fail_tester", npc: "tester", text: "Close the door on her.", available: ALWAYS, effects: [{ setFlag: "tester_blocked", value: true }], impacts: [{ target: "tester", kind: "harm" }] },
      { id: "ruin_fragile", npc: "fragile", text: "Tell them everything.", available: ALWAYS, effects: [{ setFlag: "fragile_ruined", value: true }], impacts: [{ target: "fragile", kind: "harm" }] },
      { id: "schedule_ruin", npc: "fragile", text: "Have a quiet word with the creditor.", available: ALWAYS, effects: [{ schedule: { setFlag: "fragile_ruined", value: true }, inLoops: 1 }], impacts: [{ target: "fragile", kind: "harm" }] },
      { id: "save_fragile", npc: "fragile", text: "Cover what he owes.", available: ALWAYS, effects: [{ setFlag: "fragile_safe", value: true }], impacts: [{ target: "fragile", kind: "help" }] },
      { id: "fulfil_player", npc: "tester", text: "Keep it for yourself.", available: ALWAYS, effects: [{ setFlag: "player_a_done", value: true }], impacts: [{ target: "player", kind: "self" }] },
      { id: "fail_player", npc: "tester", text: "Give it away.", available: ALWAYS, effects: [{ setFlag: "player_a_lost", value: true }], impacts: [{ target: "tester", kind: "help" }] },
      { id: "world_ruiner", npc: "tester", text: "Say nothing, and let it come.", available: ALWAYS, effects: [{ setFlag: "world_should_ruin", value: true }], impacts: [{ target: "tester", kind: "neutral" }] },
      { id: "world_helper", npc: "tester", text: "Put in a word for her.", available: ALWAYS, effects: [{ setFlag: "world_should_help", value: true }], impacts: [{ target: "tester", kind: "neutral" }] },
      { id: "aftermath", npc: "fragile", text: "He doesn't look up.", available: ALWAYS, effects: [], impacts: [{ target: "fragile", kind: "neutral" }], aftermath: true },
    ],
    goblin: {
      questions: [
        { id: "q_keyed", text: "You wanted that. What changed?", forGoals: ["player_goal_a"], answers: [{ id: "a1", text: "Nothing." }, { id: "a2", text: "Everything." }, { id: "a3", text: "I stopped looking." }] },
        { id: "q_open_1", text: "Who did you think about first?", answers: [{ id: "b1", text: "Her." }, { id: "b2", text: "Myself." }, { id: "b3", text: "No one." }] },
        { id: "q_open_2", text: "Was it worth it?", answers: [{ id: "c1", text: "Yes." }, { id: "c2", text: "No." }, { id: "c3", text: "Ask me tomorrow." }, { id: "c4", text: "I don't know." }] },
      ],
      breaks: [{ id: "break_fragile", goalId: "fragile_life", text: "He had one thing. You knew that." }],
      verdicts: { self: ["You lived for yourself."], others: ["You lived for others."] },
    },
    rules: {
      baseRent: 5,
      rentModifiers: [],
      startingMoney: 100,
      startingDebt: 0,
      lifespanMax: 75,
      interactionsPerDay: 10,
      playerGoalPool: ["player_goal_a"],
      playerGoalsAtStart: 1,
      ...overrides,
    },
  };
}
