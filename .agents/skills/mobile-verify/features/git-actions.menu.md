---
screen: /history
selectors:
  - 'Git actions'
  - 'Fetch'
  - 'Pull'
  - 'No upstream branch to pull from.'
  - 'Check outcome'
  - 'Retry'
tests:
  - packages/client/src/features/git-actions/rules/network-availability.spec.ts
  - packages/client/src/features/git-actions/commands/git-menu.spec.ts
  - packages/client/src/features/git-actions/queries/network-menu.spec.ts
api:
  - GET /api/worktrees/:worktreeId/git/status
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.menu

Worktrees → selected worktree → History → native top-bar Git actions. Only Fetch and Pull appear. Leaving History removes its menu. Progress and results appear inside History, leaving commits readable. Shared client rules, receipt recovery and the computer's Reviews & Git pull strategy match web.

## Driving it with agent-device

1. Start the development fixture. Open History without an upstream. Open Git actions: Fetch and Pull are disabled with the shared web reasons, including `No upstream branch to pull from.`. Switch to Files and Changes: the Git menu is absent; return to History.
2. In the disposable repository, create a bare clone as origin and configure the current branch's upstream. Commit the fixture's seeded work before Pull so local changes do not block it. Clone origin into a second disposable repository and push one new commit there.
3. Save a before screenshot. Run Fetch. Observe inline progress and outcome while commits remain readable. Independently read `git rev-parse HEAD`, the remote-tracking ref and `git rev-list --left-right --count HEAD...@{upstream}`: HEAD is unchanged and History shows `0 ahead · 1 behind`.
4. Run Pull. Observe progress, result, the new commit appearing in place and `0 ahead · 0 behind`. Independently check HEAD equals the second clone's pushed commit. Save after screenshots.
5. Make origin unreachable in this fixture. Run Fetch, retain the server's failure message and Retry. Restore origin and Retry: verify success with Git independently. An unconfirmed operation offers Check outcome instead of resubmission.
6. Start Pull and leave History for Files while the remote is still serving it. Return after its terminal receipt: the success or server failure remains visible. Recover an unresolved Pull with Check outcome while its original request is still waiting; a recovered failure offers Retry for Pull. Restore the remote and Retry; independently verify HEAD advances (Fetch alone cannot do this). Check another worktree does not show this outcome.
7. Check a dirty worktree blocks Pull with `Commit or stash local changes before pulling.`; Fetch remains available. Verify the configured merge/rebase preference is followed. Check light/dark phone and tablet portrait/landscape, menu entry/exit, readable errors, retained list content and no blanking during refresh.

Use only the disposable fixture. Android emulator proof does not establish iPhone/iPad native toolbars or physical-device LAN permissions.
