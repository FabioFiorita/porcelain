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

The sidebar shows one review list across projects and environments, grouped by Needs you, Waiting on agent and Ready to merge. The search and optional project/environment checkbox filters intersect without changing the open workspace. Closed opens the separate closed-review view. The flat Worktrees menu keeps checkouts without reviews reachable; Projects preserves project management actions.

## Drive it

1. Start a disposable instance with reviews in every status plus one closed review. At desktop width, check title fallback, current decision progress and status badges in words.
2. Search a review title, project, environment, PR number and branch; clear search and check that selection is unchanged.
3. Open Filter reviews and toggle project/environment checkboxes. Deselecting the last item gives no matches; Clear filters restores all rows. Retain a filter-open screenshot.
4. Open Closed, read a retained review and return with Back to reviews. Git History keeps its own name and destination.
5. Open Worktrees and select a checkout, including one without a published review. Existing workspace selection and unsaved-draft protection still apply. Projects opens project context menus for rename, copy and removal.
6. Retain default, filter-open and Closed screenshots at desktop width. Check the web phone sidebar separately; Electron bridge and remote-environment behavior need their own proof.
