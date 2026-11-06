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

## Phase 3 — decisions taken while authoring the town

**D-25 — A roster of 42, a town of 8.** §6 names three people; the roster is
42 and each seed deals 8 of them. Ilka (baker), Aldo (shopkeeper) and Ves
(builder) are pinned, because §10's three routes need those three present.

The whole roster is instantiated into `GameState`, not just the town, and each
`NpcState` carries `present`. A condition may name anyone, so everyone has to
resolve; absence gates what you can do, not what exists. Absent people offer no
choices, do not tick, and their goals never move, because nothing in play
touches their state. The alternative — instantiating only the town — would
make `{ npc: "sofie", … }` throw in a life Sofie is not part of, which turns an
ordinary authoring reference into a crash.

**D-26 — A consequence rides on the choice that causes it, never on a tick
rule.** §6 says completing the shopkeeper's retirement frees the storefront,
but a goal has no effects on completion. Routing that through a world-tick rule
("when `shopkeeper_retire` is fulfilled, free the slot") would work mechanically
and destroy the attribution: the freeing would be world-sourced, the baker's
goal would complete un-caused, and the player would get no credit for the
kindest route in the game. So `shop_help_him_go` sets the flag and moves the
slot itself, inside the player's own effect batch. Same for the builder's first
job, which schedules the rebuild from the choice.

**D-27 — The engine mirrors `debt` and `money` onto `npcs.player.state` at the
pressure check.** D-1 puts the debt-free streak on the player's NpcState, but
content cannot *read* debt: the DSL has `{ money }` and no `{ debt }`. Rather
than add a variant, the pressure check writes both onto the player, which the
existing `{ npc, key, lte }` can already see. The engine knows nothing about
what any goal does with it; the streak rules live in `npcs.json`.

**D-28 — Trust is counted by splitting each person's help in two.** D-2
authored "3 NPCs trust the player" as an explicit `all` over a fixed cast of
three. A rolled town of 8 from 42 kills that. Instead every person has a
`_help_first` (available only while they do not trust you, and the only one
that increments `player.trust_count`) and a `_help_again`. The counter reads
with `{ npc: "player", key: "trust_count", gte: 3 }` — the same shape as D-1,
and still no new DSL. It also reads better: the first time you help someone is
not the fifth.

**D-29 — `rules.trackedGoals` names the chains the balance report follows,** so
the simulator needs no knowledge of the town. §9's target only asks whether
*any* NPC goal completed, which the townsfolk satisfy for two helps; the
tracked list is what asks the real question.

**D-30 — The human bot's attachment is sticky (0.6), not absolute.** It was
first written to always return to its most-visited person. That is obsession,
not attachment, and it was a bug in the measuring instrument, not a finding:
it reported that a realistic player completes the baker's chain in 0% of lives
and the builder's in 16%. Softening the lock to a 0.6 chance of returning —
with drift to whoever else is in front of you — moved those to 12% and 62%.
A bot used to judge a design is code under test like any other, and an argmax
in a behavioural model is a red flag.

## Phase 4 — decisions taken while building the shell

**D-31 — `src/ui/store.ts` is the only seam.** Scenes read `store.state` and
call `interact` / `sleep` / `answer` / `acknowledge`. Nothing under `/scenes`
touches `GameState`, so the render layer has no way to quietly invent a rule.
A test asserts the store replaces state rather than mutating it, and another
greps `src/engine` for Phaser imports — §2's rule, now enforced rather than
merely intended.

**D-32 — `"night"` is a scene, not an engine status.** §4 lists `"night"` in
`GameStatus` but §5.3's flow never enters it: `sleep()` runs the whole
end-of-day and comes out at the next morning, a goblin, or the review. The
Night scene is the UI beat before that call. The status stays in the union
because `sceneFor` must be exhaustive, and it is the honest place to grow one
if end-of-day ever needs to pause.

**D-33 — Goblin and Review are built plain here, not deferred to Phase 5.**
§9 gives them to Phase 5, but a break can fire on the first afternoon, so
leaving them out would leave the loop open. They work; Phase 5 owes them the
slow text, the pause before he speaks, and save/load.

