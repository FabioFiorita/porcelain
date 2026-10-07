---
screen: /files
selectors:
  - "Workspace"
  - "Environment"
  - "Project"
  - "No environments paired"
  - "Select an environment"
  - "Reading projects…"
  - "No projects registered"
  - "Could not read projects"
  - "Saved worktree is unavailable"
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

The workspace picker in each destination's toolbar (the detail toolbar on iPad) chooses an environment, then a project and one of its worktrees, without leaving the current destination. Its label becomes `<project> · <worktree>`. Each environment remembers its own worktree: switching environments restores that environment's choice, and the choice survives a cold launch. Forgetting an environment drops its remembered worktree. The selected connection subscribes through the shared live client, so project and worktree notices refresh the picker. The shared client can recover retained Git receipts; mobile Git screens are still pending.

## How a user reaches it

- the Workspace button in the toolbar → Environment → an environment; then Project → a project → a worktree

## Driving it

From Files, inspect and open Workspace → Environment → the full current environment label. Reopen the renamed toolbar control, choose Project → the sample project → main, and verify the accessible toolbar label `<project> · <worktree>` while Files remains selected. Reopen and dismiss the native picker, then verify its menu is gone and selection retained. Visit Settings, return to Files and cold-launch through the printed development link; verify the workspace survives. Do not claim the selected tab persists.

## What proves it works

- `apps/mobile/spec/e2e/workspace.e2e.ts`: two real environments, each with a renamed project and an added worktree, are selected through the Environment and Project menus while Files stays selected; switching environments restores each one's worktree, a cold launch restores the last choice, and forgetting both environments clears the label. Each server holds one device labelled “Native mobile proof” and answered at least two inventory reads from the app.

## Gotchas

- Live tickets and receipt recovery use the shared client. An iPhone development-client drive selected the sample worktree, observed a server-side project rename update the picker without reloading, restored the selection after a cold launch, and forgot the environment. The server recorded the native inventory read, live ticket and live subscription. This proves the phone's shared connection graph; iPad and Android need separate native proof.

- After an environment is chosen the toolbar label becomes its name, so the second tap above reopens the picker through the new label.
- The phone uses Expo Router's toolbar menu; the iPad uses a SwiftUI Menu with Pickers, which the e2e test does not drive yet.
- The shared forget-environments flow ends in Settings. The workspace flow returns to Files before checking its toolbar's reset label and absence of the old worktree labels.
