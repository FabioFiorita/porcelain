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
  - apps/web/spec/e2e/truncated-text.e2e.ts
  - apps/web/spec/e2e/reviews-workspace-return.e2e.ts
  - apps/web/spec/e2e/projects-manage.e2e.ts
  - apps/web/spec/e2e/projects-retry.e2e.ts
  - apps/web/spec/integration/worktrees-menu.test.tsx
  - apps/web/spec/e2e/review-archive.e2e.ts
  - apps/web/spec/e2e/projects-pr-state.e2e.ts
  - packages/client/src/features/projects/rules/worktree-actions.spec.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/summary
  - GET /api/reviews/:reviewId/pull-request/checks
---

# projects.search

The left navigator is one project list across the connected environments. Each project has a collapsible header and a visible computer badge. Main worktree cards come first, followed by stable branch or detached-folder identities. Local changes and review progress fill independently after inventory; unknown data never says clean or no review. Browser mode uses its connected computer; desktop can include paired computers.

## How to get to it (user POV)

- Toggle Sidebar at phone width, or use Mod+B. Search reviews and worktrees is always visible; its icon-only Filter worktrees button sits on the right.
- The icon-only Filter worktrees button opens stock checkboxes for With a review / Without a review, Environments, scoped Projects and Show older reviews. Each project heading is static text with a static computer badge. Its labelled Project actions ellipsis opens its menu; a separate rightmost Collapse/Expand button controls disclosure. The footer has no Manage projects button.

## Driving it with browser

Preconditions: [surface baseline](README.md). Run at 1440 and 414 in light and dark; retain default, loading, filter-open, collapsed and older-review captures.

1. Register a project with main, two sibling detached checkouts and a reviewed topic checkout. Inventory identity appears before review/progress/changes finish. Check main first, detached folder names distinct, full branch/folder names visibly clipped within their card and the complete branch plus path disclosed by the primary card’s keyboard-focus tooltip, without an extra label tab stop, and an explicit unavailable state after a failed read. Pending detail slots use labelled skeletons. A failed detail offers Read again; retry reaches the existing query owner.
2. The project heading and static computer badge name project and computer; the badge has role img and its full accessible computer name, with no keyboard/touch action. Tab reaches Project actions and the separate rightmost Collapse/Expand button. Identical project names on two computers remain separate by scoped identity.
3. Select each worktree card and verify its exact project/worktree route, including remote prefix where applicable. Each card uses two rows: worktree name and aligned optional PR first; decision progress (or No review) and compact changes second. Plain Worktree, Main and Working tree clean prose does not add rows; clean cards leave the diff slot empty. Detached remains distinguished visually and main remains in the full accessible label. Hover covers the whole card; the PR stays a separate action. Only the current card has a filled theme-card background and aria-current=page; all cards have transparent borders. Move selection and confirm the fill moves with it. Check both side gutters, including with long names, and the Porcelain header without its decorative logo. Main remains reachable even when it has a review. Changes/progress updates do not move cards between groups. A card with unavailable checkout cannot select it; retained reviews remain readable without a checkout.
4. Focus the rightmost Collapse <project> · <computer> button and collapse with Enter or Space; its accessible name changes to Expand <project> · <computer>. Project text does not toggle or open a context menu. Search by branch, folder/full path, project, computer and recorded PR number. Matching search temporarily expands the project; clearing search restores its session collapse choice. Settings and back preserve the choice; it is not a persisted preference. Search ArrowDown/ArrowUp reaches first/last enabled card; with no results, focus stays in the search input. Escape clears search while keeping its field visible and focused. Mod+B keeps the normal sidebar doorway.
5. Toggle review, environment and scoped-project checkboxes. Options within each group are OR; groups intersect. Deselecting the last item shows No matching worktrees. Clear filters restores defaults, including hiding older reviews, without clearing search. Clear filters restores hidden project headers before management. Open the labelled Project actions ellipsis, then verify copy/rename/remove through the existing dialogs; hover highlights its stock menu items and pointer cursors identify actions. Escape returns focus to that button. Right-click a worktree for Copy worktree path, Switch branch and Delete (Delete is absent for main); there is no worktree ellipsis, heading or manual refresh action. Follow projects.worktree-actions for branch/deletion behavior.
6. Show older reviews starts unchecked. Enable it to reveal closed/archived retained reviews inside their project. Worktree cards retain their position and remain reachable. Open a retained review and return through the sidebar. Hide older reviews again.
7. A PR number is a separate sibling action. Opening it creates or focuses an in-app PR document tab with the source review and computer, preserving the selected workspace path and card. Repeat from an unselected worktree and another computer, including colliding review/PR IDs. Close the tab and return to the original document. Inventory identity renders first; visible expanded cards then read lightweight worktree summaries and deferred minimal GitHub check summaries. Collapsed or filtered-out projects do not mount those reads. Sidebar rendering does not fetch full GitHub PR payloads; opening the PR document can read them. Unknown/loading, failure and incomplete checks never use passed colouring. Running checks use the warning state, passed checks success, and failed checks failure, with accessible text carrying the same meaning. Compact +/− totals distinguish unavailable, clean, text changes and binary/conflicted changes without inventing zero totals. GitHub failure stays in the PR document with a reason and retry; it never reorders the project list. Back to the review opens the source review on its computer. A scoped PR file action opens that source review and the exact requested file, including after reloading the durable destination.
8. Keep a conflicted unsaved draft, select another checkout from search, return and Resume edit. The draft and disk content retain their independent values. Verify footer Settings/Keyboard shortcuts, shortcut hints, Open project and project actions at both widths. Native desktop bridge/remote behavior requires its own proof.

## Archive a completed review

Open a linked PR document: Archive appears after its readable merged/closed state and uses the existing archive dialog, settings confirmation and server protections. The worktree context menu has no Archive item. The review completion card remains another entrance. Cancel deletes nothing. Preserve ignored-file deletion disclosure, explicit dirty/unpushed acknowledgement, main-checkout protection, lock failure explanation and archive selection cleanup. After successful archive, Filter worktrees → Show older reviews exposes the retained review; its deleted checkout is absent.

Automated coverage: projects-search.e2e.ts, projects-manage.e2e.ts, projects-retry.e2e.ts, projects-pr-state.e2e.ts, review-archive.e2e.ts and worktrees-menu.test.tsx. Old status groups, a separate flat checkout submenu and fixed row-pixel expectations have been replaced.

## Returning to a warm review

After visiting main and a linked topic worktree, return to main. Its valid content remains visible without a new initial Loading review state or repeated full review/HTML reads while lightweight Changes/publication reads revalidate. The automated request ledger briefly holds live notices on the already-connected page and drains HTTP before measuring the return, so a late seen-acknowledgement inventory refresh cannot masquerade as navigation work. It releases those notices before publishing a new main revision and confirming the selected main review updates; retaining warm values must not freeze them. Computer and checkout keys remain distinct, and unavailable scopes still follow their existing recovery contracts. Drive `reviews-workspace-return.e2e.ts`; atom tests cover scoped invalidation and the bounded summary lifetime.