**D-34 — Locations are declared in `rules.json` and validated.** Found by
playing the built game: eight townspeople were standing at `"street"`, which is
not one of §6's four locations. They were dealt into town and drawn nowhere —
in the game and unreachable, with nothing failing. Content now declares its own
locations and `validateContent` rejects a person standing outside them.

**D-35 — `availableChoices`' aftermath guard was asymmetric.** It hid a broken
person's ordinary choices but never hid the aftermath line, so Aldo offered
"He is sitting on the step. He doesn't look up." on the first morning. §5.4
means the aftermath line replaces the others, which is one condition, not two:
`npc.broken !== (choice.aftermath === true)`.

**D-36 — The portrait ages by degree, not by five drawings.** §5.8 asks for
five stages; drawing five faces would make each step an announcement. One face
is drawn from shapes parameterised on the stage, so the skull narrows, the
sockets deepen while the eyes shrink, the hair recedes and greys, and two lines
arrive late. Neighbouring stages differ slightly, which is the point.

**D-37 — `tools/smoke.mjs` drives the built game in a real browser** through a
whole loop and fails on any console error. It found all three Phase 4 bugs;
91 unit tests found none of them, because none of them was a rule. A green
build is not a running game.

## Phase 5 — decisions taken while building the goblin, the review and the save

**D-38 — The version gate branches three ways, not one.** A dispatcher written
as `schema < LATEST` treats a *missing* version and a version from a *later*
build identically to "already current": both fail the comparison and fall
through, handing unmigrated or unknown data to the game. `load()` therefore
separates invalid, newer, older and current explicitly. A newer save is left on
disk untouched rather than overwritten — it belongs to a build that can read it.

**D-39 — A save is checked by crossing the real format, then by meaning.** A
round trip proves the serialiser agrees with itself; it does not prove the
restored ids still resolve. So `isGameState` checks shape, then that every npc,
slot and goal id still exists in today's content, then runs `availableChoices`
against it — the cheapest end-to-end proof that the engine will still accept
the thing. The tests assert on `canonical()` after a real `JSON` round trip,
because a field holding `undefined` survives a property read and vanishes at
`stringify`.

**D-40 — Every change is a save point.** The game is a loop of short days; a
player who closes the tab mid-afternoon should return to that afternoon. The
store writes on every commit. A failed write never throws — a game that cannot
save still plays.

**D-41 — A save that cannot be opened is said out loud, once.** A player who
had a save and is silently dropped into a fresh start reads that as lost data,
not as a format they have outgrown. Boot prints one quiet line naming what
happened, and only when there was something there.

**D-42 — The pause is the effect, and every slow line can be skipped.** §9 asks
for "slow text and a pause before he speaks": he arrives, his eyes open, and
then nothing happens for 1.4 seconds before a word appears. A tap finishes any
line at once — unskippable slow text is a tax on fast readers and on anyone
seeing it a second time.

**D-43 — The review positions off measured text height.** The two endings wrap
to different heights, and a fixed y put "Again" through the last sentence of
one of them.

**D-44 — The smoke driver polls live scene state and clicks by label.** Two
fixed assumptions broke it, both the same mistake in different clothes. It
slept for wall-clock durations, but a headless browser renders slowly and
Phaser clamps its frame delta, so in-game time ran at roughly a *third* of real
time and the goblin appeared mute — the game was fine, the wait was a guess.
And it clicked person tokens at computed coordinates, but the town is dealt
fresh every run, so a panel holding four people instead of two moved everything.
It now waits on the thing it actually cares about and finds controls by their
label. It also asserts on the SETTLED text, never the first sighting: polling
catches a typewriter mid-word, and asserting on that is a lie.

**D-45 — `globalThis.darkGoblin` exposes the game to the smoke driver,** so it
can assert on live scene state rather than on pixels. The dev overlay already
exposes far more.

## Open finding for the designer (§9 posture: report, do not tune)

**A life in which the player does nothing is read back as generosity.** §5.7
gives the verdict as self when `selfPoints > othersPoints` and others
otherwise, so 0–0 resolves to "others" (D-19) and the review says "you gave it
away" to someone who gave nothing. The rule is the spec's, so it stands. If it
should read differently, the fix is a third ending for an empty life rather
than a change to the comparison.

