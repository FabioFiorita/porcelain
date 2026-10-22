---
screen: /history/commit/[oid]/diff
selectors:
  - 'Diff unavailable'
  - "Couldn't load diff"
  - 'The patch could not be parsed'
  - 'No code change'
  - 'Comments'
  - 'Clear selection'
api:
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
tests:
  - apps/mobile/src/features/reviews/rules/document-comment.spec.ts
---

# history.diff

A commit file opens a read-only diff with its original comparison parent and line feedback.

## Sub-features

- `history.diff` — Commit comparisons, unavailable patches and comments.

## How to get to it (user POV)

- History → commit → changed file; direct diff route. Back returns to the same commit on phones.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open a commit file. Verify path/status and old/new line numbers against the server patch, including multiple hunks and added/deleted/renamed files. Only that file's paths are requested; renames preserve both.
2. Exercise binary, metadata-only, omitted, empty, missing and unavailable patches. Malformed patch says The patch could not be parsed with Retry; read error says Couldn't load diff. History code remains read-only.
3. Comments supports whole-file and source-line feedback with code visible. Select added/deleted lines; post/cancel and independently read OID, parent, side and range. Phone Back/swipe returns to commit/list with unsent-draft protection.
4. On iPad reopen the same commit/parent/path: existing diff tab activates. Another commit/parent creates a distinct tab. Return via commit tab: parent stays. Switch/close tabs and narrow/widen: History title and pane controls stay, without a native push.

Automated coverage: `document-comment.spec.ts`.

## Gotchas

- Every read is scoped by environment, project, worktree, commit and parent. Direct diff routes retain their navigation behavior; tab identity must distinguish the same path in different comparisons.
