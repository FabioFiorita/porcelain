---
route: /
selectors:
  - "All changes"
  - "Open all specs"
  - "Collapse all"
  - "Expand all"
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

All changes opens a scrollable document of every current changed file, even with a published architecture review. It includes unexplained files, deleted files and specs. Each file can be collapsed and marked reviewed; bulk marks use the same complete file set. Unsupported content is explicitly listed, not silently removed.

## Driving it

`$C start --review-sample`; pair your browser.

1. Open Review → in the Worktree review dialog choose Review tab → All changes · 55 files. Expect the All changes document and 55 files.
2. Collapse all, scroll to the end and expand an individual file. The document includes scripts/migrate-workspaces.ts, the removed legacy-write.ts and eight specs as well as files linked to walkthroughs.
3. Mark all 55 files reviewed and wait for Unmark all to become enabled. `$C server reviewed-files` contains 55 marks, including migration, legacy and test files. Layer understanding and incomplete explanation coverage remain independent.
4. Unmark all, wait for Mark all 55 files reviewed to become enabled and verify no file marks remain. Enable Spec files in Settings, return, then Open Review → expand Specs → Open all specs. Expect Specs · eight files. Mark all eight; only tests are marked in the server readback.
5. Return to All changes through its document tab. Ordinary files still need review. Reload and verify both document tabs restore. At 414 × 896, toolbar actions, file folding and the Specs section remain reachable.

## What proves it works

The named integration spec checks persisted marks for all 55 changed files, including unexplained and removed code. The Spec files E2E journey checks that marking a Specs document excludes ordinary source files.
