---
screen: /pull-request
selectors:
  - 'PR #'
  - 'Read pull request again'
  - 'Open on GitHub'
  - 'Reading pull request…'
  - 'Archive'
tests:
  - apps/mobile/src/features/reviews/rules/pull-request-document.spec.ts
  - apps/mobile/src/shared/rules/workspace-documents.spec.ts
  - apps/mobile/src/features/projects/rules/retained-review-route.spec.ts
api:
  - GET /api/reviews/:reviewId/pull-request
  - POST /api/reviews/:reviewId/archive
---

# reviews.pull-request

PR numbers open a read-only native document scoped to their review and computer, while preserving the selected checkout. Description, checks and threaded conversation use the native Markdown renderer.

## How to get to it (user POV)

- Worktrees → a linked review’s PR # action.
- Published review → Open pull request.

## Driving it with agent-device

Preconditions: [surface baseline](README.md), with a review linked to a disposable GitHub fixture. Include a Markdown description, checks, comments, a review with threaded code replies, and incomplete-data flags.

1. Keep checkout A selected. Open Worktrees and tap a PR # on computer B. Phone: its native stack displays PR #number with Back. iPad: the existing workspace gains a PR #number document tab, and the previous document remains available. Independently read selection storage: checkout A and its computer remain selected.
2. Read title, state, branches, review-head relationship, description, checks and conversation; nested replies and diff hunks remain present. Check incomplete checks/conversation disclosures, no description, no conversation, long Markdown, dark/light and larger text. Open on GitHub is the explicit external action; the PR number itself stays in the app.
3. Back returns to the phone’s Worktrees list and opening tab with the same search/filters/selection. On iPad close the PR tab or reactivate the previous document: the old document and checkout remain. Repeat from Files, Review and History, and with identical PR/review numbers on two computers. The document uses the chosen computer, never the selected checkout’s connection.
4. Leave an unsent draft before opening the PR. The additive PR visit requires no discard: return to the original document and reopen its comments to find the exact body, original anchor/review revision and retry identity. Repeat on iPad in each pane. Closing a dirty document or changing its target still asks before discarding. The read-only PR document itself has no unlink or write controls.
5. Delay/fail the PR read, return not-linked, or disconnect the computer: loading/failure has a usable return path and Read pull request again when connected. Retry after recovery. Change the review’s linked PR number while the old document is open: the old document explains that it changed and directs the developer back to Worktrees rather than showing a different PR under the old number.
6. For a successfully read merged/closed PR, Archive opens the existing guarded preview with confirmed computer settings. Follow [archive](projects.workspace-picker.md#archive-a-completed-review), cancel first, then verify the actual fixture changes independently.

## Gotchas

- PR payload reads start on document opening; sidebar inventory and project expansion do not fetch them. Changing route/document never selects a checkout or computer.
- iPad landscape and portrait need their own captures. Android/iPhone proof does not establish either iPad layout.
