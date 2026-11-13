---
screen: /review-file
selectors:
  - 'No longer changed'
  - 'Mark reviewed'
  - 'Comparison:'
  - 'More actions'
tests:
  - apps/mobile/src/features/documents/adapters/code-highlighter.spec.ts
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

Diff documents support Reviewed marks and comparison switching.

## How to get to it (user POV)

- Worktrees → worktree → Changes → changed file. Reviewed and Comparison are native top-bar actions.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

Open the document from its worktree. Confirm the native top bar contains the document actions with no Comment or Comments controls. Read source and diffs in light and dark, return with Back and reopen to check the reading place. On tablets verify landscape and portrait. For changed files, mark reviewed and unmark, checking the persisted fingerprint through the server; change the fixture and confirm Changed since review. For staged plus unstaged content, the Comparison menu still switches the displayed diff.

An uncached syntax-heavy diff draws its literal rows and change markers before both sides finish coloring. Each side can gain colors independently; the hunk order, word changes, reading line and selection stay intact. Leave during coloring and reopen to check cancellation and retained completed colors.

## Gotchas

Walkthrough conversations are separate and remain on the Walkthrough page.
