---
route: /$projectId/$worktreeId
selectors:
  - "Comment on "
  - "Comment"
  - "Reply"
  - "Post reply"
  - "Waiting for the agent"
  - "From the agent"
tests:
  - apps/web/spec/integration/reviews-reply.test.tsx
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# reviews.reply

## What it is

A blank reply cannot be posted, and a written reply to the agent's comment joins its thread, which then shows "Waiting for the agent".

## How a user reaches it

- An open thread, inline under its file or in Review → Comments: button "Reply" → textbox "Reply" (placeholder "Add a reply…") → button "Post reply" (or "Cancel").

## Driving it

Start with `$C start`.

### Setup

The agent comments on README.md: `$C agent comment README.md "Should this line stay?"`.

1. `$C open /`, then `$C wait --text "Should this line stay?"`
   Look for: article "Comment thread" under README.md with "Agent Whole file From the agent", buttons "Reply" and "Resolve", and "Should this line stay?".
2. `$C click --role button --name "Reply"`
   Look for: textbox "Reply"; button "Post reply" [disabled]; button "Reply" is gone while the form is open.
3. `$C fill --role textbox --name "Reply" "   "`
   Look for: button "Post reply" still [disabled].
4. `$C fill --role textbox --name "Reply" "Yes, it documents the change"` then `$C click --role button --name "Post reply"`
   Look for: textbox "Reply" is gone; the same article now reads "Agent Whole file Waiting for the agent" and holds "Should this line stay?" followed by "You … Yes, it documents the change" and "The agent reads this when you ask it to check its comments.".
5. `$C network`
   Look for: one `POST /api/worktrees/<id>/comments/<threadId>/replies` answered 200 (step 4 only). `$C server comment-threads` holds one thread with the agent's message and then the reviewer's reply.

## What proves it works

- Step 4's two messages in one article and the "Waiting for the agent" badge; step 5's single 200 reply request.
- Persistence: `$C open /` shows the thread with both messages.
- `apps/web/spec/integration/reviews-reply.test.tsx`: after the agent comments "Should this line stay?", "Post reply" is disabled for an empty and a whitespace reply and the server conversation is unchanged; after posting, the reply and "Waiting for the agent" show and `server.commentThreads()` reads `agent: Should this line stay?`, `reviewer: Yes, it documents the change` in one thread.

## Gotchas

- "Reply" names both the button and, while the form is open, the textbox (its label). Keep `--role` on every address.
- "Reply" must be unique: another open thread in this instance adds a second button. `stop` and `start` for a clean instance.
