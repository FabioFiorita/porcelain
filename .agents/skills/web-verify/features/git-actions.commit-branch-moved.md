---
route: /
selectors:
  - "Commit"
  - "Commit changes"
  - "Message"
  - "Commit selected files"
  - "Look again"
tests:
  - apps/web/spec/integration/git-actions-commit-branch-moved.test.tsx
api:
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.commit-branch-moved

A commit expects the branch the dialog looked at when it opened: if the worktree switches to another branch afterwards, even one on the same commit, the server refuses the commit as "changed since looked" and nothing is committed.

## How to get to it (user POV)

- Group "Git controls" → button "Commit" → dialog "Commit changes" → textbox "Message" → button "Commit selected files", with the branch switched on disk while the dialog is open.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

None before step 2. The branch switch happens on disk AFTER the dialog opens (step 3); switching before opening the dialog makes the commit succeed on the new branch instead.

1. Navigate to `/`
   Expect: button "Commit" enabled.
2. Click button `Commit`
   Expect: dialog "Commit changes" whose branch strip reads "main".
3. On disk: `git -C "$REPO" switch -c journey-moved`, then inspect the accessibility tree
   Expect: the dialog's branch strip now reads "journey-moved" (repeat an accessibility inspection until it does; the README.md change stays in the working tree).
4. Fill textbox `Message` with 'Moved commit'
   Expect: button "Commit selected files" enabled.
5. Click button `Commit selected files`
   Expect: an alert in the dialog reads "changed since looked"; button "Look again" appears; button "Commit selected files" is disabled.
   Disk: `git -C "$REPO" log -1 --format=%s` prints `Initial commit`; `git -C "$REPO" branch --show-current` prints `journey-moved`.

### Observable proof

Read Git: branch journey-moved still has Initial commit. Action returns a rejected receipt with `CHANGED_SINCE_LOOKED`, not an HTTP error.

Automated coverage: `git-actions-commit-branch-moved.test.tsx`.

## Gotchas

- Open the dialog before switching branches: its displayed branch updates, but the original expectation must still refuse the commit.
- Look again refreshes the expectation and can commit on journey-moved. Reset with `git -C "$REPO" switch main`.
