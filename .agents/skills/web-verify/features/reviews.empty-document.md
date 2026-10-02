---
route: /
selectors:
  - "Nothing open"
  - "Open summary"
  - "Open all changes"
  - "Published review"
tests:
  - apps/web/spec/integration/reviews-empty-document.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/review
---

# reviews.empty-document

## What it is

With every tab closed, the empty pane offers Open all changes, which opens the worktree's changes; once the agent has published a review it offers Open summary instead, which opens the published review.

## How a user reaches it

- close every tab → Open all changes or Open summary

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### With every tab closed, the empty pane opens all changes, and the summary once the agent has published a review

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, publish a review titled “Readme layer” through the Porcelain MCP tools

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Close Changes"`
   Look for: the text “Nothing open” shows; the button “Open summary” is gone.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Open all changes"`
   Look for: the button “Close Changes” shows; the text “Nothing open” is gone.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Close Changes"`
   Look for: the button “Open all changes” is gone.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Open summary"`
   Look for: the region “Published review” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-empty-document.test.tsx` (Browser Mode integration): with every tab closed, the empty pane opens all changes, and the summary once the agent has published a review.

## Gotchas

- None known.
