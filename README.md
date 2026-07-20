# trip-planner

[![Test](https://github.com/Hawuawu/trip-planner/actions/workflows/test.yml/badge.svg)](https://github.com/Hawuawu/trip-planner/actions/workflows/test.yml)

A personal travel itinerary PWA — build a trip's timeline before departure and edit it freely during travel. Flights, layovers, hotel stays, trains, and points of interest visualized as a checkpoint timeline paired with a map.

## Documentation

| File                       | Purpose                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| [DESIGN.md](DESIGN.md)     | UX direction: layout, visual conventions, editing model, states         |
| [WORKFLOW.md](WORKFLOW.md) | End-to-end user workflows: planning, sharing, travel, post-trip         |
| [MCP.md](MCP.md)           | MCP server design: Claude ↔ trip data integration                       |
| [CLAUDE.md](CLAUDE.md)     | Implementation spec: stack, architecture rules, data model, conventions |

## Stack

- **Frontend** — Vite + React + TypeScript
- **UI** — MUI (`@mui/material`, `@mui/lab` Timeline)
- **Map** — Leaflet + OpenStreetMap via `react-leaflet`
- **State** — Zustand
- **Backend** — Firebase (Firestore, Auth, Hosting)
- **PWA** — `vite-plugin-pwa`

Architecture rule: no component ever imports from `firebase/*` directly. All Firestore access goes through a `TripRepository` interface — see [CLAUDE.md](CLAUDE.md#architecture-rule--always-follow-this).

## Running with Docker

The fastest way to get a local dev server running without installing Node:

```bash
# copy and fill in your Firebase config
cp .env.example .env

# start the dev server (hot reload enabled)
docker compose up
```

App is available at **http://localhost:5173**.

To build and serve a production image:

```bash
docker compose --profile prod up
```

Production build served by nginx at **http://localhost:8080**.

## Local development

Requires Node 20+.

```bash
npm install
cp .env.example .env   # fill in Firebase config
npm run dev
```

Other commands:

```bash
npm run build    # production build
npm run lint     # lint
npm run preview  # preview production build locally
```

## Firebase setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Firestore** and **Authentication** (Email/Password provider).
3. Copy your web app config values into `.env` (see `.env.example`).
4. Deploy Firestore security rules: `firebase deploy --only firestore:rules`.

Security rules enforce that only `trips/{tripId}.memberIds` members can read or write a trip's subcollections — see `firestore.rules`.

## Inviting people

### To the app (admin only)

Sign-in is invite-only: an Auth blocking function rejects any account whose email isn't in the `allowedUsers` allowlist, so uninvited accounts never get a session. The app admin (a fixed email, see `src/config/admin.ts`) manages access from the **App access** button in the trip-selector toolbar:

1. Open **App access → Invites → New invite link**, copy the generated link, and send it however you like (there is no automated email sending).
2. The invitee opens the link, enters the email address they'll sign in with, and accepts — the single-use token is bound to that email and the email is allowlisted.
3. They then sign in with Google as normal.

The **People** tab lists everyone with access and lets the admin revoke anyone (future sign-ins are rejected; their current session lapses within about an hour; their trips and memberships are kept in case they're re-invited). The **Activity** tab is an audit trail: invites created/redeemed/cancelled, revocations, and rejected sign-in attempts.

> **One-time bootstrap:** `allowedUsers` starts empty, and deploying the blocking function before seeding it would lock out every account, admin included. Before the first deploy of `functions/`, add the existing accounts' emails as `allowedUsers/{email}` docs directly in the Firebase Console's Firestore tab.

### To a trip (any trip owner)

Trip sharing is separate from app access: the trip's owner opens the trip's members dialog and invites a companion by email, which gives them full edit access to that trip. The person must already have app access (see above) and have signed in once. See [WORKFLOW.md](WORKFLOW.md#4-sharing-with-a-travel-companion) for the full workflow.

## Data model

```
trips/{tripId}                       — name, dateRange, memberIds
trips/{tripId}/checkpoints/{id}      — type, name, startTime, endTime?, location?, notes?
trips/{tripId}/alternatives/{id}     — same shape as a POI checkpoint, not on the timeline
trips/{tripId}/bookings/{id}         — provider, confirmationNumber, notes
```

Checkpoint types: `flight | train | metro | hotel | poi | other`

## MCP server

Claude can read and edit checkpoints directly via a local MCP server. See [MCP.md](MCP.md) for design, auth model, and the roadmap toward a shareable `npx`-distributable version.

## License

See [LICENSE](LICENSE).
