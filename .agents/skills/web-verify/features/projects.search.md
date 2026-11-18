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
  - apps/web/spec/e2e/projects-quiet-status.e2e.ts
  - apps/web/spec/e2e/projects-recent-rows.e2e.ts
  - apps/web/spec/e2e/projects-label-containment.e2e.ts
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

The left navigator is one project list across the connected environments. Each project has a collapsible header. With one connected computer its badge is omitted; with multiple computers a stacked computer caption retains the complete identity beneath the project name. Each worktree is one line: its icon, its title (a ready walkthrough title, then the PR title, then the branch or detached folder) and one trailing value: the PR number, "#N merged" once GitHub reports it merged, else the uncommitted file count ("3 files"); a clean worktree without a PR shows nothing there. The branch and folder path live in every row's tooltip and in its accessible name; search matches title and branch. An expanded project shows main first, then its five most recently touched worktrees, newest first, where touched is the later of the head commit and the last change to its uncommitted files (a deleted file or folder counts from the nearest folder that survives); the server reads that time after each inventory scan without holding inventory reads, and a failed or cut-off read keeps the last known time; the selected worktree stays visible below them when it is older. "Show N more" lists the rest and "Show less" returns to the short list; while searching, every match shows. Background reads never add text, toasts or Read again to the navigator: a failed read keeps the row's last value. Browser mode uses its connected computer; desktop can include paired computers.

## How to get to it (user POV)

- Toggle Sidebar at phone width, or use Mod+B. Search worktrees is always visible; its icon-only Filter worktrees button sits on the right.
- The icon-only Filter worktrees button opens stock checkboxes for Environments and scoped Projects. Each project heading is static text; a plain computer caption appears beneath it only when more than one computer is connected. Its labelled Project actions ellipsis opens its menu; a separate rightmost Collapse/Expand button controls disclosure. The footer has no Manage projects button.

## Driving it with browser

Preconditions: [surface baseline](README.md). Run at 1440 and 414 in light and dark; retain default, loading, filter-open, collapsed and older-review captures.

