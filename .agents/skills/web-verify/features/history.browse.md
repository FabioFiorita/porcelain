---
route: /
selectors:
  - "Review"
  - "History"
  - "Start of history."
  - "Worktree review"
tests:
  - apps/web/spec/integration/history-browse.test.tsx
api:
  - GET /api/worktrees/:worktreeId/commits
---

# history.browse

## What it is

History lists the checked-out branch's commits down to "Start of history.", shows a commit made on disk as soon as it lands, and drops it when the worktree switches to a branch without it.

## How a user reaches it

- Phone width (the CLI): button "Review" (top right of the document tabs) opens the sheet "Worktree review" → tab "History".
- Desktop width (1280 px and wider): the review sidebar stands beside the document → tab "History".
- Shortcut `Alt+3` (focus outside a text field) switches the review surface to History; at phone width the sheet still has to be opened with "Review".
- URL: `?surface=history` on the workspace route.

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start`. `REPO` is the repository path `start` printed.

### Setup

```sh
git -C "$REPO" branch before-commit
```

### 1. A commit made on disk shows above the start of history

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: dialog "Worktree review" with a tablist holding tabs "Changes", "Files", "History".
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "History"`
   Look for: tab "History" selected; Page URL has `surface=history`; Page Title "History — repository"; one row, a button whose name starts "Initial commit" and goes on with the 7-character id, "Porcelain Development", the age and the ref chips "before-commit" and "main"; text "Start of history." below it.
3. On disk: `git -C "$REPO" commit -am "Commit made on disk"`, then `.agents/skills/web-verify/scripts/cli snapshot`
   Look for: a new first row, button starting "Commit made on disk" with ref chip "main"; the "Initial commit" row now carries only "before-commit"; "Start of history." still last. Run `snapshot` again if the watcher has not caught up yet.

### 2. Switching to a branch without that commit drops it

Continue from section 1 (or on a fresh instance run the setup line and `git -C "$REPO" commit -am "Commit made on disk"` first, then steps 1 and 2 of section 1).

1. On disk: `git -C "$REPO" switch before-commit`, then `.agents/skills/web-verify/scripts/cli snapshot`
   Look for: the branch name above the list reads "before-commit"; no button starting "Commit made on disk"; the button starting "Initial commit" remains with the chip "before-commit" only (main still points at the commit made on disk).

## What proves it works

- The rows follow the disk: `git -C "$REPO" log --format=%s` prints `Commit made on disk` then `Initial commit` after section 1, and only `Initial commit` after section 2, matching the History rows.
- `network` shows `GET /api/worktrees/<id>/commits` answered 200 again after each disk change.
- `apps/web/spec/integration/history-browse.test.tsx`: the initial commit and "Start of history." show; a commit made on disk appears as a new row while the initial row keeps the chip "before-commit", and the server lists both subjects newest first; after switching to before-commit the row disappears and the server lists only "Initial commit".

## Gotchas

- At phone width the sheet hides the page behind it from the accessibility tree; while it is open, document tabs and Git controls cannot be addressed. `Escape` closes it.
- Row names are the whole row text (subject, 7-character id, author, relative age, ref chips), so address rows with a regex such as `--name "/^Commit made on disk/"`.
- Section 2 leaves the repository on branch before-commit with the README change committed on main; `git -C "$REPO" switch main` returns, or start a fresh instance.
