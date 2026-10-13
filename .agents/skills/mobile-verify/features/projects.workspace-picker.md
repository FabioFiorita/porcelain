---
screen: /files
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'Workspace'
  - 'No environments paired'
  - 'Reading projects…'
  - 'No projects registered'
  - 'Could not read projects'
  - 'Read projects again'

tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - packages/client/src/features/projects/queries/inventory-state.spec.ts
api:
  - POST /api/inventory/refresh
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
- An unavailable project shows a state sentence outside its disabled row, prefixed by its environment and project name. `Read projects again` refreshes every paired environment through `POST /api/inventory/refresh` and uses the returned inventory; a server without that route answers 404 and the inventory is read again instead. Mobile has no Remove project action; the web sidebar's unavailable-project popover offers Retry and, where management is enabled, Remove.

## Driving it

1. Pair two disposable environments, select Files, then open the Workspace toolbar button. Expect projects from both environments in the same menu, with their environment names as subtitles on iOS and no Environment submenu.
2. Expand one project and select its main worktree. Expect <project> · <worktree> in the toolbar and Files still selected.
3. Reopen the toolbar picker by its new label. Expect both environments' projects still visible; expand a project from the other environment and choose its worktree. Expect the toolbar to update directly to that workspace.
4. Dismiss the native menu. Expect the same worktree and destination.
5. Cold-launch the development client against the same Metro URL. Expect the remembered workspace after returning to Files.
6. Read the app's saved selection IDs from its SQLite store and compare them to fixtures.environmentId, projectId and worktreeId in connection.json; also retain the native inventory/live requests from the server log.
7. Stop one disposable environment, then inspect the picker. Expect its inventory error to name that environment, while the other environment's projects remain available. Forgetting an environment removes its projects and saved choice.
8. Make a registered repository missing, permission denied, replaced, or fail Git. Open the picker and expect its reason sentence with environment and project name. A reason absent on an older server shows "Porcelain can't reach this repository right now." Restore the folder and choose `Read projects again`; expect the original worktree to become available.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- Live tickets and receipt recovery use the shared client. iPhone evidence does not prove iPad or Android behavior.

- After choosing a worktree, reopen the picker through its new `<project> · <worktree>` label.
- iPhone and iPad use SwiftUI Menus with native checkmarked worktree actions. The iPhone hosts its menu in Expo Router's toolbar. Android uses Expo Router's toolbar menu. Drive the native picker on each platform during mobile verification.
- The shared forget-environments flow ends in Settings. The workspace flow returns to Files before checking its toolbar's reset label and absence of the old worktree labels.

- Native iOS project rows expose an accessibility label of `<project>, <environment>` for their title and subtitle.

## Selected workspace states

1. Start with loaded storage and no saved worktree. Open Files, Review and History; expect Select a worktree to continue. The Workspace menu remains reachable, and choosing a worktree keeps the current tab.
2. Cold-launch with a remembered worktree while the first inventory is pending. Expect Reading workspace… on all three tabs, with no selection prompt. Open and dismiss the toolbar menu without losing the destination.
3. Fail the first inventory read with no previous data. Expect its error message and Read again on all three tabs; restore the environment and retry. After an inventory has loaded, fail a background reread instead: the tab and any open child screen or sheet stay mounted, retaining search and expanded folders.
4. Make the fixture project or worktree unavailable, then read its inventory again. Expect Workspace unavailable and the reason on all three tabs. If an entry is absent, expect the distinct no-longer-registered or no-longer-in-project message naming the environment. An unavailable project uses the shared server-reason message, including the neutral fallback for an older server without a reason. The picker uses the same unavailable reason. Press Read again to refresh that environment through POST, or open and dismiss the picker; restoring or selecting another available workspace recovers the current destination. A saved environment that is no longer paired offers Open Settings instead of retrying a missing connection.
5. In Files, hold the first root directory response. Expect Reading files… without No files. Release an empty root response and expect No files. Search a loaded inventory of paths with no matches and expect No files match this view.

Child file, commit, commit diff and review screens use the same states; a workspace key mismatch retains their existing return-to-Files/History/Review message and native Back or Done control. The iPad detail pane owns the state and retry; its master shows the selected branch/path only, and stays empty otherwise. Its sidebar and detail toolbar remain the way out. An iPhone run does not prove the split view or Android.
