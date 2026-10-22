---
screen: /history
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'History'
  - 'Choose a document'
  - 'Select a worktree to continue.'
  - 'No commits yet'
  - "Couldn't load history"
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/commits
---

# history.history

History follows the selected worktree, loads older commits and updates when new commits arrive.

## Sub-features

- `history.history` — Commit browsing, pagination and live updates.

## How to get to it (user POV)

- History tab or `porcelain.dev://history`; phone toolbar or iPad navigator selects a worktree.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Choose a worktree and open History. Branch/detached HEAD commits belong to that selection; no selection asks Select a worktree to continue., unborn branch shows No commits yet., read failure offers Retry.
2. Open a commit; phone Back/swipe returns to the list. iPad opens/activates central tabs without native pushes. Open two commits and a diff; inspector switches retain them. Follow [workspace](app.workspace.md) for tab/resize/Settings/worktree session restoration and merge-parent retention.
3. Switch worktrees and verify the new history. Independently commit in the fixture: live history updates. Scroll beyond one page; older rows and restart/shallow-clone/wide-frontier boundaries appear.
4. Disconnect/recover the disposable server: show error, then Retry restores history in the retained inspector.

Automated coverage: `workspace-selection.spec.ts`.

## Gotchas

- Healthy iPad History updates live; narrow inspector/content switching retains selected documents. An empty center says Choose a document.
- Use [Worktrees recovery](projects.workspace-picker.md#driving-it-with-agent-device) for shared inventory/loading/unavailable states.
