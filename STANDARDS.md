# Development standards

Coding conventions and development philosophy for the trip-planner web
app (`src/`). Referenced from `CLAUDE.md` — read this before writing or
reviewing non-trivial code changes.

## Development philosophy

- **Keep it simple / YAGNI.** Prefer the direct, obvious implementation.
  This is a two-person travel app, not a platform — don't add config,
  plugin points, or generic layers for requirements that don't exist yet.
- **Rule of Three.** Duplication isn't automatically bad. Three similar
  call sites beat one premature shared abstraction — wait for a real
  third occurrence before extracting a helper/hook/component.
- **Single responsibility, small units.** A component/function/hook
  should do one thing. If a component file is doing data-fetching
  orchestration, form state, and rendering all at once, that's a sign to
  split it (e.g. the store handles data, the component handles rendering
  and local UI state only) — not a hard line-count rule, a smell to
  notice.
- **Composition over inheritance.** This codebase has no class
  hierarchies; keep it that way. Share behavior via hooks/functions, not
  base classes or HOC chains.
- **Explicit over implicit, fail fast.** Don't silently coerce or default
  away an invalid state. If a precondition is violated, let it
  throw/type-error close to the source rather than papering over it
  several calls downstream.
- **Validate only at system boundaries.** Trust internal function
  signatures and TypeScript's guarantees; don't re-validate a value
  already narrowed by a type or by the architecture rule (e.g.
  `FirebaseTripRepository` is the only place a raw Firestore error shape
  can appear — nothing past it needs to re-check for one).
- **Prefer immutability and pure functions** where practical. Zustand
  state updates use `set()` with new objects/arrays rather than mutating
  in place (see any `updateX` action in `src/store/tripStore.ts`); pure
  helper functions (`src/utils/`) take inputs and return outputs rather
  than reaching into shared state.
- **Avoid deep nesting; prefer early returns.** Guard clauses at the top
  of a function beat wrapping the whole body in nested `if`/`if`/`if`.
- **Descriptive naming, no abbreviations.** Match the codebase's existing
  style (`updateCheckpoint`, not `updChk`) — a good name makes a comment
  unnecessary.
- **No premature optimization.** Don't reach for `useMemo`/`useCallback`,
  manual memoization, or micro-optimized loops without a concrete reason
  (see "Hooks and effects" below).
- **No speculative error handling.** Don't add try/catch, fallbacks, or
  validation for scenarios that can't happen given the code's own
  guarantees; only handle errors at real boundaries (network calls, user
  input, third-party SDKs).
- **No backwards-compatibility shims or feature flags for internal
  code.** When changing an internal API, change its call sites — don't
  keep an old signature alive "just in case" or gate new behavior behind
  a flag for code nothing else depends on yet.
- **Comment discipline.** No comments that restate what the code does. A
  comment earns its place only by explaining a non-obvious _why_ (a
  hidden constraint, a workaround, a subtle invariant) — see
  `src/utils/inviteErrors.ts` and the `useRef` example under "Hooks and
  effects" for the house style.

## TypeScript conventions

- `strict` mode is on, plus `noUnusedLocals`, `noUnusedParameters`, and
  `noFallthroughCasesInSwitch` (see `tsconfig.json`). Write code that's
  clean under these — don't disable them per-file.
