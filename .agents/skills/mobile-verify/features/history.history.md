---
screen: /history
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'History'
  - 'Select a worktree to continue.'
  - 'No commits yet'
  - "Couldn't load history"
  - 'No upstream'
  - 'Detached HEAD'
  - 'Uncommitted changes'
  - 'Retry branch status'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/features/history/rules/status.spec.ts
  - apps/mobile/src/features/history/rules/commit-age.spec.ts
  - packages/client/src/features/history/rules/presentation.spec.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/commits
  - GET /api/worktrees/:worktreeId/git/status
---

# history.history

History is read-only. It shows the selected branch's ahead/behind counts against its named upstream, an uncommitted-files row when needed, and commits along a graph line. It loads older commits and updates when the worktree changes.

## How to get to it (user POV)

- History tab or `porcelain.dev://history`; phone toolbar or iPad navigator selects a worktree.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Choose a worktree and open History. Branch/detached HEAD commits belong to that selection; no selection asks Select a worktree to continue., unborn branch shows No commits yet., read failure offers Retry.
2. Open a commit; phone Back/swipe returns to the list. iPad opens/activates central tabs without native pushes. Open two commits and a diff; panel switches retain them. Follow [workspace](app.workspace.md) for tab/resize/Settings/worktree session restoration and merge-parent retention.
3. Switch worktrees and verify the new history. Independently commit in the fixture: live history updates. Scroll beyond one page; older rows and restart/shallow-clone/wide-frontier boundaries appear.
4. Disconnect/recover the disposable server: show error, then Retry restores history in the retained panel.
5. In the disposable fixture, configure a local upstream and make two commits without updating it. Expect `2 ahead · 0 behind` and the upstream name. Advance the upstream three commits beyond the checked-out branch instead: expect `0 ahead · 3 behind`. With both refs equal, both counts stay visible as zero. A diverged branch shows both nonzero counts. These counts compare against the upstream, never an inferred main branch.
6. Unset the fixture branch's upstream: expect `No upstream` with no counts. Detach HEAD: expect `Detached HEAD` with no counts. An unborn branch retains its header and `No commits yet`; an untracked file still shows `Uncommitted changes` above the empty history.
7. Modify one fixture file in both index and worktree, add an untracked file and create a conflict in a separate file. Expect one count per file in the uncommitted row. Clean the worktree and verify the row disappears. This row is a status, with no Git action.
8. Rename the fixture branch to a very long name and configure a long upstream name. Verify the compact header groups a branch icon, branch name, project, counts and labelled upstream; long names truncate at phone width and retain full text in accessibility. Commit metadata uses relative ages (including future author dates), while opening the commit retains its full timestamp. Check light and dark themes: graph lines and dots use shared graph tokens. Open a commit, return, and confirm the header and selection remain.
9. If only Git status fails, commits remain readable, the status error offers `Retry branch status`, and old counts/uncommitted totals are hidden. Recover and retry. A history failure offers Retry without displaying an empty-repository message. Check paginated errors separately from first-load failures.

Automated coverage: `workspace-selection.spec.ts`, `status.spec.ts` (empty repository and distinct changed files), `presentation.spec.ts` (upstream counts, no upstream, detached/missing branch, full names and visible refs).

## Gotchas

- Healthy iPad History updates live; narrow panel/content switching retains selected documents. The pinned Review or Changes tab remains when all documents close.
- Use [Worktrees recovery](projects.workspace-picker.md#driving-it-with-agent-device) for shared inventory/loading/unavailable states.
- Emulator loopback proof does not cover iOS, physical-device LAN permissions or remote routing.
