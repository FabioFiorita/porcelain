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
  - 'Select a worktree'
  - 'Pair an environment'
  - 'Open Settings'
  - 'Projects and worktrees'

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

On iPad, the sidebar lists environments, their projects and directly selectable worktree rows. It highlights the current worktree, marks the main worktree and disables unavailable entries. Its worktree rows expose Select <branch> in <project> on <environment>. There are no Files, Review or History app links in this navigator; those views belong to the selected workspace. The healthy iPad navigator has no routine refresh button. Read projects again appears for unavailable projects or inventory errors and refreshes paired environments; initial storage or selection failures offer Read again.

The toolbar picker uses the same metadata, readiness and selection commands as the sidebar. Its filter control is icon-only, with an accessibility label of `<project> · <worktree>` when selected or Workspace otherwise. On iOS, a project row shows its name as the title and its environment as a gray subtitle; Android uses `<project> · <environment>`. Each menu project expands to its worktrees. Choosing one saves its environment and worktree in a single update, and the choice survives a cold launch. Forgetting an environment drops its projects and remembered worktree. Each environment reads inventory and subscribes to live updates independently; a failed inventory read leaves other environments' projects available. The shared client can recover retained Git receipts.

## How a user reaches it

- the Workspace button in the toolbar → a project with its environment subtitle → a worktree
- On iPad, show the sidebar → find an environment and project → select its visible worktree row. Settings remains in the shell footer.
- An unavailable project shows a state sentence outside its disabled row, prefixed by its environment and project name. `Read projects again` refreshes every paired environment through `POST /api/inventory/refresh` and uses the returned inventory; a server without that route answers 404 and the inventory is read again instead. Mobile has no Remove project action; the web sidebar's unavailable-project popover offers Retry and, where management is enabled, Remove.

## Driving it

1. On a phone, pair two disposable environments, select Files, then open the Workspace toolbar button. Expect projects from both environments in the same menu, with their environment names as subtitles on iOS and no Environment submenu. On iPad use the visible worktree navigator described below.
2. On a phone, expand one project and select its main worktree. Expect the filter to remain icon-only with accessibility label <project> · <worktree>, the Files context caption to identify that worktree, and Files still selected.
3. Reopen the toolbar picker by its new label. Expect both environments' projects still visible; expand a project from the other environment and choose its worktree. Expect the toolbar to update directly to that workspace.
4. Dismiss the native menu. Expect the same worktree and destination.
5. Cold-launch the development client against the same Metro URL. Expect the remembered workspace after returning to Files.
6. Read the app's saved selection IDs from its SQLite store and compare them to fixtures.environmentId, projectId and worktreeId in connection.json; also retain the native inventory/live requests from the server log.
7. Stop one disposable environment, then inspect the picker. Expect its inventory error to name that environment, while the other environment's projects remain available. Forgetting an environment removes its projects and saved choice.
8. Make a registered repository missing, permission denied, replaced, or fail Git. Open the picker and expect its reason sentence with environment and project name. A reason absent on an older server shows "Porcelain can't reach this repository right now." Restore the folder and choose `Read projects again`; expect the original worktree to become available.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

For the iPad sidebar, pair two disposable environments and check their project/worktree groups without opening the toolbar menu. Select a main worktree and another branch; verify only the chosen environment/project/worktree row is highlighted and the workspace content follows it. Select a same-named project or branch on the other environment and check its saved IDs independently. Resize to a narrow iPad window and select a worktree; the shell must reveal the workspace without adding a native worktree screen. Cold-launch and check the remembered row. Stop one environment, then make a project or worktree unavailable: its rows must be disabled, its reason visible and the other environment selectable. Restore and press Read projects again. Forget an environment and check its groups disappear. These sidebar behaviors remain unproved until driven on the current combined build.

## Gotchas

- Live tickets and receipt recovery use the shared client. iPhone evidence does not prove iPad or Android behavior.

- After choosing a worktree, reopen the picker through its new `<project> · <worktree>` label.
- iPad sidebar rows are Porcelain controls; its optional toolbar picker and the iPhone toolbar picker use SwiftUI Menus with native checkmarked worktree actions. Android uses Expo Router's toolbar menu. Drive each entry point on its platform during mobile verification.
- The shared forget-environments flow ends in Settings. The workspace flow returns to Files before checking its toolbar's reset label and absence of the old worktree labels.

- Native iOS project rows expose an accessibility label of `<project>, <environment>` for their title and subtitle.

## Selected workspace states

1. Start with loaded storage and no saved worktree. On phone, open Files, Review and History; expect Select a worktree and guidance to choose a project and worktree from the toolbar filter. On iPad, the workspace asks to choose a worktree in the sidebar. The selection entry point remains reachable, and choosing a worktree reveals its workspace. With no paired environments, expect Pair an environment and Open Settings instead.
2. Cold-launch with a remembered worktree while the first inventory is pending. Expect Reading workspace… on all three tabs, with no selection prompt. Open and dismiss the toolbar menu without losing the destination.
3. Fail the first inventory read with no previous data. Expect its error message and Read again on all three tabs; restore the environment and retry. After an inventory has loaded, fail a background reread instead: the tab and any open child screen or sheet stay mounted, retaining search and expanded folders.
4. Make the fixture project or worktree unavailable, then read its inventory again. Expect Workspace unavailable and the reason on all three tabs. If an entry is absent, expect the distinct no-longer-registered or no-longer-in-project message naming the environment. An unavailable project uses the shared server-reason message, including the neutral fallback for an older server without a reason. The picker uses the same unavailable reason. Press Read again to refresh that environment through POST, or open and dismiss the picker; restoring or selecting another available workspace recovers the current destination. A saved environment that is no longer paired offers Open Settings instead of retrying a missing connection.
5. In Files, hold the first root directory response. Expect Reading files… without No files. Release an empty root response and expect No files. Search a loaded inventory of paths with no matches and expect No files match this view.

Child file, commit, commit diff and review screens use the same states; a workspace key mismatch retains their existing return-to-Files/History/Review message and native Back or Done control. The current destination owns the state and retry; its sidebar and toolbar remain the way out. An iPhone run does not prove the iPad layout or Android.
