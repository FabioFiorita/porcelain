# reviews.layer-graph

## What it is

The Graph tab of a published layer loads the diagram lazily and draws the layer's lanes and steps; choosing a step opens its code in a "Selected step code" panel beside (below, at phone width) the diagram.

## How a user reaches it

- Review (sheet at phone width) → "1. Readme layer" → the layer toolbar's tabs "Layer presentation" → "Graph".
- In the graph, click a step box (a button named by the step title) to show its code; "Close code" hides it.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

- The agent publishes a review: `$C agent publish-review "Readme layer"` (one layer "Readme layer", lane "Docs", one step "New line" with text "A line is added" on README.md line 3).

1. Open `/` on the instance web URL
   Look for: tab "Review Close Review", region "Published review".
2. Click the button named 'Review'
   Look for: the review sheet (a dialog) with a button whose name contains "Readme layer".
3. Click the button whose name contains 'Readme layer'
   Look for: region "Review layer Readme layer"; tab "Code" selected in the layer's tablist (its "Layer presentation" label does not show in the snapshot); article "Step New line".
4. Click the tab named 'Graph', then wait for the button named 'New line'
   Look for: tab "Graph" [selected]; an application holding text "Docs" (the lane) and button "New line" with "New line Changed" and paragraph "A line is added"; buttons "Zoom In", "Zoom Out", "Fit View"; no "Loading diagram…" left.
5. Click the button named 'New line'
   Look for: region "Selected step code" with button "Close code" and article "Step New line" holding heading "New line" and the README.md diff (button "Mark README.md as reviewed").
6. Click the button named 'Close code'
   Look for: region "Selected step code" gone; the diagram stays.

## What proves it works

- Step 4 shows the step box and the lane with no loading text left; step 5 shows the "Selected step code" region.
- `apps/web/spec/integration/reviews-layer-graph.test.tsx`: in region "Review layer Readme layer", the Graph tab is selected, the "New line" button shows "A line is added", "Docs" is visible, "Loading diagram…" is gone, and clicking the step shows region "Selected step code".

## Gotchas

- The diagram module loads on first use; "Loading diagram…" shows for a moment after the tab click, which the wait in step 4 covers.
- At phone width the code panel stacks under the diagram (`md:` breakpoint); scroll or screenshot to see it.
- The step box button is named by the step title only; in the Code view "New line" is a heading, not a button.
- Choose the "Readme layer" button in the Review sidebar while no layer tab is open. Afterwards, choose the "Readme layer" tab; its separate close button also includes that name.
