---
route: /$projectId/$worktreeId
selectors:
  - "Side panel"
  - "Review sidebar"
  - "Hide side panel"
  - "Show side panel"
  - "Uncommitted changes"
  - "Open graph"
  - "Worktree review"
tests:
  - apps/web/spec/integration/reviews-side-panel.test.tsx
  - apps/web/spec/integration/history-list.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/commits
---

# reviews.side-panel

At 1280px and wider a 44px rail stands at the far right of the worktree: buttons Files (`Alt+1`), Review — "Changes" when the worktree has no review — (`Alt+2`) and History (`Alt+3`), then a bottom button that hides or shows the panel (`Alt+Shift+R`). The selected view docks as a resizable panel (320px by default) between the page and the rail, with a 48px header that holds the view's name and its actions, and the page gives up that width. Clicking the pressed view hides the panel and leaves no view pressed. Below 1280px there is no rail: button "Review" in the bar, `Alt+Shift+R` or `Alt+1`/`Alt+2`/`Alt+3` open the same views in the "Worktree review" sheet, whose header holds the view tabs (role tab) and the view's actions.

The History view names the branch and counts ahead and behind against its named upstream ("No upstream" when it has none), lists "Uncommitted changes" with a file count that opens All changes, draws the commits on their graph line and ends with "Open graph". The Files view uses Pierre's default 30px rows; its header holds "Create file or folder" and "Collapse all".

A durable review page (`/reviews/<reviewId>`) uses the same rail and panel with the Review view only, because it has no worktree to browse: see [reviews.page](reviews.page.md).

## How to get to it (user POV)

- Desktop: the rail at the far right; its tooltips name each view and its key.
- Phone: button "Review" in the bar, then the sheet's tabs.
- Keyboard: `Alt+1`, `Alt+2`, `Alt+3` open a view (and the panel or sheet); `Alt+Shift+R` hides or shows it.

## Driving it with browser

Preconditions: [surface baseline](README.md).

1. At 1280 × 800 open the worktree. Expect navigation "Side panel" with button "Files" pressed and complementary "Review sidebar" whose heading is "Files"; the bar has no visible button "Review".
2. Click "Changes" and "History": the heading follows. Click the pressed button again: the panel closes, no view button is pressed and button "Show side panel" has `aria-expanded="false"`. Click it: the panel returns on the last view.
3. Press `Alt+Shift+R`: the panel closes and focus lands on "Show side panel". Press `Alt+3`, `Alt+2`, `Alt+1`: each opens its view.
4. In History, check region "Branch" (branch name, `n ahead · n behind`, `against <upstream>`), write a file in `REPO`, then click "Uncommitted changes 1 file": tab "All changes" opens. Click "Open graph": tab "Commit graph" opens.
5. Measure the page (region "Review content") with the panel shown and hidden; it widens by the panel plus its 8px gap.
6. At 414 × 896 repeat 2–4 through button "Review" and the sheet's tabs.

## Gotchas

- Clicking the pressed rail button closes the panel; select a different view, or use `Alt+1`/`Alt+2`/`Alt+3`, when a journey needs the panel open.
- The selected view is the `surface` search parameter; it survives a reload, the panel's visibility does not.
