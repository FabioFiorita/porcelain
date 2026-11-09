---
screen: /review-file
selectors:
  - 'Comment on file'
  - 'Comment on selected lines'
  - 'Clear selection'
  - 'No longer changed'
  - 'Mark reviewed'
  - 'Comparison:'
  - 'More actions'
  - 'Code changed since selection.'
tests:
  - apps/mobile/src/features/workspace/reading-place.spec.ts
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

- Worktrees → worktree → Review → changed file. Mark reviewed, Comment on file / Comment on selected lines, Clear selection and the Comparison menu are native top-bar actions; when more than three apply, the first two stay visible and the rest sit under More actions.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open a changed file: its route pushes with the file name as the title and its folder, comparison and review status (for example `src · staged · unstaged · Reviewed`) as the second line, on phones and tablets. On iOS the bar is opaque and the diff starts below it, with no second row of path or buttons. For staged plus unstaged use the Comparison top-bar menu (named `Comparison: <scope>`, under More actions while a selection is active): a tap opens the native menu on both platforms, the selected scope is checked, and selecting a scope closes it and shows the matching lines. Branch comparison retains merge-base/tip OIDs and both rename paths; untracked files show source.
2. Mark reviewed, independently verify fingerprint, unmark. Change the file through the fixture: Changed since review. Fingerprint failures disable marking; read errors offer Read again.
3. Tap added/deleted lines: same-side second tap extends from the first; opposite-side tap starts a new range. Context uses the active side's number. Wrapped segments select their source line; scrolling selects nothing. Comment on selected lines opens the sheet; Clear selection restores whole-file feedback. Read side/range/comparison/fingerprint through comment-threads. An unrelated file write preserves the current reading line and selection. If the selected file changes, keep the original target and show Code changed since selection; clearing and selecting again targets the new saved content. Never silently attach an old range to a new fingerprint.
4. Close or dismissal returns to the exact underlying file; unsent drafts keep discard confirmation. Scroll a long diff, select a range, Back and reopen: same visible rendered row/range/comparison. Record the top row's source side/line and text before leaving and after returning; the saved reading position counts rendered rows, including headers, removed lines and collapsed gaps, rather than parsing a row ID or using source-line numbers. Repeat on tablets in landscape and portrait. Plain Files content, another comparison/base and another worktree keep independent reading places. Removing the file shows No longer changed without selecting another.
5. Drive binary, metadata-only, omitted, malformed, empty, conflicted and unsupported comparisons: explicit notices; metadata patch has no selectable text-line feedback. Change workspace: the old route invalidates. Changing the Review comparison/base does not rewrite an open file's captured comparison.

Automated coverage: the named atom tests protect retained identity and original targets; native line rendering, gestures and return paths require retained live actions and independent readbacks.

## Gotchas

- Code and comparison must remain from the displayed document when composing.
