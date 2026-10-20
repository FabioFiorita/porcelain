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

## What it is

All changes opens one scrollable document of every current changed file, also with a published review. It includes unexplained files, deleted files and specs. With a review published, the files come in walkthrough order, each with the name of its stop beside it ("<n>. <decision title>", "Not explained" or "Specs"), and the agent's notes carry decision-numbered markers such as "1.2". Each file can be collapsed and marked reviewed; the bulk mark covers the same complete file set. Unsupported content is listed, not silently removed.

## How a user reaches it

- Review (sheet at phone width, dialog "Worktree review") → tab "Review" → nav "Walkthrough" → button "All changes". The file count appears in the opened document's toolbar.
- With no review published, the handoff tab "Changes" is the same document.

## Driving it

`$C start --review-sample`; pair your browser. The architecture is committed in its published revision. In the card's fixture repository, remove `packages/workspace/src/actor.ts` and append a line to `tests/publish-note.spec.ts`. There are now five current changes: the deleted actor, policy, revoke-access, the unexplained migration script and the spec. These are current worktree changes; the retained review's committed file count is a separate inventory.

1. Open Review → tab "Review" → button "All changes".
   Look for: the All changes document with "5 files" and button "Mark all 5 files reviewed". The revoke-access change retains its decision's agent notes.
2. Click "Collapse all", scroll to the end and expand an individual file.
   Look for: all five paths, including the removed packages/workspace/src/actor.ts, scripts/migrate-workspaces.ts and tests/publish-note.spec.ts. Expanding a file restores its content.
3. Click "Mark all 5 files reviewed" and wait for "Unmark all" to become enabled.
   Look for: `$C server reviewed-files` holds exactly those five marks. The bulk action records current-file marks, not a reviewed decision on the retained revision.
4. Click "Unmark all" and wait for "Mark all 5 files reviewed" to become enabled.
   Look for: `$C server reviewed-files` holds no marks.
5. Reload the All changes document. Repeat at 414 × 896.
   Look for: its complete file count, bulk actions and file folding stay reachable. The separate Specs document is covered by [reviews.spec-files](reviews.spec-files.md).

## What proves it works

- Steps 3 and 4 read the server marks after each bulk action.
- `apps/web/spec/integration/reviews-all-changes.test.tsx`: with five current changes after publication, "All changes" opens "5 files"; "Mark all 5 files reviewed" leaves all five marks on the server, including the unexplained scripts/migrate-workspaces.ts, deleted packages/workspace/src/actor.ts and tests/publish-note.spec.ts; "Unmark all" leaves none and offers "Mark all 5 files reviewed".
- The Spec files E2E journey checks that marking a Specs document excludes ordinary source files.

## Gotchas

- The bulk count leaves out current files already reviewed. Unmark first if the fixture has marks from an earlier run.
- Files committed in a retained review are not all current worktree changes. Use the retained walkthrough to read the complete published revision.
