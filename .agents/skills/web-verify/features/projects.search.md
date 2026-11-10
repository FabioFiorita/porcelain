---
route: /
selectors:
  - 'Search worktrees'
  - 'Projects and worktrees'
  - 'Filter worktrees'
  - 'Computer:'
  - 'Navigator controls'
  - 'Settings'
  - 'Keyboard shortcuts'
tests:
  - apps/web/spec/e2e/projects-search.e2e.ts
  - apps/web/spec/e2e/projects-open-remote.desktop.e2e.ts
  - apps/web/spec/e2e/truncated-text.e2e.ts
  - apps/web/spec/e2e/projects-manage.e2e.ts
  - apps/web/spec/e2e/projects-retry.e2e.ts
  - apps/web/spec/e2e/worktree-status-warning.e2e.ts
  - apps/web/spec/integration/worktrees-menu.test.tsx
  - apps/web/spec/e2e/review-archive.e2e.ts
  - apps/web/spec/e2e/projects-pr-state.e2e.ts
  - packages/client/src/features/projects/rules/worktree-actions.spec.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/git/status
  - GET /api/projects/:projectId/pull-requests/:number/checks
---

# projects.search

The left navigator is one project list across the connected environments. Each project has a collapsible header. With one connected computer its badge is omitted; with multiple computers a stacked computer caption retains the complete identity beneath the project name. Worktree rows prefer a ready walkthrough title, then the cached PR title, then their branch. A titled row shows its branch underneath in small monospace text; search matches both. Main worktree cards come first, followed by stable branch or detached-folder identities. Local file counts and publication metadata fill independently after inventory; unknown data never says clean or no review. Browser mode uses its connected computer; desktop can include paired computers.

## How to get to it (user POV)

- Toggle Sidebar at phone width, or use Mod+B. Search worktrees is always visible; its icon-only Filter worktrees button sits on the right.
- The icon-only Filter worktrees button opens stock checkboxes for Environments and scoped Projects. Each project heading is static text; a plain computer caption appears beneath it only when more than one computer is connected. Its labelled Project actions ellipsis opens its menu; a separate rightmost Collapse/Expand button controls disclosure. The footer has no Manage projects button.

## Driving it with browser

Preconditions: [surface baseline](README.md). Run at 1440 and 414 in light and dark; retain default, loading, filter-open, collapsed and older-review captures.

