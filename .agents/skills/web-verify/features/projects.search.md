---
route: /
selectors:
  - 'Search reviews and worktrees'
  - 'Projects and worktrees'
  - 'Filter worktrees'
  - 'Computer:'
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

The left navigator is one project list across the connected environments. Each project has a collapsible header and a visible computer badge. Main worktree cards come first, followed by stable branch or detached-folder identities. Local changes and review progress fill independently after inventory; unknown data never says clean or no review. Browser mode uses its connected computer; desktop can include paired computers.

## How to get to it (user POV)

- Toggle Sidebar at phone width, or use Mod+B. Search reviews and worktrees opens the search input.
- The icon-only Filter worktrees button opens stock checkboxes for With a review / Without a review, Environments, scoped Projects and Show older reviews. Manage projects remains in Navigator controls independently of these filters.

## Driving it with browser

Preconditions: [surface baseline](README.md). Run at 1440 and 414 in light and dark; retain default, loading, filter-open, collapsed and older-review captures.

1. Register a project with main, two sibling detached checkouts and a reviewed topic checkout. Inventory identity appears before review/progress/changes finish. Check main first, detached folder names distinct, full paths disclosed on keyboard focus, and an explicit unavailable state after a failed read. Pending detail slots use labelled skeletons. A failed detail offers Read again; retry reaches the existing query owner.
2. The project header names project and computer; Tab reaches its computer badge independently. Enter or touch opens its full computer name and environment identity; Escape returns focus. Identical project names on two computers remain separate by scoped identity.
3. Select each worktree card and verify its exact project/worktree route, including remote prefix where applicable. Only the current card has a filled theme-card background and aria-current=page; all cards have transparent borders. Move selection and confirm the fill moves with it. Check both side gutters, including with long names, and the Porcelain header without its decorative logo. Main remains reachable even when it has a review. Changes/progress updates do not move cards between groups. A card with unavailable checkout cannot select it; retained reviews remain readable without a checkout.
4. Collapse a project with Enter or Space. Search by branch, folder/full path, project, computer and recorded PR number. Matching search temporarily expands the project; clearing search restores its session collapse choice. Settings and back preserve the choice; it is not a persisted preference. Search ArrowDown/ArrowUp reaches first/last enabled card; with no results, focus stays in the search input. Escape clears search and returns focus to its toggle. Mod+B keeps the normal sidebar doorway.
5. Toggle review, environment and scoped-project checkboxes. Options within each group are OR; groups intersect. Deselecting the last item shows No matching worktrees. Clear filters restores defaults, including hiding older reviews, without clearing search. Project actions remain available through Manage projects even with no matching cards; verify rename/copy/remove and their existing dialogs.
6. Show older reviews starts unchecked. Enable it to reveal closed/archived retained reviews inside their project. Worktree cards retain their position and remain reachable. Open a retained review and return through the sidebar. Hide older reviews again.
7. A PR number is a separate sibling action. Opening it creates or focuses an in-app PR document tab with the source review and computer, preserving the selected workspace path and card. Repeat from an unselected worktree and another computer, including colliding review/PR IDs. Close the tab and return to the original document. Sidebar rendering does not fetch GitHub details; document open and the explicit row context menu can read them. GitHub failure stays in the PR document with a reason and retry; it never reorders the project list. Back to the review opens the source review on its computer. A scoped PR file action opens that source review and the exact requested file, including after reloading the durable destination.
8. Keep a conflicted unsaved draft, select another checkout from search, return and Resume edit. The draft and disk content retain their independent values. Verify footer Settings/Keyboard shortcuts, shortcut hints, Open project and project actions at both widths. Native desktop bridge/remote behavior requires its own proof.

## Archive a completed review

Open a linked PR document: Archive appears after its readable merged/closed state and uses the existing archive dialog, settings confirmation and server protections. To use its context-menu action, enable Show older reviews and right-click the retained review after the PR closes. The review completion card remains another entrance. Cancel deletes nothing. Preserve ignored-file deletion disclosure, explicit dirty/unpushed acknowledgement, main-checkout protection, lock failure explanation and archive selection cleanup. After successful archive, Filter worktrees → Show older reviews exposes the retained review; its deleted checkout is absent.

Automated coverage: projects-search.e2e.ts, projects-manage.e2e.ts, projects-retry.e2e.ts, projects-pr-state.e2e.ts, review-archive.e2e.ts and worktrees-menu.test.tsx. Old status groups, a separate flat checkout submenu and fixed row-pixel expectations have been replaced.
