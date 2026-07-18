# MCP.md

Design notes for the MCP (Model Context Protocol) server that lets Claude
read and edit trip checkpoints directly.

## Why this exists

Both the web app and the MCP server should share one source of truth for
data access. The MCP server is not a separate integration bolted on the
side — it's another client of the same `TripRepository` interface the web
app uses (see `CLAUDE.md`). This means checkpoint logic, validation, and
(for the shareable version below) permission rules live in one place, not
duplicated between the app and the MCP tools.

## What's already built: the local, personal version

A local stdio MCP server, scaffolded in an earlier session, covering:

**Tools:**
- `list_checkpoints(tripId)`
- `get_checkpoint(tripId, checkpointId)`
- `add_checkpoint(tripId, checkpoint)`
- `update_checkpoint(tripId, checkpointId, changes)`
- `delete_checkpoint(tripId, checkpointId)`
- `list_alternatives(tripId)`
- `add_alternative(tripId, alternative)`

**Auth model:** a Firebase Admin SDK service account key, loaded via
`GOOGLE_APPLICATION_CREDENTIALS`. This has full admin access to Firestore —
it bypasses the app's normal security rules entirely.

**Distribution:** none — it's a local folder, registered manually in
`claude_desktop_config.json` with an absolute path to `src/index.js` and to
the service account key on disk.

**This version must never be published or shared as-is.** A service
account key is an admin credential; putting it in a package anyone can
`npx` would hand out full read/write access to all trip data to anyone who
installs it.

## What "shareable via npx" requires instead

The goal: someone else (your friend, or anyone building a similar trip) can
run `npx <package-name>` and get a working MCP server registered against
*their own* Firebase project and *their own* account — without you handing
out any secret, and without them getting access to data they don't own.

### Key design change: per-user auth, not a shared admin key

Swap the admin-based repository for a client-auth-based one:

- `FirebaseAdminTripRepository` (current) → `FirebaseClientTripRepository`
  (new), built on the Firebase **client** SDK instead of `firebase-admin`.
- The client SDK authenticates as an actual user (email/password, email
  link, or Google sign-in), not a service account — so it's subject to the
  same Firestore security rules as the web app: a user only sees trips
  where their uid is in `memberIds`.
- This is the same trust boundary the web app already relies on, so no new
  security rules need to be written — the MCP server just becomes another
  authenticated client.

### First-run login flow

1. On first run, if no cached session exists, the server opens the user's
   browser to a Firebase Auth sign-in page (or prompts for an email link).
2. Once signed in, the resulting auth token is cached locally (e.g.
   `~/.japan-companion-mcp/credentials.json`), refreshed automatically on
   later runs.
3. Subsequent `npx` runs reuse the cached session — no repeated login.

This means the published package itself contains no secrets at all; every
user brings their own identity.

### Packaging

- `package.json` gets a `"bin"` entry pointing at the server's entry file,
  making `npx <package-name>` work.
- Published to the public npm registry under a scoped or unique name.
- README for other users covers: run `npx <package-name>` once to log in,
  then add the resulting command to their own `claude_desktop_config.json`.

### Config: which trip?

A user may belong to more than one trip once this is shared beyond a
single household. Options to decide between:
- A `select_trip` / `list_trips` tool, so Claude can ask "which trip?" and
  the user picks conversationally.
- A local config file caching a "default trip" per user, set once.

Leaning toward the tool-based option — it avoids a setup step and works
naturally if someone is on more than one trip at a time.

## Open questions

- Which auth method for first-run login: Firebase's email-link flow (no
  password to manage) vs. Google sign-in (fewer steps, but ties identity to
  a Google account) — leaning email-link for simplicity, not decided.
- Package name and npm scope.
- Whether `FirebaseClientTripRepository` fully replaces the admin version,
  or both exist side by side (admin version kept only for your own local,
  non-shared use).
- Versioning/publish workflow (manual `npm publish` vs. CI on tag push) —
  low priority until the server itself is built and working for one user.

## Suggested build order

1. Build `FirebaseClientTripRepository` against the existing
   `TripRepository` interface — should be a near drop-in swap since both
   implement the same contract.
2. Get the login flow working locally (cache + refresh a session) before
   touching packaging.
3. Rewire the existing tool handlers (`list_checkpoints`, etc.) to use the
   new client-auth repository instead of the admin one.
4. Add `select_trip` / `list_trips` tools.
5. Add the `bin` entry and test `npx` from a local tarball
   (`npm pack` + `npx ./package.tgz`) before publishing for real.
6. Publish, then update `CLAUDE.md`'s "not yet decided" section once this
   is resolved.
