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

A comment on the whole uncommitted change is saved with no file (anchor `{ kind: 'change' }`) and waits for the agent; one on the whole branch is saved against the branch base and the tip the branch had when it was read.

## How to get to it (user POV)

- Review (phone; the right sidebar on desktop) → tab "Comments" → button "Comment on the whole change" while the "Uncommitted" tab is selected.
- Review → tab "Branch" (tablist "Changes to review", URL gains `?scope=branch`) → tab "Comments" → button "Comment on the whole branch". It stays disabled until the branch changes have loaded.
- `Alt+Shift+R` toggles the Review sheet at phone width.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

None before step 1. Step 6 creates the branch on disk mid-drive.

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Review`
   Expect: dialog "Worktree review" with tab "Uncommitted" selected and tabs "Changed files" and "Comments".
3. Click tab `/^Comments/`
   Expect: button "Comment on the whole change"; buttons "open 0" and "resolved 0"; text "No open comments yet."
4. Click button `Comment on the whole change`
   Expect: textbox "Comment" with the label text "Whole change" above it; button "Comment" is disabled.
5. Fill textbox `Comment` with 'Split this into two commits' then click button `Comment`
   Expect: textbox "Comment" is gone and button "Comment on the whole change" is back; an article "Comment thread" with the text "You", button "Whole change" (title "Show the change"), the text "Split this into two commits" and "Waiting for the agent"; button "open 1"; the tab now reads "Comments 1".
6. On disk:
   ```sh
   git -C "$REPO" switch -c feature
   printf 'first line\n' > "$REPO/notes.md"
   git -C "$REPO" add --all && git -C "$REPO" commit -m "Add notes"
   git -C "$REPO" rev-parse --short=7 HEAD
   ```
   The last line prints the tip, call it `<tip>`.
7. Click tab `Branch`
   Expect: URL ends with `?scope=branch` (or contains `scope=branch`); button "Comment on the whole branch" is enabled.
8. Click button `Comment on the whole branch`
   Expect: textbox "Comment" with the label text "Whole branch · at <tip>".
9. Fill textbox `Comment` with 'Ready to merge once the notes are in' then click button `Comment`
   Expect: a second article "Comment thread" with button "Whole branch in <tip>" and the text "Ready to merge once the notes are in"; the first thread still shows button "Whole change"; button "open 2".
10. Inspect HTTP traffic
    Expect: two `POST /api/worktrees/<id>/comments` answered 200 (steps 5 and 9).

### Observable proof

Reload Review → /^Comments/: Whole change and Whole branch in <tip> threads persist; two POSTs answer 200.

Automated coverage: `reviews-change-comment.test.tsx`.

## Gotchas

- Use `/^Comments/` because the count joins its name. Wait for live branch availability before clicking.
- add --all commits README too, so Uncommitted becomes empty. Setup leaves feature/two threads; reset before another map.
