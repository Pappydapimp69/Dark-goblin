<!-- brain:pointer v2 — managed by `brain link`/`sync`; edits here are overwritten -->
## Cognitive system: Brain (linked via `brain` CLI)
This project is linked to the Brain cognitive system. Do not read the node
repos directly — use the CLI.

**How to invoke it (try in order, use the first that runs):**
1. `brain <cmd>`
2. if `brain` is not found: `python "$HOME/.brain/Brain/bin/brain" <cmd>`
   (Windows PowerShell: `python "$env:USERPROFILE\.brain\Brain\bin\brain" <cmd>`)

When the user asks anything like "query save" / "ask brain X" / "mine this",
run the matching `brain` command yourself — do not make the user type paths.
Before non-trivial work: `brain query <terms>`. To capture lessons, write a
proposal file + `brain sync` (or `brain mine` for a work-list). `brain sync`
reconciles with main. Keep session output minimal.

### Using Brain well (read this before deciding it's empty)
- **Query with 1-2 KEYWORDS, not sentences.** `brain query reachability`, not
  `brain query "ai cannot reach the exit on a walled map"`. The matcher is
  keyword-based; long phrases return 0. **A 0-result query almost always means
  rephrase, not "empty system"** — try broader / single terms first, and read
  the `local:` bucket, not just the shared counts.
- **Re-query at each NEW sub-problem, not only at session start.** Every
  non-trivial bug or decision is its own retrieval trigger.
- **Capture non-bugs too, not only bugs:** reusable pattern -> `ideas`;
  unresolved fork -> `tension`; experiment/synthesis -> `exploration`; a
  committed decision -> an ADR in the build (and if it generalizes, ALSO an
  `ideas` kernel). See `orchestration.md`'s write-back table.
- **At each milestone, produce a Cognitive Update UNPROMPTED** (New Ideas,
  Memory, Tensions, Exploration, Graduation Candidates) — the standing rule in
  `orchestration.md`.
- **Surface any open (red/yellow) tension that touches your work to the user**
  before committing to that fork.
- **Never hand-write a proposal format.** `brain mine` prints the current
  schema verbatim from the memory repo — follow it exactly. A format you
  invent parses as an EMPTY entry and is held on every field at once.
<!-- /brain:pointer -->

# CLAUDE.md — The Dark Goblin (Prototype Build Spec)

You are building a playable prototype of **The Dark Goblin**, a 2D narrative game. This file is the source of truth. If something here conflicts with your instincts, follow this file. If something is genuinely unspecified, make the simplest choice that preserves the rules below and note it in `DECISIONS.md`.

## 0. Working rules

- **Architecture before implementation.** Before writing code for any phase, post the module plan for that phase and wait for approval.
- Build **phase by phase** (section 9). Stop at the end of each phase, run the tests, and summarize what changed.
- The **engine is pure TypeScript with zero Phaser imports**. Rendering never mutates state directly; it dispatches actions to the engine.
- All randomness goes through one **seeded RNG**. Same seed + same inputs = same game.
- **No numbers are ever shown to the player.** Lifespan, score, and slots are hidden. A dev overlay (toggle with the backtick key) may show them.
- Every rule in section 5 must have a unit test.

---

## 1. Concept (for context)

The player lives the same day on repeat and never changes. The town does. NPCs have needs, wants, and goals, and their lives advance between loops based on what the player did. Every choice trades helping yourself against helping others. A goblin appears only when something becomes permanent. When the player's lifespan runs out, the goblin reads back what they did and gives one verdict: you lived for yourself, or for others.

The theme is never stated in-game.

---

## 2. Stack

- **Vite + TypeScript (strict)**
- **Phaser 3** for rendering and input
- **Vitest** for tests
- Static build, `base: './'` in Vite config, for itch.io upload
- Mobile browser and desktop both supported (tap and click)
- Save state in `localStorage` (one slot, JSON-serialized `GameState`)

---

## 3. Project layout

```
/src
  /engine            # pure logic, no Phaser
    types.ts         # all types from section 4
    rng.ts           # seeded RNG (mulberry32)
    conditions.ts    # condition evaluator
    effects.ts       # effect applier
    scoring.ts       # daily meter, clamp, pressure, lifespan loss
    goals.ts         # path checks, fulfill/fail, adjacent rolls, breaks
    world.ts         # end-of-day world tick (NPC advancement, scheduled effects)
    goblin.ts        # nightfall/break triggers, question selection, log
    verdict.ts       # final review computation
    engine.ts        # public API: newGame, interact, sleep, answerGoblin, etc.
    validate.ts      # content + game-start validation
  /content
    npcs.json
    goals.json       # goal pools
    choices.json     # interaction choices
    slots.json
    goblin.json      # question templates, break lines, verdict lines
  /sim
    bots.ts          # selfish, generous, mixed, isolated strategies
    run.ts           # headless runner -> CSV report
  /scenes            # Phaser only
    Boot.ts
    Mirror.ts        # morning: aging portrait
    Street.ts        # 4 locations, NPC sprites
    Dialogue.ts      # choice overlay
    Night.ts         # bills + sleep
    Goblin.ts        # nightfall + break
    Review.ts        # final review
  /ui
    DevOverlay.ts
  main.ts
/tests
  scoring.test.ts
  goals.test.ts
  goblin.test.ts
  determinism.test.ts
DECISIONS.md
```

