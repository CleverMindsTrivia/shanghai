# Shanghai — The Family Table

A mobile-friendly practice version of our family’s seven-round Shanghai game. Play one human seat against three computer players. No dependencies or account setup required.

## Run locally

Use Node.js 22 or newer (Netlify is pinned to Node 24).

```sh
npm run dev
```

Open http://localhost:4173. To check the rules and make the deploy folder:

```sh
npm test
npm run build
```

## Deploy to Netlify

Import this GitHub repository into Netlify. The included `netlify.toml` sets:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `24`

There are no environment variables or backend services in this practice version. All assets are served locally; no external fonts or scripts are required. Netlify can deploy the main branch after the repository is imported.

## What works

- One private human hand against three computer players, all seven round contracts.
- Eleven-card deals from two regular decks, discard pickup, stock recycling.
- Full-contract staging and validation, with extra cards permitted inside a set/run.
- Ace-low and ace-high same-suit runs; no wrapping and no repeated rank in a run.
- Add to your own or anyone else’s combinations after laying down.
- Buy up to three times per round: offered discard plus one penalty card.
- Shanghai moves a playable discard into a valid table combination, then the caller discards from their own hand, even before laying down.
- Shanghai replacement discards do not open a second Shanghai window.
- Going out by playing or discarding, including round seven; immediate round endings.
- Automatic round and cumulative scores; lowest total wins, with ties shown jointly.
- Local game persistence, pause/resume, and a four-second discard reaction window.
- Responsive table, hand sorting, rules, standings, and activity history.

## Practice limitations and next stage

This is not online multiplayer yet. Computer opponents do not buy or call Shanghai; they always decline purchases, leaving the eligible human player priority. The four-second reaction window is a practice UI choice, not a finalized multiplayer timing rule. The local engine accepts the first completed buy/Shanghai action; family-room turn-order arbitration needs an authoritative backend.

Jokers are excluded until the optional wild-card restrictions and point value are confirmed. The family’s regular scoring is 2–9 = 5, 10/J/Q/K = 10, ace = 15.

The current cards use a clean traditional suit design. Family portrait artwork will be integrated after its visible center seams have been repaired. No prior print exports are bundled or altered.

Planned multiplayer work: private room codes, player credentials, server-only deck and opponent hands, transactional turn and buy/Shanghai arbitration, Supabase authorization and realtime updates, reconnecting, room cleanup, and multi-device testing. Never send the whole practice game object to multiplayer clients: it contains the full deck and all hands.

## Family character assignments

| Suit | King | Queen | Jack |
| --- | --- | --- | --- |
| Spades | Ray | Caylee | Thomas |
| Hearts | Dad | Mom | Charles |
| Clubs | Martin | Dusti | CJ |
| Diamonds | Jon (glasses) | Jordyn | Daniel |

Jokers: Trinity and Eli.

## Seven rounds

1. Two sets of 3
2. One set of 3 + one run of 4
3. Two runs of 4
4. Three sets of 3
5. Two sets of 3 + one run of 4
6. One set of 3 + two runs of 4
7. Three runs of 4

## Validation

`npm test` checks physical-card conservation, deal counts, ace boundaries, disjoint contracts, complete laydowns, extensions, buy limits and penalties, Shanghai ordering and no chaining, immediate round endings, score accumulation, and five seeded complete seven-round simulations.
