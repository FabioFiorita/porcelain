---
screen: /worktrees
selectors:
  - 'Worktrees'
  - 'Worktrees by project'
  - 'Search worktrees'
  - 'Filter worktrees'
  - 'All environments'
  - 'All projects'
  - 'No environments'
  - 'No projects'
  - 'Open pull request #'
  - 'No matching worktrees'
  - 'No computers paired'
  - 'Add computer'
  - 'current'
  - 'Remove from Porcelain'
  - 'Read projects again'
tests:
  - packages/client/src/features/projects/rules/worktree-navigator.spec.ts
  - packages/client/src/features/projects/store/worktree-navigator.spec.ts
  - packages/client/src/features/projects/queries/worktree-navigator.spec.ts
  - packages/client/src/features/projects/rules/workspace-choices.spec.ts
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - packages/client/src/features/projects/queries/inventory-state.spec.ts
  - packages/git/src/actions/commands/cleanup-worktree.spec.ts
  - packages/client/src/features/projects/rules/worktree-actions.spec.ts
  - apps/mobile/src/features/projects/rules/worktree-row.spec.ts
  - apps/mobile/src/features/projects/rules/worktree-action-selection.spec.ts
api:
  - POST /api/reviews/:reviewId/archive
  - POST /api/worktrees/:worktreeId/delete
  - POST /api/worktrees/:worktreeId/git/actions
  - GET /api/reviews/:reviewId/pull-request
  - GET /api/reviews/:reviewId/comments
  - GET /api/reviews/:reviewId/pull-request/checks
  - GET /api/worktrees/:worktreeId/git/status
  - POST /api/inventory/refresh
  - GET /api/inventory
  - POST /api/live/tickets
  - GET /api/live
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
---

# projects.worktrees

The Worktrees tab combines live checkouts across paired computers. Each collapsible project owns its main checkout and compact worktree rows. A row leads with the worktree's walkthrough title, else its pull request title, else its branch; when a title leads, the branch follows as small monospaced text. Multiple computers show a plain icon and computer name beneath the project name. Reviews are their own durable list in the Reviews tab.

## How to get to it (user POV)

- Worktrees tab. Search is the native header search bar (Search worktrees); on Android tap the Search icon in the header first.
- Filter worktrees and the All environments / All projects pickers sit at the top of the scrolling list.
- Tap a worktree to select it and open its [Worktree](projects.worktree.md) screen. Open the Reviews tab for saved publications, including those whose checkouts no longer exist.

## Driving it with agent-device

Preconditions: [surface baseline](README.md). Seed two computers with colliding project/worktree/review ids, a main checkout, detached and unavailable worktrees, active reviews and retained closed/archived reviews. Keep server request evidence with the captures.

1. Select the Worktrees tab. Its large title has the Settings gear on the left and the native search bar with placeholder Search worktrees (Android: tap the Search icon to expand it; pressing X on an empty field collapses it and brings back Settings). The first row of the list holds the icon-only decreasing-lines Filter worktrees button beside the scope pickers. On tablets with sufficient content width the list is the left column and the chosen worktree's page, with its Changes, Files and History, sits beside it instead of pushing; verify landscape and portrait, rotating with a worktree chosen; the selection and list state stay.
2. Write a walkthrough on a worktree (see [Walkthrough](reviews.walkthrough-page.md)): its row leads with the walkthrough title and the branch moves beneath it in small monospaced text; the accessible name starts with the title. One combined list has project headers with chevrons. A single connected computer has no redundant computer caption. Multiple connected computers show the full computer name and its icon beneath the semibold project name, even when filters hide other projects. Long computer names can truncate visually but remain in their complete accessible label; no name is replaced with an icon-only badge. Main comes first inside each project, followed by newest head commit, with undated worktrees last. Expand/collapse independently, leave/reopen, and check session state. Relaunch resets navigator search, filters, and project expansion.
3. A clean checkout without a review uses one title row and no No review filler. Otherwise the optional second row holds neutral review metadata and a quiet changed-file count. Branch/home/review icons identify the destination. Main and detached identities remain explicit in accessibility labels; detached parent paths remain accessible. Decision reviews and new revisions use the shared recorded metadata; sidebar rows show no reviewed/total fraction or additions/deletions. Only the selected row has a neutral rounded fill, with no left accent or border. Move selection and confirm its fill and selected state move together. Pending and failed reads remain distinct from clean/no-review states. Check long names, larger text, light/dark, phone and tablet layouts, including both tablet orientations.
4. At the top of the list, the horizontally scrollable All environments and All projects pickers expose checked multi-select options; project names include their environment. Narrowed pickers summarize the selected count, empty selections read No environments or No projects, and each picker can reset to All. The icon-only Filter worktrees menu contains with/without review without duplicating environment/project options. Review history belongs to the Reviews tab’s Filter reviews menu. Within each group selections combine with OR; groups combine with AND. Select two computers and two projects with colliding names, then select one review-presence option. Clear filters restores defaults without clearing search. Search separately by branch, folder, project, computer and PR number; clear it separately. Test no matches and empty selections.
6. A linked review has a separate neutral # PR action retaining its stock 44pt/48dp touch target. A failed check has an independent warning icon; passed/running/loading/unavailable states do not color the PR label, and the full check state remains accessible. Activating PR from an unselected row leaves checkout selection and an existing draft unchanged. Follow [pull requests](reviews.pull-request.md) and prove the source computer/review identity. A review without a linked PR never announces Checks loading. Inventory renders before optional check rollups. Expanding/searching/filtering does not request local-diff summaries or full GitHub PR payloads. Collapsed/filtered-out projects do not mount expensive detail reads. Retain request evidence with first-paint and settled captures.
7. With no paired computer, worktree-navigator shows No computers paired, guidance and Add computer; search/filter UI is absent even when session filters were retained before the last computer was forgotten. Add computer opens Settings → Computers. Saved-storage failures retain their error and retry. Retry unavailable inventories and details with Read projects again.

