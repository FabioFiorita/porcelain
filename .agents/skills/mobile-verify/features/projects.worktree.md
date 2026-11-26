---
screen: /changes
selectors:
  - 'worktree-switch'
  - 'walkthrough-tab'
  - 'changes-tab'
  - 'files-tab'
  - 'history-tab'
  - 'worktree-pull-request'
  - 'spinner'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/shared/rules/side-drawer.spec.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/branch-changes
---

# projects.worktree

The four worktree tabs (`walkthrough-tab`, `changes-tab`, `files-tab`, `history-tab`) read the selected worktree. Each tab root's header title is the worktree button (`worktree-switch`): the worktree's name, "project · computer" below it, and a down chevron; tapping it opens the [Worktrees](projects.worktrees.md) drawer. A page's own actions (Files' Create file or folder, History's Git menu) sit on the right of the same native header. A worktree whose branch matches a GitHub pull request shows a Pull request #n row (`worktree-pull-request`) at the top of Changes, opening the [pull request](reviews.pull-request.md). While the computer is away or refuses this device, each tab keeps its content and shows one floating connection notice ([environment status](access.environment-status.md)). With nothing selected each tab shows "Choose a worktree" with one Choose worktree button.

Tablets with at least 700 units of content width show lists beside content inside the tab: Files' tree beside the open file, Changes' files beside the diff, the Walkthrough's steps beside the page. Narrower content stacks and pushes, as on a phone.

## How to get to it (user POV)

- Any worktree tab; the title button changes the worktree.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Choose a worktree in the selector. Read the saved selection independently: that worktree and computer are selected. Each tab's title shows it.
2. Changes: for a branch matched to a GitHub PR, `worktree-pull-request` reads Pull request #n and opens the PR; otherwise it is absent.
3. Files: Create file or folder in the header; History: the Git menu in the header.
4. Change worktree from the title: every tab follows; each tab's pushed screens are popped to the new worktree's roots or show "Another worktree is selected now."
5. Tablet landscape and portrait: lists beside content where described; rotate with a file open in Files: it stays beside the tree (both orientations are ≥ 700 units on the reference tablet).

Automated coverage: `workspace-selection.spec.ts`, `start-path.spec.ts`.

## Gotchas

- Sections read the current workspace; a pushed screen opened for another worktree shows its own gate notice.
