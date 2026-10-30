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
  - packages/client/src/features/projects/store/worktree-navigator.spec.ts
  - packages/client/src/features/projects/rules/workspace-choices.spec.ts
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - packages/client/src/features/projects/queries/inventory-state.spec.ts
  - packages/git/src/actions/commands/archive-review.spec.ts
  - packages/client/src/features/reviews/rules/archive-review.spec.ts
  - apps/mobile/src/features/projects/rules/worktree-row.spec.ts
  - apps/mobile/src/features/projects/rules/retained-review-route.spec.ts
  - apps/mobile/src/shared/rules/workspace-documents.spec.ts
api:
  - POST /api/reviews/:reviewId/archive
  - GET /api/reviews/:reviewId/pull-request
  - POST /api/inventory/refresh
  - GET /api/inventory
  - POST /api/live/tickets
  - GET /api/live
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
---

# projects.workspace-picker

Worktrees combines projects across paired computers. Each collapsible project owns its main checkout, compact worktree cards and optional older reviews; each project visibly identifies its computer.

## How to get to it (user POV)

- Review, Files or History → Worktrees icon opens a native stack page with Back.
- iPad landscape docks Worktrees in the sidebar; portrait uses the Worktrees icon and a full-width stack page.

## Driving it with agent-device

Preconditions: [surface baseline](README.md). Seed two computers with colliding project/worktree/review ids, a main checkout, detached and unavailable worktrees, active reviews and retained closed/archived reviews. Keep server request evidence with the captures.

1. Open Worktrees from Review, Files and History. Its header has the title, native Back and an icon-only decreasing-lines filter with accessible name Filter worktrees; it has no Update button or Worktrees shortcut. Check native Back returns to the opening destination. On iPad drive landscape first, then portrait: landscape docks the list; portrait hides the docked sidebar and opens the full-width Worktrees stack. Rotate with a checkout and document selected; returning preserves both.
2. One combined list has project headers with chevrons and compact visible computer badges. Main comes first inside each project. Tap a badge to read its complete computer name; VoiceOver/TalkBack announces complete project/computer identity. Expand/collapse independently, leave/reopen and check session state. Relaunch resets navigator search, filters and project expansion rather than saving a preference.
3. Each checkout card shows its branch (detached: folder and parent path), Main worktree/Detached HEAD when applicable, local-change state and review state with exact reviewed/total once available. Verify local file counts and marks independently. Pending review/change reads remain visibly pending; failed reads say unavailable; neither implies clean, No review or 0/0. Check long names, larger text, light/dark, phone and iPad. All complete identities and paths remain accessible.
4. Below Search, the horizontally scrollable All environments and All projects pickers expose checked multi-select options; project names include their environment. Narrowed pickers summarize the selected count, empty selections read No environments or No projects, and each picker can reset to All. The icon-only Filter worktrees menu contains with/without review and Show older reviews without duplicating environment/project options. Within each group selections combine with OR; groups combine with AND. Select two computers and two projects with colliding names, then select one review-presence option. Clear filters restores defaults, including older reviews hidden, without clearing search. Search separately by branch, folder, project, computer and PR number; clear it separately. Test no matches and empty selections.
5. Older reviews stay hidden until Show older reviews is enabled, then appear inside their project. Tap a retained review and use native Back to return to the same Worktrees query/filters. Its checkout remains independently selectable. An unavailable/deleted checkout stays disabled while its retained review remains readable. Selecting a checkout preserves the draft leave guard.
6. A linked review has a separate PR # action. Follow [pull requests](reviews.pull-request.md) and prove it preserves the selected checkout and computer. Merely expanding/searching/filtering projects must not request full GitHub PR payloads; collapsed/filtered-out projects must not mount expensive review/marks/change reads. Retain request evidence alongside the first-paint and settled captures.
7. With no paired computer, worktree-navigator shows No computers paired, guidance and Add computer; search/filter UI is absent even when session filters were retained before the last computer was forgotten. Add computer opens Settings → Computers. Saved-storage failures retain their error and retry. Retry unavailable inventories and details with Read projects again.

### Archive a completed review

Precondition: review linked to merged/closed PR. In Settings → Reviews & Git, the review's computer has confirmed settings (Use these settings for <computer name>); When archiving a review has worktree/local branch/remote branch switches. Until then Archive is disabled and says why.

1. Open the row’s PR number, then Archive shows actual deletion targets. When deleting a worktree, it says the entire folder will be permanently deleted, including ignored files such as .env and local build output, even when ignored files are the only local contents. Cancel and independently verify .env remains. Keeping a worktree while deleting its branch explicitly detaches it without a folder-deletion warning; main checkout/branches stay protected. Settings configures deletion options; there is no separate archive shortcut, context-menu action or mobile completion-card Archive.
2. Dirty files/unpushed commits require their warning/acknowledgement; Android switch starts off and Archive stays disabled until checked. Ignored files alone are not dirty. No upstream skips remote deletion; auto-deleted remote at the merged PR head says already deleted without an unpushed warning. Failed preview replaces checking text with a plain reason.
3. Confirm for the selected worktree: selection leaves before deletion. Show older reviews retains the readable review and Archived in its accessible label/detail. A kept worktree stays in its project alongside main. Capture before, confirmation, the retained project row and settings.
4. With long worktree and branch paths and Android font scale 2.0, scroll the confirmation body through the deletion targets, acknowledgement and any failure. Cancel and Archive review stay visible in a fixed footer; both labels fit without reducing font scaling. Repeat on iPad in landscape and portrait, with normal and larger Dynamic Type; the native page-sized sheet contains its footer. Reopen after a locked-worktree failure, acknowledge again, retry and independently read the deletion result.


## Gotchas

- Selecting or archiving retains document-leave protection. A retained review stays in the Files, Review or History stack that opened it. A PR document uses its own computer/review identity and does not select that computer or checkout.
- Archive is available inside a successfully read closed/merged PR document; the navigator does not eagerly read PR payloads to decide eligibility. Existing server preview and confirmed per-computer settings own deletion protections.
