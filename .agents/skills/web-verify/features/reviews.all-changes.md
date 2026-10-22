---
route: /
selectors:
  - "All changes"
  - "Collapse all"
  - "Expand all"
  - "Mark all"
tests:
  - apps/web/spec/integration/reviews-all-changes.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.all-changes

All changes opens one scrollable document of every current changed file, also with a published review.

## Sub-features

- `reviews.all-changes` — Review-wide changes and file selection.

## How to get to it (user POV)

- Review (sheet at phone width, dialog "Worktree review") → tab "Review" → nav "Walkthrough" → button "All changes". The file count appears in the opened document's toolbar.
- With no review published, the handoff tab "Changes" is the same document.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Required instance mode: `$C start --review-sample`. Before loading, remove `"$REPO/packages/workspace/src/actor.ts"` and append a line to `"$REPO/tests/publish-note.spec.ts"`. Expect five current changes: deleted actor, policy, revoke-access, unexplained migration and spec. The retained revision inventory is separate.

It includes unexplained files, deleted files and specs. With a review published, the files come in walkthrough order, each with the name of its stop beside it ("<n>. <decision title>", "Not explained" or "Specs"), and the agent's notes carry decision-numbered markers such as "1.2". Each file can be collapsed and marked reviewed; the bulk mark covers the same complete file set. Unsupported content is listed, not silently removed.

1. Open Review → tab "Review" → button "All changes".
   Expect: the All changes document with "5 files" and button "Mark all 5 files reviewed". The revoke-access change retains its decision's agent notes.
2. Click "Collapse all", scroll to the end and expand an individual file.
   Expect: all five paths, including the removed packages/workspace/src/actor.ts, scripts/migrate-workspaces.ts and tests/publish-note.spec.ts. Expanding a file restores its content.
3. Click "Mark all 5 files reviewed" and wait for "Unmark all" to become enabled.
   Expect: `$C server reviewed-files` holds exactly those five marks. The bulk action records current-file marks, not a reviewed decision on the retained revision.
4. Click "Unmark all" and wait for "Mark all 5 files reviewed" to become enabled.
   Expect: `$C server reviewed-files` holds no marks.
5. Reload the All changes document. Repeat at 414 × 896.
   Expect: its complete file count, bulk actions and file folding stay reachable. The separate Specs document is covered by [reviews.spec-files](reviews.spec-files.md).

### Observable proof

Read independent server marks after each bulk action; Specs-document marking must exclude ordinary files.

Automated coverage: `reviews-all-changes.test.tsx`.

## Gotchas

- The bulk count leaves out current files already reviewed. Unmark first if the fixture has marks from an earlier run.
- Files committed in a retained review are not all current worktree changes. Use the retained walkthrough to read the complete published revision.
