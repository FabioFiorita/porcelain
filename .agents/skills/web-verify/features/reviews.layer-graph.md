---
route: /
selectors:
  - "Review"
  - "Review layer "
  - "Layer presentation"
  - "Graph"
  - "Loading diagram…"
  - "Explore the layer"
  - "Close"
tests:
  - apps/web/spec/integration/reviews-layer-graph.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
---

# reviews.layer-graph

## What it is

The Graph tab of a published layer loads the diagram lazily and draws the layer's lanes and steps; Only explicitly published arrows describe relationships; reading order does not create arrows. The "Explore the layer" panel stays beside (below, at phone width) the diagram. Its numbered code-location links and graph nodes open a complete single-file diff in a dialog, keeping Graph selected. The explorer contains navigation rather than a code preview; "Full layer diff" restores the continuous document.

## How a user reaches it

- Review (sheet at phone width) → "1. Readme layer" → the layer toolbar's tabs "Layer presentation" → "Graph".
- In the graph, click a step box (a button named by the step title) to open its complete file in a dialog. Close it or press Escape to return to the same graph and selection.

## Driving it

`$C start`; pair your browser using the card’s pairing-link command.

### Setup

- The agent publishes a review: `$C agent publish-review "Readme layer"` (one layer "Readme layer", lane "Docs", one step "New line" with text "A line is added" on README.md line 3).

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: tab "Review Close Review", region "Published review".
2. Click button named `Review`
   Look for: the review sheet (a dialog) with a button whose name contains "Readme layer".
3. Click button named `/Readme layer/`
   Look for: region "Review layer Readme layer"; tab "Code" selected in the layer's tablist (its "Layer presentation" label does not show in the snapshot); the full README.md changes and an individual file mark.
4. Click tab named `Graph`, then wait for button named `New line` to be visible
   Look for: tab "Graph" [selected]; an application holding text "Docs" (the lane) and button "New line" with "New line Changed" without the explanatory paragraph "A line is added"; buttons "Zoom In", "Zoom Out", "Fit View"; no "Loading diagram…" left.
5. Click button named `New line`
   Look for: dialog "New line" holding the complete README.md diff and "Mark README.md as reviewed". The graph remains behind it; Explore the layer contains no code preview.
6. Press Escape or click `Close` in the dialog
   Look for: Graph remains selected, the "New line" node stays highlighted, and keyboard focus returns to the node. "Explore the layer" navigation stays.

## What proves it works

- Step 4 shows the step box and the lane with no loading text left; step 5 opens the complete file diff in a dialog.
- `apps/web/spec/integration/reviews-layer-graph.test.tsx`: in region "Review layer Readme layer", the Graph tab is selected, the "New line" button excludes "A line is added", "Docs" is visible, "Loading diagram…" is gone, and clicking the step opens its complete file in a dialog, and Escape returns to the highlighted node without changing Graph.

## Gotchas

- The diagram module loads on first use; "Loading diagram…" shows for a moment after the tab click, which the visible-state wait in step 4 covers.
- At phone width the explorer stacks below the main pane; its numbered links scroll independently.
- The step box button is named by the step title only; Code shows all file changes; agent-note titles are disclosure labels.
- Address the sidebar's layer button by `/Readme layer/` only while no layer tab is open (its "Close 1. Readme layer" button matches too); afterwards use Click tab named `/Readme layer/`.
