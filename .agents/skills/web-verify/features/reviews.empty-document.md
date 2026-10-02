---
route: /
selectors:
  - "Close "
  - "Nothing open"
  - "No open tabs"
  - "Open all changes"
  - "Open summary"
  - "Published review"
tests:
  - apps/web/spec/integration/reviews-empty-document.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/review
---

# reviews.empty-document

## What it is

With every tab closed, the document pane says "Nothing open" and offers one button: "Open all changes" while there is no published review, "Open summary" once the agent has published one. Either button reopens the handoff tab.

## How a user reaches it

- Close the last tab with its close button ("Close Changes", or "Close Review" once a review is published), the tab context menu's Close, or `Alt+W` while the pane has focus.
- The empty pane's button: "Open all changes" (no review) or "Open summary" (review published).
- With no changes and no review the pane says "No changes to review" and shows no button.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. The first half needs nothing; the second half needs the agent to publish a review, which the CLI cannot do.

### Setup

- None for steps 1 to 3.
- Before step 4: the agent publishes a review. CLI gap: `cli agent publish-review "Readme layer"` (the kit's sample review: one layer "Readme layer" with one step "New line" on README.md line 3; `agent.publishReview` in `apps/web/spec/kit/shapes.ts`).

1. `$C open /`
   Look for: tab "Changes Close Changes" selected, heading "Changes", button "Mark all 1 files reviewed".
2. `$C click --role button --name "Close Changes"`
   Look for: text "Nothing open", text "No open tabs" in the tablist "Open documents", button "Open all changes"; no button "Open summary".
3. `$C click --role button --name "Open all changes"`
   Look for: tab "Changes Close Changes" selected again, heading "Changes"; text "Nothing open" gone. Page URL carries `entry=handoff`.
4. (After `cli agent publish-review "Readme layer"`.) `$C snapshot`
   Look for: the handoff tab is now named "Review Close Review" and the pane shows region "Published review" (heading "Review", "1 layers").
5. `$C click --role button --name "Close Review"`
   Look for: text "Nothing open", button "Open summary"; no button "Open all changes".
6. `$C click --role button --name "Open summary"`
   Look for: tab "Review Close Review" selected, region "Published review" with an iframe titled "Review summary".

## What proves it works

- Step 2 shows "Open all changes" and no "Open summary"; step 5 shows "Open summary" and no "Open all changes"; each button brings back the handoff tab (steps 3 and 6).
- `$C network` shows `GET /api/worktrees/<id>/review` answered 200 after the publish (the web re-read the review it was told about).
- `apps/web/spec/integration/reviews-empty-document.test.tsx`: closing the tab shows "Nothing open" without "Open summary"; "Open all changes" brings "Close Changes" back; after `agent.publishReview`, closing the tab shows no "Open all changes" and "Open summary" opens region "Published review".

## Gotchas

- Unreachable through the CLI (second half only): the published review needs an agent action. Command needed: `cli agent publish-review "Readme layer"`.
- Once a review with layers is published the handoff tab is renamed "Review" and its close button is "Close Review"; "Close Changes" no longer exists. The test clicks "Close Changes" right after publishing, before the page has received the review; an agent driving by hand sees "Close Review".
- The tab layout is saved in localStorage per worktree; a closed tab stays closed across `open`. Reset with `$C click --role button --name "Open all changes"` (or "Open summary").
