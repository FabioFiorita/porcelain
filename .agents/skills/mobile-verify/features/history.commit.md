---
screen: /history/commit/[oid]
selectors:
  - 'Root commit'
  - 'No changed files'
  - 'Compare parent'
  - "Couldn't load commit"
tests: []
api:
  - GET /api/worktrees/:worktreeId/commits/:oid/files
---

# history.commit

Commit details show metadata, comparison parents and changed files, with navigation back to History.

## How to get to it (user POV)

- History → commit row; direct commit route. Native Back returns to History.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open a commit. Verify subject, body, author/time, selectable full OID, refs, comparison and file list against independent server reads. The timestamp remains complete even though list rows show relative ages. Same-named branch and tag badges retain their `Branch` and `Tag` labels; remote refs say `Remote branch`. Open added/modified/renamed/deleted files and return to the same commit/list. Renames retain old paths; deletions retain their path.
2. Open a root commit: Root commit compares with the empty tree. Empty file list says No changed files; read failure offers Retry. Merge commits offer in-content Compare parent; choose each and compare files independently before opening a diff.
3. On iPad open two commits, reopen one to activate its existing tab, change parent, switch away/back: parent stays. Close tabs, narrow/widen, change panel, visit Settings and switch worktrees: use [workspace](app.workspace.md) for restoration. The pinned Review or Changes tab remains when all documents close.
4. Change workspace while old phone detail remains: it asks to return to History, never reading that OID against the new worktree.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- iPad commit tabs share the Files/Review document strip; parent selection must not replace the project/worktree title or pane controls. Direct commit routes keep their navigation behavior.
