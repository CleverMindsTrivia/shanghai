# Private family rooms: first multiplayer build

Status: code ready for a dedicated Supabase project and two-device testing. This is a separate alpha entry point (`/multiplayer.html`); the practice game remains available at `/`.

## What is implemented

- Create/join using an eight-character room code; 2–4 human seats, no bots.
- Host deals, randomized first dealer, next seat starts; all seven contracts.
- Server holds the authoritative deck, hands, scores, and turn state. Each response contains only the requesting seat's hand.
- A private random rejoin key is retained in the device's browser. Database stores its SHA-256 hash; no account signup required for family players.
- Version-checked writes prevent concurrent moves overwriting one another. Move IDs prevent retried actions being applied twice.
- Human buying: next player has first refusal; eligible buyers are ordered by seats, not announcement order. A queued buy prevents a later Shanghai. Winning buyer gets exactly one penalty card.
- Shanghai before laying, correct table placement, and the caller's replacement discard use the shared rules engine.
- Private local staging, automatic new-card markers, explicit sorting, custom family card art, round scores, and table history.
- Polling synchronizes devices every 1.2 seconds while the page is visible. This is polling, not a Realtime WebSocket subscription.

## Connect the backend

1. Create a **separate Supabase project for Shanghai**. Keep the database password private.
2. In that project's SQL Editor, run `supabase/migrations/001_private_rooms.sql` once. It creates a server-only table with RLS enabled and no browser-access policies.
3. In the **Shanghai Netlify site's** environment variables, add:
   - `SUPABASE_URL`: that project's URL, e.g. `https://PROJECT.supabase.co`.
   - `SUPABASE_SERVICE_ROLE_KEY`: the project's legacy `service_role` API key. This is a server secret. Enter it directly into Netlify; do not paste it into chat, commit it, or put it in a browser config file. It must be available to Functions at runtime.
4. Deploy this feature branch as a Netlify branch/deploy preview, or merge it after reviewing. Netlify detects `netlify/functions/room.mjs`; shared modules are imported from `server/` and `public/engine.mjs`. No npm dependencies are needed.
5. Open `/multiplayer.html`. The form remains disabled with a setup message until the function reports both environment variables present. A successful create/join is still needed to verify the database migration and credentials.
6. Use two separate devices (or independent browser profiles) for the first test. Copying a tab within the same browser shares the saved seat; it is not a second player.

No Supabase anon/publishable key or client-side Supabase SDK is required. Browsers call the same-origin Netlify function only; the existing Content Security Policy can stay unchanged.

## Two-device acceptance test

- Host creates room; second device joins by code under a different name. Both see the lobby and member list.
- Host deals. Each sees 11 of their own cards, the same discard, and the same active player.
- Non-active device cannot draw/discard. Active player draws, stages the entire contract, lays, extends, and discards; both devices converge.
- Refresh each device: room, seat, private hand, private draft, and hand order survive.
- With three/four devices, announce competing buys; next player's normal pickup beats them, and closest eligible buyer receives the card plus exactly one penalty.
- Shanghai a playable discard before a buy; verify correct group placement and non-chaining replacement discard. Announce a buy first; verify Shanghai is blocked.
- Repeat a move request ID: only one draw/discard occurs. Race conflicting requests: one authoritative state survives.
- Finish a round, let host deal the next, and finish round seven with correct scoring.

## Known alpha limitations

- Backend has not been connected or exercised against a live Supabase project in this coding session. Unit tests use an in-memory CAS store and mocked REST transport. They do not prove live Netlify/Supabase integration or iOS touch fit.
- Four seats maximum in this first version. Six-to-eight-seat family layout comes after the two-device check.
- The alpha page has selection, sorting, and staging; practice-page drag ordering has not yet been ported to it.
- No host transfer, seat replacement, spectator mode, account-based seat recovery, or multiplayer pause yet. If a player loses their browser's seat key, there is no recovery flow; start a new room.
- Rooms expire 24 hours after creation; no background expiry/deletion job is installed. The API rejects expired rooms. Optionally schedule deletion of expired rows through Supabase after selecting a retention policy.
- Claim windows last four seconds on the server. Browser/network latency affects how much usable response time players have; tune only after actual device tests.
- Room creation has no production anti-abuse/rate-limit layer yet. Keep initial testing to private family use; add database-backed rate limits before a broader public rollout.

## Validation and rollout

`npm test` covers game rules plus room privacy, authorization, duplicate requests, simultaneous buyers, next-seat priority, expiration, and compare-and-swap transport. `npm run build` copies both entry points and assets.

Keep the existing practice app available during testing. Rollback: remove the alpha link or revert the multiplayer feature commit; do not delete the database to roll back the UI. Revoke/rotate the server key in Supabase if it is ever exposed.
