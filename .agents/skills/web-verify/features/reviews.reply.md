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

Start with `.agents/skills/web-verify/scripts/cli start`.

### Setup

The promise starts from an agent comment on README.md: `cli agent comment README.md "Should this line stay?"`, which the CLI lacks. With it, the thread shows inline under README.md with the badge "From the agent" and steps 2 to 5 run as written (skip step 1). Without it, step 1 makes a reviewer thread to drive the same reply mechanics; it already reads "Waiting for the agent", so it proves less.

1. Fallback for the gap: `.agents/skills/web-verify/scripts/cli open /` then `.agents/skills/web-verify/scripts/cli click --role button --name "Comment on README.md (unstaged · modified)"` then `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Comment" "Should this line stay?"` then `.agents/skills/web-verify/scripts/cli click --role button --name "Comment"`
   Look for: article "Comment thread" under README.md with "Should this line stay?" and button "Reply".
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Reply"`
   Look for: textbox "Reply"; button "Post reply" is disabled; button "Reply" is gone while the form is open.
3. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Reply" "   "`
   Look for: button "Post reply" is still disabled.
4. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Reply" "Yes, it documents the change"` then `.agents/skills/web-verify/scripts/cli click --role button --name "Post reply"`
   Look for: textbox "Reply" is gone; the same article now holds "Should this line stay?" followed by "Yes, it documents the change"; the badge text "Waiting for the agent" (it read "From the agent" before, with the agent comment).
5. `.agents/skills/web-verify/scripts/cli network`
   Look for: one `POST /api/worktrees/<id>/comments/<threadId>/replies` answered 200 (step 4 only).

## What proves it works

- Step 4's two messages in one article and the "Waiting for the agent" badge; step 5's single 200 reply request.
- Persistence: `.agents/skills/web-verify/scripts/cli open /` shows the thread with both messages.
- `apps/web/spec/integration/reviews-reply.test.tsx`: after the agent comments "Should this line stay?", "Post reply" is disabled for an empty and a whitespace reply and the server conversation is unchanged; after posting, the reply and "Waiting for the agent" show and `server.commentThreads()` reads `agent: Should this line stay?`, `reviewer: Yes, it documents the change` in one thread.

## Gotchas

- Unreachable through the CLI: replying to an agent comment needs `cli agent comment README.md "Should this line stay?"` first; the step 1 fallback only proves the reply mechanics on a reviewer thread.
- "Reply" names both the button and, while the form is open, the textbox (its label). Keep `--role` on every address.
- "Reply" must be unique: another open thread in this instance adds a second button. `stop` and `start` for a clean instance.
