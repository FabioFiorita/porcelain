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

History lists the checked-out branch's commits down to "Start of history.", shows a commit made on disk as soon as it lands, and drops it when the worktree switches to a branch without it.

## Sub-features

- `history.browse` — History entry, loading and navigation.

## How to get to it (user POV)

- Phone width: button "Review" (top right of the document tabs) opens the sheet "Worktree review" → tab "History".
- Desktop width (1280 px and wider): the review sidebar stands beside the document → tab "History".
- Shortcut `Alt+3` (focus outside a text field) switches the review surface to History; at phone width the sheet still has to be opened with "Review".
- URL: `?surface=history` on the workspace route.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

```sh
git -C "$REPO" branch before-commit
```

### 1. A commit made on disk shows above the start of history

1. Click button `Review`
   Expect: dialog "Worktree review" with a tablist holding tabs "Files", "Changes", "History".
2. Click tab `History`
   Expect: tab "History" selected; URL has `surface=history`; the current document stays open (title "Changes — repository" on the start fixture); one row, a button whose name starts "Initial commit" and goes on with the 7-character id, "Porcelain Development", the age and the ref chips "before-commit" and "main"; text "Start of history." below it.
3. On disk: `git -C "$REPO" commit -am "Commit made on disk"`, then inspect the accessibility tree
   Expect: a new first row, button starting "Commit made on disk" with ref chip "main"; the "Initial commit" row now carries only "before-commit"; "Start of history." still last. Run an accessibility inspection again if the watcher has not caught up yet.

### 2. Switching to a branch without that commit drops it

Continue from section 1 (or on a fresh instance run the setup line and `git -C "$REPO" commit -am "Commit made on disk"` first, then steps 1 and 2 of section 1).

1. On disk: `git -C "$REPO" switch before-commit`, then inspect the accessibility tree
   Expect: the branch name above the list reads "before-commit"; no button starting "Commit made on disk"; the button starting "Initial commit" remains with the chip "before-commit" only (main still points at the commit made on disk).

### Observable proof

Compare live rows with Git after commit and branch switch; commits GET/200 repeats without reload.

Automated coverage: `history-browse.test.tsx`.

## Gotchas

- At phone width close the sheet with Escape before addressing document tabs/Git controls. Rows include subject, short OID, author, age and refs: match `/^Commit made on disk/`.
- Section 2 leaves before-commit; switch main or reset before another map.
