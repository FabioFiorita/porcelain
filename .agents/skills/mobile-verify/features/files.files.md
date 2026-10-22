---
screen: /files
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'Files'
  - 'Select a worktree'
  - 'Choose a document'
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

Files browses and searches the selected worktree, manages entries and preferences, and shows review status.

## Sub-features

- `files.files` — Browse, search, create, rename, trash and preferences.

## How to get to it (user POV)

- Files tab or `porcelain.dev://files`; choose a worktree through [Worktrees](projects.workspace-picker.md).
- Create file or folder; hold a row for file/folder actions.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Choose a worktree, expand a folder/child, open a file, return and search a nested path. Collapse all clears search/closes folders while retaining loaded directories and the open document. Rename/trash the ancestor; current tree/reader recovers without retrying obsolete paths.
2. Without selection expect Select a worktree. Initial root load shows Reading files…, never No files. Only a completed empty root shows No files; completed no-match search shows No files match this view., while pending search shows no empty result. Initial child read announces loading and replaces its chevron without moving existing rows. Background reads retain rows/chevrons/header height.
3. Fail a read: Read folders again retries with a pending disabled button, including when old data remains. Independently change a file/add a directory while visible: updates arrive without refresh.
4. Create file or folder → open/dismiss menu, open New file/New folder sheets and Cancel: no disk change. Create a root folder/file; file opens, folder does not. Hold rows for nested creation, Rename (full relative path) and Move to trash confirmation. Inspect disk after each mutation. Errors keep sheets retryable; trash is recoverable.
5. Hold a file in tree/search/Pinned files → Pin file, Unpin file, Hide file; folders offer Hide folder. Show hidden exposes saved paths; Show file/folder clears the actual hidden preference, including inherited ancestors. Pins are reachable before parent expansion. Read preferences independently, leave/reopen and switch project/environment: no preference leaks. Exercise pending/error/retry.
6. Put reviewed and unreviewed changed files beside unchanged files/folders. Changed rows show Reviewed, Unreviewed or Changed since review in tree/search/pins; unchanged entries have no label. Accessible Open includes full path/status, distinguishing duplicate leaf names. Opening by any path writes no marks; kind/ignored badges and menus remain.
7. Mark/unmark through Review, then update marks independently while Files stays visible. Mutate reviewed contents: Changed since review. Switch comparison/worktree, reconnect/relaunch: labels agree with independent reads. Pending/unavailable review reads keep navigation, show Reading file review status… or File review status is unavailable. plus Read file review status again, and retain no Reviewed labels.
8. For iPad tab/inspector switching, retained search/expansion, worktree sessions and narrow panes follow [workspace](app.workspace.md). Repeat landscape, portrait and larger Dynamic Type.

Automated coverage: `workspace-selection.spec.ts`, `directory-loading.spec.ts`, `directory-requests.spec.ts`, `file-preferences.spec.ts`, `comparison.spec.ts`.

## Gotchas

- Phones use Uncommitted marks and native routes; iPad names its Uncommitted/Branch context and uses central tabs. Only iPad offers Open to the side.
- Phone creation uses its toolbar; iPad's plus menu stays in the inspector body. Workspace selection is in the phone toolbar or iPad left navigator.
