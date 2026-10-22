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

Stashing sets the changes aside and popping the stash brings them back and drops it; popping over a file changed since is refused with what Git said, and the stash is kept. A stash dialog opened again starts fresh, without the previous run's outcome.

## How to get to it (user POV)

- Git actions → menuitem "Stash changes" (description "Set aside local changes") → dialog "Stash changes": textbox "Message" (prefilled "Porcelain review"), checkbox "Include untracked files" (checked) → button "Stash changes".
- Git actions → menuitem "Pop stash" (description "Restore, then remove a stash") → dialog "Pop stash": combobox "Stash", checkbox "Restore staged changes" → button "Pop stash". Disabled with "No stash is available." when there is none.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### 1. Stash and pop bring the changes back

1. Click button `Git actions`
   Expect: menuitems starting "Stash changes" and "Pop stash".
2. Click menuitem `/^Stash changes/`
   Expect: dialog "Stash changes" with textbox "Message" reading "Porcelain review" and checkbox "Include untracked files" checked.
3. Fill textbox `Message` with 'Journey stash'
   Expect: the textbox reads "Journey stash".
4. Click button `Stash changes`
   Expect: `status` "succeeded" in the dialog.
5. Press `Escape`
   Expect: dialog "Stash changes" is gone; README.md is no longer listed (no button "Mark README.md as reviewed"). On disk `git -C "$REPO" stash list` prints `stash@{0}: On main: Journey stash` and `git -C "$REPO" status --short` prints nothing.
6. Click button `Git actions`
   Expect: the menu is open; menuitem starting "Pop stash" is enabled.
7. Click menuitem `/^Pop stash/`
   Expect: dialog "Pop stash" whose combobox "Stash" shows "On main: Journey stash · <7-character id>".
8. Click button `Pop stash`
   Expect: `status` "succeeded" in the dialog.
9. Press `Escape`
   Expect: dialog "Pop stash" is gone; README.md is listed again. `git -C "$REPO" stash list` prints nothing and `tail -1 "$REPO/README.md"` prints `A change to review.`

10. Click button `Git actions`, then click menuitem `/^Stash changes/`
   Expect: dialog "Stash changes" with button "Stash changes" enabled, no `status` "succeeded" and no button "Check outcome": the dialog starts fresh.
11. Click button `Stash changes`, Press `Escape`, click button `Git actions`, click menuitem `/^Pop stash/`
   Expect: dialog "Pop stash" with button "Pop stash" enabled, no `status` "succeeded" and no button "Check outcome", although the pop of step 8 succeeded in this page.

### 2. Popping over a file changed since is refused and keeps the stash

On a fresh instance (or after section 1):

1. Click button `Git actions`
   Expect: the menu is open.
2. Click menuitem `/^Stash changes/`
   Expect: dialog "Stash changes".
3. Click button `Stash changes`
   Expect: `status` "succeeded".
4. Press `Escape`
   Expect: the dialog is gone. Then on disk: `printf 'Changed while the stash was set aside\n' > "$REPO/README.md"`; the review lists README.md again.
5. Click button `Git actions`
   Expect: the menu is open.
6. Click menuitem `/^Pop stash/`
   Expect: dialog "Pop stash" with the stash "On main: Porcelain review · <id>" selected.
7. Click button `Pop stash`
   Expect: an `alert` in the dialog with Git's message containing "would be overwritten".

### Observable proof

Read stash message, disappearance and restored README after pop. On refused pop, both Changed while the stash was set aside and `stash@{0}: On main: Porcelain review` remain.

Automated coverage: `git-actions-stash.test.tsx`.

## Gotchas

- The menuitem names start with the label and continue with the description, so address them by `/^Stash changes/` and `/^Pop stash/`. While a dialog is open the page behind it is hidden from the accessibility tree, so button "Stash changes" or "Pop stash" resolves to the dialog's button only.
- Escape closes the dialog only after the action settled.
- Steps 10 and 11 of section 1 leave a stash set aside and the "Pop stash" dialog open; before section 2 press Escape and run `git -C "$REPO" stash pop`, or start a fresh instance.
- Section 2 leaves a stash and a modified README.md; reset with `git -C "$REPO" checkout README.md && git -C "$REPO" stash pop`, or start a fresh instance.
- A reopened dialog shows an earlier outcome only while that action is still running or unconfirmed (then with "Check outcome"); a settled one is not shown again.
