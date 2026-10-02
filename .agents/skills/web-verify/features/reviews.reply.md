---
route: /
selectors:
  - "Reply"
  - "Post reply"
  - "Waiting for the agent"
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

A blank reply cannot be posted, and a written reply to the agent's comment joins its thread and waits for the agent.

## How a user reaches it

- All changes → the agent's comment on a changed file → Reply

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A blank reply cannot be posted, and a written reply to the agent joins its thread and waits for the agent

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, comment on `README.md` through the Porcelain MCP tools

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the text “Should this line stay?” shows.
1. `.agents/skills/web-verify/scripts/cli click --role button --name "Reply"`
   Look for: the textbox “Reply” shows; the button “Post reply” is disabled.
2. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Reply" " "`
   Look for: the button “Post reply” is disabled.
3. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Reply" "Yes, it documents the change"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Post reply"`
   Look for: the text “Yes, it documents the change” shows; the text “Waiting for the agent” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-reply.test.tsx` (Browser Mode integration): a blank reply cannot be posted, and a written reply to the agent joins its thread and waits for the agent.
- The tests read back what the server kept through the kit: `server.commentThreads()`.

## Gotchas

- None known.
