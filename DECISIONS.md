# DECISIONS.md — The Dark Goblin

Every entry here is a point where `CLAUDE.md` was silent or under-specified.
Per §0, each takes the simplest choice that preserves the rules.

Format: **D-n — decision** · *why* · *spec ref*

---

## Spec gaps resolved

**D-1 — `player_clear_debt` ("debt 0 at end of day for 3 consecutive loops")
is tracked as `npcs.player.state.debt_clear_streak`, not a flag.**
The Condition DSL's `{flag}` variant supports only `eq`; `{npc,key,gte}`
supports `gte`. §4 already declares `"player"` a valid `NpcId`, so the streak
lives on the player's `NpcState` and the goal path reads
`{npc:"player", key:"debt_clear_streak", gte:3}`. No DSL extension. (§4, §6)

**D-2 — "3 NPCs trust the player" is authored as an explicit `all` of the
three prototype NPCs.**
The DSL has no count-across-NPCs quantifier. With a fixed cast of 3, an `all`
block is exact and needs no new condition kind. Revisit if the cast grows. (§6)

**D-3 — `player_own_place` resolves to `storefront` or `wrecked_shop`.**
No slot of kind `house` exists in the prototype, so "any slot of kind
storefront or house" is authored as an `any` over the two real storefront
slots. (§6)

**D-4 — `shopkeeper_income` gets two authored paths so §7 validation passes.**
§6 describes only its *closed* condition, but §7 requires every critical goal
to have ≥2 paths open at game start. Paths: **A** he still holds `storefront`
and his debt is under the ruin threshold; **B** `flag shopkeeper_retired = true`
(the shift route, which §6 says fulfils the critical goal peacefully). (§6, §7)

**D-5 — On the final day the Nightfall goblin resolves before the Review.**
§5.3 runs the nightfall check (step 5) before the lifespan check (step 6), so
a day that both ends a life and fails a player goal shows the goblin first;
`answerGoblin` then transitions to `review`. (§5.3, §5.6, §5.7)

**D-6 — Baker readiness counts *loops in which she was helped*, not
interactions.** §6 says "3 helpful loops". A per-loop `helped_this_loop` bit is
set by help choices and folded into `readiness` at world tick, then cleared —
so ten helps in one day still counts as one loop. (§5.5, §6)

**D-7 — `rentModifiers` is authored in `content/rules.json`,** not in code, per
the §5.3 note. Prototype content: base 5, `+3` while the player holds a
storefront slot.

## Engineering constraints (from prior lessons — `brain query`)

**D-8 — One seeded RNG (mulberry32); its `{seed, count}` is part of
`GameState` and is saved.** Ambient `Math.random()`/`Date.now()` are banned in
`/src/engine` and `/src/sim`, enforced by a grep test.

**D-9 — Adjacent-pool rolls always draw, then conditionally use.**
A roll skipped on a branch (goal not failed, pool empty, forced single
candidate) shifts the shared stream and desyncs every later draw. The draw
count per goal-check is constant by construction; the result is discarded when
unused.

**D-10 — Determinism is fingerprinted per step, not only at end state.**
`determinism.test.ts` hashes a canonical (sorted-key) serialization of
`GameState` after every interaction, not just at review — an end-state match
hides a mid-run divergence.

**D-11 — `localStorage` is namespaced (`darkgoblin:v1:save`) and every access
is wrapped in try/catch with the restored state re-validated.** A shared host
origin (itch.io, GitHub Pages) otherwise collides with a sibling game, and
sandboxed webviews can throw on the access itself. Unavailable or corrupt
storage degrades to a clean first run, never a white screen.

**D-12 — All meter arithmetic is integer.** The §5.3 half-bill test is written
`paid * 2 >= bill` rather than `paid >= bill / 2`, so no float ever reaches
authoritative state.

## Phase 1 — decisions taken while building the engine

**D-13 — `money` never goes below zero.** The `{ money: n }` effect floors at 0.
Affordability is a choice's `available` condition, not the applier's problem; a
negative balance would poison `paid = min(money, bill)` at the next pressure
check. (§5.3, §6)