**Why an empty life outlives a generous one (measured).** Under §5.2–5.3
each day's life loss is an identity:
`2 + helps + neutrals + 2·harms + (goal max − goal score, before the bill) − bill score`.
It matches the engine on 7,499 of 7,627 bot-days, and every miss is a clamp day.
A help is +0 against +1 max, so each one costs a life. A self act (+1/+1), a
finished NPC goal (+2/+2) and an idle day cost nothing beyond the fixed 2 and
the bill. So a day of doing nothing costs exactly what a day of pure
selfishness costs (1 with the bill paid). Giving costs 13 and lasts about 6
days; sleeping through life lasts 27. Player goals that fail overnight cost no
life at all, because the world tick runs after the day is cashed out (step 3
before step 4). The spec's own table implies all of this, so it stands; whether
withdrawal should be the safest life is open as Brain tension T202.

## Phase 6 — decisions taken in the polish pass

**D-46 — Sound hooks exist; sound does not.** §9 asks for the hooks with no
assets. `cue()` no-ops unless a clip is actually loaded under the key, so every
beat that will want audio already calls it and adding files later is a matter
of loading them in Boot — no scene changes, and no hunting months later for
where the right moment was. Half a set of files is as safe as none.

**D-47 — The dialogue rises as it arrives.** Opening a conversation fades the
veil and lifts the panel eighteen pixels, so it reads as a step toward someone
rather than a popup. This nested the buttons in a container, which broke the
smoke driver a third time — see D-48.

**D-48 — The smoke driver finds controls by walking the whole tree and asking
for world transforms.** Nesting buttons inside a container for the animation
hid them from a harness that only looked at a scene's top-level children, and
their coordinates became local. This is the third time one instrument has been
wrong about a moving world (D-30's argmax, D-44's fixed waits and coordinates),
and the shape is always the same: an assumption about structure that was true
when the harness was written. It now recurses and calls
`getWorldTransformMatrix()`, so legitimate scene structure cannot break it.

**D-49 — "No numbers are ever shown" is checked, not asserted by hand.** The
smoke driver collects every string the game draws across a whole playthrough,
the goblin and the review included, and fails if any of them contains a digit.
§0's hardest rule to hold by discipline is the easiest to hold mechanically:
52 distinct strings, none numeric.

**D-50 — The itch build is verified from a nested path.** `base: './'` makes
asset references relative, but `vite preview` serves from a domain root, which
is exactly the case where an absolute path would still work. `verify:itch`
unpacks the shipping zip under `/html/<id>/` and plays the whole game there,
the way itch actually serves it.

## Visual assets — decisions taken cutting the blocks

**D-51 — The art is source, not files.** Every asset is SVG assembled by code
in `src/art`, handed to the game as a texture and written out to `art/` by
`npm run art`. It is diffable, it scales to any screen, there are no binaries
in the repository, and — the reason that matters — it can be *composed*.

**D-52 — Forty-two people is a system, not forty-two drawings.** Six builds,
six head coverings, twelve carried objects, five cloth tones. A town is eight
people dealt from the roster, so what has to read is *individual* and *trade*,
not portraiture. Colour is the last cue rather than the first: two palettes
chosen independently can land on the same colour-vision confusion axis at
nearly the same luminance, and at that point only silhouette separates them.
So silhouette carries, and a test records which tone pairs are relying on that.
Ilka, Aldo and Ves get bespoke marks — an apron, a ledger, a plank — which is
the escape hatch for anyone the composition would render as a stranger.

**D-53 — The portrait stays parametric.** This is the one place "add visual
assets" cut against a decision already made. D-36 made the face parametric so
that neighbouring stages differ only slightly; five authored illustrations
would turn every morning into an announcement, and §5.8 makes this the only
lifespan feedback in the game. It is now a woodcut, but still one block
re-inked at five pressures rather than five drawings.

**D-54 — A covering is drawn in two parts, behind the skull and in front of
it.** The first version drew each head covering as one shape over the head,
which buried the face: a headscarf and a hood both enclose a head, and the two
marks that make a figure a person are the first thing they cover. Nine of the
forty-two had no face at all, which the contact sheet showed at a glance and
no test would ever have caught. The mass now goes behind and only the near
edge — a brim, a drape, a fringe — comes back over, always clear of the eyes.

