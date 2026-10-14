---
route: /$projectId/$worktreeId
selectors:
  - "Review sidebar"
  - "Changed files"
  - "Actions for "
  - "Expand all"
  - "Collapse all"
  - "Mark as reviewed"
  - "Unmark as reviewed"
  - "Thread actions"
  - "Resolve"
  - "Reopen"
  - "Reply"
  - "Waiting for the agent"
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

## What it is

Review sidebar files, walkthrough decisions, document sections, file groups and comment threads offer context menus and matching menu buttons. Actions use existing review and comment commands. Open comment cards wrap their action row within the card, including long file names and the narrowest resizable sidebar.

## Driving it

Start with `$C start`, pair a browser with the card's pairing-link command, and read the repository path from its connection file. Publish a decision with `$C agent publish-review "Phone verification"` and a thread with `$C agent comment README.md "should be 5"`.

1. In the Review sidebar select tab "Review". Right-click the "1 Phone verification" row: "Open" and "Mark as reviewed" appear. Mark it. `$C server reviewed-files` and `$C server reviewed-layers` show the file and fresh decision marks. Right-click again and unmark: only the decision mark disappears. Its walkthrough toolbar still offers the same mark/unmark controls.
2. Use the row's "Actions for 1. Phone verification" button, then Escape and Enter to reopen it by keyboard; use the arrow keys and Enter to select an action. File rows also have an "Actions for <path>" button matching their context menu. A document section's menu offers "Open", as does its ordinary button.
3. Right-click the "Changed files" group header, then "Collapse all": its rows and the separate Specs group's rows disappear. "Expand all" from either header's menu button opens both. Individual group headers toggle their own rows by click or keyboard. To include Specs, enable the existing Spec files setting and create a changed spec file in the fixture.
4. Select Comments. Right-click article "Comment thread", then "Resolve". Read back the resolved flag with `$C server comment-threads`. Choose the resolved filter and right-click "Resolved comment thread", then "Reopen". The flag returns to false. The ordinary Resolve/Reopen buttons and "Thread actions" menu use the same command. Reply through the menu opens the existing reply form.
5. Reply to the thread so it shows "Waiting for the agent". Drag the sidebar separator through widths 520, 400, 320, 280 and 260 pixels. The badge, Reply and Resolve stay inside the card with complete labels. Repeat with a very long filename. At 414 × 896, open the Review sheet and check the same controls. Right-click does not open a document or submit a reply.

## Evidence

The Browser Mode spec reads decision, file and resolution state back from the real disposable server. The Playwright spec drags the actual separator to the allowed width endpoints and checks each button and the waiting badge against the card bounds, then checks the phone sheet. Client rule tests cover disabled writes while decision reads settle, pending thread commands and the allowed action sets.
