# The Dark Goblin

A 2D narrative prototype. You live the same day on repeat and never change.
The town does. Every choice trades helping yourself against helping someone
else, a goblin appears only when something becomes permanent, and when your
lifespan runs out he reads back what you did and gives one verdict.

The theme is never stated in the game. No number is ever shown to the player.

The build spec is [`CLAUDE.md`](CLAUDE.md) and is the source of truth. Every
point where it was silent is recorded in [`DECISIONS.md`](DECISIONS.md).

## Running it

```sh
npm install
npm run dev            # play it
npm test               # 109 unit tests
npm run sim            # 100 games per bot, writes sim-report.csv
npm run build          # static build into dist/
npm run package        # dist/ zipped for itch.io
```

Two browser checks, both needing a served build:

```sh
npm run build && npx vite preview --port 4173 &
npm run smoke          # plays the built game in Chromium, fails on any console error
npm run verify:itch    # unpacks the zip under a nested path and plays it there
```

## How it is put together

```
src/engine   pure TypeScript, zero Phaser imports. (state, input) -> state.
src/content  the town, as JSON. 42 townspeople; a town is 8 of them.
src/sim      headless bots, for balance.
src/scenes   Phaser only. Reads state, dispatches actions, decides nothing.
src/ui       the store (the single seam), save, portrait, dev overlay, sound hooks.
tools        the browser smoke driver and the itch packaging.
```

The engine never imports Phaser and the scenes never touch `GameState` —
both are enforced by tests rather than by good intentions. All randomness goes
through one seeded stream whose position lives in the saved state, so the same
seed plays the same life.

Press the backtick key for the dev overlay, which shows everything the game
hides. It cannot be reached by touch.

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
