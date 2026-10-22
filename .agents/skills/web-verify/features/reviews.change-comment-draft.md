---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Comments"
  - "Branch"
  - "Comment on the whole branch"
  - "Comment"
  - "Whole branch"
tests:
  - apps/web/spec/integration/reviews-change-comment-draft.test.tsx
api:
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/branch-changes
  - POST /api/worktrees/:worktreeId/comments
---

# reviews.change-comment-draft

A whole-branch comment being written keeps its text when a new commit lands on the branch, its label moves to the new tip, and it is saved against the tip the branch has when it is posted.

## How to get to it (user POV)

- Review (phone; the right sidebar on desktop) → tab "Branch" (tablist "Changes to review") → tab "Comments" → button "Comment on the whole branch", while the agent (or anyone) commits on the branch.
- `Alt+Shift+R` toggles the Review sheet at phone width.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

```sh
git -C "$REPO" switch -c feature
printf 'first line\n' > "$REPO/notes.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
```

Do not make the second commit yet: it lands in step 6, while the draft is open.

1. Navigate to `/`
   Expect: title "Files — repository".
2. Click button `Review`, then click tab `Changes`
   Expect: dialog "Worktree review" with tabs "Uncommitted" and "Branch", "Changed files" and "Comments".
3. Click tab `Branch`
   Expect: tab "Branch" selected; URL contains `scope=branch`.
4. Click tab `/^Comments/`
   Expect: button "Comment on the whole branch" (enabled once the branch changes load).
5. Click button `Comment on the whole branch` then replace the contents of textbox named `Comment` with 'Split the notes before merging'
   Expect: the label text `Whole branch · at <first tip>` above textbox "Comment", where `<first tip>` is `git -C "$REPO" rev-parse --short=7 HEAD`; the snapshot shows the textbox holding "Split the notes before merging".
6. On disk, with the composer still open:
   ```sh
   printf 'first line\nsecond line\n' > "$REPO/notes.md"
   git -C "$REPO" commit -am "Extend notes"
   git -C "$REPO" rev-parse --short=7 HEAD
   ```
   The last line prints `<new tip>`.
7. Inspect the accessibility tree
   Expect: the label text `Whole branch · at <new tip>`; textbox "Comment" still holds "Split the notes before merging".
8. Click button `Comment`
   Expect: textbox "Comment" is gone; an article "Comment thread" with button `Whole branch in <new tip>` and the text "Split the notes before merging".
9. Inspect HTTP traffic
   Expect: one `POST /api/worktrees/<id>/comments` answered 200 after a later `GET /api/worktrees/<id>/branch-changes`.

### Observable proof

Reload → Review → Branch → /^Comments/: draft survived commit and saved Whole branch in <new tip> anchor persists.

Automated coverage: `reviews-change-comment-draft.test.tsx`.

## Gotchas

- Wait for the live tip label after disk commit. Fill without blur; Escape cancels the draft.
- Setup leaves feature/thread; reset before another map. Fixture Git identity is supplied by the baseline.
