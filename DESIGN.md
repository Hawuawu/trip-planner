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

## Anime-styled MUI theme

Reskins the app with an anime-styled MUI theme (custom palette, typography,
shape, and component overrides via `ThemeProvider` in `src/theme.ts`),
applied app-wide.

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

### Palette

Defined in `src/theme.ts`, sampled from the generated hero banner. Body
text and the current/next-checkpoint accent are deliberately kept outside
this softened palette (see above).

| Role                 | Hex       | Used for                                            |
| -------------------- | --------- | --------------------------------------------------- |
| `primary`            | `#6B5470` | Buttons, active/selected states, primary icons      |
| `secondary`          | `#D97D89` | Current/next-checkpoint accent, secondary actions   |
| `background.default` | `#FBF6F2` | App background                                      |
| `background.paper`   | `#FFFDFB` | Cards, dialogs, list surfaces                       |
| `text.primary`       | `#3D2E3F` | Body text, checkpoint names — kept at full contrast |
| `text.secondary`     | `#7A6B7D` | Secondary/meta text, muted empty-state copy         |
| `divider`            | `#E5DCE2` | Borders, dividers                                   |

### Shape & typography

- Font: `"Inter", "Helvetica Neue", Arial, sans-serif`.
- `shape.borderRadius: 5` — the base radius for boxes, cards, and dialogs
  (used directly, or as the 1x/2x unit behind `sx={{ borderRadius: 1 }}`
  etc. throughout the app). Deliberately small/restrained rather than
  heavily rounded, matching "Visual tone" above (boarding-pass register,
  not a lifestyle-blog one).
- Buttons are the one exception: an explicit `MuiButton` `styleOverrides`
  pins their radius to `16`, independent of the smaller box radius above,
  so the pill-shaped buttons established early in the reskin didn't get
  flattened when the box radius was tightened later.

### Decorative textures

A recurring sakura-branch motif, used sparingly as a background texture
behind panel content — never as foreground/interactive imagery, so it
can't compete with or obscure real content (per "Visual tone" above).
Both assets live in `src/assets/` and are always rendered via a dedicated,
absolutely-positioned, `pointer-events: none` layer sitting behind the
real content (see `PanelBackground`/`TexturedPanel` in
`src/components/layout/AppShell.tsx`) — texture opacity is controlled by
CSS on that layer, not baked into the SVG, and it never intercepts clicks
or fades real content.

- **`sakura-pattern.svg`** — a small, seamlessly-tileable ditsy floral
  repeat. Used behind the Alternatives panel at a `360px` tile size.
- **`sakura-branch.svg`** — a single tall vertical branch illustration.
  Used behind the Timeline panel, `background-size: contain` /
  `no-repeat` / anchored top-center so it scales to the column without
  cropping.
- Both currently render at `opacity: 0.05` — faint enough to read as
  texture, not pattern, well clear of interfering with checkpoint/
  alternative text legibility.
- Applied consistently across all three responsive layouts (phone tabs,
  tablet split, desktop split) via a shared helper, not duplicated
  per-breakpoint.

### Asset inventory for Recraft generation

Status as of this writing — compiled by scanning current icon/image usage
in `src/`.

**Shipped:**

- **Banner / hero art** —
  `src/components/auth/SignInPage.tsx` (`hero-banner.svg` +
  `signin-bg.svg`) and `src/components/trips/TripSelectorScreen.tsx`'s
  empty-trip state (`empty-state-banner.svg`, covering the "empty trip"
  state under "States worth designing deliberately" above).
- **App icon** — `app-icon.svg`, used inline in `AppShell.tsx`'s toolbar.
  Note this is _not yet_ wired as the actual favicon/PWA icon (see below)
  — it's only used within the app UI itself so far.
- **Decorative textures** — see above; not originally scoped in this
  inventory but added during the reskin as a second texture pass.

**Still pending:**

**Checkpoint type icons** (highest priority — this is the app's core
iconography per "type is communicated by icon shape, not color" above).
Defined in `src/components/timeline/CheckpointIcon.tsx`, used on both the
timeline and the map pins, so they must work at both scales — still
plain MUI defaults, unchanged since this reskin started:

- `flight` (currently MUI `Flight`)
- `train` (MUI `Train`)
- `metro` (MUI `Subway`)
- `hotel` (MUI `Hotel`)
- `poi` (MUI `Place`)
- `other` (MUI `RadioButtonUnchecked` — fallback/default)

Needs: one consistent set, simple silhouettes (not overly detailed), a
single line weight, and both a neutral and an accent-filled variant per
icon (for the current/next state described under "The timeline").

**App icon / favicon / PWA icons** — `app-icon.svg` exists (see
"Shipped" above) but isn't wired into `index.html`'s favicon or the PWA
manifest's `icons` array (`vite.config.ts`) yet; the manifest's
`theme_color`/`background_color` also still reference the pre-reskin
Material blue/white, not the palette above:

- App icon, 192×192 and 512×512, plus a maskable variant
- Favicon
- Apple touch icon

**Out of scope for the reskin**: generic UI/action icons (nav tabs,
delete, add, layers, chevrons, offline-wifi, logout) and the Google brand
icon — leave these as MUI defaults unless the icon language is redone
wholesale.
