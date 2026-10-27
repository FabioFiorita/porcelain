---
screen: /files
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'Files'
  - 'Select a worktree'
  - 'Search files'
  - 'Create file or folder'
  - 'New file'
  - 'New folder'
  - 'Rename'
  - 'Move to trash'
  - 'Collapse all'
  - 'Clear search and collapse all'
  - 'Pin file'
  - 'Unpin file'
  - 'Hide folder'
  - 'Show hidden'
  - 'Pinned'
  - 'All files'
  - 'Uncommitted review status'
  - 'Branch review status'
  - 'Reading file review status…'
  - 'File review status is unavailable.'
  - 'Read file review status again'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/features/files/rules/directory-loading.spec.ts
  - apps/mobile/src/features/files/rules/directory-requests.spec.ts
  - apps/mobile/src/features/files/rules/file-preferences.spec.ts
  - apps/mobile/src/features/reviews/rules/comparison.spec.ts
  - packages/client/src/features/files/rules/change-marks.spec.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/paths
  - POST /api/worktrees/:worktreeId/files
  - GET /api/projects/:projectId/file-preferences
  - PUT /api/projects/:projectId/file-preferences
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/reviewed
---

# files.files

Files browses and searches the selected worktree, manages entries and preferences, and marks changed files and the folders that contain them.

## How to get to it (user POV)

- Files tab or `porcelain.dev://files`; choose a worktree through [Worktrees](projects.workspace-picker.md).
- Create file or folder; hold a row for file/folder actions.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Choose a worktree, expand a folder/child, open a file, return and search a nested path. Switch to another worktree and back several times: the tree draws its rows every time without a reload (Android once left them blank). Collapse all clears search/closes folders while retaining loaded directories and the open document. Rename/trash the ancestor; current tree/reader recovers without retrying obsolete paths.
2. Without selection expect Select a worktree. Initial root load shows Reading files…, never No files. Only a completed empty root shows No files; completed no-match search shows No files match this view., while pending search shows no empty result. Initial child read announces loading and replaces its chevron without moving existing rows. Background reads retain rows/chevrons/header height.
3. Fail a read: Read folders again retries with a pending disabled button, including when old data remains. Independently change a file/add a directory while visible: updates arrive without refresh.
4. Create file or folder → open/dismiss menu, open New file/New folder sheets and Cancel: no disk change. Create a root folder/file; file opens, folder does not. Hold rows for nested creation, Rename (full relative path) and Move to trash confirmation. Inspect disk after each mutation. Errors keep sheets retryable; trash is recoverable.
5. The phone shows the worktree name and branch above the tree, with Show hidden (n) at its right edge when anything is hidden. Pinned (with its count) comes before All files; both groups collapse and expand independently, and both hide while searching so results stand alone. Hold a file in tree/search/Pinned → Pin file, Unpin file, Hide file; folders offer Hide folder. Show hidden exposes saved paths; Show file/folder clears the actual hidden preference, including inherited ancestors. Pins are reachable before parent expansion. Read preferences independently, leave/reopen and switch project/environment: no preference leaks. Exercise pending/error/retry.
6. Put added, modified, deleted, renamed and untracked files beside unchanged files/folders. Changed files show their letter (A, M, R, U) at the right edge in tree/search/pins, and every folder above a changed file that still exists shows a dot; a deleted file shows D only where it is still listed (search for an unstaged deletion, a pinned path) and gives its folders no dot. Unchanged entries show nothing; a Symlink/Submodule/Ignored badge sits beside the mark. Search and Pinned rows keep the filename visible, ellipsized when needed, with the muted folder taking the remaining space and truncating at its head. Exercise both a long filename and a long nested folder together; neither path nor name overlaps the change mark. Plain tree rows also ellipsize long filenames. Accessible Open includes full path, change kind and Reviewed, Unreviewed or Changed since review, distinguishing duplicate leaf names. Opening by any path writes no marks; kind/ignored badges and menus remain.
7. Mark/unmark through Review, then update marks independently while Files stays visible. Mutate reviewed contents: Changed since review. Switch comparison/worktree, reconnect/relaunch: labels agree with independent reads. Pending/unavailable review reads keep navigation, show Reading file review status… or File review status is unavailable. plus Read file review status again, and retain no Reviewed labels.
8. For iPad tab/panel switching, retained search/expansion, worktree sessions and narrow panes follow [workspace](app.workspace.md). Repeat landscape, portrait and larger Dynamic Type.
9. Search or pin a known text/image path inside a folder with more than 2,000 visible entries. Open it before expanding its parent; the reader still opens when browsing that folder is refused. Follow [Preview](files.preview.md) for content, safety and return-path controls.

Automated coverage: `workspace-selection.spec.ts`, `directory-loading.spec.ts`, `directory-requests.spec.ts`, `file-preferences.spec.ts`, `comparison.spec.ts`, `change-marks.spec.ts`.

## Gotchas

- Phones use Uncommitted marks and native routes; iPad names its Uncommitted/Branch context and uses central tabs. Review status is in the accessible name only; the row shows one change mark. Only iPad offers Open to the side.
- Phone creation uses its toolbar; iPad's plus menu stays in the panel body. Workspace selection is in the phone toolbar or iPad left navigator.
