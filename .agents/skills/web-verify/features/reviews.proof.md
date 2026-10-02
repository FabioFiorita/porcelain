---
route: /
selectors:
  - "Review"
tests:
  - apps/web/spec/integration/reviews-proof.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review/proof
---

# reviews.proof

## What it is

The checks and screenshot the agent published with its review show under Proof, and a failing check stands out first with its output.

## How a user reaches it

- Review → Layers → Proof

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### The proof an agent published shows its checks and screenshot, with the failing check first

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, publish a review with proof titled “Readme layer” through the Porcelain MCP tools

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Proof · 1 failing"`
   Look for: the alert reads '1 check failed'; the listitem reads output; the img “Saved notice” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-proof.test.tsx` (Browser Mode integration): the proof an agent published shows its checks and screenshot, with the failing check first.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
