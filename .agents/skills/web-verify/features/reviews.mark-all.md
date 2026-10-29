---
route: /
selectors:
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

The Changes document's File review actions popover button marks every changed file reviewed in one request; a file that changes on disk afterwards becomes eligible again ("Mark all 1 file reviewed"), and once everything is reviewed the same button reads "Unmark all" and clears every mark.

## How to get to it (user POV)

- The Changes (handoff) document, shown when no review is published: progress count button "File review actions: r of n files reviewed", opening a popover with "Mark all reviewed", accessible name "Mark all <n> files reviewed"; it becomes "Unmark all" when every reviewable file is reviewed.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

```sh
printf 'Notes to review\n' > "$REPO/NOTES.md"
```

1. Navigate to `/`
   Expect: heading "2 uncommitted changes" and progress "0 of 2 files reviewed". Open File review actions to see button "Mark all 2 files reviewed" (text "Mark all reviewed"), buttons "Mark README.md as reviewed" and "Mark NOTES.md as reviewed".
2. Click button `Mark all 2 files reviewed`
   Expect: button "Unmark all" enabled; status "Marked 2 files."; buttons "Unmark README.md as unreviewed" and "Unmark NOTES.md as unreviewed"; both diffs fold (buttons "Expand README.md", "Expand NOTES.md"). `$C server reviewed-files` lists NOTES.md and README.md with their fingerprints.
   Proof before continuing: reload now, then reopen File review actions: Unmark all and both fingerprints persist. `$C server reviewed-files` after each mark holds both fingerprints; after step 5 it holds none and the reload must show Mark all 2 files reviewed. Bulk PUT/DELETE answer 200.

3. On disk: `printf 'Notes changed after the review\n' > "$REPO/NOTES.md"`, then wait for button `Mark all 1 file reviewed`
   Expect: button "Mark all 1 file reviewed" enabled; button "Mark changed NOTES.md as reviewed" with the badge text "Changed since reviewed"; README.md still "Unmark README.md as unreviewed".
4. Click button `Mark all 1 file reviewed`
   Expect: button "Unmark all" enabled; status "Marked 1 file. Skipped 1." (README.md was already reviewed); "Unmark NOTES.md as unreviewed".
5. Click button `Unmark all`
   Expect: button "Mark all 2 files reviewed" enabled; "Mark README.md as reviewed" and "Mark NOTES.md as reviewed". `$C server reviewed-files` shows `"marks": []`.

Automated coverage: `reviews-mark-all.test.tsx`.

## Gotchas

- Bulk counts exclude already reviewed current files; unmark first. With a published review, bulk controls live in All changes rather than walkthrough.
- Leave marks cleared and remove NOTES.md before another file-count journey.
