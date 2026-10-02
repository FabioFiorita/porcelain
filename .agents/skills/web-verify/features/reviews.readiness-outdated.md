---
route: /
selectors:
  - "Review"
  - "These checks ran before the latest changes"
  - "Proof"
tests:
  - apps/web/spec/integration/reviews-readiness-outdated.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
---

# reviews.readiness-outdated

## What it is

A question the agent is waiting on you to answer and checks that ran before the latest changes keep the readiness panel from clearing, and the proof says when it was published and that its checks are out of date.

## How a user reaches it

- Review → Readiness

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### An agent question and checks older than the code keep the readiness panel from clearing

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, publish a review with proof titled “Readme layer” through the Porcelain MCP tools
- as the agent, comment on `README.md` through the Porcelain MCP tools
- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the text “These checks ran before the latest changes” shows; the heading “Proof” shows; the region “Proof” reads 'Published '.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-readiness-outdated.test.tsx` (Browser Mode integration): an agent question and checks older than the code keep the readiness panel from clearing.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
