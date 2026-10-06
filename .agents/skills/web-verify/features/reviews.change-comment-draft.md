# reviews.change-comment-draft

## What it is

A whole-branch comment being written keeps its text when a new commit lands on the branch, its label moves to the new tip, and it is saved against the tip the branch has when it is posted.

## How a user reaches it

- Review (phone; the right sidebar on desktop) → tab "Branch" (tablist "Changes to review") → tab "Comments" → button "Comment on the whole branch", while the agent (or anyone) commits on the branch.
- `Alt+Shift+R` toggles the Review sheet at phone width.

## Driving it

Start with `$C start`. `$REPO` is the path `start` prints after `repository`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

```sh
git -C "$REPO" switch -c feature
printf 'first line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
```

Do not make the second commit yet: it lands in step 6, while the draft is open.

1. Open `/` on the instance web URL
   Look for: Page Title "Changes — repository".
2. Click the button named 'Review'
   Look for: dialog "Worktree review" with tabs "Uncommitted" and "Branch", "Changed files" and "Comments".
3. Click the tab named 'Branch'
   Look for: tab "Branch" selected; Page URL contains `scope=branch`.
4. Click the tab whose name starts with 'Comments'
   Look for: button "Comment on the whole branch" (enabled once the branch changes load).
5. Click the button named 'Comment on the whole branch' then set the text field named 'Comment' to 'Split the notes before merging'
   Look for: the label text `Whole branch · at <first tip>` above textbox "Comment", where `<first tip>` is `git -C "$REPO" rev-parse --short=7 HEAD`; the snapshot shows the textbox holding "Split the notes before merging".
6. On disk, with the composer still open:
   ```sh
   printf 'first line\nsecond line\n' > "$REPO/notes.md"
   git -C "$REPO" commit -am "Extend notes"
   git -C "$REPO" rev-parse --short=7 HEAD
   ```
   The last line prints `<new tip>`.
7. Inspect the current page
   Look for: the label text `Whole branch · at <new tip>`; textbox "Comment" still holds "Split the notes before merging".
8. Click the button named 'Comment'
   Look for: textbox "Comment" is gone; an article "Comment thread" with button `Whole branch in <new tip>` and the text "Split the notes before merging".
9. Inspect browser network evidence
   Look for: one `POST /api/worktrees/<id>/comments` answered 200 after a later `GET /api/worktrees/<id>/branch-changes`.

## What proves it works

- Steps 7 and 8: the draft survives the commit, the label follows the new tip, and the saved thread names `<new tip>`, not `<first tip>`.
- Persistence: open `/` on the instance web URL, "Review", tab "Branch", the tab whose name starts with "Comments" lists the thread with `Whole branch in <new tip>`.
- `apps/web/spec/integration/reviews-change-comment-draft.test.tsx`: after the second commit the composer shows `Whole branch · at <tip>` for the new tip and still holds the draft; after posting, `server.commentThreads()` holds one thread whose `anchor.revision` is the new tip.

## Gotchas

- The label moves only after the server's watcher reports the commit; if step 7 still shows the first tip, inspect the page again after a second.
- Replace the text field content and keep focus in it, so the draft stays open while you commit on disk; do not press `Escape` (it cancels the composer).
- `git commit` uses your global Git identity; if it has none, add `-c user.name=Verifier -c user.email=verifier@example.invalid` after `git -C "$REPO"`.
- The instance keeps the branch `feature` (with the sample README change committed into "Add notes") and the thread. `stop` and `start` for a clean instance.
