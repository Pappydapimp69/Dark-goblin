# The Dark Goblin

## ▶ Play it: https://pappydapimp69.github.io/Dark-goblin/

Open the link. That is the whole of it — nothing to install, no server to
start. It is a static page; the game runs entirely in the browser, keeps its
save in the browser, and talks to nothing.

(Note the capital D. Pages keeps the repository's own casing in the path, and
the lowercase spelling returns a 404.)

---

A 2D narrative prototype. You live the same day on repeat and never change.
The town does. Every choice trades helping yourself against helping someone
else, a goblin appears only when something becomes permanent, and when your
lifespan runs out he reads back what you did and gives one verdict.

The theme is never stated in the game. No number is ever shown to the player.
Press the backtick key for a dev overlay showing everything it hides; touch
cannot reach it.

The build spec is [`CLAUDE.md`](CLAUDE.md) and is the source of truth. Every
point where it was silent is recorded in [`DECISIONS.md`](DECISIONS.md).

## Working on it

None of this is needed to play — it is for changing the game.

```sh
npm install
npm run dev            # dev server with hot reload
npm test               # 122 unit tests
npm run sim            # 100 games per bot, writes sim-report.csv
npm run art            # write every SVG asset into art/, plus a contact sheet
npm run build          # static build into dist/
npm run deploy         # rebuild and publish it to the gh-pages branch
npm run package        # dist/ zipped for itch.io
```

The live site is served from the `gh-pages` branch (Settings → Pages → Source:
*Deploy from a branch* → `gh-pages` / `/ (root)`). `npm run deploy` rebuilds
and force-pushes it.

Pages serves the game from a path rather than a domain root, which is what
`base: './'` is for. Two browser checks prove that shape before anything ships:

```sh
npm run build && npx vite preview --port 4173 &
npm run smoke          # plays the built game in Chromium, fails on any console error
npm run verify:itch    # unpacks the shipping zip under a nested path and plays it there
```

`npm run smoke` runs at 1440x900 by default; `SMOKE_VIEWPORT=390x844` plays it
at phone size.

## How it is put together

```
src/engine   pure TypeScript, zero Phaser imports. (state, input) -> state.
src/content  the town, as JSON. 42 townspeople; a town is 8 of them.
src/art      the woodcut, as parametric SVG source. Every asset is built here.
src/sim      headless bots, for balance.
src/scenes   Phaser only. Reads state, dispatches actions, decides nothing.
src/ui       the store (the single seam), save, dev overlay, sound hooks.
tools        the browser smoke driver, the art writer and the itch packaging.
```

The engine never imports Phaser and the scenes never touch `GameState` —
both are enforced by tests rather than by good intentions. All randomness goes
through one seeded stream whose position lives in the saved state, so the same
seed plays the same life.

Press the backtick key for the dev overlay, which shows everything the game
hides. It cannot be reached by touch.

## The art

Every asset is cut from source in `src/art` — SVG assembled by code, not
image files. `npm run art` writes all 53 of them into `art/` as real `.svg`
documents, plus a contact sheet of the whole cast, which is the only practical
way to spot two neighbours who happen to have come out the same.

A cast of forty-two is a system rather than forty-two drawings: six builds,
six head coverings, twelve carried objects and five cloth tones, composed.
That is not only a budget decision. Two palettes chosen independently can land
on the same colour-vision confusion axis at the same luminance, and then only
the silhouettes tell the figures apart — so the silhouette does the work and
colour is the last cue, not the first. Ilka, Aldo and Ves get bespoke marks
(an apron, a ledger, a plank), which is the escape hatch for anyone the system
would otherwise render as just another neighbour.

The portrait is the exception that proves it. It is one block re-inked at five
pressures rather than five drawings, because §5.8 makes it the only lifespan
feedback in the game and the effect depends on neighbouring stages differing
so little that the change is felt instead of announced.

## Definition of done (§10)

| What the spec asks | What proves it |
|---|---|
| A new player can play from the first morning to the final review, no numbers visible | `npm run smoke` drives the built game through a whole loop and the goblin and review scenes, collects every string drawn, and fails if any contains a digit |
| The storefront reaches the baker by all three routes — hurt, help, shift | `tests/routes.test.ts`, one test each, driven by hand against the real content |
| The Break fires if the shopkeeper is ruined by the player | `tests/routes.test.ts` (hurt route) and `tests/goblin.test.ts` |
| A Nightfall visit happens when a player goal fails | `tests/goblin.test.ts`, including that it does *not* fire for an NPC goal |
| The final verdict differs between the selfish and generous bots | `tests/sim.test.ts` — selfish ends on "self" in every game, generous on "others" |
| All tests pass; `npm run build` produces a static folder that runs from itch.io | `npm test`, then `npm run verify:itch`, which serves the zip's contents from a nested path the way itch does |

## Where the balance stands

From `npm run sim`, 100 games per bot on the real content:

| bot | loops | baker_shop | builder_work | verdict self |
|---|---|---|---|---|
| selfish | 21.9 | 0% | 0% | 100% |
| generous | 6.5 | 92% | 100% | 0% |
| mixed | 8.6 | 13% | 40% | 35% |
| isolated | 27.0 | 0% | 0% | 0% |
| human | 13.5 | 12% | 62% | 13% |

`human` is a fifth bot beyond the four the spec names. The four are policies
over scoring tags the player cannot see, and one of them looks ahead; `human`
plays on what the screen actually shows, keeps returning to whoever it was
just with, goes to bed before the day is spent, and drifts toward looking
after itself as the portrait ages.

It is the row that matters. A player playing normally reaches the game's
headline outcome in **12%** of lives, against 92% for a bot optimising to help.
That is reported, not tuned — see the open finding at the end of
`DECISIONS.md`, along with the other one: a life in which the player does
nothing is currently read back as generosity.
