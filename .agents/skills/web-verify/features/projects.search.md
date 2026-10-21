---
route: /
selectors:
  - "Search reviews and worktrees"
  - "Projects and worktrees"
  - "Clear search"
tests:
  - apps/web/spec/e2e/projects-search.e2e.ts
api:
  - GET /api/inventory
---

# projects.search

The sidebar shows one review list across projects and environments, with a compact Projects section first (one main checkout per project, with project name primary and branch/machine in one truncated meta line), followed by Needs you, Waiting on agent, Ready to merge and No review. Main checkouts stay out of the status groups even with an active review. The search and optional project/environment checkbox filters intersect without changing the open workspace. Closed opens the separate closed-review view. No review contains non-main checkouts without an open review; the flat Worktrees menu also keeps all checkouts reachable; Projects preserves project management actions.

## Drive it

1. Start a disposable instance with reviews in every status plus one closed review. At desktop width, check title fallback, current decision progress and status badges in words.
2. Check Projects is above the status groups and No review is last. Select a main checkout and an unreviewed non-main checkout and verify the exact workspace. Search a review title, project, environment, PR number and branch; the Projects rows use the same search. Clear search and check that selection is unchanged.
3. Open Filter reviews and toggle project/environment checkboxes. Deselecting the last item gives no matches; Clear filters restores all rows. Retain a filter-open screenshot.
4. Open Closed, read a retained review and return with Back to reviews. Git History keeps its own name and destination.
5. Open the footer Worktrees menu, including while Closed is displayed. It lists active checkouts with its own temporary search. Click its input and type through real keyboard events; verify the text and focus stay in the input, matching results appear, and Escape closes it. Reopening starts with an empty query and never changes sidebar search or filters. Check long menu labels remain on one line with full text in their title. Select a checkout, including one without a published review. Existing workspace selection and unsaved-draft protection still apply. Projects opens project context menus for rename, copy and removal.
6. Check row title/badge indentation is aligned with and without progress, search inputs have icons, and loading/empty states use the installed primitives. Retain default, filter-open, Worktrees-menu and Closed screenshots at desktop width. Check the web phone sidebar separately; Electron bridge and remote-environment behavior need their own proof.
