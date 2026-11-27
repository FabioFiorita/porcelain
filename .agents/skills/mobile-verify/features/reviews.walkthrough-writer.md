---
screen: /walkthrough-writer
selectors:
  - 'Writer'
  - 'Writer for the next run of this worktree.'
  - 'Effort'
  - 'Make project default'
  - 'Project default'
  - 'The project default was not saved.'
tests:
  - packages/client/src/features/projects/rules/walkthrough-writer.spec.ts
api:
  - GET /api/walkthrough-settings
  - PUT /api/projects/:projectId/walkthrough-settings
---

# reviews.walkthrough-writer

The writer for this worktree's next Walkthrough run, chosen in a sheet: each provider's latest model per family and every exact model, the effort the chosen model supports, and Make project default. It copies the web's writer menu.

## How to get to it (user POV)

- [Walkthrough](reviews.walkthrough-page.md) → the writer button under the status, beside No walkthrough yet, or above Try again (it reads "<provider> / <model> · <effort>").
- Close returns; the choice is kept for this worktree until the app quits.

## Driving it with agent-device

Preconditions: [reviews.walkthrough-page](reviews.walkthrough-page.md) on a computer with at least one signed-in coding CLI.

1. Open the writer button. The current choice has a check; choose another model: the page's writer button shows it, and the next Write or Update walkthrough sends it (`$C server` readback of the run's writer).
2. Effort lists only the efforts the chosen model supports; a model without the current effort switches to its default.
3. Make project default saves the choice for the project; the button then reads "Project default" and is disabled. A refusal shows "The project default was not saved."

## Gotchas

- Without any signed-in CLI the sheet shows one line asking to sign in to Claude Code or Codex.
