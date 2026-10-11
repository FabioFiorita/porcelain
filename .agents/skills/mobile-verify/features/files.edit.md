---
screen: /file-edit
selectors:
  - "File contents"
  - "Save and done"
  - "Discard changes"
tests: []
api:
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/text
  - POST /api/worktrees/:worktreeId/files
---

# files.edit

Edit opens a native full-height form sheet with Porcelain Input and buttons. The shared FileDraft service owns autosave, retained drafts, editing ownership and fingerprint conflict protection. Save and done dismisses only after a confirmed save; Discard changes asks before replacing the draft with the latest file. Removing a screen with an unsaved draft prompts to keep editing or save and leave.

Edit a real file, save, return and independently read its literal disk contents. Change the file on the computer during editing and attempt a save: expect a conflict, retained draft and no overwrite. Discard to read the latest version. A missing fingerprint never exposes editing.

Close a clean editor, change that file on the computer, then reopen Edit. It must display the newly read text and save against its new fingerprint. A retained unsaved or currently owned draft must keep its contents.

The named phone flow asserts the saved bytes through the server fixture. Failed drafts are retained in the running app session; persistence through app termination is not promised by the shared service.
