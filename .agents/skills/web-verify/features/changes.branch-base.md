---
route: /
selectors:
  - "Review"
  - "Branch"
  - "Compare against "
  - "the default branch"
  - "Find a base branch"
tests:
  - apps/web/spec/e2e/changes-branch-base.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
---

# changes.branch-base

## What it is

In the branch review, choosing another base branch compares the checked-out branch against it and keeps the choice in the address (`base=`); choosing the default branch again drops `base` and brings back the default comparison.

## How a user reaches it

- Workspace → button "Review" (phone width; at desktop width the review sidebar stands beside the document, toggled by `Alt+Shift+R`) → tab "Branch" → button "Compare against the default branch" (shows "Against the default branch") → option of a branch in listbox "Suggestions". The button is renamed `Compare against <branch>` once a base is chosen.
- The popover has a textbox "Find a base branch" that filters the options.
- Directly by address: `?scope=branch&base=refs/heads/<branch>` on the workspace route.

## Driving it

`$C start`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`.

### Setup

```sh
git -C "$REPO" switch -c feature
printf 'first\n' > "$REPO/first.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "First on the branch"
git -C "$REPO" branch checkpoint
printf 'second\n' > "$REPO/second.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Second on the branch"
git -C "$REPO" log --oneline main..feature | wc -l   # prints 2
```

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Files — repository" (the working tree is clean, so no Changes document is opened by default).
2. Click button named `Review`, then click tab named `Changes`
   Look for: the sheet shows tabs "Files", "Changes", "History" and, under them, tabs "Uncommitted" [selected] and "Branch".
3. Click tab named `Branch`
   Look for: text "2 commits on feature since main"; button "Compare against the default branch"; buttons "README.md · modified", "first.md · added", "second.md · added"; the Page URL contains `scope=branch` and no `base=`.
4. Click button named `Compare against the default branch`
   Look for: listbox "Suggestions" with group "Local" holding options "checkpoint", "feature" and "main default".
5. Click option named `checkpoint`
   Look for: text "1 commit on feature since checkpoint"; button "Compare against checkpoint"; button "second.md · added" shows; buttons "first.md · added" and "README.md · modified" are gone; the Page URL contains `base=refs%2Fheads%2Fcheckpoint`.
6. Click button named `Compare against checkpoint`
   Look for: listbox "Suggestions" again with the same three options.
7. Click option named `/^main/`
   Look for: text "2 commits on feature since main"; button "Compare against the default branch"; button "first.md · added" is back; the Page URL no longer contains `base=`.

## What proves it works

- The heading line of the list switches between "2 commits on feature since main" and "1 commit on feature since checkpoint", the file rows follow it, and the Page URL gains `base=refs%2Fheads%2Fcheckpoint` then loses it.
- Persistence is in the address: after step 5, Navigate to `<the` on the card’s web URL (full page load) and reopen Review → still "1 commit on feature since checkpoint".
- Inspect HTTP requests and responses shows `GET /api/worktrees/<worktreeId>/branch-bases` (sent when the picker first opens) and `GET /api/worktrees/<worktreeId>/branch-changes` once with the default base and once with `base=refs/heads/checkpoint`, all 200.
- `apps/web/spec/e2e/changes-branch-base.e2e.ts`: asserts both count lines, that "second.md · added" shows and "first.md · added" is detached against checkpoint, and that the `base` search param is `refs/heads/checkpoint` then null.

## Gotchas

- Every commit here uses `git add --all`, so the start state's modified README.md is committed on `feature` too and appears as "README.md · modified" in the default comparison.
- The options load only when the picker opens ("Reading branches…" first); the click waits for the option, so no extra step is needed.
- The main option's name is "main" plus its "default" tag, so address it by the pattern `/^main/`, never by the exact name "main".
- The setup leaves the repository on `feature` with branch `checkpoint`; other features assume the start state on `main`, so `$C stop` and `$C start`; pair your browser using the card’s pairing-link command before driving another feature.
