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
  - apps/web/spec/integration/reviews-comment.test.tsx
  - apps/web/spec/integration/reviews-comment-drafts.test.tsx
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# reviews.reply

A blank reply cannot be posted, and a written reply to the agent's comment joins its thread, which then shows "Waiting for the agent".

## How to get to it (user POV)

- An open thread, inline under its file or in Review → Comments: button "Reply" → textbox "Reply" (placeholder "Add a reply…") → button "Post reply" (or "Cancel").
- Reply focuses its field. `ControlOrMeta+Enter` posts through the same form as Post reply; Escape closes the reply form. Composition input does not submit. Resolve and Reopen preserve both messages; an inline resolved thread is named "Resolved comment thread".
- Navigate away with an unsent reply and return to its thread. Reply restores that thread's text and retry identity; a confirmed send clears it. The draft belongs to that environment/review/thread and lasts for the running client session.

## Driving it with browser

Preconditions: [surface baseline](README.md). For the visual sweep, pass the concrete `/<projectId>/<worktreeId>?entry=handoff` URL; the workspace adds that canonical document entry when opened without one.

### Setup

The agent comments on README.md: `$C agent comment README.md "Should this line stay?"`.

1. Navigate to `/`, then wait for 'Should this line stay?'
   Expect: article "Comment thread" under README.md with "Agent Whole file From the agent", buttons "Reply" and "Resolve", and "Should this line stay?".
2. Click button `Reply`
   Expect: textbox "Reply"; button "Post reply" [disabled]; button "Reply" is gone while the form is open.
3. Fill textbox `Reply` with '   '
   Expect: button "Post reply" still [disabled].
4. Fill textbox `Reply` with 'Yes, it documents the change' then click button `Post reply`
   Expect: textbox "Reply" is gone; the same article now reads "Agent Whole file Waiting for the agent" and holds "Should this line stay?" followed by "You … Yes, it documents the change" and "The agent reads this when you ask it to check its comments.".
5. Inspect HTTP traffic
   Expect: one `POST /api/worktrees/<id>/comments/<threadId>/replies` answered 200 (step 4 only). `$C server comment-threads` holds one thread with the agent's message and then the reviewer's reply.

### Observable proof

Reload: both messages remain in one thread; one reply POST/200.

Automated coverage: `reviews-reply.test.tsx`.

## Gotchas

- Reply names both button and textbox; keep roles. Scope the thread or use a fresh fixture if more than one Reply exists.
