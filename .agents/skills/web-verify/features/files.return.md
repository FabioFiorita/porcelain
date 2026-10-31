---
route: /
selectors:
  - 'Files'
  - 'Open documents'
  - 'Code content'
  - 'Open diff'
  - 'Reviewed'
tests:
  - apps/web/spec/integration/files-return.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
---

# files.return

Files is a helper for quick browsing and small changes. Reading a file preserves its place when another document is selected. Reviewing stays an explicit diff action.

## How to get to it

Choose a worktree in the project/worktree sidebar, open Files, then select a plain text or code file. The same file may be opened from a pin or Quick Open. Selecting an already open file focuses its existing document tab.

## Drive and record

1. Add a code file with several hundred numbered lines to the disposable fixture. Open it from Files and confirm its tab is a file document, not a change document.
2. Scroll well below the first screen. Select a source line. Record the visible line, selection and scroll position.
3. Select Changes or a second file tab, then return to the original file tab. Confirm the reading position and source selection return. Repeat after switching worktrees and back.
4. Close/reopen Files or switch its panel mode. Confirm the previous folder expansion, selected file, query and list position return. Repeat at 414 width through the Worktree review sheet. Reopening must not create a duplicate file tab.
5. While reading the plain file, the document toolbar has no Reviewed control. Press R and independently read reviewed-files: opening or reading must not mark the file reviewed.
6. Choose Open diff. Confirm Reviewed is available there; mark it and independently read back the file mark. Return to the file: its reading position remains.
7. Open a known relative path such as config/.env through Quick Open while Files is closed. Git ignore must not prevent explicit guarded access. Paths deliberately hidden in Porcelain follow Show hidden. Missing/unreadable paths show recovery without changing the current workspace.
8. Capture light/dark and keyboard focus/return behavior. Long-path labels retain the full accessible value. Record directory/text requests and compare a warm return to the same fixture, without correctness assertions on wall-clock durations.

Web/desktop renderer behavior is shared. Electron bridge, native phone Back and iPad dock/sheet behavior require their own surface proof. No browser width is native evidence.
