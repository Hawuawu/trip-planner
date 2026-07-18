# CLAUDE.md

Persistent context for Claude Code sessions on this repository.

## Project

A personal travel itinerary PWA ("Japan companion app" / trip-planner).
Build a trip's timeline before departure and edit it freely during travel —
flights, layovers, hotel stays, trains, points of interest — visualized as a
narrow checkpoint timeline paired with a map.

This repo is currently empty (just `LICENSE` and a placeholder `README.md`).
If no `package.json` exists yet, the first task is scaffolding per "Initial
setup" below before anything else.

## Stack

- Vite + React + TypeScript
- Zustand for state
- MUI (`@mui/material`, `@mui/lab` Timeline) for UI
- Leaflet + OpenStreetMap for the map
- Firebase: Firestore (data), Auth, Hosting
- Installable PWA (`vite-plugin-pwa`)

## Architecture rule — always follow this

**No component or store ever imports from `firebase/*` directly.** All data
access goes through a `TripRepository` interface:

```typescript
interface TripRepository {
  getTrip(tripId: string): Promise<Trip>;
  subscribeToCheckpoints(tripId: string, cb: (c: Checkpoint[]) => void): () => void;
  addCheckpoint(tripId: string, checkpoint: Checkpoint): Promise<void>;
  updateCheckpoint(tripId: string, id: string, changes: Partial<Checkpoint>): Promise<void>;
  deleteCheckpoint(tripId: string, id: string): Promise<void>;
}
```

`FirebaseTripRepository` (in `src/data/firebaseTripRepository.ts`) is the
only file allowed to import Firestore/Firebase APIs. It converts Firestore
`Timestamp` objects to ISO strings before returning data — nothing outside
this file should ever see a Firestore-specific type. Auth is wrapped the
same way behind an `AuthService` interface. This exists so the backend can
be swapped later without touching UI code — don't erode it by reaching for
`firebase/firestore` from a component "just this once."

## Data model (Firestore)

```
trips/{tripId}                          — name, dateRange, memberIds: [uid]
trips/{tripId}/checkpoints/{id}         — type, name, startTime, endTime?,
                                           location?, notes?, linkedBookingId?
trips/{tripId}/alternatives/{id}        — same shape as a POI checkpoint,
                                           not attached to the timeline
trips/{tripId}/bookings/{id}            — provider, confirmationNumber, notes
```

`type` is one of: `flight | train | metro | hotel | poi | other`. A layover
is just a checkpoint between two flight checkpoints, not a separate type.

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

## Initial setup (if `package.json` doesn't exist yet)

1. `npm create vite@latest . -- --template react-ts`
2. Add dependencies: `firebase`, `zustand`, `@mui/material`,
   `@mui/icons-material`, `@mui/lab`, `@emotion/react`, `@emotion/styled`,
   `react-leaflet`, `leaflet`, `vite-plugin-pwa`
3. Set up the `TripRepository` interface and `FirebaseTripRepository`
   before building any UI — the data layer comes first.
4. Build the timeline (list + add/edit/delete, no styling) before the map
   or responsive layout.

## Commands

Once scaffolded:
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — lint (add this script if not already present)

## Not yet decided (don't assume an answer, ask if it matters)

- Whether to build a shareable, npx-distributable MCP server, vs. keeping
  the local MCP server (separate from this repo) personal-only.
- Final hosting target — Firebase Hosting is the plan, but the repository
  abstraction means this isn't locked in.
