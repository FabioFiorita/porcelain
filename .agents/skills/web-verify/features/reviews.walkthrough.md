---
route: /
selectors:
  - "Review walkthrough"
  - "Walkthrough progress"
  - "Open the briefing"
  - "Briefing"
  - "Files reviewed"
  - "Decisions reviewed"
  - "What this adds to the system"
  - "The walkthrough"
  - "Not explained"
  - "Existing code it relies on"
  - "Mark decision reviewed"
tests:
  - apps/web/spec/integration/reviews-walkthrough.test.tsx
  - apps/web/spec/integration/reviews-walkthrough-shortcuts.test.tsx
  - apps/web/spec/integration/reviews-unavailable-completion.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
  - GET /api/reviews/:reviewId
  - GET /api/reviews/:reviewId/revisions/:revision/file
  - POST /api/reviews/:reviewId/revisions/:revision/diffs
  - GET /api/reviews/:reviewId/marks
  - PUT /api/reviews/:reviewId/marks
---

# reviews.walkthrough

The verdict precedes the existing briefing and walkthrough. The briefing retains system owners, New/Changed/Removed groups, Needs your decision, decision order and Not explained. Each decision reads code from its immutable revision. Context files and their stored excerpts remain available after worktree removal.

## Sub-features

- `reviews.walkthrough` — Briefing, decision navigation and completion.

## How to get to it (user POV)

- Worktree Review tab → decision row; review page → Start here or a decision.
- N / P move between stops; Open the briefing returns to the overview.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Follow [reviews.page](reviews.page.md) for setup, widths, themes and lifecycle. In the worktree Review tab the sidebar decision rows open this same page. In the page, select a decision or Start here; N and P move between stops. Open the briefing returns to owners and progress. A decision records its available files before its decision mark; unmarking the decision leaves file marks. Worktree edits do not change retained code or its marks. Branch commits ahead of the latest revision are reported separately.

Automated coverage: `reviews-walkthrough.test.tsx`, `reviews-walkthrough-shortcuts.test.tsx`, `reviews-unavailable-completion.test.tsx`.

## Gotchas

- Retained published code intentionally differs from later worktree edits; compare against the selected revision.