1. Register a project with main, two sibling detached checkouts and a reviewed topic checkout. Inventory identity appears before review/progress/changes finish. Check main first, the other worktrees newest head commit first with an unborn branch last, a new commit in an older worktree moving it up without a reload, detached folder names distinct, full branch/folder names visibly clipped within their card and the complete branch plus path disclosed by the primary card’s keyboard-focus tooltip, without an extra label tab stop, and an explicit unavailable state after a failed read. Pending details use explicit reading labels. A failed detail offers Read again; retry reaches the existing query owner.
2. With one connected computer, no computer badge consumes project-name space; the project actions and collapse control still carry the complete project/computer identity. With multiple computers, a plain caption has role img and its full accessible computer name. A clipped name uses the existing keyboard/touch text disclosure. Computer-caption visibility follows connected computers, not the search/filter result, so filtering to one project does not erase its identity. Identical project names on two computers remain separate by scoped identity. Check landing-site beside a long computer name and confirm its project name remains readable.
3. Select each worktree card and verify its exact project/worktree route, including remote prefix where applicable. Each card starts with its worktree name and a leading home or branch icon; its optional neutral PR action sits with metadata. Detached status stays in that title row. A second row appears only for review type, a new publication revision or local changed-file counts; a clean worktree without a review uses one row and does not render No review filler. Full accessible labels still distinguish no review and clean state. Plain Worktree, Main and Working tree clean prose does not add rows; clean cards leave the diff slot empty. Detached remains distinguished visually and main remains in the full accessible label. Hover covers the whole card; the PR stays a separate action. The current card has a filled theme-card background, a stronger name weight and aria-current=page; hover can share the fill but never gains the selected name weight. All cards have transparent borders. Hover an unselected card while another stays selected, then move selection and confirm the fill and name weight move together. In Reviews, hover the selected publication link and confirm its icon and text remain painted above its click target in both themes. Check both side gutters, including with long names, and the Porcelain header without its decorative logo. Main remains reachable even when it has a review. Changed-file counts and publication updates do not move cards between groups. A card with unavailable checkout cannot select it; retained reviews remain readable without a checkout.
4. Focus the rightmost Collapse <project> · <computer> button and collapse with Enter or Space; its accessible name changes to Expand <project> · <computer>. Project text does not toggle or open a context menu. Search by branch, folder/full path, project, computer and recorded PR number. Matching search temporarily expands the project; clearing search restores its session collapse choice. Settings and back preserve the choice; it is not a persisted preference. Search ArrowDown/ArrowUp reaches first/last enabled card; with no results, focus stays in the search input. Escape clears search while keeping its field visible and focused. Mod+B keeps the normal sidebar doorway.
5. Toggle review, environment and scoped-project checkboxes. Options within each group are OR; groups intersect. Deselecting the last item shows No matching worktrees. Clear filters restores defaults, including hiding older reviews, without clearing search. Clear filters restores hidden project headers before management. Open the labelled Project actions ellipsis, then verify copy/rename/remove through the existing dialogs; Walkthrough settings opens the writer override and Manual / Automatic dialog; hover highlights its stock menu items and pointer cursors identify actions. Escape returns focus to that button. Right-click a worktree for Copy worktree path, Switch branch and Delete (Delete is absent for main); there is no worktree ellipsis, heading or manual refresh action. Follow projects.worktree-actions for branch/deletion behavior.
6. A PR number is a separate sibling action. Opening it creates or focuses an in-app PR document tab with the source review and computer, preserving the selected workspace path and card. Repeat from an unselected worktree and another computer, including colliding review/PR IDs. Close the tab and return to the original document. Inventory identity renders first; visible expanded worktree cards then read Git status/file counts and deferred minimal GitHub check summaries. Navigator rows never read full diff summaries or review marks. Reviews lists stored records without requiring a current checkout. For available checkouts, it reads the canonical current publication to associate only the matching review id with live controls. A publication with a pending candidate checkout lookup waits before its row becomes navigable; unrelated saved publications remain reachable. Collapsed or filtered-out projects do not mount those reads. Sidebar rendering does not fetch full GitHub PR payloads; opening the PR document can read them. Unknown/loading, failure and incomplete checks never use passed colouring. Only failed checks add an independent warning icon; the PR action remains neutral and its accessible name reports the actual check state. Local changed-file counts distinguish unavailable, pending and clean state without inventing zero totals. Reading progress and +/− totals belong inside the workspace, not in navigator rows. Routine record reviews never become approval requests merely because they are unread. GitHub failure stays in the PR document with a reason and retry; it never reorders the project list. Back to the review opens the source review on its computer. A scoped PR file action opens that source review and the exact requested file, including after reloading the durable destination.
7. Keep a conflicted unsaved draft, select another checkout from search, return and Resume edit. The draft and disk content retain their independent values. Verify footer Settings/Keyboard shortcuts, shortcut hints, Open project and project actions at both widths. Native desktop bridge/remote behavior requires its own proof.

## Archive a completed pull request

Open a linked PR document: Archive appears after its readable merged/closed state and uses the existing archive dialog, settings confirmation and server protections. The worktree context menu has no Archive item. Cancel deletes nothing. Preserve ignored-file deletion disclosure, explicit dirty/unpushed acknowledgement, main-checkout protection, lock failure explanation and archive selection cleanup. After successful archive, the deleted checkout is absent.

Automated coverage: projects-search.e2e.ts, projects-manage.e2e.ts, projects-retry.e2e.ts, projects-pr-state.e2e.ts, review-archive.e2e.ts and worktrees-menu.test.tsx. Old status groups, a separate flat checkout submenu and fixed row-pixel expectations have been replaced.

## Unavailable worktree status

A failed change-status read uses a quiet dash on the card, with Changes unavailable in its accessible name. One polite, dismissible stock toast per affected computer offers Retry and expandable Details with worktree names and received error text. It uses the stock automatic dismissal and does not reappear on unrelated navigator updates while the same failure persists. At phone width the toast is inside the open sidebar sheet so its controls remain reachable. It does not assert that a checkout is missing, corrupt or still present.

Inject linked-worktree status failures while the main checkout and another computer remain healthy. Check aggregation, long branch/computer/error text, expanded-details scrolling and keyboard access at 1440 and 414 in light/dark. Dismiss, search/filter/collapse/expand, and confirm no repeated notice for the unresolved failure. Retry remains in an affected row’s context menu after dismissal. Restore responses, retry, and verify only the affected computer is reconciled and only surviving failed checkouts are retried, without changing selection. Removing a checkout from fresh inventory removes its warning. A new failure after confirmed recovery may notify again. Run worktree-status-warning.e2e.ts for dismissal and the row-menu recovery path; shared query specs cover exact scope and stale inventory.

For title proof, seed a ready walkthrough and a known PR in the disposable database, read `/api/inventory` back, then search by each title and by its branch. Retain a sidebar screenshot. Matching and aria labels keep the branch identity.
