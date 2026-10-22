---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Comments"
  - "Comment on the whole change"
  - "Comment"
  - "Resolve"
  - "Reopen"
  - "No open comments yet."
  - "Nothing resolved yet."
tests:
  - apps/web/spec/integration/reviews-resolve.test.tsx
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# reviews.resolve

Resolving a comment thread moves it from the open comments to the resolved ones and the server keeps it resolved; reopening it moves it back.

## Sub-features

- `reviews.resolve` — Resolve and reopen threads.

## How to get to it (user POV)

- Review (phone; the right sidebar on desktop) → tab "Comments" → a thread's button "Resolve"; then filter button "resolved N" → the thread's button "Reopen"; filter button "open N" goes back.
- An inline thread under a file in a code document has the same "Resolve" / "Reopen" button.
- `Alt+Shift+R` toggles the Review sheet at phone width.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

The agent comments on README.md: `$C agent comment README.md "Is this line still needed?"`. The thread is file-anchored, so it also shows inline under README.md, behind the sheet.

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Review`
   Expect: dialog "Worktree review" with tabs "Changed files" and "Comments".
3. Click tab `/^Comments/`
   Expect: buttons "open 1" [pressed] and "resolved 0"; region "Comments" with article "Comment thread" holding button "README.md Whole file", "Is this line still needed?", "From the agent" and button "Resolve".
4. Click button `Resolve`
   Expect: text "No open comments yet."; buttons "open 0" and "resolved 1". `$C server comment-threads` reads `"resolved": true`.
5. Click button `/^resolved/i`
   Expect: article "Resolved comment thread" with "Is this line still needed?" and button "Reopen"; button "Delete resolved" [disabled] (the agent started the only resolved thread).
6. Click button `Reopen`
   Expect: text "Nothing resolved yet."; buttons "open 1" and "resolved 0". `$C server comment-threads` reads `"resolved": false`.
7. Click button `/^open/i`
   Expect: article "Comment thread" with "Is this line still needed?" and button "Resolve".
8. Inspect HTTP traffic
   Expect: two `PUT /api/worktrees/<id>/comments/<threadId>/resolution` answered 200 (steps 4 and 6).

### Observable proof

Resolve/reopen changes counts/filter and independent resolved flag; PUTs answer 200. Resolve and reload resolved filter: thread stays resolved.

Automated coverage: `reviews-resolve.test.tsx`.

## Gotchas

- Whole-change comments resolve in the list. Filter names use lowercase/counts; match `/^open/i`, `/^resolved/i`.
- Scope Resolve or use a fresh fixture when multiple threads exist.
