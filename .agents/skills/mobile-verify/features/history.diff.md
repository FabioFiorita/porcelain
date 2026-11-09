---
screen: /history/commit/[oid]/diff
selectors:
  - 'Diff unavailable'
  - "Couldn't load diff"
  - 'The patch could not be parsed'
  - 'No code change'
  - 'Comments'
  - 'More actions'
  - 'Clear selection'
api:
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
tests:
  - apps/mobile/src/features/workspace/rules/document-comment.spec.ts
---

# history.diff

A commit file opens a read-only diff with its original comparison parent and line feedback.

## How to get to it (user POV)

- Worktrees → worktree → History → commit → changed file; direct diff route. Back returns to the same commit.

## Driving it with agent-device

Comments and Clear selection are native top-bar actions; on iOS the bar is opaque and the diff starts below it, with no second row of path or buttons.

Preconditions: [surface baseline](README.md).

1. Open a commit file. The title is the file name; its folder and status (for example `src/ui · added`) are the second line. Verify that and old/new line numbers against the server patch, including multiple hunks and added/deleted/renamed files. Only that file's paths are requested; renames preserve both.
2. Exercise binary, metadata-only, omitted, empty, missing and unavailable patches. Malformed patch says The patch could not be parsed with Retry; read error says Couldn't load diff. History code remains read-only.
3. The Comments top-bar action supports whole-file and source-line feedback with code visible. Select added/deleted lines; post/cancel and independently read OID, parent, side and range. Back/swipe returns to commit/list with unsent-draft protection.
4. Open the same path under another parent: the diff names that parent. Return: the commit keeps it. Verify tablets in landscape and portrait.

Automated coverage: `document-comment.spec.ts`.

## Gotchas

- Every read is scoped by environment, project, worktree, commit and parent. Direct diff routes retain their navigation behavior; the same path under different comparisons must stay distinct.
