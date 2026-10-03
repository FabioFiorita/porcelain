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

## What it is

Saving an edit to a file that changed on disk since the editor opened is refused by the server (409 `content_changed`): the editor says so, keeps the draft, disables Done, and the disk keeps the other writer's text.

## How a user reaches it

- Review → Files → right-click a changed file → Open file → Edit, while another writer (an agent, a shell) changes the file on disk, then any save: Done, `Mod+S`, the 3 second autosave, closing the tab, or leaving the editor.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. `$REPO` is the path `start` prints after `repository`.

### Setup

None before driving; the disk write happens between steps 6 and 7.

1. `$C open /`
   Look for: Page Title "Changes — repository".
2. `$C click --role button --name "Review"`
   Look for: dialog "Worktree review" with tab "Files".
3. `$C click --role tab --name "Files"`
   Look for: treeitem "README.md".
4. `$C click --role treeitem --name "README.md" --button right`
   Look for: menuitem "Open file".
5. `$C click --role menuitem --name "Open file"`
   Look for: tab "README.md Close README.md" selected; button "Edit".
6. `$C click --role button --name "Edit"`
   Look for: textbox "README.md"; status "Saves as you pause".
7. On disk: `printf 'Changed on disk while the browser edits\n' > "$REPO/README.md"`
   Look for: nothing changes in the editor (an open editor never takes the disk text).
8. `$C fill --role textbox --name "README.md" "Browser edit made before the disk changed"`
   Look for: status "Unsaved changes".
9. `$C click --role button --name "Done"`
   Look for: alert "The file changed on disk since you opened it. Reload it before saving. Your draft is kept here." with buttons "Copy draft" and "Reload" (no "Retry save"); status "Not saving: changed on disk"; button "Done" disabled; textbox "README.md" still holds "Browser edit made before the disk changed".
   Disk: `cat "$REPO/README.md"` prints `Changed on disk while the browser edits`.
10. `$C network`
    Look for: exactly one `POST /api/worktrees/<id>/files` and it answered 409.
11. `$C click --role button --name "Reload"`
    Look for: the editor closes; button "Edit" is back; the Reader shows the paragraph "Changed on disk while the browser edits".

## What proves it works

- Step 9's alert, disabled Done and status, together with the disk still holding the shell's text, and step 10's single 409 write: the server refused the stale write and nothing was overwritten.
- `apps/web/spec/integration/files-edit-conflict.test.tsx`: after the disk changes under an open editor, Done shows the alert text "The file changed on disk since you opened it.", the status "Not saving: changed on disk" and a disabled Done; `server.fileWriteCount()` is 1 and `server.text()` is still the disk text.

## Gotchas

- The disk write must land after Edit (step 6) and before the save; written before Edit, the editor starts from the new text and the save succeeds.
- Once refused, no later save sends a request (Done stays disabled, `Mod+S` and autosave do nothing) until Reload; only one POST appears in the network log.
- The CLI browser is 414 px wide: the tree lives in the sheet behind "Review", which closes when the file opens.
- The tab strip persists per worktree in localStorage across `open /`; leftovers from an earlier feature can make "Edit" or the tab names ambiguous. `$C stop` and `$C start` for a clean instance.
- The step 7 write replaces the sample `README.md` for later features; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
