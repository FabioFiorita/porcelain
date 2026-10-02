---
route: /
selectors:
  - "Review"
  - "Mark layer reviewed"
  - "Reviewed"
  - "Mark changed layer reviewed"
  - "Code changed since the review was written."
  - "The layer mark could not be updated. Try again."
tests:
  - apps/web/spec/integration/reviews-mark-layer-refresh.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed-layers
  - GET /api/worktrees/:worktreeId/review
  - GET /api/worktrees/:worktreeId/reviewed-layers
  - PUT /api/worktrees/:worktreeId/reviewed-layers
---

# reviews.mark-layer-refresh

## What it is

While the published layer is read again after its code changed, its mark button waits for the new layer, so the mark is sent with the fingerprint of the layer on screen and is accepted.

## How a user reaches it

- Review → Layers → layer → Mark changed layer reviewed

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### While a published layer is read again after its code changed, its mark waits for the new layer and then marks it

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, publish a review titled “Readme layer” through the Porcelain MCP tools
- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "/Readme layer/"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Mark layer reviewed"`
   Look for: the button “Reviewed” has aria-pressed="true"; the button “Mark changed layer reviewed” is disabled; the text “Code changed since the review was written.” shows; the button “Mark changed layer reviewed” is enabled.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Mark changed layer reviewed"`
   Look for: the button “Reviewed” has aria-pressed="true"; the text “The layer mark could not be updated. Try again.” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-mark-layer-refresh.test.tsx` (Browser Mode integration): while a published layer is read again after its code changed, its mark waits for the new layer and then marks it.
- The tests read back what the server kept through the kit: `server.reviewedLayers()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
- The tests hold or drop the live connection or a request to reach a race; the CLI cannot, so an agent drives the ordinary path and leaves the race to the tests.
