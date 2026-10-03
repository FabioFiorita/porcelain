---
route: /
selectors:
  - "Git actions"
  - "Stash changes"
  - "Message"
  - "Pop stash"
  - "Stash"
  - "Include untracked files"
tests:
  - apps/web/spec/integration/git-actions-stash.test.tsx
api:
  - GET /api/worktrees/:worktreeId/git/status
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.stash

## What it is

Stashing sets the changes aside and popping the stash brings them back and drops it; popping over a file changed since is refused with what Git said, and the stash is kept. A stash dialog opened again starts fresh, without the previous run's outcome.

## How a user reaches it

- Git actions → menuitem "Stash changes" (description "Set aside local changes") → dialog "Stash changes": textbox "Message" (prefilled "Porcelain review"), checkbox "Include untracked files" (checked) → button "Stash changes".
- Git actions → menuitem "Pop stash" (description "Restore, then remove a stash") → dialog "Pop stash": combobox "Stash", checkbox "Restore staged changes" → button "Pop stash". Disabled with "No stash is available." when there is none.

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start`. Section 1 needs no setup; `REPO` is the repository path `start` printed.

### 1. Stash and pop bring the changes back

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: menuitems starting "Stash changes" and "Pop stash".
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Stash changes/"`
   Look for: dialog "Stash changes" with textbox "Message" reading "Porcelain review" and checkbox "Include untracked files" checked.
3. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Message" "Journey stash"`
   Look for: the textbox reads "Journey stash".
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Stash changes"`
   Look for: `status` "succeeded" in the dialog.
5. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: dialog "Stash changes" is gone; README.md is no longer listed (no button "Mark README.md as reviewed"). On disk `git -C "$REPO" stash list` prints `stash@{0}: On main: Journey stash` and `git -C "$REPO" status --short` prints nothing.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the menu is open; menuitem starting "Pop stash" is enabled.
7. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Pop stash/"`
   Look for: dialog "Pop stash" whose combobox "Stash" shows "On main: Journey stash · <7-character id>".
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Pop stash"`
   Look for: `status` "succeeded" in the dialog.
9. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: dialog "Pop stash" is gone; README.md is listed again. `git -C "$REPO" stash list` prints nothing and `tail -1 "$REPO/README.md"` prints `A change to review.`

10. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`, then `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Stash changes/"`
   Look for: dialog "Stash changes" with button "Stash changes" enabled, no `status` "succeeded" and no button "Check outcome": the dialog starts fresh.
11. `.agents/skills/web-verify/scripts/cli click --role button --name "Stash changes"`, `.agents/skills/web-verify/scripts/cli press Escape`, `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`, `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Pop stash/"`
   Look for: dialog "Pop stash" with button "Pop stash" enabled, no `status` "succeeded" and no button "Check outcome", although the pop of step 8 succeeded in this page.

### 2. Popping over a file changed since is refused and keeps the stash

On a fresh instance (or after section 1):

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the menu is open.
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Stash changes/"`
   Look for: dialog "Stash changes".
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Stash changes"`
   Look for: `status` "succeeded".
4. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog is gone. Then on disk: `printf 'Changed while the stash was set aside\n' > "$REPO/README.md"`; the review lists README.md again.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Git actions"`
   Look for: the menu is open.
6. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/^Pop stash/"`
   Look for: dialog "Pop stash" with the stash "On main: Porcelain review · <id>" selected.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Pop stash"`
   Look for: an `alert` in the dialog with Git's message containing "would be overwritten".

## What proves it works

- Section 1: the disk checks after steps 5 and 9 (stash created with its message, then gone, README.md restored).
- Section 2: `cat "$REPO/README.md"` still prints `Changed while the stash was set aside` and `git -C "$REPO" stash list` still prints `stash@{0}: On main: Porcelain review`.
- `apps/web/spec/integration/git-actions-stash.test.tsx`: after the stash the server reports no changes and one stash "On main: Journey stash"; the pop dialog offers it, succeeds, restores README.md and leaves no stash; after a stash and a pop that succeeded, reopening "Stash changes" and then "Pop stash" shows neither a `status` nor "Check outcome" before the click, and each runs again; the refused pop shows the alert "would be overwritten", keeps the local text and keeps the stash "On main: Porcelain review".

## Gotchas

- The menuitem names start with the label and continue with the description, so address them by `/^Stash changes/` and `/^Pop stash/`. While a dialog is open the page behind it is hidden from the accessibility tree, so button "Stash changes" or "Pop stash" resolves to the dialog's button only.
- Escape closes the dialog only after the action settled.
- Steps 10 and 11 of section 1 leave a stash set aside and the "Pop stash" dialog open; before section 2 press Escape and run `git -C "$REPO" stash pop`, or start a fresh instance.
- Section 2 leaves a stash and a modified README.md; reset with `git -C "$REPO" checkout README.md && git -C "$REPO" stash pop`, or start a fresh instance.
- A reopened dialog shows an earlier outcome only while that action is still running or unconfirmed (then with "Check outcome"); a settled one is not shown again.
