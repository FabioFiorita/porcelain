---
screen: /files
selectors:
  - "Files"
  - "Select a worktree to continue."
  - "Search files"
  - "New file"
  - "New folder"
  - "Rename"
  - "Move to trash"
tests:
  - apps/mobile/spec/e2e/files.e2e.ts
  - apps/mobile/spec/e2e/phone-shell.e2e.ts
  - apps/mobile/spec/e2e/destinations.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/paths
  - POST /api/worktrees/:worktreeId/files
---

# files.files

Files browses the selected worktree through lazily loaded folders. Search matches worktree paths. Native tabs, toolbar workspace menu and stack navigation surround Porcelain file rows and controls. Without a selection it asks to select a worktree.

Reach Files through its phone tab or porcelain.dev://files. Choose a worktree with projects.workspace-picker. Expand folders, open a file, return with native Back, and search a nested path. Refresh rereads loaded folders. Read errors offer retry; an empty directory says No files.

New file and New folder open a native sheet. Holding a row offers Rename and Move to trash; folder menus also create inside that folder. Create a folder and file, rename the file with its full relative path, and confirm trash. Independently inspect the fixture directory after each operation. Errors keep the sheet open for retry. Trash uses the server's recoverable trash operation.

The named Files phone flow proves browsing, editing and directory operations against a real server. iPad and Android are unproved in this change.
