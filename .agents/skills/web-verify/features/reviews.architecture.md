---
route: /
selectors:
  - "Architecture overview"
  - "Architecture"
  - "Before"
  - "After"
  - "Focus on selection"
  - "Show entire map"
  - "Show all changes in this file"
tests:
  - apps/web/spec/integration/reviews-architecture.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
  - GET /api/worktrees/:worktreeId/reviewed-layers
---

# reviews.architecture

## What it is

The review opens an architecture map with before and after views, short component labels, selectable relationships and code walkthroughs. Reading progress, stale explanations and unexplained changes remain separate. Relationships are agent descriptions, not independently verified call traces.

## Driving it

`$C start --review-sample` (also `pnpm dev:review`) creates an entirely synthetic repository with eight behaviors, four shared owners, a removed legacy write path, nine walkthroughs and sixty code locations. It includes staged, unstaged, untracked and deleted files, partial explanation coverage, a changed code pointer and an unresolved architectural decision. No private project source is copied. Pair your browser using the connection card.

1. At 1440 × 1000, open Review → Review tab → Architecture overview. Expect Architecture selected, "1 of 9 walkthroughs reviewed · 8 left", an unexplained-files action and "1 code location changed". No long introductory paragraphs precede the map. Cards wrap into at most three columns and start at readable size at the top; scroll or pan down to see remaining rows and owners.
2. Open combobox "Select architecture component", then click option "Delivery outbox". Its ownership trace contains only the owner and its two callers, with connection lines in a clear gutter. Labels and the unresolved transaction ownership decision appear in the inspector. The complete map draws no crossing connection web.
3. Selection focuses automatically. Expect "Showing 3 of 13 components". Show entire map restores all thirteen without crossing connections; Focus on selection returns to the trace. Every component remains available through the selector.
4. Select Before and Page-owned writes. Its detail explains independent page writes. Select After: the removed legacy component explains the shared-owner replacement.
5. Follow Revoke access across devices. Code opens all current changes across its files. Select Graph → Domain. Expect "Code changed since the review was written." and an explicit excerpt range, with no whole-file review mark.
6. In Graph open combobox "Select code location" and choose an option: only its snippet opens. Code returns to the continuous file document, with individual reviewed controls and existing context at the bottom. Expand Architectural intent and Verification evidence when needed. The sample claims no passing application checks.
7. Show all changes in this file opens the complete diff; Open file opens its source. Return through the walkthrough and overview tabs. The unexplained-files action exposes the new migration script and the uncovered policy change.
8. Repeat selection, focus/reset, walkthrough navigation and full-file actions at 414 × 896. Controls remain reachable without a clipped desktop-width pane. Check light and dark themes and reload the architecture overview.
9. Read `$C server published-review` and compare the nine walkthroughs, thirteen after components and incomplete coverage to the displayed progress. Inspect review HTTP 200 responses and console diagnostics with the browser driver. Close the browser session and stop the owned instance unless it is intentionally left as a requested playground.

## What proves it works

The integration spec exercises shared-owner relationships, focus counts, before/after details, partial coverage and stale excerpts. Shared rule tests ensure reading order never fabricates arrows and stale code cannot count toward completed understanding. Live driving checks scale, navigation and viewport layout.

## Gotchas

The graph is authored by the publishing agent. A missing relationship stays unspecified; absent linked code is stated explicitly. File marks do not imply all decisions were understood, and completed walkthroughs do not imply all changed code was explained. The native mobile application has a separate interface.
