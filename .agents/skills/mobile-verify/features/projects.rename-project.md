---
screen: /rename-project
selectors:
  - 'Rename project'
  - 'Name'
  - 'Rename'
  - 'Project unavailable'
tests: []
api:
  - PATCH /api/projects/:projectId
  - DELETE /api/projects/:projectId
  - GET /api/inventory
---

# projects.rename-project

Rename project is a form sheet route opened from a project header's ellipsis in Worktrees. It holds the Name field and a Rename button; Close or swipe-down dismisses it without saving.

## How to get to it (user POV)

- Worktrees → project header ellipsis → Rename project.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open Rename project. Expect the sheet over the tab bar with the title and an X (Close), the current name in Name and Rename; there is no Cancel button. Close, then reopen and swipe down: the name stays unchanged (read `$C server project`).
2. Enter a new name and press Rename. The sheet closes, the header and row labels show the new name, and `$C server project` reads it back. Rename it back.
3. Remove from Porcelain in the same ellipsis opens the platform alert "Remove <project> from Porcelain?" with Cancel and Remove. Cancel keeps the project; Remove drops it from Worktrees and a failure shows Project not removed with the reason.

## Gotchas

- An empty name disables Rename. The sheet reads the project from the computer's inventory; a project removed elsewhere shows Project unavailable.
