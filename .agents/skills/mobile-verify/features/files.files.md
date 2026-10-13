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

Expand a folder and its child, then rename or trash the ancestor. Its obsolete directory reads must be removed; the current tree and live reader must recover without retrying the missing paths.

Files browses the selected worktree through lazily loaded folders. Search matches worktree paths. The phone toolbar owns workspace selection, refresh and creation. On iPad, the left worktree navigator owns selection; the single-tap native plus menu stays in the Files inspector body, and routine Refresh is removed. Without a selection it asks to select a worktree. Phones open files in the native stack. iPads open files in the single central workspace tab strip. Files is a right inspector mode; a narrow iPad switches between inspector and central document in place.

Reach Files through its phone tab or porcelain.dev://files. Choose a worktree with projects.workspace-picker. Expand folders, open a file, return with native Back, and search a nested path. On phones, Refresh rereads loaded folders; iPad relies on live updates and keeps Read folders again for errors. Read errors offer retry. No files appears only after the root directory has a value and is empty; it does not appear below Reading files… while the first root read is pending. A completed search with no matches keeps No files match this view.; a pending search shows no empty result.

On iPad, choose a worktree from the left navigator. Open two files, switch and close document tabs, then change the right inspector to Review and History: the file tabs and active document stay in the same central area. Reopening a path activates its existing tab. Search and expanded folders survive inspector mode switches. Hide/show the inspector, narrow the window, and select the current file again to show central content without native Back. Visit Settings and return; switch to a second worktree and back. Each worktree restores its own central tabs and active document. See [app.workspace](app.workspace.md) for the combined session promise.

During the first folder read (pending with no previous value), its row replaces the chevron with a loading indicator and exposes loading in its accessibility label. The existing rows stay visible without moving until the children arrive. Reading files… appears in the header only for a root read without a value; background rereads and refreshing loaded folders preserve their rows, chevrons and the header height without loading labels. On phones, user-initiated Refresh disables the native toolbar refresh icon and relabels it from Refresh files to Refreshing files until the reads settle. Read folders again shows a pending, disabled retry button while retrying, including failures that retain previous data.

The phone native plus menu beside Refresh and the iPad Files inspector menu are labelled Create file or folder. Its New file and New folder actions open a native sheet to create at the worktree root. A created file opens in a document tab on iPad or a native file route on phone. Search remains above file rows. The phone retains its selected project/branch caption; the iPad worktree navigator identifies the selected project/branch. Holding a row offers Rename and Move to trash; folder menus also create inside that folder. Open and dismiss the plus menu, then open each creation sheet and cancel without changing the fixture directory. Create a folder and file, rename the file with its full relative path, and confirm trash. Independently inspect the fixture directory after each operation. Errors keep the sheet open for retry. Trash uses the server's recoverable trash operation.

Earlier phone evidence covers browsing, editing and directory operations against a real server. Document tabs and the current combined layout need a fresh native walkthrough; iPad and Android remain unproved until driven.

See [selected workspace states](projects.workspace-picker.md#selected-workspace-states) for shared loading, failure, availability and recovery behavior.
