---
route: /
selectors:
  - 'Search reviews and worktrees'
  - 'Projects and worktrees'
  - 'Review status'
  - 'Navigator controls'
  - 'Settings'
  - 'Keyboard shortcuts'
tests:
  - apps/web/spec/e2e/projects-search.e2e.ts
  - apps/web/spec/e2e/projects-manage.e2e.ts
  - apps/web/spec/e2e/projects-retry.e2e.ts
  - apps/web/spec/integration/worktrees-menu.test.tsx
  - apps/web/spec/e2e/review-archive.e2e.ts
  - apps/web/spec/e2e/projects-pr-state.e2e.ts
  - packages/client/src/features/reviews/rules/archive-review.spec.ts
api:
  - GET /api/inventory
---

# projects.search

The sidebar shows one review list across projects and environments, grouped by Needs you, Waiting on agent, Ready to merge and No review, followed by the collapsed Closed group. Main checkouts remain reachable in No review under their branch, with the project beside it.

## How to get to it (user POV)

- Toggle Sidebar at phone width → Manage projects / All (Filter reviews), Search reviews and worktrees, or the Closed group.
- Manage projects; Filter reviews → Worktrees; review row → Archive.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Main checkouts stay out of the status groups even with an active review, except while a linked PR state is loading or unavailable: keep that review visible until GitHub can confirm its state. The search and optional project/environment checkbox filters intersect without changing the open workspace. Closed expands beneath the active groups without replacing them. No review contains main checkouts first, then non-main checkouts without a review, ordered by the shown branch with the project breaking ties; a checkout whose only reviews are closed shows only under Closed and stays reachable from Filter reviews → Worktrees, and while it is the selected worktree its No review row stays, raised; Filter reviews contains a Worktrees submenu that keeps all checkouts reachable and the separately labelled Manage projects menu keeps project actions reachable independently of search and filters. The header holds Search reviews and worktrees beside Open project. The footer keeps the labelled Settings button on the left, with the Update Badge (when offered), Manage projects and Keyboard shortcuts together on the right in one row; it has no Projects or Worktrees buttons or Worktrees heading.

