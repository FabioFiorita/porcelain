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

## What it is

A resolved thread the agent answers after the reviewer opened the "Delete resolved" confirmation is not deleted: the server skips it because its revision changed, and the dialog turns into "Kept 1 thread that changed" with a Close button.

## How a user reaches it

- Review (phone; the right sidebar on desktop) → tab "Comments" → filter button "resolved N" → "Delete resolved" → (the agent replies now) → "Delete".

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start`.

### Setup

None before step 1. Step 6 needs an agent reply while the confirmation is open, which the CLI cannot send (see Gotchas). Steps 1 to 5 and the deletion without the race (`reviews.delete-resolved`) are drivable.

1. `.agents/skills/web-verify/scripts/cli open /` then `.agents/skills/web-verify/scripts/cli click --role button --name "Review"` then `.agents/skills/web-verify/scripts/cli click --role tab --name "/^Comments/"`
   Look for: dialog "Worktree review"; button "Comment on the whole change".
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment on the whole change"` then `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Split this into two commits"` then `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: article "Comment thread" with "Split this into two commits".
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Resolve"`
   Look for: text "No open comments yet."; button "resolved 1".
4. `.agents/skills/web-verify/scripts/cli click --role button --name "/^resolved/i"`
   Look for: article "Resolved comment thread"; button "Delete resolved".
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Delete resolved"`
   Look for: alertdialog with heading "Delete 1 resolved thread?"; buttons "Cancel" and "Delete".
6. CLI gap, with the alertdialog still open: `cli server comment-threads` (to read the thread id), then `cli agent reply <threadId> "Done, split into two commits"`.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Delete"`
   Look for: the alertdialog stays, now with heading "Kept 1 thread that changed", the text "The agent answered or someone reopened them after you confirmed, so they stay for you to read first." and button "Close" (no "Cancel" or "Delete").
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Close"`
   Look for: the alertdialog is gone; the resolved thread "Split this into two commits" is still listed.

## What proves it works

- Step 7's "Kept 1 thread that changed" and step 8's thread still listed; `.agents/skills/web-verify/scripts/cli network` shows `POST /api/worktrees/<id>/comments/resolved/deletion` answered 200 (the server reports the skipped thread in its answer instead of failing).
- Persistence: after `open /`, Review → Comments → resolved still lists the thread, now with the agent's reply in it.
- `apps/web/spec/integration/reviews-delete-resolved-race.test.tsx`: the reviewer resolves their own whole-change comment, opens "Delete resolved", the agent replies while "Delete 1 resolved thread?" is shown, Delete shows "Kept 1 thread that changed", Close removes the alertdialog, and `server.commentThreads()` still holds both messages.

## Gotchas

- Unreachable through the CLI: the race needs an agent reply between steps 5 and 7, `cli agent reply <threadId> "Done, split into two commits"`, and reading the thread id needs `cli server comment-threads`.
- Without step 6, "Delete" simply deletes the thread and the alertdialog closes (the promise of `reviews.delete-resolved`), so a drive that skips the gap proves nothing about the race.
- Threads left by other features make "Resolve" ambiguous; `stop` and `start` for a clean instance.
