---
screen: /history/commit/[oid]/diff
selectors:
  - 'Diff unavailable'
  - "Couldn't load diff"
  - 'The patch could not be parsed'
  - 'No code change'
  - 'More actions'
api:
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
tests:
  - apps/mobile/src/shared/rules/highlight-diff.spec.ts
---

# history.diff

A commit file opens a read-only diff with its original comparison parent and line feedback.

## How to get to it (user POV)

- Worktrees → worktree → History → commit → a file heading or compact row on the commit page; direct diff route. Back returns to the commit page at the same scroll place.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

Open the document from its worktree. Confirm the native top bar contains the document actions with no Comment or Comments controls. Read source and diffs in light and dark, return with Back and reopen to check the reading place. On tablets verify landscape and portrait. For changed files, mark reviewed and unmark, checking the persisted fingerprint through the server; change the fixture and confirm Changed since review. For staged plus unstaged content, the Comparison menu still switches the displayed diff.

## Gotchas

Walkthrough conversations are separate and remain on the Walkthrough page.
