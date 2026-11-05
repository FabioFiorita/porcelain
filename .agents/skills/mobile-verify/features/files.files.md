---
screen: /files
selectors:
  - 'Show timeline'
  - 'Timeline'
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'Files'
  - 'Select a worktree'
  - 'worktree-files'
  - 'Search files'
  - 'Open path'
  - 'Create file or folder'
  - 'New file'
  - 'New folder'
  - 'Rename'
  - 'Move to trash'
  - 'Collapse all'
  - 'Clear search and collapse all'
  - 'Pin folder'
  - 'Unpin folder'
  - 'Pinned entry is unavailable'
  - 'Pinned entry is missing'
  - 'Pin file'
  - 'Unpin file'
  - 'Hide folder'
  - 'Show hidden'
  - 'Pinned'
  - 'All files'
  - 'Reading file review status…'
  - 'File review status is unavailable.'
  - 'Read file review status again'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/features/files/rules/directory-loading.spec.ts
  - apps/mobile/src/features/files/rules/directory-requests.spec.ts
  - packages/client/src/features/files/rules/file-preferences.spec.ts
  - apps/mobile/src/features/files/rules/file-navigation.spec.ts
  - apps/mobile/src/features/files/store.spec.ts
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

- Worktrees tab → worktree → Files (`worktree-files`) on the [Worktree](projects.worktree.md) screen, or `porcelain.dev://files` for the selected worktree.
- Header + (Create file or folder) on the right; hold a row for file/folder actions.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Choose a worktree, expand a folder/child, open a file, return and search a nested path. Switch to another worktree and back several times: the tree draws its rows every time without a reload (Android once left them blank). Collapse all clears search/closes folders while retaining loaded directories and the open document. Rename/trash the ancestor; current tree/reader recovers without retrying obsolete paths.
2. Without selection (e.g. `porcelain.dev://files` before choosing one) expect Select a worktree with Choose a worktree in Worktrees to continue to Files. Initial root load shows Reading files…, never No files. Only a completed empty root shows No files; completed no-match search shows No files match this view., while pending search shows no empty result. Initial child read announces loading and replaces its chevron without moving existing rows. Background reads retain rows/chevrons/header height.
3. Fail a read: Read folders again retries with a pending disabled button, including when old data remains. Independently change a file/add a directory while visible: updates arrive without refresh.
4. Header + (Create file or folder) → open/dismiss menu, open the New file/New folder [form sheets](files.file-action.md) and close them: no disk change. Create a root folder/file; file opens, folder does not. Hold rows for nested creation, Rename (full relative path) and the Move to trash alert. Inspect disk after each mutation. Errors keep sheets retryable; trash is recoverable.
5. Files shows the project name and branch above the tree, with Show hidden (n) at its right edge when anything is hidden. Pinned (with its count) comes before All files; both are plain headings without section-collapse controls, and both hide while searching so results stand alone. Hold a file in tree/search/Pinned → Pin file, Unpin file, Hide file; folders offer Pin folder, Unpin folder and Hide folder. Expand a pinned folder: descendants appear in the same scrolling list; pin a nested folder as well and verify each branch can collapse. Fail its parent read: the pin stays unresolved and removable, and Read folders again retries. Open as file explicitly attempts the saved path through the guarded file reader without assigning a file kind; folders, symlinks and unsupported entries retain the server refusal. A saved file in a refused large parent still opens. Delete a pinned path or replace it with a symlink/submodule: Unpin stays available. Expand a pinned folder with more than 1,000 children and scroll through its children without an eager header tree. Show hidden exposes saved paths; Show file/folder clears the actual hidden preference, including inherited ancestors. Pins are reachable before parent expansion. Read preferences independently, leave/reopen and switch project/environment: no preference leaks. Exercise pending/error/retry.
6. Put added, modified, deleted, renamed and untracked files beside unchanged files/folders. Changed files show their letter (A, M, R, U) at the right edge in tree/search/pins, and every folder above a changed file that still exists shows a dot; a deleted file shows D only where it is still listed (search for an unstaged deletion, a pinned path) and gives its folders no dot. Unchanged entries show nothing; a Symlink/Submodule/Ignored badge sits beside the mark. Search and Pinned rows keep the filename visible, ellipsized when needed, with the muted folder taking the remaining space and truncating at its head. Exercise both a long filename and a long nested folder together; neither path nor name overlaps the change mark. Plain tree rows also ellipsize long filenames. Accessible Open includes full path, change kind and Reviewed, Unreviewed or Changed since review, distinguishing duplicate leaf names. Opening by any path writes no marks; kind/ignored badges and menus remain.
7. Mark/unmark through Review, then update marks independently while Files stays visible. Mutate reviewed contents: Changed since review. Switch comparison/worktree, reconnect/relaunch: labels agree with independent reads. Pending/unavailable review reads keep navigation, show Reading file review status… or File review status is unavailable. plus Read file review status again, and retain no Reviewed labels.
8. Scroll a deep tree, open a long plain code file, scroll down, return, then reopen it: query, expansion, selected file and tree offset remain, and the reader returns to its reading line. Go back to Worktrees, open another worktree's Files, then return to the first: each workspace retains its own place. While another screen or tab is active, directory/file subscriptions belong only to the visible Files owners. Plain file contents have no Reviewed control; diff review controls remain. Repeat on tablets in landscape and portrait with larger system text; changes to iOS text scaling also need larger Dynamic Type proof.
9. Enter `.env` or a known nested relative path in Search files and use Open path (or submit the field), including an ignored file absent from indexed results. The explicit helper opens directly without requiring a parent listing and respects hidden preferences until Show hidden. Fail its parent read and repeat; the server still guards invalid/missing paths. Search or pin a known text/image path inside a folder with more than 2,000 visible entries. Open it before expanding its parent; the reader still opens when browsing that folder is refused. Follow [Preview](files.preview.md) for content, safety and return-path controls.

Automated coverage: `workspace-selection.spec.ts`, `directory-loading.spec.ts`, `directory-requests.spec.ts`, `file-preferences.spec.ts`, `comparison.spec.ts`, `change-marks.spec.ts`.

## Gotchas

- Files uses Uncommitted marks and native routes on phones and tablets. Review status is in the accessible name only; the row shows one change mark.
- Creation is the header +. Workspace selection happens in the Worktrees tab; Files has no worktree picker of its own.
