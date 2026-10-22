---
route: /
selectors:
  - "Commit"
  - "Apply stash"
  - "Git actions"
  - "Stash changes"
  - "Git controls"
tests:
  - apps/web/spec/integration/git-actions-suggested-step.test.tsx
api:
  - GET /api/worktrees/:worktreeId/git/status
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.suggested-step

The Git button (group "Git controls", left of Git actions) suggests the next step: Commit while anything changed, then Pull, then Push, and, once nothing is left to commit, pull or push, Apply stash for a waiting stash; following it brings the stashed changes back and keeps the stash.

## How to get to it (user POV)

- The Git button in group "Git controls": its accessible name is the suggestion ("Commit", "Pull", "Push", "Apply stash"); with nothing to suggest it reads "Commit" and is disabled with the hint "Nothing to commit, pull or push."
- Apply stash opens dialog "Apply stash" (combobox "Stash", checkbox "Restore staged changes", button "Apply stash"). The Git actions menu has no Apply stash entry; only the suggestion offers it.

## Driving it with browser

Preconditions: [surface baseline](README.md).

1. Inspect the accessibility tree
   Expect: group "Git controls" holds button "Commit" and button "Git actions"; no button "Apply stash".
2. Click button `Git actions`
   Expect: menuitem starting "Stash changes".
3. Click menuitem `/^Stash changes/`
   Expect: dialog "Stash changes".
4. Click button `Stash changes`
   Expect: `status` "succeeded" in the dialog.
5. Press `Escape`
   Expect: the dialog is gone; group "Git controls" now holds button "Apply stash" (visible text "Apply stash") instead of "Commit"; README.md is no longer listed.
6. Click button `Apply stash`
   Expect: dialog "Apply stash" with the description "Its changes come back into the working tree and the stash is kept.", combobox "Stash" showing "On main: Porcelain review · <id>" and button "Apply stash".
7. Click button `Apply stash`
   Expect: `status` "succeeded" in the dialog.
8. Press `Escape`
   Expect: the dialog is gone; the Git button is "Commit" again (no button "Apply stash"); README.md is listed again.

### Observable proof

Read README ending A change to review. and retained `stash@{0}: On main: Porcelain review`; Apply keeps the stash.

Automated coverage: `git-actions-suggested-step.test.tsx`.

## Gotchas

- The modal Apply stash button shares the page trigger name, but hides the page. Scope the dialog if needed.
- Apply keeps the stash; `git -C "$REPO" stash drop` restores the expected Commit primary action.