---

## 4. Data model

```ts
type NpcId = string;          // "baker", "shopkeeper", "builder", "player", "child"
type SlotId = string;

interface GameState {
  seed: number;
  loop: number;                     // day count, starts at 1
  lifespan: { current: number; max: number };   // starts 75/75
  day: DayMeter;
  money: number;
  debt: number;                     // unpaid balance carried to next bill
  npcs: Record<NpcId, NpcState>;
  slots: Record<SlotId, Slot>;
  goals: Record<string, Goal>;
  flags: Record<string, boolean | number | string>;
  scheduled: ScheduledEffect[];     // resolve at world tick
  closedToday: ClosureEvent[];
  ledger: LedgerEntry[];            // every scored event, for verdict
  goblinLog: GoblinEntry[];         // every question + answer + break
  status: "day" | "night" | "goblin_nightfall" | "goblin_break" | "review";
}

interface DayMeter { score: number; max: number; interactions: number; } // starts -1 / 0 / 0

interface NpcState {
  id: NpcId;
  name: string;
  state: Record<string, string | number | boolean>;  // job, home, mood, stage, etc.
  broken: boolean;                  // critical goal failed: story over
  goalIds: string[];
}

interface Slot {
  id: SlotId;
  kind: "storefront" | "job" | "house" | "partner";
  holder: NpcId | null;
  exists: boolean;                  // created slots start false
}

interface Goal {
  id: string;
  owner: NpcId;                     // includes "player" and "child"
  critical: boolean;
  label: string;                    // internal only
  paths: Path[];
  status: "open" | "fulfilled" | "failed";
  adjacentPool?: string[];          // goal template ids to roll on non-critical failure
}

interface Path {
  id: string;
  complete: Condition;              // path succeeds when true
  closed: Condition;                // path is dead when true
}

interface Choice {
  id: string;
  npc: NpcId;
  text: string;                     // what the player says/does
  available: Condition;
  effects: Effect[];
  impacts: Impact[];                // scoring tags, one per NPC affected
}

interface Impact { target: NpcId | "player"; kind: "help" | "harm" | "self" | "neutral"; }

interface ScheduledEffect { atLoop: number; effect: Effect; source: "player" | "world"; }
interface ClosureEvent { goalId: string; owner: NpcId; critical: boolean; causedByPlayer: boolean; }
```

### Conditions (JSON DSL)

```ts
type Condition =
  | { all: Condition[] } | { any: Condition[] } | { not: Condition }
  | { flag: string; eq?: any }
  | { npc: NpcId; key: string; eq?: any; gte?: number; lte?: number }
  | { slotHolder: SlotId; is: NpcId | null }
  | { slotExists: SlotId }
  | { money: { gte?: number; lte?: number } }
  | { loopGte: number }
  | { goalStatus: string; is: "open" | "fulfilled" | "failed" };
```

### Effects (JSON DSL)

```ts
type Effect =
  | { setFlag: string; value: any }
  | { setNpc: NpcId; key: string; value: any }
  | { addNpc: NpcId; key: string; delta: number }
  | { moveSlot: SlotId; to: NpcId | null }
  | { createSlot: SlotId }
  | { money: number }                         // + earn, - spend/give
  | { schedule: Effect; inLoops: number };    // resolves at a future world tick
```

---

## 5. Rules (implement exactly)

### 5.1 The day

- Each day begins with `day = { score: -1, max: 0, interactions: 0 }`.
- The player may take at most **10 interactions** per day. Repeat interactions with the same NPC are allowed and count.
- The day ends when interactions reach 10 **or** the player chooses to sleep.

### 5.2 Scoring an interaction (in this order)

1. Apply the choice's `effects` to state (source = player).
2. `day.max += 1` and `day.interactions += 1`.
3. For each `Impact`:
   - `self` → score +1
   - `help` → score +0
   - `harm` → score −1
   - `neutral` → +0
   - Append each to `ledger`.
4. Run the **goal check** (5.4). Apply goal events:

| Event | score | max |
|---|---|---|
| NPC goal fulfilled, caused by player | +2 | +2 |
| NPC goal failed, caused by player | −2 | +2 |
| Player or child goal fulfilled | +5 | 0 |
| Player or child goal failed | −3 | 0 |

   Goal events not caused by the player change nothing on the meter.
5. **Clamp:** if `score > max`, set `score = max`. This is a reset, not a lock. Later interactions still count (7/7 then a harm → 6/8).
6. If any NPC critical goal failed this step and was caused by the player, set `status = "goblin_break"` (5.6).

### 5.3 End of day (in this order)

1. **Pressure check.** `bill = baseRent + rentModifiers(state) + debt`. Auto-pay `paid = min(money, bill)`; `money -= paid`; `debt = bill - paid`.
   - `paid == bill` → score +1
   - `paid >= bill / 2` → score +0
   - otherwise → score −1
   - Always `day.max += 1`.
2. Clamp again.
3. `loss = day.max - day.score` (never negative after the clamp). `lifespan.current -= loss`.
4. **World tick** (5.5).
5. **Nightfall check** (5.6).
6. If `lifespan.current <= 0` → `status = "review"`.
7. Otherwise, `loop += 1`, reset the day meter, clear `closedToday`, and go to the Mirror scene.

`rentModifiers` reads world state (for example, if the player holds the storefront, rent rises). Define modifiers in content, not in code.

### 5.4 Goal check

Run after every interaction and after the world tick. For each open goal:

- If any path's `complete` is true → **fulfilled**.
- Else if every path's `closed` is true → **failed**.
  - **Non-critical:** roll a replacement from `adjacentPool` with the seeded RNG. The owner keeps going.
  - **Critical, NPC owner:** mark `npc.broken = true`. Their choices become unavailable except one authored "aftermath" choice.
  - **Critical, player owner:** treated as failed (−3), no break.
- Record a `ClosureEvent` for every failure.

**Attribution:** an outcome is `causedByPlayer` if the condition flip happened while applying a player-sourced effect, including scheduled effects whose `source` is `"player"`. Implement by running the goal check immediately after each effect batch and tagging with that batch's source.

### 5.5 World tick

