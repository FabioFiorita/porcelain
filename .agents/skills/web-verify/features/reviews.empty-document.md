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

`C=.agents/skills/web-verify/scripts/cli; $C start`. The first half needs nothing; the second half has the agent publish a review.

### Setup

- None for steps 1 to 3.
- Step 4 publishes the kit's sample review: one layer "Readme layer" with one step "New line" on README.md line 3, as the test's `agent.publishReview` does.

1. `$C open /`
   Look for: tab "Changes Close Changes" selected, heading "Changes", button "Mark all 1 files reviewed".
2. `$C click --role button --name "Close Changes"`
   Look for: tablist "Open documents" reading "No open tabs"; text "Nothing open Open all changes, or choose a file or commit from the right."; button "Open all changes"; no button "Open summary".
3. `$C click --role button --name "Open all changes"`
   Look for: tab "Changes Close Changes" selected again, heading "Changes"; text "Nothing open" gone. Page URL carries `entry=handoff`.
4. `$C agent publish-review "Readme layer"`, then `$C wait --role tab --name "Review Close Review"` and `$C snapshot`
   Look for: the handoff tab is now tab "Review Close Review" [selected] and the pane shows region "Published review" (heading "Review", paragraph "1 layers").
5. `$C click --role button --name "Close Review"`
   Look for: text "Nothing open Open the summary, or choose a file or commit from the right."; button "Open summary"; no button "Open all changes".
6. `$C click --role button --name "Open summary"`
   Look for: tab "Review Close Review" selected, region "Published review" with an iframe titled "Review summary".

## What proves it works

- Step 2 shows "Open all changes" and no "Open summary"; step 5 shows "Open summary" and no "Open all changes"; each button brings back the handoff tab (steps 3 and 6).
- `$C network` shows `GET /api/worktrees/<id>/review` answered 200 after the publish (the web re-read the review it was told about).
- `apps/web/spec/integration/reviews-empty-document.test.tsx`: closing the tab shows "Nothing open" without "Open summary"; "Open all changes" brings "Close Changes" back; after `agent.publishReview`, closing the tab shows no "Open all changes" and "Open summary" opens region "Published review".

## Gotchas

- After step 6 the summary iframe stays blank, with no request for its page, until the next `open /` loads it (seen in the 2026-10-03 drive); right after the publish in step 4 and after a reload it loads. The promise here is the reopened handoff tab and its frame, not the frame's content.
- Once a review with layers is published the handoff tab is renamed "Review" and its close button is "Close Review"; "Close Changes" no longer exists. The test clicks "Close Changes" right after publishing, before the page has received the review; an agent driving by hand sees "Close Review".
- The tab layout is saved in localStorage per worktree; a closed tab stays closed across `open`. Reset with `$C click --role button --name "Open all changes"` (or "Open summary").
