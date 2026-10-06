# reviews.reply

## What it is

A blank reply cannot be posted, and a written reply to the agent's comment joins its thread, which then shows "Waiting for the agent".

## How a user reaches it

- An open thread, inline under its file or in Review → Comments: button "Reply" → textbox "Reply" (placeholder "Add a reply…") → button "Post reply" (or "Cancel").

## Driving it

Start with `$C start`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

The agent comments on README.md: `$C agent comment README.md "Should this line stay?"`.

1. Open `/` on the instance web URL, then wait for the text 'Should this line stay?'
   Look for: article "Comment thread" under README.md with "Agent Whole file From the agent", buttons "Reply" and "Resolve", and "Should this line stay?".
2. Click the button named 'Reply'
   Look for: textbox "Reply"; button "Post reply" [disabled]; button "Reply" is gone while the form is open.
3. Set the text field named 'Reply' to '   '
   Look for: button "Post reply" still [disabled].
4. Set the text field named 'Reply' to 'Yes, it documents the change' then click the button named 'Post reply'
   Look for: textbox "Reply" is gone; the same article now reads "Agent Whole file Waiting for the agent" and holds "Should this line stay?" followed by "You … Yes, it documents the change" and "The agent reads this when you ask it to check its comments.".
5. Inspect browser network evidence
   Look for: one `POST /api/worktrees/<id>/comments/<threadId>/replies` answered 200 (step 4 only). `$C server comment-threads` holds one thread with the agent's message and then the reviewer's reply.

## What proves it works

- Step 4's two messages in one article and the "Waiting for the agent" badge; step 5's single 200 reply request.
- Persistence: open `/` on the instance web URL shows the thread with both messages.
- `apps/web/spec/integration/reviews-reply.test.tsx`: after the agent comments "Should this line stay?", "Post reply" is disabled for an empty and a whitespace reply and the server conversation is unchanged; after posting, the reply and "Waiting for the agent" show and `server.commentThreads()` reads `agent: Should this line stay?`, `reviewer: Yes, it documents the change` in one thread.

## Gotchas

- "Reply" names both the button and, while the form is open, the textbox (its label). Distinguish the button from the text field when choosing the target.
- "Reply" must be unique: another open thread in this instance adds a second button. `stop` and `start` for a clean instance.
