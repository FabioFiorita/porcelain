---
screen: /files
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'Files'
  - 'Select a worktree'
  - 'Select a file'
  - 'Search files'
  - 'Create file or folder'
  - 'New file'
  - 'New folder'
  - 'Rename'
  - 'Move to trash'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - apps/mobile/src/features/files/rules/directory-loading.spec.ts
  - apps/mobile/src/features/files/rules/directory-requests.spec.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/paths
  - POST /api/worktrees/:worktreeId/files
---

# files.files

Expand a folder and its child, then rename or trash the ancestor. Its obsolete directory reads must be removed; the current tree and Refresh must recover without retrying the missing paths.

Files browses the selected worktree through lazily loaded folders. Search matches worktree paths. The native toolbar owns workspace selection, refresh and creation. Without a selection it asks to select a worktree. Phones open files in the native stack. iPads keep the Files screen and open files in closable document tabs beside the directory; a narrow iPad switches between directory and document in place.

Reach Files through its phone tab or porcelain.dev://files. Choose a worktree with projects.workspace-picker. Expand folders, open a file, return with native Back, and search a nested path. Refresh rereads loaded folders. Read errors offer retry. No files appears only after the root directory has a value and is empty; it does not appear below Reading files… while the first root read is pending. A completed search with no matches keeps No files match this view.; a pending search shows no empty result.

On iPad, select a worktree and expect Select a file in the empty document pane. Open two files and switch their document tabs. Opening an already open path activates its existing tab without creating a duplicate; the directory highlights the active file. Close an inactive tab, then the active tab and the last tab, checking the remaining document or Select a file. Resize the same iPad to a narrow window, return to the directory with its Files control, and select the already active file: its document must become visible again without native Back or a filename navigation title. Search and expanded folders survive switching between directory and document. Choose another worktree and expect its empty document state, never the previous worktree's tabs or contents.

During the first folder read (pending with no previous value), its row replaces the chevron with a loading indicator and exposes loading in its accessibility label. The existing rows stay visible without moving until the children arrive. Reading files… appears in the header only for a root read without a value; background rereads and refreshing loaded folders preserve their rows, chevrons and the header height without loading labels. User-initiated Refresh disables the native toolbar refresh icon and relabels it from Refresh files to Refreshing files until the reads settle. Read folders again shows a pending, disabled retry button while retrying, including failures that retain previous data.

The native plus menu beside Refresh is labelled Create file or folder. Its New file and New folder actions open a native sheet to create at the worktree root. A created file opens in a document tab on iPad or a native file route on phone. Search and the selected project/branch caption remain above the file rows. Holding a row offers Rename and Move to trash; folder menus also create inside that folder. Open and dismiss the plus menu, then open each creation sheet and cancel without changing the fixture directory. Create a folder and file, rename the file with its full relative path, and confirm trash. Independently inspect the fixture directory after each operation. Errors keep the sheet open for retry. Trash uses the server's recoverable trash operation.

Earlier phone evidence covers browsing, editing and directory operations against a real server. Document tabs and the current combined layout need a fresh native walkthrough; iPad and Android remain unproved until driven.

See [selected workspace states](projects.workspace-picker.md#selected-workspace-states) for shared loading, failure, availability and recovery behavior.
