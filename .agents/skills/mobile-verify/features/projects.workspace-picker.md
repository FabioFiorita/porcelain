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
---

# projects.workspace-picker

## What it is

The workspace picker in each destination's toolbar (the detail toolbar on iPad) chooses an environment, then a project and one of its worktrees, without leaving the current destination. Its label becomes `<project> · <worktree>`. Each environment remembers its own worktree: switching environments restores that environment's choice, and the choice survives a cold launch. Forgetting an environment drops its remembered worktree.

## How a user reaches it

- the Workspace button in the toolbar → Environment → an environment; then Project → a project → a worktree

## Driving it

Start an instance first: `.agents/skills/mobile-verify/scripts/cli start`.

```sh
.agents/skills/mobile-verify/scripts/cli open /files
.agents/skills/mobile-verify/scripts/cli tap --label Workspace
.agents/skills/mobile-verify/scripts/cli tap --label Environment
.agents/skills/mobile-verify/scripts/cli snapshot
```

Look for: the menu lists the environment “Mobile Verification …”. Tap it by its label, then open the picker again:

```sh
.agents/skills/mobile-verify/scripts/cli tap --label "Mobile Verification <id from the snapshot>"
.agents/skills/mobile-verify/scripts/cli tap --label "Mobile Verification <id from the snapshot>"
.agents/skills/mobile-verify/scripts/cli tap --label Project
.agents/skills/mobile-verify/scripts/cli snapshot
```

Look for: the sample project with its main worktree. Tap the project, then the worktree; the toolbar label becomes `<project> · <worktree>` and Files stays selected.

## What proves it works

- `apps/mobile/spec/e2e/workspace.e2e.ts`: two real environments, each with a renamed project and an added worktree, are selected through the Environment and Project menus while Files stays selected; switching environments restores each one's worktree, a cold launch restores the last choice, and forgetting both environments clears the label. Each server holds one device labelled “Native mobile proof” and answered at least two inventory reads from the app.

The test keeps one app installation and both servers across three Maestro runs: `pair-environments.yaml`, `workspace.yaml` and `workspace-restore.yaml`. Each phase retains its assertions and the existing ten-minute process limit; splitting the journey does not add a retry or extend a deadline.

## Gotchas

- After an environment is chosen the toolbar label becomes its name, so the second tap above reopens the picker through the new label.
- The phone uses Expo Router's toolbar menu; the iPad uses a SwiftUI Menu with Pickers, which the e2e test does not drive yet.
