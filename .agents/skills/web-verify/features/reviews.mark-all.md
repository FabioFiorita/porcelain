---
route: /
selectors:
  - "Mark all 2 files reviewed"
  - "Mark all reviewed"
  - "Unmark "
  - "Marked "
  - "Mark changed "
  - "Changed since reviewed"
  - "as reviewed"
  - "as unreviewed"
tests:
  - apps/web/spec/integration/reviews-mark-all.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.mark-all

## What it is

The Changes document's toolbar button marks every changed file reviewed in one request; a file that changes on disk afterwards becomes eligible again ("Mark all 1 files reviewed"), and once everything is reviewed the same button reads "Unmark all" and clears every mark.

## How a user reaches it

- The Changes (handoff) document, shown when no review is published: toolbar button "Mark all reviewed", accessible name "Mark all <n> files reviewed"; it becomes "Unmark all" when every reviewable file is reviewed.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (prints `repository <path>`; call it `$REPO`).

### Setup

```sh
printf 'Notes to review\n' > "$REPO/NOTES.md"
```

1. `$C open /`
   Look for: heading "Changes", text "2 files", button "Mark all 2 files reviewed" (text "Mark all reviewed"), buttons "Mark README.md as reviewed" and "Mark NOTES.md as reviewed".
2. `$C click --role button --name "Mark all 2 files reviewed"`
   Look for: button "Unmark all" enabled; status "Marked 2 files."; buttons "Unmark README.md as unreviewed" and "Unmark NOTES.md as unreviewed"; both diffs fold (buttons "Expand README.md", "Expand NOTES.md"). `$C server reviewed-files` lists NOTES.md and README.md with their fingerprints.
3. On disk: `printf 'Notes changed after the review\n' > "$REPO/NOTES.md"`, then `$C wait --role button --name "Mark all 1 files reviewed"` and `$C snapshot`
   Look for: button "Mark all 1 files reviewed" enabled; button "Mark changed NOTES.md as reviewed" with the badge text "Changed since reviewed"; README.md still "Unmark README.md as unreviewed".
4. `$C click --role button --name "Mark all 1 files reviewed"`
   Look for: button "Unmark all" enabled; status "Marked 1 file. Skipped 1." (README.md was already reviewed); "Unmark NOTES.md as unreviewed".
5. `$C click --role button --name "Unmark all"`
   Look for: button "Mark all 2 files reviewed" enabled; "Mark README.md as reviewed" and "Mark NOTES.md as reviewed". `$C server reviewed-files` shows `"marks": []`.

## What proves it works

- The button labels in steps 2 to 5 and `$C network`: `PUT /api/worktrees/<id>/reviewed-bulk` 200 for steps 2 and 4, `DELETE /api/worktrees/<id>/reviewed-bulk` 200 for step 5.
- Persistence: `$C server reviewed-files` reads both marks with their fingerprints after steps 2 and 4 and none after 5; `$C open /` after step 2 or 4 still shows "Unmark all".
- `apps/web/spec/integration/reviews-mark-all.test.tsx`: after marking all, both files are reviewed at their current fingerprints (`server.reviewedFiles()` against `server.changes()`); rewriting NOTES.md leaves only README.md reviewed as it is and offers "Mark all 1 files reviewed"; marking again covers both; "Unmark all" leaves no marks.

## Gotchas

- The page follows the disk write through the server's watcher and the live connection, which the `wait` in step 3 follows.
- Only shown while no review is published: with a published review the handoff tab shows the review overview instead and this button is gone.
- Marks persist on the server and NOTES.md stays on disk; end with step 5 and `rm "$REPO/NOTES.md"` before another feature that counts files.
