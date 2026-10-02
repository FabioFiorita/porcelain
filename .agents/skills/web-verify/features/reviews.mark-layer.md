---
route: /
selectors:
  - "Review"
  - "Mark layer reviewed"
  - "Reviewed"
  - "Code changed since the review was written."
  - "Mark changed layer reviewed"
tests:
  - apps/web/spec/integration/reviews-mark-layer.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed-layers
  - GET /api/worktrees/:worktreeId/reviewed-layers
  - PUT /api/worktrees/:worktreeId/reviewed-layers
---

# reviews.mark-layer

## What it is

Marking a layer of the agent's published review reviewed keeps the mark, a change to the layer's code turns it into a request to review the changed layer again, and unmarking removes the mark.

## How a user reaches it

- Review → Layers → layer → Mark layer reviewed

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Marking a published layer reviewed keeps the mark, a change to its code asks for review again, and unmarking removes it

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, publish a review titled “Readme layer” through the Porcelain MCP tools
- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "/Readme layer/"`
   Look for: the button “Mark layer reviewed” is enabled.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Mark layer reviewed"`
   Look for: the button “Reviewed” has aria-pressed="true"; the text “Code changed since the review was written.” shows; the button “Mark changed layer reviewed” is enabled.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Mark changed layer reviewed"`
   Look for: the button “Reviewed” has aria-pressed="true".
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Reviewed"`
   Look for: the button “Mark layer reviewed” is enabled.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-mark-layer.test.tsx` (Browser Mode integration): marking a published layer reviewed keeps the mark, a change to its code asks for review again, and unmarking removes it.
- The tests read back what the server kept through the kit: `server.reviewedLayers()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
