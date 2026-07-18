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
