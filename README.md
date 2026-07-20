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

### To the app (admin approves)

App access is approval-based. Anyone can sign in with Google, but an Auth blocking function stamps every sign-in with an `appAccess` custom claim — `true` only for emails in the `allowedUsers` allowlist — and both the UI and the Firestore security rules require that claim, so an unapproved account can't see or touch any data. Signing in _is_ the access request:

1. Tell the person to open the app and sign in with Google once. They'll land on a "waiting for approval" screen, and their request appears for the admin automatically.
2. The admin (a fixed email, see `src/config/admin.ts`) opens **App access → Requests** from the trip-selector toolbar and clicks approve (or deny).
3. The person hits **Check again** on their waiting screen (or just comes back later) — their access claim refreshes and the app opens up. No second sign-in needed.

The **People** tab lists everyone with access and lets the admin revoke anyone: future sign-ins lose the claim, their current session lapses within about an hour, and their trips and memberships are kept in case they're re-approved (revoked people reappear in the Requests tab). The **Activity** tab is an audit trail: access requested/approved/denied/revoked.

> **One-time bootstrap:** `allowedUsers` starts empty. Seed the admin's (and any existing collaborator's) email as `allowedUsers/{email}` docs directly in the Firebase Console's Firestore tab before the first deploy of `functions/` — otherwise even the admin lands on the waiting screen with nobody able to approve. Everyone must also sign in once _after_ the deploy for their access claim to be stamped.

### To a trip (any trip owner)

Trip sharing is separate from app access: the trip's owner opens the trip's members dialog and invites a companion by email, which gives them full edit access to that trip. The person must already be approved for the app (see above) and have signed in once. See [WORKFLOW.md](WORKFLOW.md#4-sharing-with-a-travel-companion) for the full workflow.

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