**D-14 — A goal event moves the meter only when the player caused it — for
player-owned goals too.** §5.2's table leaves rows 3-4 unqualified but the
sentence under it is a blanket rule, so the two readings disagree. The step
order in §5.3 settles it: the meter is cashed out into lifespan at step 3,
*before* the world tick at step 4, so a goal the world advances cannot change
lifespan under either reading. The event is still written to the ledger, so the
verdict and the goblin still see it — which is what makes `player_clear_debt`
(D-1) worth pursuing even though it completes at a world tick and scores 0.

**D-15 — `RngState` carries `{ seed, state, count }`, not `{ seed, count }`.**
`state` is the generator's live register, so a reload is O(1) instead of
replaying `count` draws. `count` is kept as an assertable trace: a test can see
a draw that was skipped, which is how D-9 is enforced rather than just
documented.

**D-16 — Three files exist that §3's layout does not list:**
`engine/errors.ts` (the shared `ContentError` / `RuleError`, extracted to keep
`validate.ts` out of a cycle with `conditions.ts`), `engine/canonical.ts`
(sorted-key serialization + fingerprint, needed by D-10 and later by save/load),
and `content/rules.json` (D-7's home for rent, and for the numbers §6 states in
prose). `tests/harness.ts` is a test driver, not engine code.

**D-17 — `Choice` gains `aftermath?: boolean`.** §5.4 requires a broken NPC to
keep "one authored aftermath choice", but §4's `Choice` has no field to mark it.

**D-18 — The break can also fire at the end of the day, and the engine gains
`acknowledgeGoblin`.** §5.6 calls the break mid-day, but §6's hurt route works
by *scheduling* foreclosure a loop out, so the critical failure it causes lands
in the world tick — and §10 requires that route to produce a break. A break
therefore fires wherever a player-caused critical failure appears, and records
where play resumes (mid-day, or the rest of end-of-day) so §5.3's remaining
steps still run in order afterwards. `acknowledgeGoblin` exists because a break
has no questions to answer, so `answerGoblin` has nothing to take.

**D-19 — A tie in the final verdict reads as "others".** §5.7 defines self as
`selfPoints > othersPoints` and everything else as others.

**D-20 — `{ all: [] }` is the always-true condition.** `every` over an empty
list is true, so an unconditional choice needs no new DSL variant.

## Phase 2 — decisions taken while building the simulator

**D-21 — Each bot draws from its own RNG stream.** The bot's seed is derived
from the game seed and its own id, so two bots played on seed 7 meet the same
world, but a bot's deliberation never advances the world's stream. A bot
sharing the game's RNG would perturb the world it is supposed to be measuring —
and the harder the bot thinks, the more it would perturb it. Tested: `isolated`
produces a life bit-identical to the same game driven by hand. (§9)

**D-22 — A fifth bot, `human`, alongside §9's four.** §9's four are policies
over `impacts` tags, and `selfish` additionally looks ahead by trial-applying a
choice to see whether it completes a player goal. No player can do either: §0
hides every number, and nobody gets to try a move and take it back. The balance
target in §9 is a claim about what a *person* experiences, so it needs a bot
that plays on what the screen actually shows — who is in front of you, what the
choice says, and the five-stage portrait (§5.8), which is the only lifespan
feedback in the game.

It differs from a policy in three human ways: it keeps returning to whoever it
has been spending time with rather than re-deciding from scratch; it goes to
bed after four to nine interactions instead of spending every day to the last;
and as the face in the mirror ages it drifts from helping to looking after
itself — self-preservation arriving late and gradually, which is the trade the
game is about. It never looks ahead.

§9's four are built exactly as specified and reported unchanged. The fifth is
an addition, not a substitution.

**D-23 — `src/sim/report.ts` holds the simulator's logic; `run.ts` is only the
entry point.** §3's layout lists just `bots.ts` and `run.ts`, but a file that
runs 500 games on import cannot be imported by a test. `run.ts` now does I/O
and nothing else.

**D-24 — Phase 2's balance verdict is provisional.** The simulator runs against
the Phase 1 fixture, where one choice fulfils an NPC goal outright, so the
generous bot clears §9's target in 100% of games trivially. The number that
matters is the other one: **a purely generous life is exactly 7 loops long,
every seed** (−11 lifespan a day against 75). Phase 3's builder chain needs
three loops of help plus a two-loop schedule before the shop exists at all,
which leaves roughly one loop of slack for the baker to take it. Phase 3 should
be authored against that ceiling, and the target re-run on real content before
anyone believes it.
