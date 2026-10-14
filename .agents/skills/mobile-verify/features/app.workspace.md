---
screen: /files
selectors:
  - 'Show inspector'
  - 'Hide inspector'
  - 'Files'
  - 'Review'
  - 'History'
  - 'Open documents'
  - 'Choose a document'
tests:
  - apps/mobile/src/shared/rules/workspace-documents.spec.ts
  - apps/mobile/src/shared/rules/document-tabs.spec.ts
api:
  - GET /api/inventory
---

# app.workspace

On iPad, a selected worktree owns one central document area and a right inspector with Files, Review and History modes. The left sidebar selects worktrees. The document tab strip is the top workspace header, with a native glass worktree-sidebar control before the first tab and an inspector control at the end. These controls and tabs remain visible regardless of inspector mode, active document or narrow-pane visibility. Worktree identity remains in the selected left navigator row. Phones retain their destination tabs and detail routes.

Open a file through Files, a changed file through Review, and a commit and its file diff through History. Expect all documents in the same central tab strip. Opening an existing document activates its tab; closing inactive and active tabs selects the expected remaining document. Changing the inspector mode keeps both open tabs and the active central document. Search and folder expansion remain alive while switching inspector modes. No document selection pushes a native detail route on iPad.

Each review tab retains its original Uncommitted or Branch/base comparison; changing the inspector comparison affects newly opened review documents and preserves the existing tabs. A commit tab retains its selected parent when reopened; each commit diff tab is identified by commit, parent and path. Live file changes still produce stale reviewed marks or No longer changed, using the existing shared readers.

Open Settings, return to the worktree, and confirm its central tabs, active document, inspector mode, comparison and inspector visibility return. Switch to another worktree, open different documents, then return to the first: each worktree restores its own transient session. No contents or writes from the other worktree are offered. Sessions survive navigation in this app process; a cold launch starts a fresh document session.

Hide and show the inspector with the native right control. At wide widths it appears on the right beside the central document; at narrow widths it replaces the visible center in place. Selecting a file, review or commit from the narrow inspector shows its document again. Selecting an existing tab also reveals its content without hiding the persistent tab header. Resizing preserves the tabs and selection. Open and cancel file editing and comments through their existing native sheets; dirty/pending guards still apply, and dismissal returns to the same central selection. Retain independent server readbacks for file writes, marks and comment anchors.

This map describes the implementation; native acceptance requires a fresh iPad walkthrough. Follow the feature maps for server fixtures, unsupported files, stale comments, merge parents, errors and reconnection.

The Files inspector has a native plus menu opened by a single tap; New file and New folder keep the existing sheet and Cancel paths. Routine refresh buttons are absent from the iPad workspace and healthy worktree navigator. Live readers update them; actual errors and unavailable inventories keep their recovery actions. Phones retain native refresh controls. Git controls remain a separate follow-up, with no placeholder in this header.
