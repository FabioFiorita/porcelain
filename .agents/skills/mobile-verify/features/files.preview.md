---
screen: /file
selectors:
  - "Edit"
  - "Show source"
  - "Workspace changed"
tests:
  - apps/mobile/spec/e2e/files.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/text
  - GET /api/worktrees/:worktreeId/asset
---

# files.preview

Open a file from Files or search. The native stack shows its filename, full path and back button. Source uses CodeView; Markdown, self-contained HTML and images use the existing native previews. Reader/source controls remain Porcelain controls. Binary, oversized, symlink, submodule and unavailable files have explicit notices; links are not followed on disk. Linked local HTML assets are not yet included.

Drive a code file, Markdown reader/source, an image and HTML preview/source. Return with the native back button or swipe. Select another workspace while a file is open: the stale route must say Workspace changed and never display or edit the same path from another worktree.

The named Files phone flow opens real source and reaches Edit. The iPad layout, Android and physical-device Local Network permission are unproved.