**D-55 — Builds are dealt round-robin over the cast, not by hash-modulo.** A
modulo of a hash is uniform over ids, not over forty-two of them: the first
deal gave thirteen bent figures against three tall ones, and a town of eight
drawn from that looks like every other town.

**D-56 — The SVGs are rasterised before the game is constructed, not loaded.**
Phaser's `load.svg` runs a data URI through `atob`, so a percent-encoded
document kills the game before the first scene — nothing rendered at all.
Rather than switching to base64 and staying inside a loader that clearly did
not expect this, each asset goes through an `Image` and a canvas in `main.ts`,
and Boot registers the results as textures. It is simpler, it gives exact
control over raster size, and it cannot be broken by the loader's opinions.

**D-57 — Every art spec is narrowed loudly, and the whole cast is walked
through it.** A presentation-side lookup that falls back to a placeholder
gives no signal when an entry is missing — the figure just draws as something
generic for months. `readSpec` throws, a test walks all forty-two, and another
cuts every build/head/prop combination the system allows. Two more checks earn
their place for procedural art specifically: no asset may contain `NaN` (one
in a path makes a browser drop the shape silently) and every document must be
well-formed with a viewBox.

**D-58 — The smoke driver waits for the camera to settle before it
photographs.** Screenshots were landing mid-fade, which made every scene look
murkier than it is and nearly sent me tuning the palette to fix a problem that
did not exist. Same mistake as D-44 and D-48, now about pixels: it polled for
"the scene is active" when it meant "the scene has finished arriving".

**D-59 — The goblin's eye halo is derived from the block's own coordinates.**
Placed by eye, it sat nineteen pixels off the lights cut into the drawing, and
he had four eyes.

## Deployment

**D-60 — Pages is served from an orphan `gh-pages` branch, not from a
workflow.** Both work, and a GitHub Actions workflow would redeploy on every
push, but it needs Pages set to *GitHub Actions* as its source AND a token
permitted to write `.github/workflows/`, and it fails invisibly if either is
missing. A branch holding the built files needs one settings change, no Actions
minutes, and it is live within a minute of being enabled. `npm run deploy`
rebuilds and force-pushes it; the branch shares no history with the source and
nothing of value lives there.

**D-61 — The save key was already namespaced, and on Pages that stops being
housekeeping.** GitHub Pages serves every project of one account from a single
origin — the project name is only a path, while `localStorage` is scoped to the
origin. Two games shipped by the same author share a save slot unless their
keys are namespaced, and with a schema guard in place the collision presents to
a player as "no save" rather than as a conflict, which reads as lost data.
`darkgoblin:v1:save` (D-11) was chosen for exactly this and is now load-bearing.

**D-62 — The Pages URL keeps the repository's casing.** The site is at
`/Dark-goblin/`, not `/dark-goblin/`; the lowercase form 404s even though every
git remote, clone path and API call in this project uses it and GitHub resolves
repository URLs case-insensitively. Only the Pages path is strict. Worth
knowing because the failure is indistinguishable from "Pages is not enabled
yet" — same 404, and you can watch a successful `pages build and deployment`
run complete while still looking at one.

**D-63 — Touch gets its own smoke run, forbidden from the mouse.** A
phone-shaped viewport proves the layout survives a narrow screen and nothing
more; it says nothing about whether a touch-only player can press anything.
`SMOKE_TOUCH=1` produces every input through `touchscreen.tap` and cannot reach
the mouse, because the driver's one input helper is the only place events come
from. The rule generalises: each input a game claims to support needs one run
that is forbidden from using any other input's API.

**D-64 — Headless cannot reproduce a mobile chrome bar, and that is a
diagnosis, not an obstacle.** Five viewports, four pixel ratios, emulated touch
on phone and tablet, and the bytes GitHub actually serves all passed while the
game was unplayable on a real Android. No headless browser has an address bar
that collapses, so the canvas rectangle never moves and the stale-bounds bug
cannot occur. "Green in every harness, broken on device" should be read as
naming the category — a mobile viewport condition the harness does not model —
rather than as a reason to keep widening the harness.

