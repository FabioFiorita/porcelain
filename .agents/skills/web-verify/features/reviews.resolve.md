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

## What it is

Resolving a comment thread moves it from the open comments to the resolved ones and the server keeps it resolved; reopening it moves it back.

## How a user reaches it

- Review (phone; the right sidebar on desktop) → tab "Comments" → a thread's button "Resolve"; then filter button "resolved N" → the thread's button "Reopen"; filter button "open N" goes back.
- An inline thread under a file in a code document has the same "Resolve" / "Reopen" button.
- `Alt+Shift+R` toggles the Review sheet at phone width.

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start`.

### Setup

The agent comments on README.md: `.agents/skills/web-verify/scripts/cli agent comment README.md "Is this line still needed?"`. The thread is file-anchored, so it also shows inline under README.md, behind the sheet.

1. `.agents/skills/web-verify/scripts/cli open /`
   Look for: Page Title "Changes — repository".
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: dialog "Worktree review" with tabs "Changed files" and "Comments".
3. `.agents/skills/web-verify/scripts/cli click --role tab --name "/^Comments/"`
   Look for: buttons "open 1" [pressed] and "resolved 0"; region "Comments" with article "Comment thread" holding button "README.md Whole file", "Is this line still needed?", "From the agent" and button "Resolve".
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Resolve"`
   Look for: text "No open comments yet."; buttons "open 0" and "resolved 1". `.agents/skills/web-verify/scripts/cli server comment-threads` reads `"resolved": true`.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "/^resolved/i"`
   Look for: article "Resolved comment thread" with "Is this line still needed?" and button "Reopen"; button "Delete resolved" [disabled] (the agent started the only resolved thread).
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Reopen"`
   Look for: text "Nothing resolved yet."; buttons "open 1" and "resolved 0". `.agents/skills/web-verify/scripts/cli server comment-threads` reads `"resolved": false`.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "/^open/i"`
   Look for: article "Comment thread" with "Is this line still needed?" and button "Resolve".
8. `.agents/skills/web-verify/scripts/cli network`
   Look for: two `PUT /api/worktrees/<id>/comments/<threadId>/resolution` answered 200 (steps 4 and 6).

## What proves it works

- Steps 4 to 7: the thread moves between the "open" and "resolved" filters, the counts follow and the server's `resolved` flag with them; step 8's two 200 PUTs.
- Persistence: resolve it again, then `.agents/skills/web-verify/scripts/cli open /`, "Review", tab `/^Comments/`, button `/^resolved/i` shows it still resolved.
- `apps/web/spec/integration/reviews-resolve.test.tsx`: after an agent comment, Resolve shows "No open comments yet." and `server.commentThreads()` reads `resolved: true`; the "resolved" filter shows it; Reopen shows "Nothing resolved yet." and the server reads `resolved: false`; the "open" filter shows it again.

## Gotchas

- A reviewer comment on the whole change resolves the same way and shows only in the list; "Delete resolved" is then enabled.
- The filter buttons are named in lower case with their count ("open 1", "resolved 0"); CSS capitalises them. Address them with `/^open/i` and `/^resolved/i`.
- "Resolve" must be unique: threads left by other features in this instance make it ambiguous. `stop` and `start` for a clean instance.
