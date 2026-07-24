# MCP.md

Design notes for the MCP (Model Context Protocol) server that lets Claude
read and edit trip checkpoints directly.

## Why this exists

Both the web app and the MCP server should share one source of truth for
data access. The MCP server is not a separate integration bolted on the
side — it's another client of the same `TripRepository` data model the web
app uses (see `CLAUDE.md`), just with its own one-shot-request-flavored
repository implementation rather than the web app's subscription-based one.

## Status

Built, in a separate repository: `japan-companion-mcp`
(`~/Repositories/japan-companion-mcp` on the maintainer's machine — **not
yet pushed to GitHub**, that's a pending decision, see Open questions).
`tsc` builds clean. **Not yet verified end-to-end** — needs a real Google
OAuth client and a signed-in, approved account to exercise against; do that
before publishing to npm.

This supersedes an earlier local, personal-only version of this server
(admin-key auth, never distributed) that issue #22 flagged as
`GOOGLE_APPLICATION_CREDENTIALS`-based and unsafe to share — that version
no longer exists; `japan-companion-mcp` fully replaces it, per the original
decision to have one codebase rather than an admin version and a
client-auth version side by side.

## Authentication

**Per-user OAuth, not a shared admin key.** The server authenticates as an
actual Google-signed-in user via the Firebase **client** SDK
(`FirebaseClientTripRepository`, not `firebase-admin`), so every call is
subject to the same Firestore security rules the web app enforces — a user
only sees trips where their uid is in `memberIds`, and (see below) only if
their account has been approved. This is the same trust boundary the web
app already relies on; the MCP server is just another authenticated
client, no new security rules needed.

**Sign-in flow: OAuth 2.0 device authorization grant (RFC 8628)** — the
same flow `gcloud auth login --no-launch-browser` uses. Chosen over a
localhost-loopback-listener flow (the originally planned design, still
functionally equivalent — both are per-user OAuth against a Google Cloud
OAuth client) because it needs no local HTTP server: the process prints a
short code and a verification URL, the user opens that URL on _any_
device/browser and enters the code, and the server polls Google's token
endpoint until it's authorized. Requires a Google Cloud OAuth client of
type **"TVs and Limited Input devices"** (Google's recommended type for
this flow — a "Desktop app" client type doesn't work with the
`/device/code` endpoint).

**App-access gate (#35) — the important thing that changed since this
server was first planned.** Signing in with Google always succeeds now,
but `trip-planner` gates actual Firestore access behind an `appAccess`
custom claim that only an admin grants (approval-based access, not
membership-based — see `firestore.rules`'s `hasAppAccess()`). A merely
signed-in, unapproved account would otherwise hit a bare Firestore
`permission-denied` on every tool call with no explanation. The server
checks `getIdTokenResult().claims.appAccess` right after sign-in and, if
false, exits with an explicit message telling the user to ask the trip
admin to approve them from the app's _App access_ dialog — before ever
attempting a Firestore call.

**Session persistence**: the Firebase JS SDK's built-in persistence
backends assume a browser (`localStorage`/`IndexedDB`), so a plain
`getAuth()` in Node falls back to in-memory — nothing survives past one
`npx` invocation. The server implements the SDK's internal `Persistence`
interface backed by a JSON file at `~/.japan-companion-mcp/credentials.json`
instead (same pattern as Firebase's own `getReactNativePersistence()`
helper), so the SDK's normal token-refresh logic keeps working unmodified
once that file is restored on a later run. This file is server-managed
state, not something a user edits directly.

## Configuration

No local config file, no `claude_desktop_config.json` entry with secrets in
it (both considered and rejected — see git history on `japan-companion-mcp`
for why). Instead, six environment variables set once via `claude mcp add`:

```sh
claude mcp add --scope user japan-companion \
  --env FIREBASE_API_KEY=... \
  --env FIREBASE_AUTH_DOMAIN=maiyun-trip-planner.firebaseapp.com \
  --env FIREBASE_PROJECT_ID=maiyun-trip-planner \
  --env FIREBASE_APP_ID=... \
  --env GOOGLE_OAUTH_CLIENT_ID=... \
  --env GOOGLE_OAUTH_CLIENT_SECRET=... \
  -- npx -y @hawuawu/japan-companion-mcp
```

`--scope user` writes to `~/.claude.json`, available from any Claude Code
session regardless of working directory — not tied to being inside
`trip-planner`. The four `FIREBASE_*` values are public client identifiers
(same as `trip-planner`'s own `.env`); `GOOGLE_OAUTH_CLIENT_SECRET` is the
one value worth keeping out of anywhere casually shared, hence env-var
injection at registration time rather than a plaintext file.

## Tools

**Add, update, and read only — no delete, no membership management.** Both
deliberate scope decisions made when this issue was refreshed (2026-07):
deleting through Claude isn't supported yet for any entity type, and
inviting/removing trip members is a bigger trust surface than data edits
and was left out of this pass rather than assumed in.

```
list_trips(), get_trip(tripId), create_trip(name, dateRange), update_trip(tripId, changes)

list_checkpoints(tripId), get_checkpoint(tripId, checkpointId)
add_checkpoint(tripId, checkpoint), add_checkpoints(tripId, checkpoints[])
update_checkpoint(tripId, checkpointId, changes)

list_alternatives(tripId)
add_alternative(tripId, alternative), add_alternatives(tripId, alternatives[])
update_alternative(tripId, alternativeId, changes)
promote_alternative(tripId, alternativeId, startTime)

list_bookings(tripId)
add_booking(tripId, booking), update_booking(tripId, bookingId, changes)
```

`promote_alternative` deletes the promoted alternative after copying it to
the timeline, matching the web app's own `promoteAlternative` — confirmed
with the user that the "no delete tools" decision is about standalone
`delete_*` tools, not this already-shipped promotion behavior's side
effect.

Not tool-mapped: `recordAccess` and the various `subscribeToX` methods
collapse into one-shot `listX` reads (an MCP tool call is a single
request/response, nothing to push realtime updates to).

## Booking repository gap — closed as a prerequisite

`FirebaseTripRepository.addBooking`/`updateBooking` (in `trip-planner`,
not the MCP repo) threw `Not implemented` even though the web UI's
`BookingPanel` already called them — a live, pre-existing bug, discovered
while refreshing issue #22, unrelated to MCP itself but blocking the new
`add_booking`/`update_booking` tools. Fixed on `feat/22-booking-repo-impl`
(PR #57 into `develop`): real Firestore-backed `addBooking`, `updateBooking`,
and `subscribeToBookings`. `deleteBooking` is intentionally still
unimplemented — no MCP tool calls it, and the UI's delete-button bug is
tracked separately, not fixed as part of this.

## Open questions

- **Push `japan-companion-mcp` to GitHub, or keep it local for now?** Not
  yet decided — currently a local-only git repo.
- Package name/npm scope: currently a placeholder,
  `@hawuawu/japan-companion-mcp`.
- Publishing workflow (manual `npm publish` vs. CI on tag push) — low
  priority until verified end-to-end against a real account.
- Membership tools (`invite_member`/`remove_member`/`leave_trip`) and a
  read-only activity-log tool were explicitly deferred, not designed —
  worth a deliberate follow-up decision, not an assumption, if/when wanted.

## Suggested next steps

1. Create the Google Cloud OAuth client ("TVs and Limited Input devices"
   type) in the `maiyun-trip-planner` GCP project.
2. Run `claude mcp add` as above; verify the device-flow sign-in, the
   `appAccess` rejection message (test with an unapproved account), and
   each of the 16 tools end-to-end against a real trip.
3. Decide on pushing the repo to GitHub.
4. `npm pack` + `npx ./package.tgz` from a scratch directory before
   `npm publish --access public`.
