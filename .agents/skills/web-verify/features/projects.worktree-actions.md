---
route: /
selectors:
  - 'Projects and worktrees'
  - 'Copy worktree path'
  - 'Switch branch'
  - 'Find a branch'
  - 'Delete'
  - 'Delete local worktree'
  - 'Delete local branch'
  - 'Delete remote branch'
tests:
  - apps/web/spec/e2e/projects-worktree-actions.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/review-git-settings
  - POST /api/worktrees/:worktreeId/git/actions
  - POST /api/worktrees/:worktreeId/delete
---

# projects.worktree-actions

A worktree's right-click menu has icon-labelled Copy worktree path, Switch branch and Delete actions. Main has Copy and Switch, with no Delete. The menu has no header, ellipsis or manual refresh action. Project management stays in the project header's ellipsis menu.

## Driving it with browser

Use the disposable instance at 1440 and 414, light/dark. Include main, a clean topic checkout, an unused local branch, a branch occupied by another checkout and a detached checkout.

1. Right-click main: Copy worktree path and Switch branch are available; Delete is absent. Copy reads back the exact full path. Escape returns to the card.
2. Right-click an unselected topic and open Switch branch. Search filters local branches. The current branch is marked Current; branches checked out elsewhere are In use and disabled. Remote refs are excluded. A no-match search explains the empty result. Choose an unused local branch and confirm. The real Git branch changes in that checkout while the originally selected workspace and computer stay selected. Cancel changes nothing. A failure remains in the dialog with its reason and retry path.
3. Open Delete on a non-main checkout. Three switches initially reflect the computer's saved archive settings; this dialog does not save those settings. Changing Delete local worktree off while Delete local branch is on explains that the folder stays and becomes detached before deleting that branch. Deleting the folder while retaining its branch explains that combination. Cancel leaves Git, files and review history unchanged. Reopen: switches reset from saved settings.
4. Open Delete on detached HEAD: both branch switches are off and disabled, with an explanation; worktree deletion remains available. Main cannot enter this dialog through its menu. Confirm one supported non-main deletion in the disposable fixture; verify the chosen Git/files effect, truthful failures, retained review history and selection cleanup. Unsaved/dirty/locked protections and partial failures must stay observable; never infer success from a vanished dialog alone.
5. Retain screenshots of both menus/dialogs and independent server/Git/settings readbacks. PR-document Archive remains a separate review operation with its existing safeguards.
