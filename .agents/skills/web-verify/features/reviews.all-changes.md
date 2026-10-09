---
route: /
selectors:
  - "All changes"
  - "Open all specs"
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

- Review (sheet at phone width, dialog "Worktree review") → tab "Review" → nav "Walkthrough" → button "All changes · N files".
- With no review published, the handoff tab "Changes" is the same document.

## Driving it

`$C start --review-sample`; pair your browser. The sample has 55 changed files, six of them already reviewed by the first decision.

1. Open Review → tab "Review" → button "All changes · 55 files".
   Look for: the All changes document with "55 files"; the first files are the first decision's, each with "1. Invite a teammate" beside it; button "Mark all 49 files reviewed".
2. Click "Collapse all", scroll to the end and expand an individual file.
   Look for: scripts/migrate-workspaces.ts marked "Not explained", the removed packages/workspace/src/legacy-write.ts, and the specs, as well as the decision files.
3. Click "Mark all 49 files reviewed" and wait for "Unmark all" to become enabled.
   Look for: `$C server reviewed-files` holds 55 marks, including scripts/migrate-workspaces.ts, packages/workspace/src/legacy-write.ts and tests/invite-member.spec.ts. `$C server reviewed-layers` is unchanged: marking files records no decision.
4. Click "Unmark all" and wait for "Mark all 55 files reviewed" to become enabled.
   Look for: `$C server reviewed-files` holds no marks.
5. Enable Spec files in Settings, return, then open Review, expand "Specs · 8 files" and click "Open all specs".
   Look for: the Specs document with "8 files". Marking all eight marks only tests in the server readback.
6. Return to All changes through its document tab, reload, and check both document tabs restore. Repeat at 414 × 896.
   Look for: toolbar actions, file folding and the Specs section stay reachable.

## What proves it works

- Steps 3 and 4 read the server marks after each bulk action.
- `apps/web/spec/integration/reviews-all-changes.test.tsx`: with the sample, "All changes · 55 files" opens "55 files"; "Mark all 49 files reviewed" leaves 55 marks on the server, including scripts/migrate-workspaces.ts, packages/workspace/src/legacy-write.ts and tests/invite-member.spec.ts; "Unmark all" leaves none and offers "Mark all 55 files reviewed".
- The Spec files E2E journey checks that marking a Specs document excludes ordinary source files.

## Gotchas

- The bulk count leaves out files already reviewed: the sample starts with six, so it offers 49, not 55.
- Run step 3 last in a session that also drives the walkthrough, or unmark afterwards: the marks change the walkthrough's counts.