### Worktree and project actions

1. Each project header has a stacked plain computer caption when multiple computers are connected, an ellipsis with Copy path, [Rename project](projects.rename-project.md) and Remove from Porcelain (a platform alert), then the collapse chevron at the far right. Keyboard/screen-reader labels include project and computer. Copy project path uses the native clipboard; paste it into Search to independently read it back, then clear Search.
2. Long-press a worktree row to open [its actions sheet](projects.worktree-actions.md) with Copy worktree path and Switch branch. A normal tap selects the checkout and never opens the sheet. Switch/Delete replace the body within that same sheet; rows do not embed native menu hosts. Non-main rows also show Delete; main never does. Copy uses the native clipboard and closes the sheet only after success; failure remains visible. Opening an action for another worktree must preserve the selected checkout and its unsent comment. On Android, open a decision comment for selected checkout B, type an unsent message, then go back to Worktrees and long-press checkout A to switch its branch and delete it. Return to B's Review after each command: the exact draft remains and no comment was posted. Open A’s PR from another unselected row and verify the same retention. Submit a branch switch on selected B: Discard comment? appears before Git; Keep writing preserves the draft and Git branch. Native Back returns through the same stack.
3. Switch branch lists local branches with search; current and checked-out-elsewhere branches are labelled and disabled. Switch on main is allowed. On a selected target, the document leave guard still applies; on an unselected target it must not discard another document’s comment. A lost response exposes Check outcome backed by the same durable request, with branch choices disabled while unresolved. Verify the actual Git branch after success and reopen to see the current marker.
4. Delete opens three one-off switches initialized from this computer’s actual saved settings. Close and reopen resets choices; changing them never saves preferences. Detached worktrees disable local/remote branch deletion. Keeping the folder while deleting the local branch explicitly says it detaches the checkout. Review deletion reads the actual targets before the final Delete; dirty/unpushed warnings require acknowledgement. A failed confirmation clears the plan and acknowledgement before another preview. Verify main/default-branch protection and independently read files/branches/settings. Removing the selected worktree moves selection to main; removing another worktree preserves the selected checkout. Keeping and detaching the folder keeps it selectable. Review history remains readable through Reviews → Filter reviews → Show older reviews.

### Archive a completed review

Follow [archive review](projects.archive-review.md).

## Gotchas

- Selecting or archiving retains document-leave protection. Published reviews open from Reviews by their durable review/computer identity. A PR document uses its own computer/review identity and does not select that computer or checkout.
- Archive is available inside a successfully read closed/merged PR document; the navigator does not eagerly read PR payloads to decide eligibility. Existing server preview and confirmed per-computer settings own deletion protections.

## Unavailable worktree status

Status failures use a quiet dash in the worktree row, with Changes unavailable in its accessible label, and show one small floating dismissible notice for an affected computer. Details lists affected worktrees and available error text; Retry reconciles only that computer and rereads surviving failed statuses. Dismissal keeps the current failure quiet while it persists. Worktree actions retain Retry changes after dismissal. Confirm recovery and stale-checkout removal clear the notice without moving the selected workspace or affecting a healthy computer. Drive phone and tablet layouts, including both tablet orientations, keyboard and screen-reader labels, long names and detail scrolling. This map describes required behavior; a browser screenshot is not native evidence.
