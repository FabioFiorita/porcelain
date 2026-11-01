---
screen: /timeline
selectors:
  - 'Timeline'
  - 'Commits that changed this file'
  - 'No commits touch this file'
  - 'Load older commits'
  - "Couldn't load older commits"
tests:
  - packages/client/src/features/history/queries/history.spec.ts
  - packages/client/src/features/history/commands/focus-commit-file.spec.ts
  - packages/client/src/features/files/rules/file-preferences.spec.ts
api:
  - GET /api/worktrees/:worktreeId/file-commits
---

# history.timeline

Files opens the selected file's commit timeline without changing worktrees or losing its return context.

## How to get to it

- Files → file row menu → Show timeline.
- An open file → Timeline control. Phone uses the Files stack; iPad opens a timeline document in its existing pane.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Create more than one page of file changes and at least one rename in the disposable fixture. Open Timeline from both entrances. Compare exact commit order and historical paths with Git. Branch and tag labels remain distinct; ages are relative.
2. Load older commits. Open an older row, verify that the historical file is selected in the commit, choose a merge parent and open its diff. Back/swipe returns through the same commit and timeline to Files. Previously selecting another file in the same commit must not override this explicit timeline entrance; choosing another merge parent carries the focused historical path when present. Loaded older rows, selected OID and scroll survive; the file's own reading place remains.
3. Fail a later page: keep confirmed rows and Retry the exact same cursor. First-load failure must not say No commits touch this file. An untouched file has that empty state. Shallow history names its boundary. Rewrite the checkout while paging: replace old rows, reset native reading position to the top and disclose the restart.
4. On iPad use landscape first, then portrait. Reopening the same path activates its existing timeline tab. A commit and its parent-specific diff use existing central tabs, without phone pushes. Switch panes/tabs and worktrees; each timeline belongs to its original workspace/path.
5. Return after an external commit or reconnection: reread current data to the retained depth. Phone views keep their native reading position while they remain in the Back stack; popping a timeline releases its reads. Reopening after unmount rereads current data to the retained depth. Exercise local, LAN and remote routing separately when available.

The continuation is a typed JSON query cursor pinned to a tip and raw record offset. It is never a Git --skip over the current filename. Automated query/Git tests do not establish native layout, focus or Back behavior.
