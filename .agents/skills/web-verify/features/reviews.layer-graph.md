---
route: /
selectors:
  - "Review"
  - "Review layer "
  - "Layer presentation"
  - "Graph"
  - "Loading diagram…"
  - "Selected step code"
  - "Close code"
tests:
  - apps/web/spec/integration/reviews-layer-graph.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
---

# reviews.layer-graph

## What it is

The Graph tab of a published layer loads the diagram lazily and draws the layer's lanes and steps; choosing a step opens its code in a "Selected step code" panel beside (below, at phone width) the diagram.

## How a user reaches it

- Review (sheet at phone width) → "1. Readme layer" → the layer toolbar's tabs "Layer presentation" → "Graph".
- In the graph, click a step box (a button named by the step title) to show its code; "Close code" hides it.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`.

### Setup

- The agent publishes a review. CLI gap: `cli agent publish-review "Readme layer"` (one layer "Readme layer", lane "Docs", one step "New line" with text "A line is added" on README.md line 3).

1. `$C open /`
   Look for: tab "Review Close Review", region "Published review".
2. `$C click --role button --name "Review"`
   Look for: the review sheet (a dialog) with a button whose name contains "Readme layer".
3. `$C click --role button --name "/Readme layer/"`
   Look for: region "Review layer Readme layer"; tab "Code" selected in tablist "Layer presentation"; article "Step New line".
4. `$C click --role tab --name "Graph"`
   Look for: tab "Graph" selected (aria-selected true); button "New line" containing text "A line is added"; lane text "Docs"; no "Loading diagram…" left.
5. `$C click --role button --name "New line"`
   Look for: region "Selected step code" with button "Close code", heading "New line" and the README.md diff (button "Mark README.md as reviewed").
6. `$C click --role button --name "Close code"`
   Look for: region "Selected step code" gone; the diagram stays.

## What proves it works

- Step 4 shows the step box and the lane with no loading text left; step 5 shows the "Selected step code" region.
- `apps/web/spec/integration/reviews-layer-graph.test.tsx`: in region "Review layer Readme layer", the Graph tab is selected, the "New line" button shows "A line is added", "Docs" is visible, "Loading diagram…" is gone, and clicking the step shows region "Selected step code".

## Gotchas

- Unreachable through the CLI: the layer exists only after the agent publishes. Command needed: `cli agent publish-review "Readme layer"`.
- The diagram module loads on first use; "Loading diagram…" can show for a moment after step 4. Snapshot again if it is still there.
- At phone width the code panel stacks under the diagram (`md:` breakpoint); scroll or screenshot to see it.
- The step box button is named by the step title only; in the Code view "New line" is a heading, not a button.
- Address the sidebar's layer button by `/Readme layer/` only while no layer tab is open (its "Close 1. Readme layer" button matches too); afterwards use `$C click --role tab --name "/Readme layer/"`.