- Resolve all `scheduled` effects whose `atLoop <= loop + 1`, keeping each effect's source.
- Advance NPC tracks using authored per-NPC tick rules in content (for example, the shopkeeper's debt grows each loop unless paid).
- Run the goal check.

### 5.6 The goblin

- **Break (immediate):** fires mid-day when a player-caused NPC critical failure happens. He states what the player did, what they gained, and what they lost, then leaves. **No questions.** Log it.
- **Nightfall:** fires after the day ends **only if** a player-owned or child-owned goal failed that day. Choose 1–3 questions from `goblin.json` templates keyed to the closures. Each question offers 3–4 answers. **Answers never change score or state.** Log question and answer.
- Otherwise, no goblin that night.

### 5.7 Final review

When lifespan hits 0, the goblin reads back, in order:

1. Each Break, as one line
2. Each Nightfall answer the player gave
3. What they took for themselves vs. what they gave, as words, not numbers
4. The child's outcomes, listed separately (if a child exists)
5. The verdict: **self** if `selfPoints > othersPoints`, else **others**
   - `selfPoints` = count of `self` impacts + player goals fulfilled
   - `othersPoints` = count of `help` impacts + player-caused NPC goals fulfilled
   - Child goal outcomes are excluded from both and shown only in step 4.

Then the game ends.

### 5.8 Aging

The Mirror scene shows one of 5 portrait stages based on `lifespan.current / lifespan.max`. That is the only lifespan feedback the player gets.

---

## 6. Content for the prototype

Build exactly this. Write all dialogue in plain, warm, slightly sad small-town voice. Every choice must be tagged with `impacts`.

### Locations (4)

The Storefront, The Market, The Wrecked Building, Your Room.

### Slots

- `storefront` — exists, held by `shopkeeper`
- `wrecked_shop` — does not exist until the builder chain completes

### NPCs (3)

**Baker (`baker`)**
- Goal `baker_shop` (critical: false): own a storefront.
  - Path A: `storefront` holder is baker.
  - Path B: `wrecked_shop` exists and holder is baker.
  - Closed if both slots are held by someone else and neither can change.
  - Adjacent pool: `baker_work_at_shop` (work at whoever holds a shop), `baker_leave_town`.
- Readiness track: needs 3 helpful loops (savings, confidence) before she can take a shop.

**Shopkeeper (`shopkeeper`)**
- Goal `shopkeeper_income` (**critical: true**): keep the storefront and stay solvent.
  - Closed if he loses the storefront while his debt is unpaid.
- Goal `shopkeeper_retire` (non-critical): move near his daughter.
  - Completing it frees the storefront willingly (**shift route**) and fulfills his critical goal peacefully.
- Hurt route: the player can tell his creditor he's behind, which schedules foreclosure in 1 loop. Freeing the storefront this way fails his critical goal: **Break**.

**Builder (`builder`)**
- Goal `builder_work` (non-critical): work again.
  - Needs 2–3 loops of help (tools, encouragement, a first small job).
  - Completing it schedules `createSlot: wrecked_shop` in 2 loops (**help route**).
- Adjacent pool: `builder_odd_jobs`.

### Player goals (start with 2, rolled from pool)

- `player_own_place`: hold any slot of kind `storefront` or `house`.
- `player_clear_debt`: debt is 0 at end of day for 3 consecutive loops.
- `player_be_known`: 3 NPCs in state `trusts_player = true`.

### Money

- Base rent: 5 per loop. Rent modifier: +3 if the player holds a storefront.
- Self-help choices earn 2–4 (odd jobs, selling, haggling).
- Help choices that cost money: give 1–3.

### Goblin content

- 6 Nightfall question templates (for example: "You wanted that. What changed?", "Who did you think about first?"). Each has 3–4 answers with no right one.
- 1 Break line per possible critical failure (only the shopkeeper in this prototype).
- 2 verdict endings, 4 sentences max each.

### Deferred (build schema hooks only)

- Partner slot, child spawn, and the child's linked goals (child goals score as the player's; given-up player goals can seed the child's pool). Do **not** build these in the prototype, but keep `owner: "child"` working in the engine.

---

## 7. Validation

At content load and at `newGame`:

- Every Condition and Effect parses against the DSL.
- Every critical goal has **at least 2 paths** that are not closed at game start.
- Every choice has at least one `impacts` entry.
- Every `adjacentPool` id exists.
- Fail loudly with the file and id.

---

## 8. Tests (required)

`scoring.test.ts` must reproduce this table exactly (bills paid in full unless noted):

| Scenario | Before bills | After bills | Loss |
|---|---|---|---|
| 10 self-helps | 9/10 | 10/11 | 1 |
| 10 self-helps + player goal fulfilled | 10/10 | 11/11 | 0 |
| 10 NPC helps | −1/10 | 0/11 | 11 |
| 10 NPC helps + 2 player-caused NPC goals fulfilled | 3/14 | 4/15 | 11 |
| 5 harms + 1 player-caused NPC goal failed | −8/7 | −7/8 | 15 |
| 0 interactions, bill missed (paid < half) | −1/0 | −2/1 | 3 |
| Clamp: at 7/7, one harm | 6/8 | — | — |

Also test:

- Clamp is applied after every interaction and again after the pressure check.
- Unpaid bill carries into next day's `debt`.
- Non-player-caused goal outcomes do not touch the meter.
- Scheduled player effects keep player attribution.
- Break fires only on player-caused NPC critical failure, and has no questions.
- Nightfall fires only when a player/child goal failed that day.
- Goblin answers do not change state (snapshot before and after).
- Determinism: same seed + same inputs → identical final state.

---

## 9. Build phases

**Phase 1 — Engine core.** Types, RNG, conditions, effects, scoring, goals, world tick, goblin triggers, verdict. All tests in section 8 pass. No Phaser.

**Phase 2 — Headless simulator.** `npm run sim` plays 100 games per bot with random seeds and writes `sim-report.csv` (loops survived, goals fulfilled, breaks, verdict). Bots:
- `selfish`: prefers `self`, harms when it unlocks a player goal
- `generous`: prefers `help`, never harms
- `mixed`: weighted random
- `isolated`: sleeps immediately every day

Print a summary. **Balance target:** the generous bot should survive long enough to see at least one NPC goal fulfilled. If it can't, report it; do not change rules without approval.

**Phase 3 — Content.** Author all JSON in section 6. Validation passes. Sim reruns on real content.

**Phase 4 — Phaser shell.** Mirror → Street → Dialogue → Night → loop. Placeholder art (colored shapes and simple portraits are fine). Tap/click only. Dev overlay.

**Phase 5 — Goblin + Review.** Nightfall and Break scenes with slow text and a pause before he speaks. Review scene. Save/load.

**Phase 6 — Polish pass.** Transitions, sound hooks (no assets needed), itch.io build.

---

## 10. Definition of done (prototype)

- A new player can play from the first morning to the final review with no numbers visible.
- The storefront can reach the baker by all three routes: hurt, help, and shift.
- The Break fires if the shopkeeper is ruined by the player.
- A Nightfall visit happens when a player goal fails.
- The final verdict differs between the selfish and generous bots.
- All tests pass. `npm run build` produces a static folder that runs from itch.io.