1. Register a project with main, two sibling detached checkouts and a reviewed topic checkout. Inventory identity appears before review/progress/changes finish. Check main first, the other worktrees most recently touched first with an unborn branch last, and an older worktree moving up under main without a reload after a new commit or after editing one of its files (the server rescans within 30 seconds, or at once on Refresh). Detached folder names stay distinct, long titles clip within their card, and the keyboard-focus tooltip discloses title · branch · path without an extra label tab stop. With more than five other worktrees, Show N more and Show less toggle the rest, and a selected older worktree stays below the five.
2. With one connected computer, no computer badge consumes project-name space; the project actions and collapse control still carry the complete project/computer identity. With multiple computers, a plain caption has role img and its full accessible computer name. A clipped name uses the existing keyboard/touch text disclosure. Computer-caption visibility follows connected computers, not the search/filter result, so filtering to one project does not erase its identity. Identical project names on two computers remain separate by scoped identity. Check landing-site beside a long computer name and confirm its project name remains readable.
3. Select each worktree card and verify its exact project/worktree route, including remote prefix where applicable. Each card is one line: a leading home or branch icon, its title and its trailing value; the PR number is a neutral action at the end of that line. Detached HEAD, main, the branch and the path remain in the full accessible label. Hover covers the whole card; the PR stays a separate action. The current card has a filled theme-card background, a stronger name weight and aria-current=page; hover can share the fill but never gains the selected name weight. All cards have transparent borders. Hover an unselected card while another stays selected, then move selection and confirm the fill and name weight move together. In Reviews, hover the selected publication link and confirm its icon and text remain painted above its click target in both themes. Check both side gutters, including with long names, and the Porcelain header without its decorative logo. Main remains reachable even when it has a review. Changed-file counts and publication updates do not move cards between groups. A card with unavailable checkout cannot select it; retained reviews remain readable without a checkout.
4. Focus the rightmost Collapse <project> · <computer> button and collapse with Enter or Space; its accessible name changes to Expand <project> · <computer>. Project text does not toggle or open a context menu. Search by branch, folder/full path, project, computer and recorded PR number. Matching search temporarily expands the project; clearing search restores its session collapse choice. Settings and back preserve the choice; it is not a persisted preference. Search ArrowDown/ArrowUp reaches first/last enabled card; with no results, focus stays in the search input. Escape clears search while keeping its field visible and focused. Mod+B keeps the normal sidebar doorway.
5. Toggle review, environment and scoped-project checkboxes. Options within each group are OR; groups intersect. Deselecting the last item shows No matching worktrees. Clear filters restores defaults, including hiding older reviews, without clearing search. Clear filters restores hidden project headers before management. Open the labelled Project actions ellipsis, then verify copy/rename/remove through the existing dialogs; Walkthrough settings opens the writer override and Manual / Automatic dialog; hover highlights its stock menu items and pointer cursors identify actions. Escape returns focus to that button. Right-click a worktree for Copy worktree path, Switch branch and Delete (Delete is absent for main); there is no worktree ellipsis, heading or manual refresh action. Follow projects.worktree-actions for branch/deletion behavior.
6. A PR number is a separate sibling action. Opening it creates or focuses an in-app PR document tab with the source review and computer, preserving the selected workspace path and card. Repeat from an unselected worktree and another computer, including colliding review/PR IDs. Close the tab and return to the original document. Inventory identity renders first; visible expanded worktree cards then read Git status/file counts and deferred minimal GitHub check summaries. Navigator rows never read full diff summaries or review marks. Reviews lists stored records without requiring a current checkout. For available checkouts, it reads the canonical current publication to associate only the matching review id with live controls. A publication with a pending candidate checkout lookup waits before its row becomes navigable; unrelated saved publications remain reachable. Collapsed or filtered-out projects do not mount those reads. Sidebar rendering does not fetch full GitHub PR payloads; opening the PR document can read them. Unknown/loading, failure and incomplete checks never use passed colouring. Only failed checks add an independent warning icon; the PR action remains neutral and its accessible name reports the actual check state. The trailing file count is the uncommitted file count and appears only when no PR is shown; a pending or failed read shows no value rather than an invented zero. Reading progress and +/− totals belong inside the workspace, not in navigator rows. Routine record reviews never become approval requests merely because they are unread. GitHub failure stays in the PR document with a reason and retry; it never reorders the project list. Back to the review opens the source review on its computer. A scoped PR file action opens that source review and the exact requested file, including after reloading the durable destination.
7. Keep a conflicted unsaved draft, select another checkout from search, return and Resume edit. The draft and disk content retain their independent values. Verify footer Settings/Keyboard shortcuts, shortcut hints, Open project and project actions at both widths. Native desktop bridge/remote behavior requires its own proof.

## Archive a completed pull request

Open a linked PR document: Archive appears after its readable merged/closed state and uses the existing archive dialog, settings confirmation and server protections. The worktree context menu has no Archive item. Cancel deletes nothing. Preserve ignored-file deletion disclosure, explicit dirty/unpushed acknowledgement, main-checkout protection, lock failure explanation and archive selection cleanup. After successful archive, the deleted checkout is absent.

Automated coverage: projects-search.e2e.ts, projects-manage.e2e.ts, projects-retry.e2e.ts, projects-pr-state.e2e.ts, review-archive.e2e.ts and worktrees-menu.test.tsx. Old status groups, a separate flat checkout submenu and fixed row-pixel expectations have been replaced.

## Failed background reads

A failed change-status, pull-request or inventory read adds nothing to the navigator: no toast, no sentence and no Read again. The row keeps the last value it showed. A worktree whose status was never read shows no trailing count; its context menu still offers Retry changes. When no inventory has ever loaded and nothing is listed, the navigator shows one line, Couldn’t reach Porcelain, with Try again. Write a file in a worktree, then fail its status reads (`failWorktreeStatusRead`) and write again: the count stays as it was and no dialog or status text appears; restore and write once more to see the new count. Run projects-quiet-status.e2e.ts; shared query specs cover keeping the last value.

For title proof, seed a ready walkthrough and a known PR in the disposable database, read `/api/inventory` back, then search by each title and by its branch. Retain a sidebar screenshot. Matching and aria labels keep the branch identity.
