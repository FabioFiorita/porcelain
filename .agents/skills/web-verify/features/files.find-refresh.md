# files.find-refresh

## What it is

When the open file changes on disk while the find bar is open, the file view shows the new text and the match count is recomputed on it, never naming a match past the new last one.

## How a user reaches it

- Review → Files → right-click a changed file → Open file → `Mod+F` (`SHORTCUTS.findInFile`), while another writer changes the file on disk.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. `$REPO` is the path `start` prints after `repository`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

```sh
printf 'needle one\nneedle two\nneedle three\n' > "$REPO/notes.txt"
```

A second write happens between steps 4 and 5.

1. Open `/` on the instance web URL, click the button named 'Review', click the tab named 'Files'
   Look for: treeitem "notes.txt".
2. Right-click the tree item named 'notes.txt', then click the menu item named 'Open file'
   Look for: tab "notes.txt Close notes.txt" selected; the code shows "needle one", "needle two", "needle three".
3. Press `Mod+F`, then set the text field named 'Find in file' to 'needle'
   Look for: status "1 of 3".
4. Press `Enter`, then press `Enter`
   Look for: status "2 of 3" after the first, "3 of 3" after the second.
5. On disk: `printf 'needle only\n' > "$REPO/notes.txt"`, then inspect the current page
   Look for: the code shows "needle only" and no longer "needle three"; textbox "Find in file" still holds "needle"; status "1 of 1" (not "3 of 1").
6. Inspect browser network evidence
   Look for: a second `GET /api/worktrees/<id>/text?path=notes.txt` answered 200 after the disk write.

## What proves it works

- Step 5: the view picked up the disk change without a reload and the status clamped to "1 of 1"; step 6 shows the refetch the live update triggered.
- `apps/web/spec/integration/files-find-refresh.test.tsx`: after two `Enter` presses the status reads "3 of 3"; after the file is rewritten to one line, "needle only" shows and the status reads "1 of 1".

## Gotchas

- The new text arrives through the server's file watcher and a live update; give it a moment and inspect the current page again if it still shows the old lines.
- Keep focus in "Find in file" after typing, which is where `Enter` must land to step; `Enter` anywhere else does not step.
- A single click on `notes.txt` (untracked, so a change) opens its diff, not the file; use the tree menu's "Open file".
- At a narrow browser viewport, the tree lives in the sheet behind "Review", which closes when the file opens. At this width the "Changed on disk just now" note in the file header is hidden (it shows from the `xl` breakpoint up, for `FILE_DISK_CHANGE_NOTICE_MS` = 8000 ms).