1. Start a disposable instance with reviews in every status plus one closed review. At desktop width, check title fallback, single-line titles, trailing muted decision counts, and one status icon per review.
2. Check review status groups precede No review, which includes main checkouts, and Closed is last. Select a main checkout and an unreviewed non-main checkout and verify the exact workspace. Open Search reviews and worktrees to reveal the searchbox in the filter row. Search a review title, project, environment, PR number and branch; main checkout rows use the same search. Clear search and check that selection is unchanged.
3. Open Filter reviews and toggle project/environment checkboxes. Deselecting the last item gives no matches; Clear filters restores all rows. Retain a filter-open screenshot.
4. Expand the Closed group at the bottom (accessible name Closed reviews). It starts collapsed, shows its count and remembers its own collapse choice. Opening it keeps active rows visible. Read a retained review, reopen the sidebar and collapse Closed with the same header. With no closed reviews it says No closed reviews; a search/filter with no closed matches says No matching closed reviews. Git History keeps its own name and destination.
5. Open Filter reviews → Worktrees, including while Closed is expanded. It lists active checkouts with its own temporary search. Click its input and type through real keyboard events; verify the text and focus stay in the input as results change from no matches to matches, including with the pointer over a result. ArrowDown then Enter selects the matching checkout and closes both menu levels. Pointer selection and reselection also close both levels at desktop and phone widths. Browser navigation closes an open menu and clears its temporary search; Escape closes the menu. Reopening starts with an empty query and never changes sidebar search or filters. The selected worktree has the same trailing checkmark as filter selections, never a Current badge. Check long menu labels and computer Badges remain on one 32px line with full text in a Tooltip on hover and keyboard focus. Select a checkout, including one without a published review. Existing workspace selection and unsaved-draft protection still apply. Manage projects opens project action submenus for rename, copy and removal.
6. Toggle each group header with its chevron, including No review and Closed. Keyboard Enter and Space also toggle it. Collapse two groups independently, search so a group disappears, clear the search, visit Settings and return, then reload: each choice survives. Reopen one and verify the other stays collapsed. Check Search is the full placeholder and the filter button remains. Escape or Close search clears the query, restores Projects All and returns focus to Search reviews and worktrees without closing the phone sidebar. Verify the workspace sidebar uses the frame surface and Settings keeps its rounded bordered card panel.
7. Check that main, review and unreviewed sidebar rows and the Porcelain header never name a computer. There is no Computers button in the footer. Computer names remain in the Worktrees and remote-project pickers and the Update menu, where they distinguish targets. The browser still shows only its connected computer; desktop merges paired computers.
8. Group headers read chevron, label and a right-aligned count. Review rows use the 41 px height: one status indicator beside the row (Needs you a brand dot, Waiting on agent a dashed ring, Ready to merge a filled check, a failure the alert icon), title and muted progress (brand on the current row) on line 1, `project · branch` on line 2. No review rows, main checkouts included, are one line (30 px, 40 px in the phone sidebar): an open ring, the branch (or a detached checkout's folder) as the title and the project right-aligned and muted; a detached checkout adds its parent path beneath. The selected row is a raised card in every group. The filter row is one button reading Projects with All or Filtered, its chevron at the row's right edge. No reason badges or labels are visible in the row. Hover or tap the named Review status button to read failed proof, unexplained files and the agent recommendation in the tooltip. Tab reaches this button separately from the navigation link; focus and Enter reveal its reason without navigation. A tapped reason stays open after the finger lifts; tap elsewhere or press Escape to close it. Escape keeps focus on the button, and its accessible description includes the open reason. Screen-reader row labels and the review detail retain these reasons. Check search inputs have icons, and loading/empty states are clearly labelled. Focus Settings and check its tooltip includes the key from SHORTCUTS.openSettings; Keyboard shortcuts has the key from SHORTCUTS.openShortcuts. Walk the sidebar using only Tab, Enter, Space and Escape, including independent group collapse, Settings and back, and Mod+B. With Settings focused, Escape closes its shortcut tooltip first; a second Escape closes the phone sidebar. Retain default, filter-open, Worktrees-menu and Closed screenshots at 1440 and 414 in light and dark themes. Check the web phone sidebar separately; Electron bridge and remote-environment behavior need their own proof.

### Archive a completed review

With a review linked to a merged or closed PR, use Archive in its list row or on the Review completion card on the closing page. Both open the same AlertDialog. There is no archive context-menu item or keyboard shortcut; Settings only configures its options. In Settings, When archiving a review controls local worktree, local branch and remote branch deletion for the review's computer; Archive stays disabled with the reason until that computer's [Reviews & Git settings](preferences.reviews-git.md) are confirmed. The confirmation names the actual deletion targets. Whenever it deletes a worktree, it explicitly says the entire folder will be permanently deleted, including ignored files such as .env and local build output, even with no uncommitted changes. Keeping a worktree while deleting its branch detaches that checkout and says so in the confirmation, without a folder-deletion warning. The main checkout and its branches stay protected.

Cancel and verify no deletion. With uncommitted files or unpushed commits, verify the explicit warning and confirm the data-loss risk separately. Ignored files never count as dirty. Confirm a branch with no upstream reports skipped remote deletion; an auto-deleted remote branch reports already deleted without an unpushed warning when its head matches the merged PR. A failed preview clears its checking text and shows a plain reason. Archive while that worktree is selected: selection leaves it before deletion. Verify the review stays under Closed with Archived in its status tooltip and accessible label and remains readable. On Android, the data-loss acknowledgement switch starts off and Archive stays disabled until it is enabled. A retained worktree stays accessible under No review. Capture before, confirmation, Closed, settings and a short journey recording.

Automated coverage: `projects-search.e2e.ts`, `worktrees-menu.test.tsx`, `review-archive.e2e.ts`.

## Gotchas

- Checkout submenu search is temporary and independent of sidebar search/filters/Closed; restore filters before comparing the full list.
- Retain two detached checkouts side by side in one folder (`…/worktrees/qa-531`, `…/worktrees/qa-532`). The sidebar and Filter reviews → Worktrees show each folder name first, then the muted parent path cut at its start (`…/worktrees`); the full path is in the accessible name and the tooltip. Search each path and select one with ArrowDown/Enter and the other with the pointer. Verify the exact workspace, selected checkmark, both menu levels closing and an empty temporary search when reopened. Check long parent paths at 1440 and 414 in light and dark; the folder names stay whole and labels stay on one line.
- Open Filter reviews with Enter, reach Worktrees by keyboard and open it with ArrowRight, then click its search input and filter to one path. ArrowDown and ArrowUp from the input reach the first and last enabled result even after the menu has already highlighted an item; Enter selects that exact checkout. Repeat after opening with the pointer.

### Unavailable pull request state

Hold a linked review's PR read, then return each unavailable reason or fail the request. The navigator includes the pending read in its loading state. The review stays visible, including on main, under Needs you rather than Ready to merge; the status reason is available with Tab/Enter/Escape and touch. Errors show a persistent reason and Read again. The review row context menu also offers Read pull request again. Restore a merged or closed PR and retry without reloading: the review moves to Closed, its row and context menu offer Archive, and Archive opens its usual confirmation. Cancel leaves the checkout intact. The review page's PR chip and Review panel block keep the link and show the unavailable reason with its way out. Check 1440/414 in both themes.

Also recover a main-checkout PR to open, so its review leaves the status groups. Fail PR reads again and retry through a topic row: the hidden main PR must be read again and its failure must restore the main review to Needs you. A later merged result moves it to Closed with Archive.
