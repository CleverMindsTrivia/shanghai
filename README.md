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

### Stable table and overlapping hand

All four practice seats and each round's two or three combination slots are reserved from the start. Set ranks and run ranges stay in a consistent summary format; tapping a group opens its full cards. With a hand selection, legal destinations are highlighted and adding cards requires an explicit confirmation. Shanghai keeps its existing reaction flow.

The hand uses two overlapping rows, designed around 17 cards, with large exposed rank/suit labels. Draws append instead of re-sorting. New cards are outlined and marked NEW; a bought penalty card is marked P+1, with its full label beside the hand actions. Card order and markers survive refresh; markers clear after your discard. Sorting is explicit. Private staging, scores, history, and rules open in dialogs to keep the table stationary. Select cards, open Stage, and prepare a set/run; the panel closes so you can select the next group.

Validation: engine and application unit tests cover all seven rounds, buying/Shanghai, draft persistence, appended card order and markers, 17-card row rendering, reserved seats/slots, and explicit play confirmation. Real-device Safari viewport and touch testing remains necessary; DOM/unit checks do not prove visual fit on every phone.

### Arrange your hand

Hold a card for about a third of a second on touch screens, then drag it to an insertion marker in either row. With a mouse, drag directly. Release outside the hand or press Escape to cancel. A normal tap still selects; a completed drag does not change selection or play/discard cards. The saved order persists across draws, buys, and refreshes. Suit/Rank sorting remains available. Keyboard alternative: focus a card and use Alt+Left or Alt+Right to move it one position.

Automated coverage verifies ordering across rows, preservation of private staged groups and selection, new-card markers, persistence after refresh, and unchanged physical cards/scores. Touch gestures on iOS still need real-device verification.

## Private multiplayer alpha

A separate 2–4 person room build lives at `/multiplayer.html`. It uses a Netlify function and a dedicated Supabase database; server credentials are never shipped to browsers. It is not connected until the backend environment and SQL migration are applied. See [multiplayer setup](docs/multiplayer-setup.md) for the exact setup, device tests, and alpha limitations. Practice mode stays at `/`.
