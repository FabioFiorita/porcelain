---
screen: /review-file
selectors:
  - 'No longer changed'
  - 'Mark reviewed'
  - 'Comparison:'
  - 'More actions'
tests:
  - apps/mobile/src/shared/rules/highlight-diff.spec.ts
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

- Worktrees → worktree → Review → changed file, or a section heading or compact row on [All changes](reviews.all-changes.md), which opens on that section's comparison. Mark reviewed, Comment on file / Comment on selected lines, Clear selection and the Comparison menu are native top-bar actions; when more than three apply, the first two stay visible and the rest sit under More actions.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

Open the document from its worktree. Confirm the native top bar contains the document actions with no Comment or Comments controls. Read source and diffs in light and dark, return with Back and reopen to check the reading place. On tablets verify landscape and portrait. For changed files, mark reviewed and unmark, checking the persisted fingerprint through the server; change the fixture and confirm Changed since review. For staged plus unstaged content, the Comparison menu still switches the displayed diff.

## Gotchas

Walkthrough conversations are separate and remain on the Walkthrough page.
