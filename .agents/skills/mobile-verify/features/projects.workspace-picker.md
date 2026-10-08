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

1. Select Files, then the Workspace toolbar button. Expect the Environment menu.
2. Open Environment and select the full environment name from the connection card. Expect the toolbar label to become that name while Files stays selected.
3. Reopen the toolbar picker by its new label. Open Project, select the sample project, then its main worktree. Expect <project> · <worktree> in the toolbar and Files still selected.
4. Dismiss the native menu. Expect the same worktree and destination.
5. Cold-launch the development client against the same Metro URL. Expect the remembered workspace after returning to Files.
6. Read the app's saved selection IDs from its SQLite store and compare them to fixtures.environmentId, projectId and worktreeId in connection.json; also retain the native inventory/live requests from the server log.
7. With a second paired disposable environment, select a different workspace, switch environments and expect each remembered choice. Forgetting an environment removes its saved choice.

## What proves it works

- `apps/mobile/spec/e2e/workspace.e2e.ts`: two real environments, each with a renamed project and an added worktree, are selected through the Environment and Project menus while Files stays selected; switching environments restores each one's worktree, a cold launch restores the last choice, and forgetting both environments clears the label. Each server holds one device labelled “Native mobile proof” and answered at least two inventory reads from the app.

## Gotchas

- Live tickets and receipt recovery use the shared client. An iPhone development-client drive selected the sample worktree, observed a server-side project rename update the picker without reloading, restored the selection after a cold launch, and forgot the environment. The server recorded the native inventory read, live ticket and live subscription. This proves the phone's shared connection graph; iPad and Android need separate native proof.

- After an environment is chosen the toolbar label becomes its name, so reopen the picker through the new label.
- The phone uses Expo Router's toolbar menu; the iPad uses a SwiftUI Menu with Pickers, which the e2e test does not drive yet.
- The shared forget-environments flow ends in Settings. The workspace flow returns to Files before checking its toolbar's reset label and absence of the old worktree labels.
