---
route: /$projectId/$worktreeId
selectors:
  - 'Review sidebar'
  - 'Changed files'
  - 'Actions for '
  - 'More actions for decision '
  - 'Expand all'
  - 'Collapse all'
  - 'Mark as reviewed'
  - 'Unmark as reviewed'
  - 'Thread actions'
  - 'Resolve'
  - 'Reopen'
  - 'Reply'
  - 'Waiting for the agent'
tests:
  - apps/web/spec/integration/reviews-sidebar-actions.test.tsx
  - apps/web/spec/e2e/reviews-comment-width.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/reviewed-layers
  - PUT /api/worktrees/:worktreeId/reviewed-layers
  - DELETE /api/worktrees/:worktreeId/reviewed-layers
  - GET /api/worktrees/:worktreeId/comments
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
---

# reviews.sidebar-actions

Review sidebar files, walkthrough decisions, document sections, file groups and comment threads offer context menus and matching menu buttons. Actions use existing review and comment commands. Open comment cards wrap their action row within the card, including long file names and the narrowest resizable sidebar.

## How to get to it (user POV)

- Right-click a review file, decision, section, group or comment; use its matching menu button.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Publish `$C agent publish-review "Phone verification"` and `$C agent comment README.md "should be 5"` before loading.

1. In the Review sidebar select tab "Review". Right-click the row named /^1 Phone verification/: "Open" and "Mark as reviewed" appear. Mark it. `$C server reviewed-files` and `$C server reviewed-layers` show the file and fresh decision marks. Right-click again and unmark: only the decision mark disappears. Its walkthrough toolbar still offers the same mark/unmark controls.
2. Use the row's "More actions for decision 1" button (accessible description "Phone verification"), then Escape and Enter to reopen it by keyboard; use the arrow keys and Enter to select an action. File rows also have an "Actions for <path>" button matching their context menu. A document section's menu offers "Open", as does its ordinary button.
3. In the worktree Changes tab, right-click the "Changed files" group header, then "Collapse all": its rows and the separate Specs group's rows disappear. "Expand all" from either header's menu button opens both. Scope the Specs header and its menu button to region "Specs"; the walkthrough also has an "Open all specs" row. Decision rows expose their visible title and progress, while their numbered menu buttons describe the title separately. Individual group headers toggle their own rows by click or keyboard. To include Specs, enable the existing Spec files setting and create a changed spec file in the fixture.
   In the published Review tab, Changed files instead has an Open all changes button and an independent chevron for its full file list; no duplicate group menu is present. See [reviews.walkthrough](reviews.walkthrough.md) for the immutable flat view and way back.
4. Select Comments. Right-click article "Comment thread", then "Resolve". Read back the resolved flag with `$C server comment-threads`. Choose the resolved filter and right-click "Resolved comment thread", then "Reopen". The flag returns to false. The ordinary Resolve/Reopen buttons and "Thread actions" menu use the same command. Reply through the menu opens the existing reply form.
5. Reply to the thread so it shows "Waiting for the agent". Drag the sidebar separator through widths 520, 400, 320, 280 and 260 pixels. The badge, Reply and Resolve stay inside the card with complete labels. Repeat with a very long filename. At 414 × 896, open the Review sheet and check the same controls. Right-click does not open a document or submit a reply. Double-click a word in a comment: it remains selectable for copying in the sidebar and inline in the document.

Automated coverage: `reviews-sidebar-actions.test.tsx`, `reviews-comment-width.e2e.ts`.

## Gotchas

- Scope repeated menu buttons to their group/card; the walkthrough's "Open all specs" row shares its name with the Specs group's row.
