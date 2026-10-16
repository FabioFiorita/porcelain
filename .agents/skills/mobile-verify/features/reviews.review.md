---
screen: /review
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'Review'
  - 'Select a worktree to continue.'
  - 'No changes'
  - 'Open review overview'
  - 'Read agent summary'
  - 'Return to walkthrough'
  - 'Show whole file'
  - 'Show relevant range'
  - 'No agent review'
  - 'No walkthrough decisions'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/features/reviews/rules/pointer-source.spec.ts
  - packages/client/src/features/reviews/queries/publication.spec.ts
api:
  - GET /api/worktrees/:worktreeId/text
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/review
  - GET /api/worktrees/:worktreeId/reviewed
  - GET /api/worktrees/:worktreeId/comments
---

# reviews.review

## What it is

Review uses the selected worktree and shared live subscriptions to show uncommitted or branch changes, fingerprint-aware reviewed markers, an agent's published explanation and comments. It uses native comparison menus, stack navigation and a comments sheet with Porcelain content primitives. On iPad, Review is a right inspector mode. Overview and changed files open the single central document tabs shared with Files and History, without pushing native file routes. Wide panes show the inspector on the right; narrow panes switch inspector/content in place. Each review tab captures its comparison and can be closed. Phones retain the list and native file routes.

## How a user reaches it

- the app opens on Files after a cold launch
- phone: the Review tab; iPad: Review in the right inspector
- the deep link `porcelain.dev://`

## Driving it

1. Open Review without a worktree. Expect Select a worktree to continue.
2. Pair the disposable server and choose its sample worktree from the phone Workspace toolbar or iPad left navigator. Expect Review README.md. On a phone, open it and use native Back to return to the list. On iPad, open Overview and two changed files in the central tabs; reopening a file activates its existing comparison tab. Switch the inspector to Files and History and expect the active review document and all tabs to remain. The native title identifies the project/worktree. Opening Comments and using Done returns to the same central selection.
3. Choose Branch from the Uncommitted menu and choose a base. Newly opened tabs capture that comparison; changing the inspector comparison leaves existing review tabs and their anchors intact. Switch worktrees and return: each restores its own tabs, comparison and inspector mode. Marks and comments retain their comparison scope.
4. Change the sample through fixture operations. Expect the list and reviewed status to update without leaving Review. A previous fingerprint reads Changed since review; a clean worktree reads No changes.
5. Revoke or stop the disposable environment. Expect an error or unavailable-workspace state; no old workspace's writes remain available. Read again through the phone workspace toolbar or iPad worktree navigator after reconnecting.
6. Select Files and return; cold-launch against the card's Metro URL and return to Review. The selected workspace remains the shell's responsibility.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- Walkthrough code pointers open the current source at their resolved range, including context and committed files outside the comparison. Broken pointers explain that code is unavailable and disable reading. Changed pointers warn that the original snippet moved and do not highlight it as current. Changed-file diffs remain a separate destination.
- Pane width is measured after the app sidebar consumes its space. A wide phone still uses native file routes; Android keeps its existing compact presentation. Resize the iPad pane across the threshold and verify the same tabs and active content remain, with no native file-route push.
- Native acceptance requires driving the changed iPad presentation and existing compact flow; source inspection does not establish either.

See [selected workspace states](projects.workspace-picker.md#selected-workspace-states) for shared loading, failure, availability and recovery behavior.

## Agent overview and walkthrough

Use `--fixture development`. On the phone open Review; on iPad open Review in the inspector, then Overview. Verify the briefing's three decisions match the published response and web walkthrough in order: Keep document holds visible, Filter completed deliveries, Explain the dispatch handoff. Decision completion and sidebar status are independent features.

Open each numbered decision, read its supplied explanation, and move with Next and Previous. Read a code pointer: expect the path, source range and source line numbers, Show whole file and Show relevant range. Return to the named decision; open its changed-file diff and use phone Back or the iPad Review tab to return to the same decision/pointer. Open Read agent summary and expect the supplied HTML; Return to walkthrough restores the stop. The existing isolated HTML renderer displays self-contained content without executing scripts or loading remote assets.

Switch worktrees and return: no review leaks into the other workspace; the same review restores its stop. A newly published revision starts with its own briefing. Choose Branch and return to Uncommitted; branch comparison remains independent. Verify No agent review when none was supplied; No walkthrough decisions when a saved response has no decisions; loading and read failures must show a state and Read again. Refresh review retries publication, including expired summary links. On iPad Overview, a failed or loading changed-file read shows its own state and Read again while saved decisions remain available; unknown coverage must not look like an empty comparison. Its retry restores Not explained and changed-file diff links. A missing worktree displays the saved-review diagnostics and disables code pointers.

Capture Android, iPhone and iPad evidence separately. iPad landscape first, then portrait, plus larger Dynamic Type. Check unique accessible labels for overview, summary, decision entry, range reading and previous/next controls.

Agent summaries read the existing signed `/review-summaries/:token` HTML endpoint through the selected connection. The feature-map API frontmatter currently accepts only `/api/` routes.
