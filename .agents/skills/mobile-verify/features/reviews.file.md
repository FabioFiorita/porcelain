---
screen: /review-file
selectors:
  - 'This file is no longer changed.'
  - 'Comment on this file'
  - 'line-selection'
  - 'Clear selection'
  - 'Select fewer lines to comment on them.'
  - 'Mark reviewed'
  - 'Comparison:'
  - 'More actions'
tests:
  - apps/mobile/src/features/workspace/rules/line-comments.spec.ts
  - apps/mobile/src/features/documents/adapters/code-highlighter.spec.ts
  - apps/mobile/src/features/workspace/reading-place.spec.ts
  - apps/mobile/src/shared/application/document-reading.spec.ts
api:
  - POST /api/worktrees/:worktreeId/changes/diffs
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
  - GET /api/worktrees/:worktreeId/text
  - PUT /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed
  - GET /api/worktrees/:worktreeId/comments
---

# reviews.file

Diff documents support Reviewed marks, comparison switching and draft comments on the file and on lines.

## How to get to it (user POV)

- Changes tab → changed file. Reviewed, Comment on this file and Comparison are native top-bar actions.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

Open the document from its worktree. Confirm the native top bar contains the document actions. Read source and diffs in light and dark, return with Back and reopen to check the reading place. On tablets verify landscape and portrait. For changed files, mark reviewed and unmark, checking the persisted fingerprint through the server; change the fixture and confirm Changed since review. For staged plus unstaged content, the Comparison menu still switches the displayed diff.

An uncached syntax-heavy diff draws its literal rows and change markers before both sides finish coloring. Each side can gain colors independently; the hunk order, word changes, reading line and selection stay intact. Leave during coloring and reopen to check cancellation and retained completed colors.

Draft comments: the top bar's Comment on this file opens the `/comment` sheet with a file anchor. Tap a line to select it and tap more lines to extend the range on the same side (long press offers Select for review and Extend review selection); a floating bar names the range (`Line n`, `Lines n–m`, `Removed line n`) with Comment and Clear selection. Comment opens `/comment` with a lines anchor holding the selected text and clears the selection. A range longer than 64,000 characters says `Select fewer lines to comment on them.` instead. Existing drafts on the file show inline after their last line as a tappable row `Line n · Draft: …` (file drafts and lines outside the shown hunks at the top); tapping one opens `/comment?commentId=`. Read drafts back with `GET /api/worktrees/:worktreeId/comments`.

## Gotchas

Walkthrough conversations are separate and remain on the Walkthrough page. The selection is held per document, so it survives scrolling and is cleared when Comment opens the sheet.
