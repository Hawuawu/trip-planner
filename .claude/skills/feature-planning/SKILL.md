---
name: feature-planning
description: Researches prior GitHub issues (open and closed) and the current codebase before proposing a new feature for the trip-planner app, then drafts and — after explicit user go-ahead — files a GitHub issue in this repo's established style. Use when asked to plan a new feature, evaluate a feature idea against existing issues/code, or turn a request into a well-grounded GitHub issue.
---

# Feature Planning

Turns a feature idea into a well-grounded GitHub issue for `Hawuawu/trip-planner`:
search prior issues (open and closed) for related or duplicate work, analyze the
actual current code against this repo's architecture rules and conventions, draft
an implementation proposal, and — only after explicit user go-ahead — file it via
`gh issue create` in this repo's established issue style.

## 1. Get the feature intent

If invoked with an argument, treat it as the feature description. Otherwise ask
the user what feature to plan. If the description is too vague to research (a bare
noun phrase with no stated problem or use case), ask one clarifying question about
the concrete need before proceeding — don't invent scope to fill the gap.

## 2. Search prior issues, open and closed

```
gh issue list --state all --limit 200
```

Skim titles for plausible matches (this repo is small enough that this beats
trusting `--search` alone), then `gh issue view <n>` on each plausible hit and
read the full body. Classify every hit:

- **Exact/near-duplicate, still open** → triggers the duplicate hard-stop in step 4a.
- **Closed, looks already-shipped** → not proof by itself — verify against real
  code in step 3.
- **Related but distinct** (adjacent feature, a prior decision that constrains
  this one, an established pattern to reuse) → cite it by number in the drafted
  Context section.
- **Unrelated** → ignore.

## 3. Read standing conventions, then analyze real code

Read `CLAUDE.md` and `STANDARDS.md` in full before analyzing — don't rely on
memory of them. Pay particular attention to: the architecture rule (no
component/store ever imports `firebase/*` directly; all data access goes through
`TripRepository`; only `FirebaseTripRepository` touches Firestore/Firebase APIs),
the data model, TypeScript/testing/git conventions.

Then ground the analysis in actual file reads — real paths, real line
counts/current behavior, not assumptions. Typical places to look: `src/types/index.ts`,
`src/data/TripRepository.ts` and its implementations (`firebaseTripRepository.ts`,
`localTripRepository.ts`), the relevant components/hooks/stores, and existing
tests for the area.

## 4. Handle what the analysis reveals, before drafting anything

- **4a. Duplicate found** (a still-open issue from step 2 substantially
  overlaps) — stop. Surface the issue number, title, and URL to the user, and ask
  whether to proceed anyway (scope has diverged), fold this request into a comment
  on the existing issue instead, or narrow this proposal to the delta not covered
  by it. Never silently file a second issue for the same work.
- **4b. Partially already implemented** — reframe as a gap-closing issue citing
  exactly what exists vs. what's missing, rather than a from-scratch design.
- **4c. Spans multiple independent chunks of work** — flag this in the draft and
  suggest splitting into follow-up issues rather than filing one oversized issue.
- **4d. Conflicts with an established architecture rule or past decision** (e.g.
  reaching for `firebase/*` in a component, local `useState` for something that's
  Zustand's job) — surface the conflict explicitly in the draft rather than
  quietly designing around it.

## 5. Draft the issue

Use the template below, filled entirely from what steps 2-4 actually found. Omit
a section rather than write "N/A" if it doesn't apply. Only attach a label
(`gh label list` to see current options — `feature` is the common case) if it's
an unambiguous fit; leave unlabeled otherwise, matching most existing issues.

```markdown
# Feature: <short, specific description>

## Context

Why this is being proposed, what prompted it, related issues cited by number
(e.g. "See #21"). If no related prior issues were found, say so explicitly
rather than omitting the check silently.

## Ground truth (verified directly against current code)

Exact file paths, line counts/ranges, and current behavior as actually read in
step 3 — not inferred. For an audit/gap-closing issue (case 4b), use
`## Current state` instead of this heading.

## Design / Scope / What to implement

File-by-file, generally in implementation order. Use real interface
signatures/code snippets where they clarify the shape, matching this repo's
actual TypeScript conventions from STANDARDS.md. (Pick whichever of
Design/Scope/What to implement reads best for this issue — they're
interchangeable heading choices, not three separate sections.)

## Test cases

Exact new or extended test files (co-located `*.test.tsx` per STANDARDS.md, or
`src/test/*.test.ts` for store/integration tests) and the specific cases each
should cover.

## Open questions for implementation

Judgment calls intentionally left open — cosmetic choices, tradeoffs flagged but
not resolved.

## Out of scope

What this issue explicitly does not cover, and why (often an adjacent area that
could be a follow-up issue, especially if case 4c applied).

## Verification

- `npm test`, `npm run build && npm run lint` clean; coverage thresholds (85/80/80/85) apply to new code.
- Manual QA steps specific to this feature.
```

## 6. Show the draft and get explicit go-ahead

This is a hard stop, not optional. Render the complete title + body in the chat
response, exactly as it would be passed to `gh issue create`, then ask something
like "Create this issue as-is, or would you like changes first?" Only proceed to
step 7 on an explicit affirmative in a later turn — never in the same turn that
produced the draft.

## 7. On confirmation, create the issue

```
gh issue create --title "Feature: <short description>" --body "$(cat <<'EOF'
<drafted body>
EOF
)" [--label feature]
```

Report back the created issue's number and URL. Mention (don't create) the
expected next branch name `feat/<number>-<slug>` — this skill's job ends at
filing the issue; it does not create branches or write implementation code.
