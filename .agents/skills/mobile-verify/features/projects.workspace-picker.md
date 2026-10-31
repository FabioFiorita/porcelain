---
screen: /workspaces
selectors:
  - 'Worktrees'
  - 'Worktrees by project'
  - 'Search reviews and worktrees'
  - 'Filter worktrees'
  - 'All environments'
  - 'All projects'
  - 'No environments'
  - 'No projects'
  - 'Show older reviews'
  - 'PR #'
  - 'No matching worktrees'
  - 'No computers paired'
  - 'Add computer'
  - 'Clear search'
  - 'current'
  - 'Read projects again'
tests:
  - packages/client/src/features/projects/rules/worktree-navigator.spec.ts
  - packages/client/src/features/projects/store/worktree-navigator.spec.ts
  - packages/client/src/features/projects/rules/workspace-choices.spec.ts
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - packages/client/src/features/projects/queries/inventory-state.spec.ts
  - packages/git/src/actions/commands/cleanup-worktree.spec.ts
  - packages/client/src/features/projects/rules/worktree-actions.spec.ts
  - apps/mobile/src/features/projects/rules/worktree-row.spec.ts
  - apps/mobile/src/features/projects/rules/worktree-action-selection.spec.ts
  - apps/mobile/src/features/projects/rules/retained-review-route.spec.ts
  - apps/mobile/src/shared/rules/workspace-documents.spec.ts
api:
  - POST /api/reviews/:reviewId/archive
  - POST /api/worktrees/:worktreeId/delete
  - POST /api/worktrees/:worktreeId/git/actions
  - GET /api/reviews/:reviewId/pull-request
  - GET /api/reviews/:reviewId/comments
  - GET /api/reviews/:reviewId/pull-request/checks
  - GET /api/worktrees/:worktreeId/summary
  - POST /api/inventory/refresh
  - GET /api/inventory
  - POST /api/live/tickets
  - GET /api/live
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
---

# projects.workspace-picker

Worktrees combines projects across paired computers. Each collapsible project owns its main checkout, compact worktree cards and optional older reviews; each project retains its complete accessible computer identity, with a visible badge only when more than one computer is connected.

## How to get to it (user POV)

- Review, Files or History → Worktrees icon opens a native stack page with Back.
- iPad landscape docks Worktrees in the sidebar; portrait uses the Worktrees icon and a full-width stack page.

## Driving it with agent-device

Preconditions: [surface baseline](README.md). Seed two computers with colliding project/worktree/review ids, a main checkout, detached and unavailable worktrees, active reviews and retained closed/archived reviews. Keep server request evidence with the captures.

1. Open Worktrees from Review, Files and History. Its header has the title and native Back; it has no Update button or Worktrees shortcut. Search is always visible with the icon-only decreasing-lines Filter worktrees button beside it. Check native Back returns to the opening destination. On iPad drive landscape first, then portrait: landscape docks the list; portrait hides the docked sidebar and opens the full-width Worktrees stack. Rotate with a checkout and document selected; returning preserves both.
2. One combined list has project headers with chevrons. A single connected computer has no redundant badge; multiple connected computers show compact badges, each with the computer's icon (desktop until one is picked in web Settings) before its name, that leave project names priority, even when filters hide other projects. Main comes first inside each project, then the other worktrees by newest head commit, with worktrees without a commit last. Focus the badge with VoiceOver/TalkBack to read its complete computer name and project/computer identity; it is static context, not an alert or action. Expand/collapse independently, leave/reopen and check session state. Relaunch resets navigator search, filters and project expansion rather than saving a preference.
3. A clean checkout without a review uses one title row and no No review filler. Otherwise the optional second row holds review details on the left and local changes on the right. Branch/folder, detached status and optional PR action stay aligned in the first row. Main comes first without repeating Main worktree below its name; detached identity stays visible and both remain explicit in accessibility labels, and the complete detached parent path stays in the accessibility label. Numeric local uncommitted additions/deletions use stock add/del text tones, with binary-file counts when present. Until numeric details settle, show the known file count; failures or a net-zero mode change never imply Clean. Exact reviewed/total remains distinct from pending or unavailable progress. Only the selected card has the stock selected background; all cards have transparent borders. Move selection and confirm its background and selected state move together. Cards retain space on both sides. Verify local file counts and marks independently. Pending review/change reads remain visibly pending; failed reads say unavailable; neither implies clean, No review or 0/0. Check long names, larger text, light/dark, phone and iPad. All complete identities and paths remain accessible.
4. Below Search, the horizontally scrollable All environments and All projects pickers expose checked multi-select options; project names include their environment. Narrowed pickers summarize the selected count, empty selections read No environments or No projects, and each picker can reset to All. The icon-only Filter worktrees menu contains with/without review and Show older reviews without duplicating environment/project options. Within each group selections combine with OR; groups combine with AND. Select two computers and two projects with colliding names, then select one review-presence option. Clear filters restores defaults, including older reviews hidden, without clearing search. Search separately by branch, folder, project, computer and PR number; clear it separately. Test no matches and empty selections.
5. Older reviews stay hidden until Show older reviews is enabled, then appear inside their project. Tap a retained review and use native Back to return to the same Worktrees query/filters. Its checkout remains independently selectable. An unavailable/deleted checkout stays disabled while its retained review remains readable. Selecting a checkout preserves the draft leave guard. Return to the previous page only after the shared selection command succeeds; a failed save stays on Worktrees with its error. From Files, select main, a reviewed branch, a changed checkout without a review and a detached checkout, confirming each real destination and absence of a native mounting error.
6. A linked review has a separate PR # action retaining its stock touch target within the card. Exact native visual alignment requires device proof. Passed checks use stock green text, failed checks red text, and running checks show Running with stock neutral text; no checks, loading and unavailable results stay neutral with their complete accessible state. Running currently lacks yellow parity because installed native text tones have no warning tone. The separate PR touch target remains 44 points tall inside its card; PR cards reserve that height in the first title row. Activating PR from an unselected card must leave checkout selection and the existing draft unchanged. Follow [pull requests](reviews.pull-request.md) and prove it preserves the selected checkout and computer. Inventory renders before optional summary data. Visible entries may request the small local-diff summary and GitHub check-rollup routes; clean worktrees skip the extra local-diff read. Merely expanding/searching/filtering projects must not request full GitHub PR payloads; collapsed/filtered-out projects must not mount expensive review/marks/change or summary reads. Retain request evidence alongside the first-paint and settled captures.
7. With no paired computer, worktree-navigator shows No computers paired, guidance and Add computer; search/filter UI is absent even when session filters were retained before the last computer was forgotten. Add computer opens Settings → Computers. Saved-storage failures retain their error and retry. Retry unavailable inventories and details with Read projects again.