**D-65 — Hit testing is done in `widgets.ts`, not by Phaser.** Measured on a
real Android: a tap reported at 354,858 against a button spanning x 60-660,
y 808-892 — inside by any reading — with Phaser seeing both the press and the
release, nothing cancelled, and the Container's handler never firing. Phaser's
Container hit test was refusing a point inside its own hit area, on that device
only, after the coordinate mapping had already been proven correct.

Every control now registers its rectangle with one scene-level dispatcher that
does the containment itself: four comparisons, no framework hit test, nothing
that can disagree with itself across devices. Later controls take priority over
earlier ones, a release only fires the control its press armed, and hover is
skipped while a pointer is down so touch never triggers it. Controls still call
`setInteractive` so the smoke driver can find them by label, but nothing binds
to their own pointer events — there is exactly one path from a touch to a
handler.

**D-66 — Three things had to be right before a tap worked, and each hid the
next.** The viewport units (`100dvh`), then the pointer mapping (`displayScale`
is cached and only `refresh()` recomputes it, but refresh per-tap drops WebGL
textures, so refresh only when the rect has moved), then the hit test itself.
Each fix was necessary and none was sufficient, and after each one the symptom
was unchanged — "tapping Begin does nothing" — which is worth remembering the
next time an unchanged symptom is taken as evidence that a fix did nothing.

## Dialogue Reactivity

**D-67 — The response line is content, not engine.** `Choice.response` is an
optional string shown by `Dialogue.ts` after `interact()` returns; the engine
never reads it, so it cannot affect scoring or determinism. The ambient
greeting above the choice list is the same kind of thing: read straight from
`npc.state.trusts_player` in the scene, nothing written back. A broken NPC gets
no greeting because their aftermath choice already carries the whole of what's
left to say.

**D-68 — Hidden dialogue buttons must also be inactive.** The repo's mobile
touch fix routes taps through scene-level hotspots in `widgets.ts`, where a
control is considered live by `active`, not by visibility. When a response line
is typing, old choices are both hidden and deactivated so their invisible
hotspots cannot eat the tap that should advance the conversation.

**D-69 — Every reaction line belongs to one person and one act.** The first
pass of `Choice.response` drew 175 lines from 29 shared templates with the
name swapped in, so "Something in Otto eases, just slightly" and "Something
in Wilhelm eases, just slightly" were the same line. Measured over the sim
seeds (`npx vite-node tools/repeat-audit.ts`), 36% (human bot) to 64%
(generous bot) of the reactions a life heard were lines it had already heard
from someone else — the town reading as one voice, against §1's "the town
changes". Each line is now written for its choice and names something of
that person's trade or what happens next. A blind reader given 50 lines with
names masked placed 47 with the right person; word overlap with the choice
text placed only 15%, because the lines describe consequence rather than
restating the act — so overlap is the wrong instrument for this.
`tests/responses.test.ts` fails if two people ever share a line again.

## v2 — the partner and the child

§6 deferred these and asked only for schema hooks; v2 builds them. Every
choice below was taken without a ruling from the designer, on the evidence
noted, and each is easy to reverse.

**D-70 — The child is an arrival, not a new effect.** No effect kind was added
to §4's DSL. An `NpcDef` may carry `arrives: Condition`; such a person is never
dealt into the opening town and comes into town at the first world tick on
which the condition holds. Asking Wren to stay schedules `child_due` two loops
out (player-sourced), so the child is first seen on the morning two days after
the asking. Arrivals run last in the tick and stamp `arrivedOn`, which the
Mirror reads for its one line on that first morning.

**D-71 — One dedicated partner, always in town.** Measured over 500 seeds,
only the three named people are in town every life; the other five are dealt
from thirty-nine. A partner drawn from the townsfolk would be missing from most
lives, and the baker or builder would tangle the storefront routes. Wren is
pinned, lives in Your Room, and `townSize` went from 8 to 9 so the five dealt
seats — and therefore every seed's town — are unchanged.

