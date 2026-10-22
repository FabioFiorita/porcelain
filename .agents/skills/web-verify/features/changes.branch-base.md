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
  - apps/web/spec/integration/changes-branch-base.test.tsx
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
---

# changes.branch-base

In the branch review, choosing another base branch compares the checked-out branch against it and keeps the choice in the address (`base=`); choosing the default branch again drops `base` and brings back the default comparison.

## Sub-features

- `changes.branch-base` — Base selection and URL persistence.

## How to get to it (user POV)

- Workspace → button "Review" (phone width; at desktop width the review sidebar stands beside the document, toggled by `Alt+Shift+R`) → tab "Branch" → button "Compare against the default branch" (shows "Against the default branch") → option of a branch in listbox "Suggestions". The button is renamed `Compare against <branch>` once a base is chosen.
- The popover has a textbox "Find a base branch" that filters the options.
- Directly by address: `?scope=branch&base=refs/heads/<branch>` on the workspace route.

## Driving it with browser

Preconditions: [surface baseline](README.md).

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

1. Navigate to `/`
   Expect: title "Files — repository" (the working tree is clean, so no Changes document is opened by default).
2. Click button `Review`, then click tab `Changes`
   Expect: the sheet shows tabs "Files", "Changes", "History" and, under them, tabs "Uncommitted" [selected] and "Branch".
3. Click tab `Branch`
   Expect: text "2 commits on feature since main"; button "Compare against the default branch"; buttons "README.md · modified", "first.md · added", "second.md · added"; the URL contains `scope=branch` and no `base=`.
4. Click button `Compare against the default branch`
   Expect: listbox "Suggestions" with group "Local" holding options "checkpoint", "feature" and "main default".
5. Click option named `checkpoint`
   Expect: text "1 commit on feature since checkpoint"; button "Compare against checkpoint"; button "second.md · added" shows; buttons "first.md · added" and "README.md · modified" are gone; the URL contains `base=refs%2Fheads%2Fcheckpoint`.
   Proof before continuing: reload the complete current URL now: checkpoint still shows one commit and `base=refs/heads/checkpoint`; reopen Review → Changes → Branch if the sheet closed. Branch-base/branch-changes reads answer 200.

6. Click button `Compare against checkpoint`
   Expect: listbox "Suggestions" again with the same three options.
7. Click option named `/^main/`
   Expect: text "2 commits on feature since main"; button "Compare against the default branch"; button "first.md · added" is back; the URL no longer contains `base=`.

Automated coverage: `changes-branch-base.e2e.ts`, `changes-branch-base.test.tsx`.

## Gotchas

- `git add --all` also commits the initial README change, included in the main comparison. The main option includes its default tag: use `/^main/`.
- Options first show Reading branches…. Setup leaves feature/checkpoint; reset before other maps.
