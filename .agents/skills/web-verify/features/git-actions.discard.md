---
route: /
selectors:
  - "Review"
  - "Discard changes to"
  - "Discard"
  - "Cancel"
  - "Discarded"
  - "Restore"
  - "Restored"
  - "Change no longer present"
  - "Look again"
  - "Look at the diff again before discarding"
tests:
  - apps/web/spec/integration/git-actions-discard.test.tsx
api:
  - POST /api/worktrees/:worktreeId/git/actions
---

# git-actions.discard

Discarding a changed file returns it to the last commit and the toast's Restore brings the change back; a file that changed on disk after the discard dialog opened is refused and keeps its newer text.

## Sub-features

- `git-actions.discard` — Discard confirmation and resulting files.

## How to get to it (user POV)

- Button "Review" (phone width; `Alt+Shift+R` toggles it) → Changes → button "README.md · unstaged" opens the change document → its header button "Discard changes to README.md" → alertdialog "Discard README.md?" → button "Discard".
- Right-click the row "README.md · unstaged" in the review sheet → menuitem "Discard" → the same alertdialog.
- After a discard, the toast "Discarded README.md" carries button "Restore" for 10 s (`DISCARD_RESTORE_TOAST_MS`).

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

 a fresh instance has README.md modified ("# Sample repository\n\nA change to review.\n" over the committed "# Sample repository\n").

### Case 1: discard returns the file to the last commit, and Restore brings the change back

1. Navigate to `/`, then click button `Review`
   Expect: the review sheet with button "README.md · unstaged".
2. Click button `README.md · unstaged`
   Expect: the sheet closes; a README.md change document with button "Discard changes to README.md".
3. Click button `Discard changes to README.md`
   Expect: alertdialog "Discard README.md?" reading "The file goes back to the last commit. You can restore the changes."; buttons "Cancel" and "Discard".
4. Click button `Discard`
   Expect: the alertdialog is gone; in region "Notifications", dialog "Discarded README.md" with button "Restore"; the document reads "Change no longer present"; the Git button in group "Git controls" now reads "Apply stash" (the discarded change is kept as a stash until Restore). Disk: `cat "$REPO/README.md"` prints `# Sample repository`.
5. Click button `Restore` (within 10 s of step 4)
   Expect: in region "Notifications", dialog "Restored README.md"; the Git button reads "Commit" again. Disk: `cat "$REPO/README.md"` prints `# Sample repository`, a blank line, `A change to review.`

### Case 2: a file that changed after the dialog opened is refused and keeps its newer text

Fresh instance, or after case 1's Restore.

1. Navigate to `/`, click button `Review`, click button `README.md · unstaged`, click button `Discard changes to README.md`
   Expect: alertdialog "Discard README.md?".
2. On disk, with the dialog open: `printf 'Changed on disk after the discard dialog opened\n' > "$REPO/README.md"`
3. Click button `Discard`
   Expect: an alert in the alertdialog reads "changed since looked Look at the diff again before discarding."; the "Cancel" button is now named `Look again` and the "Discard" button is gone. Disk: `cat "$REPO/README.md"` prints `Changed on disk after the discard dialog opened`.
4. Click button `Look again`
   Expect: the alertdialog closes; the change document shows the newer text.

### Observable proof

Read disk after discard/restore/refusal. Record action requests including recovery `stash-apply`.

Automated coverage: `git-actions-discard.test.tsx`.

## Gotchas

- Restore expires after 10 seconds; click it immediately after Discard. Snapshot row names after staging: change scopes alter the accessible name.
- For stale refusal, write disk only after opening the confirmation. Restore README’s change before repeating without Restore.
