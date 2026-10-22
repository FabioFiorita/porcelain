---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Edit"
  - "Done"
  - "Not saving: changed on disk"
  - "Copy draft"
  - "Reload"
tests:
  - apps/web/spec/integration/files-edit-conflict.test.tsx
api:
  - POST /api/worktrees/:worktreeId/files
---

# files.edit-conflict

Saving an edit to a file that changed on disk since the editor opened is refused by the server (409 `content_changed`): the editor says so, keeps the draft, disables Done, and the disk keeps the other writer's text.

## How to get to it (user POV)

- Review → Files → right-click a changed file → Open file → Edit, while another writer (an agent, a shell) changes the file on disk, then any save: Done, `Mod+S`, the 3 second autosave, closing the tab, or leaving the editor.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

None before driving; the disk write happens between steps 6 and 7.

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Review`
   Expect: dialog "Worktree review" with tab "Files".
3. Click tab `Files`
   Expect: treeitem "README.md".
4. Right-click treeitem `README.md`
   Expect: menuitem "Open file".
5. Click menuitem `Open file`
   Expect: tab "README.md" selected; button "Edit".
6. Click button `Edit`
   Expect: textbox "README.md"; status "Saves as you pause".
7. On disk: `printf 'Changed on disk while the browser edits\n' > "$REPO/README.md"`
   Expect: nothing changes in the editor (an open editor never takes the disk text).
8. Fill textbox `README.md` with 'Browser edit made before the disk changed'
   Expect: status "Unsaved changes".
9. Click button `Done`
   Expect: alert "The file changed on disk since you opened it. Reload it before saving. Your draft is kept here." with buttons "Copy draft" and "Reload" (no "Retry save"); status "Not saving: changed on disk"; button "Done" disabled; textbox "README.md" still holds "Browser edit made before the disk changed".
   Disk: `cat "$REPO/README.md"` prints `Changed on disk while the browser edits`.
10. Inspect HTTP traffic
    Expect: exactly one `POST /api/worktrees/<id>/files` and it answered 409.
11. Click button `Reload`
    Expect: the editor closes; button "Edit" is back; the Reader shows the paragraph "Changed on disk while the browser edits".

### Observable proof

Record the alert/disabled Done, one 409 write and disk retaining the outside text.

Automated coverage: `files-edit-conflict.test.tsx`.

## Gotchas

- Write disk after Edit and before save; earlier writes become the editor baseline. After refusal, Done/Mod+S/autosave send no more requests until Reload; record exactly one POST.
- Persisted tabs can make controls ambiguous. Reset the layout/instance, and restore README after the run.
