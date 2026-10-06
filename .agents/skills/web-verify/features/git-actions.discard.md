# git-actions.discard

## What it is

Discarding a changed file returns it to the last commit and the toast's Restore brings the change back; a file that changed on disk after the discard dialog opened is refused and keeps its newer text.

## How a user reaches it

- Button "Review" (phone width; `Alt+Shift+R` toggles it) → Changes → button "README.md · unstaged" opens the change document → its header button "Discard changes to README.md" → alertdialog "Discard README.md?" → button "Discard".
- Right-click the row "README.md · unstaged" in the review sheet → menuitem "Discard" → the same alertdialog.
- After a discard, the toast "Discarded README.md" carries button "Restore" for 10 s (`DISCARD_RESTORE_TOAST_MS`).

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`, then `REPO=<the repository path start printed>`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

None: a fresh instance has README.md modified ("# Sample repository\n\nA change to review.\n" over the committed "# Sample repository\n").

### Case 1: discard returns the file to the last commit, and Restore brings the change back

1. Open `/` on the instance web URL, then click the button named 'Review'
   Look for: the review sheet with button "README.md · unstaged".
2. Click the button named 'README.md · unstaged'
   Look for: the sheet closes; a README.md change document with button "Discard changes to README.md".
3. Click the button named 'Discard changes to README.md'
   Look for: alertdialog "Discard README.md?" reading "The file goes back to the last commit. You can restore the changes."; buttons "Cancel" and "Discard".
4. Click the button named 'Discard'
   Look for: the alertdialog is gone; in region "Notifications", dialog "Discarded README.md" with button "Restore"; the document reads "Change no longer present"; the Git button in group "Git controls" now reads "Apply stash" (the discarded change is kept as a stash until Restore). Disk: `cat "$REPO/README.md"` prints `# Sample repository`.
5. Click the button named 'Restore' (within 10 s of step 4)
   Look for: in region "Notifications", dialog "Restored README.md"; the Git button reads "Commit" again. Disk: `cat "$REPO/README.md"` prints `# Sample repository`, a blank line, `A change to review.`

### Case 2: a file that changed after the dialog opened is refused and keeps its newer text

Fresh instance, or after case 1's Restore.

1. Open `/` on the instance web URL, click the button named 'Review', click the button named 'README.md · unstaged', click the button named 'Discard changes to README.md'
   Look for: alertdialog "Discard README.md?".
2. On disk, with the dialog open: `printf 'Changed on disk after the discard dialog opened\n' > "$REPO/README.md"`
3. Click the button named 'Discard'
   Look for: an alert in the alertdialog reads "changed since looked Look at the diff again before discarding."; the "Cancel" button is now named "Look again" and the "Discard" button is gone. Disk: `cat "$REPO/README.md"` prints `Changed on disk after the discard dialog opened`.
4. Click the button named 'Look again'
   Look for: the alertdialog closes; the change document shows the newer text.

## What proves it works

- The file content on disk after each step (committed text after Discard, the change back after Restore, the newer text kept after the refusal). Browser network evidence shows `POST /api/worktrees/<worktreeId>/git/actions` for the discard and for the restore (a `stash-apply` of the recovery stash).
- `apps/web/spec/integration/git-actions-discard.test.tsx`: case 1 asserts "Discarded README.md", the server text equal to the committed README, then "Restored README.md" and the changed README back; case 2 asserts the alert matches /Look at the diff again before discarding\./, the "Look again" button, and the server text equal to the newer text.

## Gotchas

- The Restore toast closes after 10 s (`DISCARD_RESTORE_TOAST_MS`); click "Restore" as the very next command after "Discard".
- Phone width: the review list lives in a sheet behind button "Review"; opening a row closes it.
- The row's name is built at runtime from the file name and its change scopes joined by " + " ("README.md · unstaged" on a fresh instance); staging the file changes the name, so take a snapshot for the exact name after any `git add`.
- Case 2's disk write must come after the alertdialog is open: the discard expects the fingerprint the dialog saw when it opened.
- After case 1 without Restore, README.md has no change left and its Discard button is gone; restore the change with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