### Worktree and project actions

1. Each project header has a static computer badge when multiple computers are connected, an ellipsis with Rename project, Copy project path and Remove project, then the collapse chevron at the far right. Keyboard/screen-reader labels include project and computer. Copy project path uses the native clipboard; paste it into Search to independently read it back, then clear Search.
2. Long-press a worktree card to open one stock action sheet with Copy worktree path and Switch branch. A normal tap selects the checkout and never opens the sheet. Switch/Delete replace the body within that same sheet; cards do not embed native menu hosts. Non-main cards also show Delete; main never does. Copy uses the native clipboard and closes the sheet only after success; failure remains visible. Opening an action for another worktree must preserve the selected checkout and its unsent comment. On Android, open a decision comment for selected checkout B, type an unsent message, then use the Files tab and Worktrees to switch and delete checkout A. Return to Review after each command: the exact draft remains and no comment was posted. Open A’s PR from another unselected card and verify the same retention. Submit a branch switch on selected B: Discard comment? appears before Git; Keep writing preserves the draft and Git branch. Native Back returns through the same stack.
3. Switch branch lists local branches with search; current and checked-out-elsewhere branches are labelled and disabled. Switch on main is allowed. On a selected target, the document leave guard still applies; on an unselected target it must not discard another document’s comment. A lost response exposes Check outcome backed by the same durable request, with branch choices disabled while unresolved. Verify the actual Git branch after success and reopen to see the current marker.
4. Delete opens three one-off switches initialized from this computer’s actual saved settings. Close and reopen resets choices; changing them never saves preferences. Detached worktrees disable local/remote branch deletion. Keeping the folder while deleting the local branch explicitly says it detaches the checkout. Review deletion reads the actual targets before the final Delete; dirty/unpushed warnings require acknowledgement. A failed confirmation clears the plan and acknowledgement before another preview. Verify main/default-branch protection and independently read files/branches/settings. Removing the selected worktree moves selection to main; removing another worktree preserves the selected checkout. Keeping and detaching the folder keeps it selectable. Review history remains readable with Show older reviews.

### Archive a completed review

Precondition: review linked to merged/closed PR. In Settings → Reviews & Git, the review's computer has confirmed settings (Use these settings for <computer name>); When archiving a review has worktree/local branch/remote branch switches. Until then Archive is disabled and says why.

1. Open the row’s PR number, then Archive shows actual deletion targets. When deleting a worktree, it says the entire folder will be permanently deleted, including ignored files such as .env and local build output, even when ignored files are the only local contents. Cancel and independently verify .env remains. Keeping a worktree while deleting its branch explicitly detaches it without a folder-deletion warning; main checkout/branches stay protected. Settings configures deletion options; there is no separate archive shortcut, context-menu action or mobile completion-card Archive.
2. Dirty files/unpushed commits require their warning/acknowledgement; Android switch starts off and Archive stays disabled until checked. Ignored files alone are not dirty. No upstream skips remote deletion; auto-deleted remote at the merged PR head says already deleted without an unpushed warning. Failed preview replaces checking text with a plain reason.
3. Confirm for the selected worktree: selection leaves before deletion. Show older reviews retains the readable review and Archived in its accessible label/detail. A kept worktree stays in its project alongside main. Capture before, confirmation, the retained project row and settings.
4. With long worktree and branch paths and Android font scale 2.0, scroll the confirmation body through the deletion targets, acknowledgement and any failure. Cancel and Archive review stay visible in a fixed footer; both labels fit without reducing font scaling. Repeat on iPad in landscape and portrait, with normal and larger Dynamic Type; the native page-sized sheet contains its footer. Reopen after a locked-worktree failure, acknowledge again, retry and independently read the deletion result.

## Gotchas

- Selecting or archiving retains document-leave protection. A retained review stays in the Files, Review or History stack that opened it. A PR document uses its own computer/review identity and does not select that computer or checkout.
- Archive is available inside a successfully read closed/merged PR document; the navigator does not eagerly read PR payloads to decide eligibility. Existing server preview and confirmed per-computer settings own deletion protections.
