---
screen: /files
selectors:
  - "Files"
  - "Select a worktree to continue."
tests:
  - apps/mobile/spec/e2e/phone-shell.e2e.ts
  - apps/mobile/spec/e2e/destinations.e2e.ts
  - apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts
api: []
---

# files.files

## What it is

Files is the second destination. It does not read files from the server yet: it shows its empty state, the heading “Files” over “Select a worktree to continue.”, whatever is paired or selected. The workspace picker in its toolbar is its own flow, `projects.workspace-picker`.

## How a user reaches it

- phone: the Files tab; iPad: Files in the sidebar
- the deep link `porcelain.dev://files`

## Driving it

Use direct Maestro to select Files, then inspect the heading, “Select a worktree to continue.” and the selected tab/sidebar row. Use a screenshot if selection is missing from the hierarchy. Workspace selection does not turn this screen into a file list.

## What proves it works

- `apps/mobile/spec/e2e/destinations.e2e.ts`: the deep link opens Files directly with the tab selected and its empty state.
- `apps/mobile/spec/e2e/phone-shell.e2e.ts`: the Files tab is selected and shows its empty state.
- `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts`: the iPad split keeps Files through a sidebar collapse.

## Gotchas

- The empty state is the only state; a server whose project has no files shows the same screen.
- On iPad in portrait the sidebar is hidden; the Files development deep link reaches the screen without it.
