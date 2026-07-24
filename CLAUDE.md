# CLAUDE.md

Persistent context for Claude Code sessions on this repository.

## Project

A personal travel itinerary PWA ("Japan companion app" / trip-planner).
Build a trip's timeline before departure and edit it freely during travel —
flights, layovers, hotel stays, trains, points of interest — visualized as a
narrow checkpoint timeline paired with a map.

## Stack

- Vite + React + TypeScript
- Zustand for state
- MUI (`@mui/material`, `@mui/lab` Timeline) for UI
- Leaflet + OpenStreetMap for the map
- Firebase: Firestore (data), Auth (Google sign-in, approval-gated — see
  `firestore.rules`'s `hasAppAccess()`), Hosting
- Installable PWA (`vite-plugin-pwa`)

## Repo structure

`src/` is the web app (this `package.json`). Two sibling sub-projects are
each their own independent Node package — own `package.json`, own
dependency tree, not part of the root `npm install`/build:

- `functions/` — Cloud Functions: the app-access blocking function, trip
  invite/activity-log callables.
- `mcp/` — MCP server: lets Claude read/edit trip data directly, signed in
  as a real user via the Firebase client SDK. See `MCP.md` and
  `mcp/README.md`.

## Architecture rule — always follow this

**No component or store ever imports from `firebase/*` directly.** All data
access goes through a `TripRepository` interface — see
`src/data/TripRepository.ts` for the current, full method list (trips,
checkpoints, alternatives, bookings, membership, activity log; it's grown
well past a minimal CRUD shape, don't assume it from memory).

`FirebaseTripRepository` (in `src/data/firebaseTripRepository.ts`) is the
only file allowed to import Firestore/Firebase APIs. It converts Firestore
`Timestamp` objects to ISO strings before returning data — nothing outside
this file should ever see a Firestore-specific type. Auth is wrapped the
same way behind an `AuthService` interface. This exists so the backend can
be swapped later without touching UI code — don't erode it by reaching for
`firebase/firestore` from a component "just this once."

## Data model (Firestore)

```
trips/{tripId}                          — name, dateRange, memberIds: [uid],
                                           ownerId?, memberProfiles?
trips/{tripId}/checkpoints/{id}         — type, name, startTime, endTime?,
                                           location?, notes?, linkedBookingId?
trips/{tripId}/alternatives/{id}        — same shape as a POI checkpoint,
                                           not attached to the timeline
trips/{tripId}/bookings/{id}            — provider, confirmationNumber, notes
trips/{tripId}/activityLog/{id}         — owner-readable audit trail

allowedUsers/{email}                    — app-access allowlist (#35)
accessRequests/{email}                  — pending/approved/denied/revoked
appActivityLog/{id}                     — admin-readable app-access audit trail
```

`type` is one of: `flight | train | metro | hotel | poi | other`. A layover
is just a checkpoint between two flight checkpoints, not a separate type.
The bottom three collections back the approval-based app-access gate (see
`firestore.rules`'s `hasAppAccess()`) — every trip operation requires the
`appAccess` claim on top of `memberIds` membership, not just the latter.

## UI conventions

- Mobile-first. Timeline is the default view; map and the alternatives
  shelf are separate tabs on phone, a synced side-by-side split on
  tablet/desktop via `useMediaQuery` — same components, different layout,
  not a separate UI.
- Checkpoint type is shown via icon, not color. Color is reserved for state
  (e.g. current/next checkpoint), never for category.
- Every checkpoint is tap-to-edit inline (bottom sheet on phone, side panel
  on desktop) — no separate "edit mode."
- Writes update local state immediately (optimistic UI) — do not wait on
  the network round-trip before reflecting an edit on screen.
- New checkpoints default to inserting between the two nearest existing
  ones, not appending to the end.

## Sync and sharing

- Sharing a trip = adding a uid to `trips/{tripId}.memberIds`. Firestore
  security rules must enforce that only members can read/write a trip's
  subcollections.
- Realtime updates via `onSnapshot`; offline queuing is handled by
  Firestore's SDK automatically — don't build a custom write queue.
- Conflict resolution is last-write-wins per document via `updatedAt`. Do
  not add CRDT/merge logic — unnecessary at this scale (two people, mostly
  editing different checkpoints).

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — lint
- `npm test` — unit tests (Vitest)

`functions/` and `mcp/` have their own `npm install`/`npm run build` —
see "Repo structure" above and each directory's own docs.
