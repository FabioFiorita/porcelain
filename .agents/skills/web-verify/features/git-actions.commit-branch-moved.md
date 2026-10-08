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

## What it is

A commit expects the branch the dialog looked at when it opened: if the worktree switches to another branch afterwards, even one on the same commit, the server refuses the commit as "changed since looked" and nothing is committed.

## How a user reaches it

- Group "Git controls" → button "Commit" → dialog "Commit changes" → textbox "Message" → button "Commit selected files", with the branch switched on disk while the dialog is open.

## Driving it

`$C start`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`.

### Setup

None before step 2. The branch switch happens on disk AFTER the dialog opens (step 3); switching before opening the dialog makes the commit succeed on the new branch instead.

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: button "Commit" enabled.
2. Click button named `Commit`
   Look for: dialog "Commit changes" whose branch strip reads "main".
3. On disk: `git -C "$REPO" switch -c journey-moved`, then inspect the accessibility tree
   Look for: the dialog's branch strip now reads "journey-moved" (repeat an accessibility inspection until it does; the README.md change stays in the working tree).
4. Replace the contents of textbox named `Message` with 'Moved commit'
   Look for: button "Commit selected files" enabled.
5. Click button named `Commit selected files`
   Look for: an alert in the dialog reads "changed since looked"; button "Look again" appears; button "Commit selected files" is disabled.
   Disk: `git -C "$REPO" log -1 --format=%s` prints `Initial commit`; `git -C "$REPO" branch --show-current` prints `journey-moved`.

## What proves it works

- The alert "changed since looked" and the newest commit still "Initial commit" on disk, on branch `journey-moved`. Inspect HTTP requests and responses shows the `POST /api/worktrees/<worktreeId>/git/actions` request (the refusal is a receipt with state `rejected`, reason `CHANGED_SINCE_LOOKED`, not an HTTP error).
- `apps/web/spec/integration/git-actions-commit-branch-moved.test.tsx`: sees the initial branch in the dialog, creates and switches to `journey-moved`, sees it in the dialog, commits, and asserts the alert matches /changed since looked/i, the newest commit subject is unchanged and the server's branch is `journey-moved`.

## Gotchas

- Order matters: open the dialog first, then switch the branch. The branch strip follows the live branch, but the commit's expectation keeps the branch the dialog saw on opening.
- "Look again" refreshes what the dialog looked at; committing after it succeeds on `journey-moved`. To reset the instance afterwards: `git -C "$REPO" switch main` (the README.md change follows).
