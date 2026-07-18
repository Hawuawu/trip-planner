# DESIGN.md

UX design direction for the app — how it should look, feel, and respond,
independent of implementation details (those live in `CLAUDE.md`).

## Design priorities, in order

1. **Legible and fast in bad conditions.** The highest-stakes moment for
   this UI isn't calm pre-trip planning — it's a phone screen in bright
   sunlight, spotty signal, one hand free. Every other design decision
   yields to this one.
2. **Never blocks on network.** Every interaction should feel instant.
   Nothing should show a spinner for a write the user just made.
3. **Nothing is ever "locked."** There's no read-only mode, no separate
   edit mode, no state where the user can see something but can't fix it.

## Layout by breakpoint

| Breakpoint                          | Layout                                                                                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone (< 600px)                     | Single column. Bottom tab bar switches between Timeline, Map, and Alternatives. A floating action button for "add checkpoint" is always present on the Timeline tab. |
| Tablet / small desktop (600–1200px) | Two-pane split: a narrower timeline rail on the left, map filling the right. Alternatives accessible as a slide-over panel.                                          |
| Desktop (> 1200px)                  | Same two-pane split with more breathing room; alternatives can sit as a persistent third column rather than a slide-over.                                            |

The same components render in all three — only their arrangement changes.
There is no separate "mobile design" and "desktop design."

## The timeline

- A narrow vertical rail: each checkpoint is a dot/icon connected by a
  continuous line to the next, reading top-to-bottom as chronological
  order — the visual language of a train schedule or boarding pass, not a
  generic card list.
- **Type is communicated by icon shape, not color** — a plane, a train, a
  building, a pin. Color-coding by type breaks down past 3–4 categories and
  fails colorblind users; icon shape doesn't.
- Color is reserved for _state_, not category: the current or next
  checkpoint gets the one accent-filled treatment on the timeline. Every
  other checkpoint is visually neutral. This keeps "what's next" scannable
  at a glance without the whole timeline turning into a rainbow.
- Each checkpoint row shows, at minimum: icon, name, time. Notes and
  secondary details (location, linked booking) are available on tap, not
  shown inline — the collapsed timeline should stay scannable even for a
  20-checkpoint trip.
- A hotel "base" spanning multiple nights renders as a single elongated
  entry, not as separate check-in/check-out checkpoints — it should read as
  one continuous stay, with check-in/out times available in its detail.

## The map

- Pins follow the same iconography as timeline checkpoints (same shapes),
  so the two views feel like one system viewed two ways, not two separate
  features bolted together.
- A subtle route line connects pins in timeline order, so travel between
  points is visible, not just the points themselves.
- Selecting a checkpoint on the timeline highlights its pin and centers the
  map on it; tapping a pin scrolls the timeline to that checkpoint. The two
  views are always in sync, never independent.

## Editing

- **Tap-to-edit inline**, everywhere: tapping a checkpoint opens its fields
  directly editable, in a bottom sheet on phone or a side panel on desktop.
  No pencil icon, no separate mode to enter and exit.
- **Optimistic updates**: the screen reflects an edit the instant it's
  made. If a sync fails later, surface that quietly (e.g. a small retry
  indicator) rather than blocking the interaction that already happened.
- **Insert-between as the default add action**: the primary "add" affordance
  sits between two existing checkpoints, not only at the end of the list —
  reflects how itineraries actually get built (rearranged constantly, not
  assembled strictly in order).
- Deleting a checkpoint should be easy to undo (a brief "undo" affordance
  after deletion) given how easy it is to mis-tap on a phone in motion.

## Alternatives

- Visually distinct from committed timeline checkpoints — a dashed border
  or reduced-opacity treatment signals "shortlisted, not committed."
- Live in their own tab/shelf, separate from the timeline, so they never
  clutter the trip's actual schedule.
- One clear, one-tap action to promote an alternative onto the timeline
  (which then asks for a day/time, converting it into a real checkpoint).

## States worth designing deliberately

- **Empty trip**: a single clear prompt to add the first checkpoint, not a
  blank screen.
- **Offline**: a small, calm indicator that changes are saved locally and
  will sync — never an error state or a blocking message, since offline is
  an expected, normal condition for this app, not a failure.
- **Sparse/incomplete itinerary**: gaps in the timeline (a day with nothing
  planned) should look intentional, not broken — this app supports
  half-finished plans as a normal state, not just a fully scheduled trip.
- **Shared editing**: when a collaborator's edit arrives via realtime sync
  while the user has the app open, it should appear without jarring the
  user's current scroll position or interrupting an in-progress edit of
  theirs.

## Visual tone

- Restrained, closer to a boarding pass or transit map than a lifestyle
  travel blog — the itinerary is a tool used under time pressure, not a
  mood board.
- Avoid decorative imagery competing with the timeline's actual job:
  showing what happens next.

## Anime-styled MUI theme (in progress)

Direction: reskin the app with an anime-styled MUI theme (custom palette,
typography, shape, and component overrides via `ThemeProvider`), applied
app-wide.

- **Scope**: theme + a few new/adapted components where MUI overrides alone
  can't get the look (e.g. a stylized timeline connector, checkpoint
  markers styled to match the accent, the collapsible-panel toggle pill).
- **Sub-style**: soft shoujo/slice-of-life — pastel palette, rounded
  shapes, soft gradients, gentle motion (Ghibli / slice-of-life register,
  not high-contrast shounen or retro VHS grading).

This still must satisfy "Design priorities, in order" above — legibility
in bright sunlight comes first, decorative styling second. Concretely: the
pastel palette applies to surfaces/backgrounds and secondary chrome, not to
body text contrast or the current/next-checkpoint accent, which stay at
full contrast regardless of the softer palette around them.

### Asset inventory for Recraft generation

Compiled by scanning current icon/image usage in `src/` — nothing below
exists as custom art yet, all currently fall back to MUI defaults or are
entirely absent.

**Checkpoint type icons** (highest priority — this is the app's core
iconography per "type is communicated by icon shape, not color" above).
Defined in `src/components/timeline/CheckpointIcon.tsx`, used on both the
timeline and the map pins, so they must work at both scales:

- `flight` (currently MUI `Flight`)
- `train` (MUI `Train`)
- `metro` (MUI `Subway`)
- `hotel` (MUI `Hotel`)
- `poi` (MUI `Place`)
- `other` (MUI `RadioButtonUnchecked` — fallback/default)

Needs: one consistent set, simple silhouettes (not overly detailed), a
single line weight, and both a neutral and an accent-filled variant per
icon (for the current/next state described under "The timeline").

**App icon / favicon / PWA icons** — currently missing entirely; no
`public/` directory and no `icons` array in the PWA manifest
(`vite.config.ts`):

- App icon, 192×192 and 512×512, plus a maskable variant
- Favicon
- Apple touch icon

**Banner / hero art** — both currently plain MUI text, no imagery:

- `src/components/auth/SignInPage.tsx` — sign-in card; a hero
  illustration/banner above or behind it is the natural slot.
- `src/components/trips/TripSelectorScreen.tsx` — trip list screen; also
  covers the "empty trip" state (see "States worth designing deliberately"
  above), which should get a deliberate illustration rather than a blank
  screen.

**Out of scope for the reskin**: generic UI/action icons (nav tabs,
delete, add, layers, chevrons, offline-wifi, logout) and the Google brand
icon — leave these as MUI defaults unless the icon language is redone
wholesale.
