---
screen: /archive-review
selectors:
  - 'Archive'
  - 'Archive review'
  - 'Checking the worktree and branches…'
  - 'I understand the risk of losing changes and commits'
  - 'Review unavailable'
tests:
  - packages/git/src/actions/commands/cleanup-worktree.spec.ts
api:
  - POST /api/reviews/:reviewId/archive
  - GET /api/reviews/:reviewId/pull-request
---

# projects.archive-review

Archive on a merged or closed pull request starts the server's archive preview and opens Archive review as a form sheet route over the tab bar. The sheet shows the actual deletion targets, the risk acknowledgement when the worktree is dirty or has unpushed commits, any failure, and the destructive Archive review button. Close (X) or swipe-down dismisses it without archiving.

## How to get to it (user POV)

- Worktrees → a row's PR number → Archive; or Reviews → review → pull request → Archive.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

Precondition: review linked to merged/closed PR. In Settings → Reviews & Git, the review's computer has confirmed settings (Use these settings for <computer name>); When archiving a review has worktree/local branch/remote branch switches. Until then Archive is disabled and says why.

1. Open the row’s PR number, then Archive shows actual deletion targets. When deleting a worktree, it says the entire folder will be permanently deleted, including ignored files such as .env and local build output, even when ignored files are the only local contents. Close the sheet (X or swipe-down) and independently verify .env remains. Keeping a worktree while deleting its branch explicitly detaches it without a folder-deletion warning; main checkout/branches stay protected. Settings configures deletion options; there is no separate archive shortcut, context-menu action or mobile completion-card Archive.
2. Dirty files/unpushed commits require their warning/acknowledgement; Android switch starts off and Archive stays disabled until checked. Ignored files alone are not dirty. No upstream skips remote deletion; auto-deleted remote at the merged PR head says already deleted without an unpushed warning. Failed preview replaces checking text with a plain reason.
3. Confirm for the selected worktree: selection leaves before deletion. Show older reviews retains the readable review and Archived in its accessible label/detail. A kept worktree stays in its project alongside main. Capture before, confirmation, the retained project row and settings.
4. With long worktree and branch paths and Android font scale 2.0, scroll the confirmation body through the deletion targets, acknowledgement and any failure. Archive review stays reachable at the end of the scrolling body and its label fits without reducing font scaling. Repeat on an Android tablet in landscape and portrait with normal and larger system text. Changes to iOS-native confirmation or text scaling also need iPad proof with normal and larger Dynamic Type. Reopen after a locked-worktree failure, acknowledge again, retry and independently read the deletion result.

## Gotchas

- A failed confirmation clears the preview: close the sheet and press Archive again to read a fresh plan before retrying.
