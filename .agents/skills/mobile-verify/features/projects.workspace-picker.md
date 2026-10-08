---
screen: /files
selectors:
  - 'Workspace'
  - 'No environments paired'
  - 'Reading projects…'
  - 'No projects registered'
  - 'Could not read projects'
  - 'Saved worktree is unavailable'
tests:
  - apps/mobile/spec/e2e/workspace.e2e.ts
api:
  - GET /api/inventory
  - POST /api/live/tickets
  - GET /api/live
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
---

# projects.workspace-picker

## What it is

The workspace picker in each destination's toolbar (the detail toolbar on iPad) lists projects from every paired environment together. On iOS, a project row shows its name as the title and its environment as a gray subtitle; Android uses `<project> · <environment>`. Each row expands to its worktrees. Choosing one saves its environment and worktree in a single update, without leaving the current destination. The toolbar label becomes `<project> · <worktree>` and the choice survives a cold launch. Forgetting an environment drops its projects and remembered worktree. Each environment reads inventory and subscribes to live updates independently; a failed inventory read leaves other environments' projects available. The shared client can recover retained Git receipts; mobile Git screens are still pending.

## How a user reaches it

- the Workspace button in the toolbar → a project with its environment subtitle → a worktree

## Driving it

1. Pair two disposable environments, select Files, then open the Workspace toolbar button. Expect projects from both environments in the same menu, with their environment names as subtitles on iOS and no Environment submenu.
2. Expand one project and select its main worktree. Expect <project> · <worktree> in the toolbar and Files still selected.
3. Reopen the toolbar picker by its new label. Expect both environments' projects still visible; expand a project from the other environment and choose its worktree. Expect the toolbar to update directly to that workspace.
4. Dismiss the native menu. Expect the same worktree and destination.
5. Cold-launch the development client against the same Metro URL. Expect the remembered workspace after returning to Files.
6. Read the app's saved selection IDs from its SQLite store and compare them to fixtures.environmentId, projectId and worktreeId in connection.json; also retain the native inventory/live requests from the server log.
7. Stop one disposable environment, then inspect the picker. Expect its inventory error to name that environment, while the other environment's projects remain available. Forgetting an environment removes its projects and saved choice.

## What proves it works

- `apps/mobile/spec/e2e/workspace.e2e.ts`: both real environments' projects are visible before selecting either; project submenus select their worktrees directly while Files stays selected. A cold launch restores the last choice, and forgetting both environments clears the label. Each server holds one device labelled “Native mobile proof” and answered at least two inventory reads from the app.

## Gotchas

- Live tickets and receipt recovery use the shared client. iPhone evidence does not prove iPad or Android behavior.

- After choosing a worktree, reopen the picker through its new `<project> · <worktree>` label.
- iPhone and iPad use SwiftUI Menus with native checkmarked worktree actions. The iPhone hosts its menu in Expo Router's toolbar. Android uses Expo Router's toolbar menu. The e2e flow does not drive iPad or Android yet.
- The shared forget-environments flow ends in Settings. The workspace flow returns to Files before checking its toolbar's reset label and absence of the old worktree labels.

- Native iOS project rows expose an accessibility label of `<project>, <environment>` for their title and subtitle.
