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

The test resolves an agent comment, which the CLI cannot create (see Gotchas). Resolving works the same on any thread, so this drive uses a reviewer comment on the whole change, which shows only in the comment list and so never collides with an inline copy.

1. `.agents/skills/web-verify/scripts/cli open /`
   Look for: Page Title "Changes — repository".
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: dialog "Worktree review" with tabs "Changed files" and "Comments".
3. `.agents/skills/web-verify/scripts/cli click --role tab --name "/^Comments/"`
   Look for: button "Comment on the whole change"; buttons "open 0" and "resolved 0".
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Comment on the whole change"` then `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Is this line still needed?"` then `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: article "Comment thread" with the text "Is this line still needed?" and button "Resolve"; button "open 1".
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Resolve"`
   Look for: text "No open comments yet."; buttons "open 0" and "resolved 1".
6. `.agents/skills/web-verify/scripts/cli click --role button --name "/^resolved/i"`
   Look for: article "Resolved comment thread" with the text "Is this line still needed?" and button "Reopen"; button "Delete resolved".
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Reopen"`
   Look for: text "Nothing resolved yet."; buttons "open 1" and "resolved 0".
8. `.agents/skills/web-verify/scripts/cli click --role button --name "/^open/i"`
   Look for: article "Comment thread" with the text "Is this line still needed?" and button "Resolve".
9. `.agents/skills/web-verify/scripts/cli network`
   Look for: two `PUT /api/worktrees/<id>/comments/<threadId>/resolution` answered 200 (steps 5 and 7).

## What proves it works

- Steps 5 to 8: the thread moves between the "open" and "resolved" filters and the counts follow; step 9's two 200 PUTs.
- Persistence: resolve it again, then `.agents/skills/web-verify/scripts/cli open /`, "Review", tab `/^Comments/`, button `/^resolved/i` shows it still resolved.
- `apps/web/spec/integration/reviews-resolve.test.tsx`: after an agent comment, Resolve shows "No open comments yet." and `server.commentThreads()` reads `resolved: true`; the "resolved" filter shows it; Reopen shows "Nothing resolved yet." and the server reads `resolved: false`; the "open" filter shows it again.

## Gotchas

- The test's own setup (an agent comment) is unreachable through the CLI: it needs `cli agent comment README.md "Is this line still needed?"`. Such a comment is file-anchored and also shows inline under README.md, behind the sheet.
- The filter buttons are named in lower case with their count ("open 1", "resolved 0"); CSS capitalises them. Address them with `/^open/i` and `/^resolved/i`.
- "Resolve" must be unique: threads left by other features in this instance make it ambiguous. `stop` and `start` for a clean instance.
