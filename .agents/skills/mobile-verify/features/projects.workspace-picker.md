---
screen: /workspaces
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
  - 'Search projects and worktrees'
  - 'All projects'
  - 'Close workspace picker'
  - 'No matching workspaces'

tests:
  - apps/mobile/src/features/projects/rules/workspace-browser.spec.ts
  - packages/client/src/features/projects/rules/workspace-search.spec.ts
  - packages/client/src/features/projects/rules/workspace-choices.spec.ts
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

Files, Review and History open a full-screen native workspace picker from their toolbar's Workspace button. Its accessible name is `<project> · <worktree>` when selected, or Workspace otherwise. It reopens in the selected project, with the current worktree marked. All projects returns to an alphabetic project list, where each row shows its computer and worktree count. Choosing a project opens its worktrees without selecting one. Close workspace picker dismisses without changing the workspace or originating destination.

Search projects and worktrees searches all paired inventories by project, branch, computer and folder path, regardless of which project is open. Space-separated terms must all match a result; `packages/client/src/features/projects/rules/workspace-search.ts` owns these matching rules for mobile and the web/Mac navigator. Results retain project and computer headings. Clear search restores the previous project/list. Duplicate branch names within a project show full paths; Main checkout, Current and Unavailable describe worktree rows. Worktree rows use the existing shared targets, availability, atomic persisted selection and document-leave safeguards.

The iPad sidebar uses the same searchable project browser. Selecting a sidebar worktree reveals Files as before. A toolbar selection returns to its originating destination, including a child screen's existing workspace-changed fallback.

## Driving it

1. Pair disposable environments with several projects and worktrees. From Files, short-tap Workspace. Expect a full-screen picker with search and Close. With a saved selection, expect its project/worktree; without one, expect Projects. All projects shows project rows with computer names and counts, without a flat list of every branch.
2. Open another project. Expect its worktrees; the saved selection has not changed yet. All projects goes back without dismissing. Close returns to the original destination and workspace.
3. From any project, search a branch on another project/computer. Expect matching worktrees grouped under their project and computer. Search by project, computer and path; try multiple terms and mixed case. Clear search restores the previous project. An unknown query says No matching workspaces.
4. Create two distinct linked worktrees on the same branch. Their paths must distinguish the rows. The selected row shows Current and a check; the main worktree says Main checkout. Unavailable rows are disabled and remain labelled.
5. Choose a matching available worktree with the keyboard visible. The sheet closes, the content follows the chosen worktree, and the original tab stays selected. Reopen and expect that project's current row. Cold-launch against the same Metro URL and independently compare the saved environment/project/worktree IDs in SQLite with the server inventory.
6. Repeat entry, search, selection and dismissal from Review and History, and from child file/commit screens. On Android test system Back as well as Close. On iPhone verify the native presentation and Close. Neither dismissal selects a workspace.
7. Start an unsent comment, then choose another worktree. Keep writing preserves the workspace and draft. Discard permits the switch. A pending send blocks switching; selecting the current worktree preserves the draft without prompting.
8. Fail one environment's inventory: another environment stays searchable/selectable and the failed computer is named. An unavailable project/worktree offers Read projects again; restore it and retry. A failed saved-state read offers Read again. Forgetting an environment removes its choices. An empty project says No worktrees available.
9. Check a large inventory, long branch names, the keyboard, larger text and scrolling to a current row. Keep Close, search and the project heading usable. On iPad verify landscape first, portrait and a narrow window, from both sidebar and toolbar.

## Proof boundaries

Drive through mobile-verify and retain fresh screenshots, interactive snapshots and independent server/storage reads. Android does not establish iPhone presentation or iPad layout. The Mac being unavailable leaves those Apple journeys unverified. Local emulator proof does not establish physical-device LAN permissions or Tailscale transport.

## Selected workspace states

The existing workspace gate applies to Files, Review, History and child screens: initial selection reads say Reading workspace…, no saved workspace asks for Select a worktree, no paired computer offers Open Settings, failed reads offer Read again, and unavailable saved targets name their reason. The toolbar remains reachable as the way out. Background inventory errors retain mounted documents, drafts and the last readable inventory; a child screen with a different workspace retains its existing return action.