**D-72 — A lost goal is handed down first.** §6: "given-up player goals can
seed the child's pool". When the child arrives, the child version of each
player goal that has already failed is dealt first (in goal-id order), and the
rest are drawn from `rules.childGoalPool`. The draw always runs the full count,
so the stream never depends on what the player lost (tested). Measured on the
current build (with the get-to-know step, D-75): only the generous bot ever
inherits. Its unpaid debt grows by exactly the rent each day, so its debt goal
fails on loop 6 in every life where that goal was dealt; children first seen on
day 7 or later inherit it (at the 2-in-3 odds it was dealt), and children who
arrive on day 5 or 6 never do — 26 of 85 generous children, 30.6%, and a one-day
shift in arrival would make it 13.3% or 57.3%. Mixed and human bots never
inherit. So inheritance happens to the lives that gave too much, on a knife-edge
of when the child comes (Brain training, inheritance-at-arrival).

**D-73 — Neglect closes the child's goals after three days in a row, and one
evening resets it.** Brain od76#E9: penalise neglect, but keep the recovery
action available so it cannot dead-end. The child's tick counts untended days
and any time spent with them resets the count; hurting them twice also closes
their goals. Neglect is the world's doing at the tick, so it never touches the
meter (§5.2) but does bring the nightfall goblin (§5.6), with two questions
keyed to the child's goals.

**D-74 — The review reads the child in words.** The engine's outcome words
(`fulfilled` / `failed` / `open`) used to be printed raw in §5.7 step 4. Each
child goal now carries a `childLine` per outcome, and the review stacks its
lines off measured heights, dropping the oldest first if the page runs out.

**Measured, not tuned (§9 posture).** 100 games per bot: the child came in 98%
of generous lives (median day 4.5), 47% of mixed, 39% of the human bot's, and
never for the selfish or isolated bots, which never court anyone. The human bot
attends the child on only 19% of days — it is built to return to whoever it
already knows, so a newcomer is under-served — and loses 1.56 of 2 child goals.
That is partly the bot (Brain dark-goblin#E1) and partly a real risk that the
arrival goes unnoticed, which is why the Mirror now marks it. A player who
spends any one action a day on the child never loses a goal to neglect. Child
goals refund +5 each, but the generous life moved only from 6.5 to 6.7 days
(0.67 child goals met per life): raising a child does not, on its own, answer
T202.

## Getting to know people

**D-75 — Nobody's choices appear until you have met them on two different
days.** Asked for after playing the live build: tapping someone showed every
choice at once, with no relationship before it. Every person but the player and
the child starts with `known: 0`. Their only choice is a first meeting; once you
have met them that day, they offer nothing more until tomorrow (a nightly tick
clears `met_today`); the second meeting, on a later day, opens their real
choices. Each meeting has its own line, and the second lets slip the trouble
their help choices address, so the help means something when it appears. The
child needs no introduction, and the aftermath choice stays reachable.

All of it is content: two meeting choices and a tick rule per person, and one
extra `{ npc, key: "known", gte: 2 }` condition wrapped around each of their
existing choices. The engine reads none of it; `meeting: true` is a marker for
the tests, the bots and the dialogue's greeting. A meeting is a neutral act, so
like any act it costs the day one action.

**D-76 — The two strict-preference bots meet people first.** With the gate in,
the selfish and generous bots took the first self or help that opened and never
met anyone else: they came to know 11–13% of the town, the selfish one stopped
meeting anyone it could harm (harms 2.54 → 0.25 a day) and lived 54 loops
instead of 24 — a result of the bot, not the game. They now take any meeting
they can before choosing by preference. Mixed and human already met 99% and
93% of the town on their own and are unchanged.

Measured after both (100 games per bot): selfish 19.5 loops (was 23.8 — the
first days go on meetings), generous 7.0 (was 6.7); the child now comes on day
6 rather than 4.5, in 85% of generous lives and 17% of the human bot's (was
39%), because Wren has to be known before they can be courted.

**D-77 — A repeated act gets a second line, then a line for the habit, then
none.** Brain training measured that 33–86% of the reaction lines a life heard
were the same person's same line again (a help taken daily, or an earning
choice taken up to 119 times), and Brain 0101#E99 showed no pool keeps up with
a choice taken that often. So every repeatable choice carries `again`: a line
for the second time and one that names the act as routine, after which it
happens without comment. The line is picked in `src/ui/reaction.ts` from the
ledger the engine already keeps, so scoring and determinism are untouched.
Measured after: repeats 0% for every bot; a life still hears 44–60 distinct
lines.
