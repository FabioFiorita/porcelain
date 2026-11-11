---
screen: /history
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'History'
  - 'Select a worktree'
  - 'No commits yet'
  - "Couldn't load history"
  - 'No upstream'
  - 'Detached HEAD'
  - 'Uncommitted changes'
  - 'Retry branch status'
  - 'Git actions'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/features/history/rules/status.spec.ts
  - packages/client/src/features/history/rules/presentation.spec.ts
  - apps/mobile/src/features/history/rules/commit-age.spec.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/commits
  - GET /api/worktrees/:worktreeId/git/status
---

# history.history

History offers Fetch and Pull in its native top-bar Git actions menu; see [git-actions.menu](git-actions.menu.md). It shows the selected branch's ahead/behind counts against its named upstream, an uncommitted-files row when needed, and commits along a graph line. It loads older commits and updates when the worktree changes.

## How to get to it (user POV)

- Worktrees tab → worktree → the History button in the [Worktree](projects.worktree.md) page's top bar, or `porcelain.dev://history` for the selected worktree.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Choose a worktree and open History. Branch/detached HEAD commits belong to that selection; no selection shows Select a worktree (Choose a worktree in Worktrees to continue to History.), unborn branch shows No commits yet., read failure offers Retry.
2. Open a commit; Back/swipe returns to the list. Open a commit diff and return through the commit to the list; the chosen merge parent stays. Open and close Settings: the stack stays.
3. Switch worktrees and verify the new history. Independently commit in the fixture: live history updates. Scroll beyond one page; older rows and restart/shallow-clone/wide-frontier boundaries appear.
4. Disconnect/recover the disposable server: show error, then Retry restores history on the same screen.
5. In the disposable fixture, configure a local upstream and make two commits without updating it. Expect `2 ahead · 0 behind` and the upstream name. Advance the upstream three commits beyond the checked-out branch instead: expect `0 ahead · 3 behind`. With both refs equal, both counts stay visible as zero. A diverged branch shows both nonzero counts. These counts compare against the upstream, never an inferred main branch.
6. Unset the fixture branch's upstream: expect `No upstream` with no counts. Detach HEAD: expect `Detached HEAD` with no counts. An unborn branch retains its header and `No commits yet`; an untracked file still shows `Uncommitted changes` above the empty history.
7. Modify one fixture file in both index and worktree, add an untracked file and create a conflict in a separate file. Expect one count per file in the uncommitted row. Clean the worktree and verify the row disappears. This row is a status, with no Git action.
8. Rename the fixture branch to a very long name and configure a long upstream name. Verify truncation at phone width and full text in accessibility. Check light and dark themes: graph lines and dots use shared graph tokens. Open a commit, return, and confirm the header and selection remain.
9. If only Git status fails, commits remain readable, the status error offers `Retry branch status`, and old counts/uncommitted totals are hidden. Recover and retry. A history failure offers Retry without displaying an empty-repository message. Check paginated errors separately from first-load failures.
10. Rows show relative ages; opening a commit retains its full local timestamp. Include a future timestamp and old commits, and return to the same list position. Create a branch and tag with the same name on the same commit: badges and accessibility distinguish `Branch <name>` from `Tag <name>`. Remote refs say `Remote branch <name>`; the checked-out commit retains its distinct `HEAD` badge. Merge rows announce Merge commit. Check long names at phone width and on tablets in landscape and portrait.

Automated coverage: `workspace-selection.spec.ts`, `status.spec.ts` (empty repository and distinct changed files), `presentation.spec.ts` (upstream counts, no upstream, detached/missing branch, full names and visible refs), `commit-age.spec.ts` (fixed-instant age units, future/invalid timestamps and year rollover).

## Gotchas

- Use [Worktrees recovery](projects.worktrees.md) for shared inventory/loading/unavailable states.
- Emulator loopback proof does not cover iOS, physical-device LAN permissions or remote routing.
