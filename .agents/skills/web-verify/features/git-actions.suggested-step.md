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

## What it is

The Git button (group "Git controls", left of Git actions) suggests the next step: Commit while anything changed, then Pull, then Push, and, once nothing is left to commit, pull or push, Apply stash for a waiting stash; following it brings the stashed changes back and keeps the stash.

## How a user reaches it

- The Git button in group "Git controls": its accessible name is the suggestion ("Commit", "Pull", "Push", "Apply stash"); with nothing to suggest it reads "Commit" and is disabled with the hint "Nothing to commit, pull or push."
- Apply stash opens dialog "Apply stash" (combobox "Stash", checkbox "Restore staged changes", button "Apply stash"). The Git actions menu has no Apply stash entry; only the suggestion offers it.

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start`. No setup; `REPO` is the repository path `start` printed.

1. `.agents/skills/web-verify/scripts/cli snapshot`
   Look for: group "Git controls" holds button "Commit" and button "Git actions"; no button "Apply stash".
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: menuitem starting "Stash changes".
3. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Stash changes/"`
   Look for: dialog "Stash changes".
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Stash changes"`
   Look for: `status` "succeeded" in the dialog.
5. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog is gone; group "Git controls" now holds button "Apply stash" (visible text "Apply stash") instead of "Commit"; README.md is no longer listed.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Apply stash"`
   Look for: dialog "Apply stash" with the description "Its changes come back into the working tree and the stash is kept.", combobox "Stash" showing "On main: Porcelain review · <id>" and button "Apply stash".
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Apply stash"`
   Look for: `status` "succeeded" in the dialog.
8. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog is gone; the Git button is "Commit" again (no button "Apply stash"); README.md is listed again.

## What proves it works

- After step 8: `tail -1 "$REPO/README.md"` prints `A change to review.` and `git -C "$REPO" stash list` still prints one entry, `stash@{0}: On main: Porcelain review` (apply keeps the stash).
- `apps/web/spec/integration/git-actions-suggested-step.test.tsx`: the button "Apply stash" is absent while README.md is changed, appears (text "Apply stash") once the stash leaves the tree clean, opens dialog "Apply stash" saying "Its changes come back into the working tree and the stash is kept." and nothing about setting changes aside, applies the stash with "succeeded", restores README.md, keeps one stash, and disappears again.

## Gotchas

- Steps 6 and 7 use the same name: in step 7 the dialog is modal, so the page behind it is hidden from the accessibility tree and `--name "Apply stash"` resolves to the dialog's button only.
- The stash stays after this feature; `git -C "$REPO" stash drop` removes it so later features start with the Git button reading "Commit".
