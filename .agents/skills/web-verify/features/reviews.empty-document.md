---
route: /
selectors:
  - "Close "
  - "Nothing open"
  - "No open tabs"
  - "Open all changes"
  - "Open review"
  - "Review walkthrough"
tests:
  - apps/web/spec/integration/reviews-empty-document.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/review
---

# reviews.empty-document

## What it is

With every tab closed, the document pane says "Nothing open" and offers one button: "Open all changes" while there is no published review, "Open review" once the agent has published one. Either button reopens the handoff tab.

## How a user reaches it

- Close the last tab with its close button ("Close Changes", or "Close Review" once a review is published), the tab context menu's Close, or `Alt+W` while the pane has focus.
- The empty pane's button: "Open all changes" (no review) or "Open review" (review published).
- With no changes and no review the pane says "No changes to review" and shows no button.

## Driving it

`$C start`; pair your browser using the card’s pairing-link command. The first half needs nothing; the second half has the agent publish a review.

### Setup

- None for steps 1 to 3.
- Step 4 publishes the kit's sample review: one layer "Readme layer" with one step "New line" on README.md line 3, as the test's `agent.publishReview` does.

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: tab "Changes Close Changes" selected, heading "Changes", button "Mark all 1 files reviewed".
2. Click button named `Close Changes`
   Look for: tablist "Open documents" reading "No open tabs"; text "Nothing open Open all changes, or choose a file or commit from the right."; button "Open all changes"; no button "Open review".
3. Click button named `Open all changes`
   Look for: tab "Changes Close Changes" selected again, heading "Changes"; text "Nothing open" gone. Page URL carries `entry=handoff`.
4. `$C agent publish-review "Readme layer"`, then wait for tab named `Review Close Review` to be visible and inspect the accessibility tree
   Look for: the handoff tab is now tab "Review Close Review" [selected] and the pane shows region "Review walkthrough" (heading "Review", tab "Walkthrough" selected).
5. Click button named `Close Review`
   Look for: text "Nothing open Open the review, or choose a file or commit from the right."; button "Open review"; no button "Open all changes".
6. Click button named `Open review`
   Look for: tab "Review Close Review" selected, region "Review walkthrough" with tab "Walkthrough" selected.

## What proves it works

- Step 2 shows "Open all changes" and no "Open review"; step 5 shows "Open review" and no "Open all changes"; each button brings back the handoff tab (steps 3 and 6).
- Inspect HTTP requests and responses shows `GET /api/worktrees/<id>/review` answered 200 after the publish (the web re-read the review it was told about).
- `apps/web/spec/integration/reviews-empty-document.test.tsx`: closing the tab shows "Nothing open" without "Open review"; "Open all changes" brings "Close Changes" back; after `agent.publishReview`, closing the tab shows no "Open all changes" and "Open review" opens region "Review walkthrough".

## Gotchas

- Walkthrough is the default presentation and reopens on the stop last read in this worktree. Selecting Agent summary refreshes the review to obtain a fresh signed link; the disposable link expires two seconds after its read.
- Once a review with layers is published the handoff tab is renamed `Review` and its close button is "Close Review"; "Close Changes" no longer exists. The test clicks "Close Changes" right after publishing, before the page has received the review; an agent driving by hand sees "Close Review".
- The tab layout is saved in localStorage per worktree; a closed tab stays closed across a full page load. Reset by clicking button named `Open all changes` (or "Open review").