- Use `import type { ... }` for type-only imports. The compiler doesn't
  require this (`isolatedModules` doesn't force it), but it's house style
  for clarity about what's erased at build time.
- No enums. Use string-literal union types instead, e.g.
  `type CheckpointType = 'flight' | 'train' | 'metro' | 'hotel' | 'poi' | 'other';`
- Entities are `interface`s with a required `id: string` field (see
  `src/types/index.ts`).
- Use discriminated unions for operation results that can succeed or fail
  in more than one distinct way — see `InviteMemberResult`, not a
  boolean plus an optional error string.
- Typing repository methods: creation payloads are
  `Omit<Entity, 'id' | 'updatedAt'>`, update payloads are
  `Partial<Omit<Entity, 'id' | 'updatedAt'>>`. This is the canonical
  shape for any new `TripRepository` method — see
  `src/data/TripRepository.ts` for the existing pattern before adding a
  new one.
- `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are **not**
  enabled — don't assume array/index access is narrowed to
  `T | undefined` by the compiler. If you index into an array from an
  unvalidated source, guard it explicitly.

## React component conventions

- Components are named function declarations:
  `export function ComponentName(props: Props) { ... }`. No
  arrow-function consts, no `React.FC`.
- Props are typed via a named `interface Props` declared directly above
  the component — not `type Props =`, not inlined into the function
  signature.
- Named exports only, with one intentional exception: `src/App.tsx` uses
  `export default function App()` because it's the root-mounted
  component. Don't add a second default export elsewhere in `src/`.
- `jsx: react-jsx` — no `import React from 'react'` needed for JSX.
- Style with MUI's `sx` prop inline; don't extract `styled()` components
  for one-off styling.
- **Reading from the Zustand store: use a per-field selector**,
  `useTripStore((s) => s.field)`, not whole-store destructuring
  (`const { a, b } = useTripStore()`). Selectors avoid re-rendering on
  unrelated state changes and are already the majority pattern
  (`AppShell.tsx`, `BookingPanel.tsx`, `SignInPage.tsx`,
  `PendingApprovalPage.tsx`, `AppAccessDialog.tsx`). Existing whole-store
  call sites (`TimelineView.tsx`, `AlternativesShelf.tsx`) don't need to
  be rewritten just to conform — use selectors for new/changed code.
- **Type callback props with method shorthand** — `onSelect(): void;` —
  not arrow-function type syntax (`onBack: () => void;`). Method
  shorthand is the majority pattern (see `CheckpointMarker.tsx`'s
  `Props`); use it for new props even though `App.tsx`'s `onBack`
  predates this and stays as-is.

## Hooks and effects

- Custom hooks live in `src/hooks/`, named `useXxx.ts`, and return a
  plain object (not a tuple) so call sites can destructure by name.
- Use `useMemo`/`useCallback` deliberately, not reflexively. Reach for
  them only when there's a concrete reason — an expensive derived
  computation, or a value that must stay referentially stable because a
  downstream effect/callback depends on it. Don't wrap trivial
  expressions or every inline function "just in case."
- **No `eslint-disable` comments anywhere in this codebase, including
  `react-hooks/exhaustive-deps`.** `npm run lint` runs with
  `--max-warnings 0`, so an unaddressed `exhaustive-deps` warning fails
  the build anyway — but even where it wouldn't, don't silence it with a
  disable comment. There are currently zero `eslint-disable` comments in
  `src/`; keep it that way.
- When a value legitimately shouldn't be an effect dependency (e.g. you
  want the _latest_ value at trigger time without re-running the effect
  every time it changes), use the ref-escape-hatch: mirror the value into
  a `useRef`, updated on every render, and read `ref.current` inside the
  effect. Always add a one-line comment explaining _why_ the value is
  read via ref instead of listed as a dependency. See
  `src/components/alternatives/AlternativesShelf.tsx`:

  ```tsx
  // Read via a ref so a fresh `prefill` value doesn't need to be listed as an
  // effect dependency — only a new openAddSignal should (re)open the drawer.
  const prefillRef = useRef(prefill);
  prefillRef.current = prefill;

  useEffect(() => {
    if (openAddSignal === undefined) return;
    setAddPrefill(prefillRef.current ?? undefined);
    setAddOpen(true);
  }, [openAddSignal]);
  ```

## State management (Zustand)

- One store per domain (`tripStore.ts`, `authStore.ts`). No slices, no
  middleware (no `persist`, no `devtools`).
- The state interface declares data fields and action method signatures
  together, with actions typed via method shorthand, e.g.
  `init(tripId: string, repo: TripRepository): void;` — see the
  `TripState` interface in `src/store/tripStore.ts`.
- Async store actions that mutate shared entities follow this canonical
  optimistic-update pattern — use it for any new mutating action:
  1. Snapshot the current state via `get()`.
  2. Update local state immediately (optionally inserting a placeholder
     entity with an `__optimistic-<id>` id when the server will assign
     the real id, e.g. `addCheckpoint`).
  3. `await` the repository call.
  4. On success, reconcile local state with the server response (e.g.
     replace the optimistic placeholder with the saved entity).
  5. On failure, roll back to the snapshot taken in step 1.
- See `updateCheckpoint`/`deleteCheckpoint`/`updateAlternative` in
  `src/store/tripStore.ts` for the rollback shape, and `addCheckpoint`
  for the optimistic-placeholder shape.

## Error handling

There's no `ErrorBoundary` and no global toast/snackbar in this app.
Error handling is local and split by where the async call originates:

- **User-initiated writes awaited directly in a dialog/form** (e.g.
  submitting an invite, signing in) should `catch` the rejection and
  surface it as inline UI: a `useState<string | null>` error field
  rendered as an MUI `<Alert severity="error">`, or as `TextField`'s
  `error`/`helperText` for field-level validation.
- **Optimistic Zustand store actions** (`updateCheckpoint`,
  `deleteCheckpoint`, and similar) catch repository failures, roll back
  to the pre-optimistic state, and swallow the error — no message is
  surfaced. This is intentional: the UI has already reverted to the
  correct (pre-edit) state, so there's nothing stale left to warn about.
  Don't add a toast/alert to these catch blocks.
- Some store actions (`addCheckpoint`, `reorderCheckpoints`,
  `inviteMember`) have **no** try/catch at all and let the rejection
  bubble up to the caller. This is correct when the caller is a
  dialog/form that's already going to catch-and-display per the first
  bullet — don't add a redundant catch in the store action too.
- **Rule of thumb for a new async store action**: if failure should
  silently revert an already-optimistic UI update, catch and roll back
  with no message (second bullet). If failure needs to be shown to the
  user as "your action didn't go through," let it bubble and catch it at
  the call site instead (first bullet). Don't do both.
- For turning a raw Firebase error into a user-facing message, follow
  `src/utils/inviteErrors.ts`'s `extractInviteErrorMessage` /
  `extractSignInErrorMessage` pattern: normalize known error codes to a
  specific message, fall back to a generic "please try again" string
  rather than showing a raw Firebase error code or JSON blob. Add new
  `extractXErrorMessage` helpers there (or alongside it) rather than
  inlining ad hoc error-string logic in a component.

## Testing conventions

- Vitest + `@testing-library/react`. Use `describe`/`it`. Query by role,
  label, or text — not snapshots, not `data-testid`. Fall back to
  `querySelector` only for MUI internals that expose no accessible role.
- Always render through `renderWithProviders()` from
  `src/test/helpers.tsx` (wraps `ThemeProvider`) instead of RTL's raw
  `render`.
- Call `resetStores()` (also in `src/test/helpers.tsx`) in `beforeEach`
  to reset Zustand state between tests.
- Any test touching store or repository behavior must use a
  `makeMockRepo(overrides)` factory implementing the full
  `TripRepository` interface (see `src/test/tripStore.test.ts`) — never
  mock the Firebase SDK directly. This keeps the repository-abstraction
  rule honest: if a test needs to reach into Firestore internals, that's
  a sign the code under test is leaking past `TripRepository`.
- **New component test files should be co-located**:
  `ComponentName.test.tsx` next to `ComponentName.tsx` (see
  `src/components/timeline/BookingPanel.test.tsx`,
  `src/components/alternatives/AlternativesShelf.test.tsx`). This is the
  canonical location going forward.
- `src/test/` remains the home for store tests, integration/smoke tests,
  and shared test infrastructure (`helpers.tsx`, `setup.ts`) that have no
  single component to colocate with — not for new component tests.
- `.firebase.test.ts` suffix marks emulator-backed tests, run separately
  via `npm run test:firebase` (excluded from the default `npm test` run
  in `vitest.config.ts`). Regular `.test.ts`/`.test.tsx` files should
  mock the repository per the rule above, not hit a real or emulated
  backend — reserve `.firebase.test.ts` for tests specifically exercising
  Firestore security rules or Firebase integration behavior.
- Coverage thresholds (enforced in `vitest.config.ts`, gate `npm run
test:coverage`): lines 85%, functions 80%, branches 80%, statements
  85%.

## Git & commit conventions

- Conventional Commits style: `type(scope): imperative lowercase
summary`, no trailing period. Types in use: `feat`, `fix`, `docs`,
  `chore`, `ci`, `test`, `refactor`, `style`, `security`. Scope is
  optional, tied to a folder/feature when present (`map`, `timeline`,
  `trips`, `functions`, `ci`, `data`, `theme`).
- Nontrivial commits (`feat`/`fix`/substantial `ci`/`test`) get a body:
  paragraph(s) explaining _why_, often a bulleted change list, and a
  closing `Verified: ...` line naming what was run to confirm the change.
  Trivial `chore`/one-line `docs` commits can skip the body.
- Add a trailing `Closes #N` line when a commit closes a tracked issue —
  use it when applicable, not on every commit.
- Branch naming: `<type>/<issue-number>-<slug>` when there's a tracked
  GitHub issue (e.g. `feat/56-place-links`), `<type>/<slug>` for
  untracked work. Types: `feat`, `fix`, `docs`, `chore`.
- PR flow: feature/docs/chore branches PR into `develop`; `develop` is
  periodically promoted to `main` via a dedicated `Release: ...` /
  `Promote develop: ...` PR. Hotfixes and urgent CI/infra chores may PR
  straight to `main`. There's no PR or issue template today — that's
  current practice, not a gap this doc is asking you to fix.
- Merges preserve full commit history (real two-parent merge commits) —
  don't squash-merge.
- Already enforced by tooling, not something you need to remember
  manually: `.claude/settings.json` blocks `git commit`/`git push`
  directly on/to `main`; `.husky/pre-commit` runs `lint-staged`;
  `.husky/pre-push` runs `build && security:sast`.

## Accessibility

- Every icon-only button/control gets a specific, entity-aware
  `aria-label` — e.g. `` `Remove ${memberLabel}` ``, not a generic
  `"Delete"` (see `CheckpointItem.tsx`, `AlternativeItem.tsx`,
  `AppAccessDialog.tsx`). Keep doing this for new icon-only controls.
- Modals/menus/toasts always use MUI `Dialog`/`Drawer`/`Snackbar`/`Menu`,
  never a hand-built overlay — this gets focus-trapping and `aria-modal`
  for free.
- Form fields use MUI `TextField label` (or `inputProps aria-label` when
  there's no visible label) — never a manual `<label htmlFor>`.
- Category/type is always shown via icon, not color alone (see
  `CLAUDE.md`'s UI conventions) — apply the same principle to any other
  state distinction you add, not just checkpoint type.
- Tests already query via `getByRole`/`getByLabelText` (see Testing
  conventions above) — treat that as a passive accessibility check too:
  if you can't query an element by role or label, its markup probably
  isn't accessible either.
- **If you give a `Box`/`span`/`div` a `role="button"` and an `onClick`,
  you must also add `tabIndex={0}` and an `onKeyDown` handler** for
  Enter/Space — or, better, just use a real `<button>`/MUI `IconButton`
  instead. `role="button"` alone does not make an element
  keyboard-operable — see [#64](https://github.com/Hawuawu/Trip-Planner/issues/64)
  for existing instances of this gap.
- Known gaps, tracked separately (not fixed by this doc):
  [#64](https://github.com/Hawuawu/Trip-Planner/issues/64) keyboard support
  for `role="button"` elements, [#62](https://github.com/Hawuawu/Trip-Planner/issues/62)
  `MapOrientationBall` has no keyboard equivalent for its pointer-only
  rotate/tilt control, [#65](https://github.com/Hawuawu/Trip-Planner/issues/65)
  selected-state relies on color alone in `CheckpointItem.tsx`/
  `CheckpointMarker.tsx`, [#63](https://github.com/Hawuawu/Trip-Planner/issues/63)
  no `eslint-plugin-jsx-a11y` configured. Also note: `@dnd-kit/*` is
  installed and `reorderCheckpoints` is implemented in `tripStore.ts`,
  but there's no UI caller yet — not an accessibility bug today, but when
  drag-to-reorder is wired up, use `KeyboardSensor` from the start rather
  than bolting on keyboard support afterward.

## Performance

- No route-level code splitting exists. The one real example of
  lazy-loading a heavy optional dependency is
  `src/utils/kanjiReading.ts`, which dynamically imports
  `@sglkc/kuroshiro`/`-kuromoji` on first use — follow this pattern if
  another heavy optional library is added later.
- No `manualChunks` config, no bundle visualizer; the default Vite
  chunk-size warning (500kB) is unmodified.
- Timeline and map both render one item/marker per checkpoint via a
  plain `.map()`, no virtualization or clustering. This is intentionally
  fine at this app's scale (a personal itinerary, dozens not thousands
  of checkpoints) — don't add `react-window`/marker clustering
  speculatively; see the "no premature optimization" rule in Development
  philosophy.
- `React.memo` isn't used anywhere in the codebase. Rely on the
  per-field Zustand selector discipline documented above for render-cost
  control instead of reaching for `memo` by default.
- `tripStore.ts`'s `init()` opens 5 unbatched `onSnapshot` listeners per
  trip. That's an intentional scale assumption for a 1-2-user personal
  trip planner, not a gap that needs batching/debouncing.

## Security practices

- CI already gates on: a `security` job running `npm run security:sast`
  (ESLint security plugins) and `npm run security:dast`
  (`scripts/dast.mjs` — a Playwright smoke test checking security
  response headers are present, that unauthenticated users see a sign-in
  gate rather than trip data, and that an XSS probe never executes), plus
  a separate `codeql.yml` CodeQL workflow. You don't need to re-run these
  manually — they run in CI — but know what they cover.
- Firestore rules pattern for any new rule: gate on **both**
  `hasAppAccess()` (the approval-based custom claim, stamped only by a
  server-side blocking function) **and** trip membership
  (`isMember(tripId)`) — never just one. Match new subcollections
  explicitly rather than relying on a wildcard sibling match — Firestore
  ORs all matching rule blocks for a path, so a wildcard neighbor can
  silently grant broader access than intended (see the `activityLog`
  rule's explicit-match comment in `firestore.rules`). Admin-only
  collections (`allowedUsers`, `accessRequests`, `appActivityLog`) are
  `write: false` for clients — all mutations go through the Admin SDK in
  Cloud Functions, never a client write. Prefer field-scoped update rules
  (`diff().affectedKeys().hasOnly([...])`) over a blanket "any member can
  update any field" rule.
- Secrets: `.env*` is gitignored (only `.env.example` is tracked).
  `VITE_FIREBASE_*` client config values are intentionally public per
  Firebase's web-config model — access control is enforced by Firestore
  rules, not by hiding the API key, so don't treat them as secrets
  needing extra protection. Real secrets (service account keys, admin
  tokens) belong server-side only, in `functions/`, never in `src/`.
- No `dangerouslySetInnerHTML` anywhere; `eslint-plugin-no-unsanitized`
  enforces this. Forward-looking note for when `react-markdown` lands
  (tracked as issue #55): it doesn't use `dangerouslySetInnerHTML` by
  default, so no extra sanitizer step should be needed — don't add
  `rehype-raw` (which would reintroduce raw HTML injection) without a
  deliberate reason.
- Client-side `appAccess`/admin checks (`Root.tsx`,
  `TripSelectorScreen.tsx`) are UX routing only, never the actual
  security boundary — Firestore rules are. Any new feature must enforce
  access in `firestore.rules`, not just hide a button/route client-side.
- CSP / `X-Frame-Options` / `X-Content-Type-Options` headers are mirrored
  across all three deploy targets — `firebase.json`'s `hosting.headers`,
  `vite.config.ts`'s `preview.headers`, and `nginx.conf` (the Docker/nginx
  target) — keep them in sync when editing any one of them (#61). The CSP
  additionally allowlists `https://apis.google.com` in `script-src` and a
  `frame-src` for `https://*.firebaseapp.com`/`https://accounts.google.com`,
  required by Firebase Auth's `signInWithPopup` Google sign-in flow (#117);
  `scripts/dast.mjs` asserts this content, not just header presence.
- Every trip mutation must be auditable via the activity log — enforced
  structurally, not by convention. `functions/src/logTripEntityActivity.ts`
  and `logTripActivity.ts` are Firestore triggers on
  `trips/{tripId}/{collectionId}/{docId}` and `trips/{tripId}` that write
  the activity log entry themselves, reacting to a `lastModifiedBy: {
uid, label }` field stamped on every write (client-side, by every
  `TripRepository` implementation that touches Firestore — see #102). A
  new mutation doesn't need to add its own logging call; it only needs to
  stamp `lastModifiedBy`, and `firestore.rules` rejects writes that omit
  it or spoof someone else's uid. This is why activity logging survived
  the MCP server (`mcp/`) existing as a fully separate client with no
  shared code path to the main app's old client-side logging helper — the
  trigger fires regardless of which client wrote the document. Known
  accepted limitation: on delete, there's no request payload to read an
  actor from, so the entry is attributed to whoever last created/updated
  the doc (`before.lastModifiedBy`), not necessarily whoever deleted it.
