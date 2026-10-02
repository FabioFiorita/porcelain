---
route: /
selectors:
  - "Review"
  - "Graph"
  - "Loading diagram…"
  - "Selected step code"
tests:
  - apps/web/spec/integration/reviews-layer-graph.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
---

# reviews.layer-graph

## What it is

The Graph tab of a layer of the agent's published review loads the diagram and draws the layer's lane and step, and choosing the step shows its code beside the diagram.

## How a user reaches it

- Review → Layers → layer → Graph

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Opening the graph of a published layer draws its lane and step, and choosing the step shows its code beside the graph

Before driving, on the instance (the sample repository and project home are in the instance file):

- as the agent, publish a review titled “Readme layer” through the Porcelain MCP tools

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "/Readme layer/"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role tab --name "Graph"`
   Look for: the tab “Graph” has aria-selected="true"; the button “New line” shows; the text “A line is added” shows; the text “Docs” shows; the text “Loading diagram…” is gone.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "New line"`
   Look for: the region “Selected step code” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/reviews-layer-graph.test.tsx` (Browser Mode integration): opening the graph of a published layer draws its lane and step, and choosing the step shows its code beside the graph.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
