# Private family rooms: first multiplayer build

Status: multiplayer and optional room voice prepared for backend setup and two-device testing. This is a separate alpha entry point (`/multiplayer.html`); the practice game remains available at `/`.

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

1. Select the Supabase project used for Shanghai. A shared project is supported: these migrations only create Shanghai tables. Keep credentials private.
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


## Optional room voice

The multiplayer page has a collapsible **Room voice** panel above the game. Join is opt-in, requires microphone permission, and connects everyone who joins voice in the same room. It includes mute/unmute, speaking and connection indicators, Enable sound, Test speaker, and Leave voice. It works in the lobby and stays connected between rounds. Refreshing requires joining voice again; it never enables the microphone automatically. Practice opponents have no microphone.

1. Run `supabase/migrations/002_room_voice.sql` in the same Supabase project's SQL Editor. It adds `shanghai_voice` with RLS and server-only grants. The existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` Functions settings are reused. No additional Supabase project or client key is needed.
2. Deploy this branch/PR preview with those variables available in the Deploy Preview context. `netlify/functions/voice.mjs` relays only signaling; the audio travels through WebRTC. Voice rows are separate from card rows and do not change the gameplay version.
3. For reliable communication between different Wi-Fi/cellular networks, configure a trusted TURN relay in the **Shanghai Netlify** Functions environment. Use the same provider as Not on the List if available; configuration in Render does not automatically reach Netlify.
   - `VOICE_TURN_URLS`: comma-separated `turn:`/`turns:` URLs.
   - Prefer `VOICE_TURN_SECRET` if the relay supports coturn REST HMAC-SHA1 credentials. The function creates one-hour credentials scoped to the room and seat; the signing secret never reaches browsers. Active clients request fresh configuration every 30 minutes.
   - Otherwise use provider-issued `VOICE_TURN_USERNAME` and `VOICE_TURN_CREDENTIAL`. These relay credentials necessarily reach authenticated room participants. Prefer expiring credentials and rotate static credentials as needed. Do not put credentials in GitHub or chat.
4. Redeploy after environment changes. On two physical devices, join the same game room, tap Join voice on both, allow microphone access, and use headphones. Confirm **Connected** and hear each other both ways. Test one on Wi-Fi and one on cellular to verify the relay. A speaking light alone does not prove received sound.
5. If connected but silent, tap Enable sound and Test speaker, check volume and mute. If the status remains Connecting or fails, check TURN/network connectivity. Leave/rejoin retries the session.

Presence expires after 45 seconds without a heartbeat. Signaling is polled every 1.5 seconds while joined; messages are bounded, directed to one seat/session, and retained for at most 90 seconds in the active row (old row data is physically pruned on the next voice request). No audio is recorded or stored by this implementation. Leaving voice or leaving the room stops microphone tracks and peer connections; page exit also closes local audio. Background iOS browser suspension may require rejoining. Voice signaling generates additional Netlify function and database requests while enabled; this is a private family alpha with no public anti-abuse layer.

Automated tests cover authorized seats only, expiry, recipient isolation, signal deduplication/cursors, concurrent joins, stale sessions, mute state, separate storage, and TURN credentials. Mock browser tests cover opt-in microphone access, host seat zero, mute, denied permission, setup failure cleanup, leaving during permission prompts, and room changes. Actual audio transport, iPhone playback, and TURN deployment still need the two-device acceptance test. The Not on the List reference implementation is `CleverMindsTrivia/not-on-the-list/public/voice.mjs` at commit `62bf8c8e94cb76e3b762facc2ec5725cca764094`.
