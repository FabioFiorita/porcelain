---
route: /
selectors:
  - "Review"
tests:
  - apps/web/spec/integration/reviews-comments-seen.test.tsx
api:
  - POST /api/worktrees/:worktreeId/comments/seen
---

# reviews.comments-seen

## What it is

Showing the comments list records the agent comments as seen and clears the worktree flag that the agent replied, while an agent comment seen only inline keeps the flag until the list shows it.

## How a user reaches it

- Review → Comments

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Reading the comments clears the agent-replied flag, and a newer agent comment raises it again until it is read

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, comment on `README.md` through the Porcelain MCP tools
- as the agent, comment on `README.md` through the Porcelain MCP tools

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the text “I added a line to the readme” shows.
1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "/^Comments/"`
   Look for: the text “I added a line to the readme” shows.
3. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the dialog is gone; the text “I also checked the other files” shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role tab --name "/^Comments/"`
   Look for: the text “I also checked the other files” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-comments-seen.test.tsx` (Browser Mode integration): reading the comments clears the agent-replied flag, and a newer agent comment raises it again until it is read.
- The tests read back what the server kept through the kit: `server.project()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
