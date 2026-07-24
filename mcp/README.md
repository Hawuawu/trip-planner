# japan-companion-mcp

MCP server for this repo's web app ("Japan companion app"). Lets Claude
read and edit trip checkpoints, alternatives, and bookings through the
same `TripRepository` data model the web app uses — signed in as _you_,
not through a shared admin credential.

Lives at `mcp/` inside `trip-planner` rather than a standalone repo — see
`../MCP.md` for why, and for the full design record. Tracked in
[issue #22](https://github.com/Hawuawu/trip-planner/issues/22). It's an
independent Node package (own `package.json`, own dependency tree, own
`npm publish` lifecycle) — not part of the web app's Vite build, same
relationship `../functions` has to the rest of the repo.

## What this does and doesn't do

- **Add and update only — no delete.** There is no `delete_checkpoint`,
  `delete_alternative`, `delete_booking`, or `delete_trip` tool. Deleting
  through Claude isn't supported yet, by design.
- **No membership management.** Inviting or removing trip members isn't
  exposed as a tool in this pass.
- Every tool call goes through the same Firestore security rules the web
  app enforces — this server has no elevated access. A trip you're not a
  member of, or an app account that hasn't been approved (see below),
  behaves exactly as it would if you tried the same thing in the browser.

## Setup

You need two things before this will run, both one-time, both under your
own accounts:

### 1. A Google OAuth client (for sign-in)

This server signs you in with the OAuth 2.0 **device authorization grant**
(RFC 8628) — the same flow `gcloud auth login --no-launch-browser` uses.
No local HTTP listener: the server prints a short code and a URL, you open
that URL on any device/browser and enter the code, and the server polls
Google until you've authorized it.

1. In the [Google Cloud Console](https://console.cloud.google.com/) for
   the _same project_ your Firebase project uses, go to **APIs & Services
   → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **TVs and Limited Input devices** — Google's
   recommended client type for the device flow.
3. Note the generated **Client ID** and **Client Secret** (device-flow
   clients get one too, and Google's token endpoint requires it on the
   polling request).

### 2. Your Firebase project's client config

The same values in `../.env` (Project Settings → General → Your apps →
SDK setup and configuration in the Firebase console). These are public
client identifiers, not secrets.

### 3. Register the server with Claude Code

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

`--scope user` registers it in `~/.claude.json`, available from any Claude
Code session regardless of which directory you're in — not tied to being
inside `trip-planner`. Run `claude mcp add --help` if you're on a Claude
Code version with different flag names.

The first run prints a code and a verification URL for Google sign-in, then
caches the session in `~/.japan-companion-mcp/credentials.json` — that file
is server-managed session state (like a token cache), not something you
configure; only the six `--env` values above are yours to set. Later runs
skip straight past login.

**App access approval**: signing in with Google always succeeds, but
`trip-planner` gates actual data access behind an approval step (see
`trip-planner`'s issue #35) — if your account isn't yet approved by the
trip's admin, this server will tell you so and exit rather than let a raw
Firestore permission error surface. Ask the admin to approve you from the
app's _App access_ dialog, then run again.

## Local development

From this directory (`mcp/`) — it has its own `package.json`, separate
from the root one:

```sh
npm install
npm run build
npm pack   # produces a .tgz; test it with: npx ./hawuawu-japan-companion-mcp-0.1.0.tgz
```

To exercise the tools interactively without registering it anywhere first
(recommended before wiring it into Claude Code/Desktop):

```sh
npm run build
FIREBASE_API_KEY=... FIREBASE_AUTH_DOMAIN=... FIREBASE_PROJECT_ID=... \
FIREBASE_APP_ID=... GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
npx @modelcontextprotocol/inspector -- node dist/index.js
```

## Publishing

Not yet published. `npm publish --access public` once the package name/scope
is finalized (see `../MCP.md`).

## Status

Design refreshed per issue #22 (2026-07). Verified: `npm install`, `tsc`
build clean, `npm pack` + `npx` from the tarball starts correctly and
fails with a clear error on missing config. One real bug was caught and
fixed during that local testing — the custom Firebase Auth file
persistence needed to be a class, not a plain object, to satisfy the
SDK's internal `_getInstance()` contract (see git history). **Not yet
verified end-to-end** (needs a real Google OAuth client + a signed-in,
approved account to actually reach Firestore) — do that before
publishing. See the issue for the full verification checklist.
