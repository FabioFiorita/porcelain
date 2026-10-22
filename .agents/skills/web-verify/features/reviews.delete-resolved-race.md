---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Comments"
  - "Comment on the whole change"
  - "Comment"
  - "Resolve"
  - "Delete resolved"
  - "Delete"
  - "Close"
  - "that changed"
tests:
  - apps/web/spec/integration/reviews-delete-resolved-race.test.tsx
api:
  - POST /api/worktrees/:worktreeId/comments/resolved/deletion
---

# reviews.delete-resolved-race

A resolved thread the agent answers after the reviewer opened the "Delete resolved" confirmation is not deleted: the server skips it because its revision changed, and the dialog turns into "Kept 1 thread that changed" with a Close button.

## How to get to it (user POV)

- Review (phone; the right sidebar on desktop) → tab "Comments" → filter button "resolved N" → "Delete resolved" → (the agent replies now) → "Delete".

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

None before step 1. Step 6 has the agent reply while the confirmation is open.

1. Navigate to `/` then click button `Review` then click tab `/^Comments/`
   Expect: dialog "Worktree review"; button "Comment on the whole change".
2. Click button `Comment on the whole change` then replace the contents of textbox named `Comment` with 'Split this into two commits' then click button `Comment`
   Expect: article "Comment thread" with "Split this into two commits".
3. Click button `Resolve`
   Expect: text "No open comments yet."; button "resolved 1".
4. Click button `/^resolved/i`
   Expect: article "Resolved comment thread"; button "Delete resolved".
5. Click button `Delete resolved`
   Expect: alertdialog with heading "Delete 1 resolved thread?"; buttons "Cancel" and "Delete".
6. With the alertdialog still open: `$C agent reply latest "Done, split into two commits"` (`latest` is the thread with the newest message; `$C server comment-threads` prints every thread id).
   Expect: "the agent's reply reached the server" with the thread now holding both messages; the alertdialog still reads "Delete 1 resolved thread?".
7. Click button `Delete`
   Expect: the alertdialog stays, now with heading "Kept 1 thread that changed", the text "The agent answered or someone reopened them after you confirmed, so they stay for you to read first." and button "Close" (no "Cancel" or "Delete").
8. Click button `Close`
   Expect: the alertdialog is gone; the resolved thread "Split this into two commits" is still listed. `$C server comment-threads` shows the thread `"resolved": true` with both messages.

### Observable proof

Reload resolved filter: changed thread/reply stays after Kept 1 thread that changed. Deletion POST/200 reports skipped thread.

Automated coverage: `reviews-delete-resolved-race.test.tsx`.

## Gotchas

- Add the agent reply while confirmation is open; otherwise this proves ordinary deletion only. Use a clean thread fixture to avoid ambiguous Resolve controls.
