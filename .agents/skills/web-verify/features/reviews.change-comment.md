---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Comments"
  - "Uncommitted"
  - "Branch"
  - "Comment on the whole change"
  - "Comment on the whole branch"
  - "Comment"
  - "Whole change"
  - "Whole branch"
tests:
  - apps/web/spec/integration/reviews-change-comment.test.tsx
api:
  - POST /api/worktrees/:worktreeId/comments
---

# reviews.change-comment

## What it is

A comment on the whole uncommitted change is saved with no file (anchor `{ kind: 'change' }`) and waits for the agent; one on the whole branch is saved against the branch base and the tip the branch had when it was read.

## How a user reaches it

- Review (phone; the right sidebar on desktop) → tab "Comments" → button "Comment on the whole change" while the "Uncommitted" tab is selected.
- Review → tab "Branch" (tablist "Changes to review", URL gains `?scope=branch`) → tab "Comments" → button "Comment on the whole branch". It stays disabled until the branch changes have loaded.
- `Alt+Shift+R` toggles the Review sheet at phone width.

## Driving it

Start with `$C start`; pair your browser using the card’s pairing-link command. `$REPO` is `fixtures.repositoryPath` in the card’s `connection.json`.

### Setup

None before step 1. Step 6 creates the branch on disk mid-drive, as the test does.

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Changes — repository".
2. Click button named `Review`
   Look for: dialog "Worktree review" with tab "Uncommitted" selected and tabs "Changed files" and "Comments".
3. Click tab named `/^Comments/`
   Look for: button "Comment on the whole change"; buttons "open 0" and "resolved 0"; text "No open comments yet."
4. Click button named `Comment on the whole change`
   Look for: textbox "Comment" with the label text "Whole change" above it; button "Comment" is disabled.
5. Replace the contents of textbox named `Comment` with 'Split this into two commits' then click button named `Comment`
   Look for: textbox "Comment" is gone and button "Comment on the whole change" is back; an article "Comment thread" with the text "You", button "Whole change" (title "Show the change"), the text "Split this into two commits" and "Waiting for the agent"; button "open 1"; the tab now reads "Comments 1".
6. On disk:
   ```sh
   git -C "$REPO" switch -c feature
   printf 'first line\n' > "$REPO/notes.md"
   git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
   git -C "$REPO" rev-parse --short=7 HEAD
   ```
   The last line prints the tip, call it `<tip>`.
7. Click tab named `Branch`
   Look for: Page URL ends with `?scope=branch` (or contains `scope=branch`); button "Comment on the whole branch" is enabled.
8. Click button named `Comment on the whole branch`
   Look for: textbox "Comment" with the label text "Whole branch · at <tip>".
9. Replace the contents of textbox named `Comment` with 'Ready to merge once the notes are in' then click button named `Comment`
   Look for: a second article "Comment thread" with button "Whole branch in <tip>" and the text "Ready to merge once the notes are in"; the first thread still shows button "Whole change"; button "open 2".
10. Inspect HTTP requests and responses
    Look for: two `POST /api/worktrees/<id>/comments` answered 200 (steps 5 and 9).

## What proves it works

- Step 9's two threads, with buttons "Whole change" and "Whole branch in <tip>", and step 10's two 200 POSTs.
- Persistence: Navigate to `/` on the card’s web URL (full page load), then "Review" and tab `/^Comments/`, lists both threads again.
- `apps/web/spec/integration/reviews-change-comment.test.tsx`: "Whole change" shows and the post button is disabled when the composer opens; after posting, `server.commentThreads()` holds `{ anchor: { kind: 'change' } }`; after the branch commit the branch button is enabled, and the branch thread is saved with `comparison: { kind: 'branch', base: 'refs/heads/main' }` and `revision` = the branch tip.

## Gotchas

- Address the Comments tab with `/^Comments/`: once an open comment exists its name gains the count ("Comments 1").
- The branch button reads the branch through the server's watcher; if step 7 shows it disabled, inspect the accessibility tree again after a second.
- The sample `README.md` change is committed with the notes in step 6 (`add --all`), so after step 6 the Uncommitted list is empty. That is expected.
- `git commit` uses your global Git identity; if it has none, add `-c user.name=Verifier -c user.email=verifier@example.invalid` after `git -C "$REPO"`.
- The instance keeps the branch `feature` and both threads; later comment features see them. `stop` and `start` for a clean instance.
