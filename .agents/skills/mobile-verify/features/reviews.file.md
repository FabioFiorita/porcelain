---
screen: /review-file
selectors:
  - 'Comment on file'
  - 'Comment on selected lines'
  - 'Clear selection'
  - 'No longer changed'
  - 'Mark reviewed'
  - 'Comparison:'
  - 'Code changed since selection.'
tests:
  - apps/mobile/src/features/reviews/reading-place.spec.ts
  - apps/mobile/src/shared/application/document-reading.spec.ts
api:
  - POST /api/worktrees/:worktreeId/changes/diffs
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
  - GET /api/worktrees/:worktreeId/text
  - PUT /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed
---

# reviews.file

Review diffs support file marking and feedback on whole files or selected source lines.

## How to get to it (user POV)

- Review → changed file; iPad document tab. Comments and line-selection controls are in the diff toolbar.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open a changed file. Phone pushes its file route; iPad opens/activates a central tab and retains project/worktree title. For staged plus unstaged use the visible Comparison button: an ordinary tap opens the native menu on both platforms, the selected scope is named, and selecting a scope closes it and shows the matching lines. Branch comparison retains merge-base/tip OIDs and both rename paths; untracked files show source.
2. Mark reviewed, independently verify fingerprint, unmark. Change the file through the fixture: Changed since review. Fingerprint failures disable marking; read errors offer Read again.
3. Tap added/deleted lines: same-side second tap extends from the first; opposite-side tap starts a new range. Context uses the active side's number. Wrapped segments select their source line; scrolling selects nothing. Comment on selected lines opens the sheet; Clear selection restores whole-file feedback. Read side/range/comparison/fingerprint through comment-threads. An unrelated file write preserves the current reading line and selection. If the selected file changes, keep the original target and show Code changed since selection; clearing and selecting again targets the new saved content. Never silently attach an old range to a new fingerprint.
4. Done/dismiss returns to the exact underlying file; unsent drafts keep discard confirmation. Scroll a long diff, select a range, phone Back and reopen: same visible rendered row/range/comparison. Record the top row's source side/line and text before leaving and after returning; the saved reading position counts rendered rows, including headers, removed lines and collapsed gaps, rather than parsing a row ID or using source-line numbers. Repeat on iPad by switching Overview/another tab and back, landscape then portrait. Plain Files content, another comparison/base and another worktree keep independent reading places. Close inactive/active tabs and confirm remaining selection. Removing the file shows No longer changed in its tab without selecting another.
5. Drive binary, metadata-only, omitted, malformed, empty, conflicted and unsupported comparisons: explicit notices; metadata patch has no selectable text-line feedback. Change workspace: old phone route invalidates, iPad restores its own session. Changing panel comparison/base preserves existing captured tabs.

Automated coverage: the named atom tests protect retained identity and original targets; native line rendering, gestures and return paths require retained live actions and independent readbacks.

## Gotchas

- Wide/narrow iPad panel changes retain the same central tab; only phones push file routes. Code and comparison must remain from the displayed document when composing.
