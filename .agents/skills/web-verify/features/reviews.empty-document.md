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

With every tab closed, the document pane says "Nothing open" and offers one button: "Open all changes" while there is no published review, "Open review" once the agent has published one.

## Sub-features

- `reviews.empty-document` — Empty review and document states.

## How to get to it (user POV)

- Close the last tab with its close button ("Close Changes", or "Close Review" once a review is published), the tab context menu's Close, or `Alt+W` while the pane has focus.
- The empty pane's button: "Open all changes" (no review) or "Open review" (review published).
- With no changes and no review the pane says "No changes to review" and shows no button.

## Driving it with browser

Preconditions: [surface baseline](README.md).

The branch review remains "Review" after later commits, with a notice when its branch tip differs. Each button reopens the handoff tab.

### Setup

- None for steps 1 to 3.
- Step 4 publishes the kit's sample review: one layer "Readme layer" with one step "New line" on README.md line 3.

1. Navigate to `/`
   Expect: tab "Changes Close Changes" selected, heading "Changes", button "Mark all 1 files reviewed".
2. Click button `Close Changes`
   Expect: tablist "Open documents" reading "No open tabs"; text "Nothing open Open all changes, or choose a file or commit from the right."; button "Open all changes"; no button "Open review".
3. Click button `Open all changes`
   Expect: tab "Changes Close Changes" selected again, heading "Changes"; text "Nothing open" gone. URL carries `entry=handoff`.
4. `$C agent publish-review "Readme layer"`, then wait for tab named `Review Close Review`
   Expect: the handoff tab is now tab "Review Close Review" [selected] and the pane shows region "Review walkthrough" (heading "Review", tab "Walkthrough" selected).
5. Click button `Close Review`
   Expect: text "Nothing open Open the review, or choose a file or commit from the right."; button "Open review"; no button "Open all changes".
6. Click button `Open review`
   Expect: tab "Review Close Review" selected, region "Review walkthrough" with tab "Walkthrough" selected.

### Observable proof

Open all changes/Open review restores the correct handoff document before/after publication; review GET/200 reflects publication.

Automated coverage: `reviews-empty-document.test.tsx`.

## Gotchas

- Walkthrough reopens at its last stop. Summary selection refreshes its short-lived link.
- After publication the handoff tab is Review/Close Review, replacing Changes/Close Changes; wait for the settled name.
- Closed tabs persist across reload; use Open all changes/Open review to restore them.
