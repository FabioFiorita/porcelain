---
route: /
selectors:
  - 'Search reviews and worktrees'
  - 'Projects and worktrees'
  - 'Clear search'
tests:
  - apps/web/spec/e2e/projects-search.e2e.ts
  - apps/web/spec/integration/worktrees-menu.test.tsx
  - apps/web/spec/e2e/review-archive.e2e.ts
api:
  - GET /api/inventory
---

# projects.search

The sidebar shows one review list across projects and environments, with a compact Projects section first (one main checkout per project, with project name primary and branch text and a secondary computer badge), followed by Needs you, Waiting on agent, Ready to merge and No review.

## How to get to it (user POV)

- Toggle Sidebar at phone width → Search, Filter reviews or Closed reviews.
- Filter reviews → Worktrees / Projects; review row → Archive.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Main checkouts stay out of the status groups even with an active review. The search and optional project/environment checkbox filters intersect without changing the open workspace. Closed opens the separate closed-review view. No review contains non-main checkouts without an open review; Filter reviews contains a Worktrees submenu that keeps all checkouts reachable and a Projects submenu for project management actions. The footer keeps Settings and Computers on the left, with the Update Badge (when offered) and Keyboard shortcuts together on the right in one row; it has no Projects or Worktrees buttons or Worktrees heading.

1. Start a disposable instance with reviews in every status plus one closed review. At desktop width, check title fallback, single-line titles, trailing muted decision counts, and one status icon per review.
2. Check Projects is above the status groups and No review is last. Select a main checkout and an unreviewed non-main checkout and verify the exact workspace. Search a review title, project, environment, PR number and branch; the Projects rows use the same search. Clear search and check that selection is unchanged.
3. Open Filter reviews and toggle project/environment checkboxes. Deselecting the last item gives no matches; Clear filters restores all rows. Retain a filter-open screenshot.
4. Use the icon-only Closed reviews button beside Filter reviews on the Search row. Its tooltip and accessible name are Closed reviews; the filter tooltip is Filter and open; it becomes Back to reviews while showing Closed. Read a retained review and return with that icon. Git History keeps its own name and destination.
5. Open Filter reviews → Worktrees, including while Closed is displayed. It lists active checkouts with its own temporary search. Click its input and type through real keyboard events; verify the text and focus stay in the input as results change from no matches to matches, including with the pointer over a result. ArrowDown then Enter selects the matching checkout and closes both menu levels. Pointer selection and reselection also close both levels at desktop and phone widths. Browser navigation closes an open menu and clears its temporary search; Escape closes the menu. Reopening starts with an empty query and never changes sidebar search or filters. The selected worktree has the same trailing checkmark as filter selections, never a Current badge. Check long menu labels and computer Badges remain on one 32px line with full text in their title. Select a checkout, including one without a published review. Existing workspace selection and unsaved-draft protection still apply. Filter reviews → Projects opens project action submenus for rename, copy and removal.
6. Toggle each group header with its chevron, including Projects and No review. Keyboard Enter and Space also toggle it. Collapse two groups independently, search so a group disappears, clear the search, visit Settings and return, then reload: each choice survives. Reopen one and verify the other stays collapsed. Check Search is the full placeholder and the filter button remains. Verify home and Settings retain rounded bordered card panels on the muted background.
7. Check each main, review, unreviewed and checkout-menu row has its computer in a secondary Badge beside its metadata. Long branch and computer names must stay within the row; the badge truncates to keep the metadata on one line.
8. Review rows use the 48 px height: title and muted progress on line 1; one status icon, project name only when more than one project survives search/filters, truncated branch and computer Badge on line 2. No review rows show project instead of repeating their branch title; Projects rows keep branch beneath project. Project and branch use muted inline text without separators. No reason badges or labels are visible in the row. Hover the status icon to read failed proof, unexplained files and the agent recommendation in the tooltip; keyboard/screen-reader row labels and the review detail retain these reasons. Check search inputs have icons, and loading/empty states are clearly labelled. Retain default, filter-open, Worktrees-menu and Closed screenshots at desktop width. Check the web phone sidebar separately; Electron bridge and remote-environment behavior need their own proof.

### Archive a completed review

With a review linked to a merged or closed PR, use Archive in its list row. In Settings, When archiving a review controls local worktree, local branch and remote branch deletion; all default on. The confirmation names the actual deletion targets. Keeping a worktree while deleting its branch detaches that checkout and says so in the confirmation. The main checkout and its branches stay protected.

Cancel and verify no deletion. With uncommitted files or unpushed commits, verify the explicit warning and confirm the data-loss risk separately. Ignored files never count as dirty. Confirm a branch with no upstream reports skipped remote deletion; an auto-deleted remote branch reports already deleted without an unpushed warning when its head matches the merged PR. A failed preview clears its checking text and shows a plain reason. Archive while that worktree is selected: selection leaves it before deletion. Verify the review stays under Closed with Archived in its status tooltip and accessible label and remains readable. On Android, the data-loss acknowledgement switch starts off and Archive stays disabled until it is enabled. A retained worktree stays accessible under No review (or Projects for the main checkout). Capture before, confirmation, Closed, settings and a short journey recording.

Automated coverage: `projects-search.e2e.ts`, `worktrees-menu.test.tsx`, `review-archive.e2e.ts`.

## Gotchas

- Checkout submenu search is temporary and independent of sidebar search/filters/Closed; restore filters before comparing the full list.
