# reviews.mark-file

## What it is

A changed file's reviewed control in its diff header marks it reviewed at its current fingerprint and unmarks it again; the control's name flips and the server keeps each change.

## How a user reaches it

- In any diff header (Changes document, a single change tab, a layer step): button "Mark README.md as reviewed" → "Unmark README.md as unreviewed"; a file changed since it was marked shows "Mark changed README.md as reviewed".
- Shortcut `R` (listed as "Toggle reviewed" in the shortcuts dialog, `Mod+/`): toggles the focused entry of the active code document. It is ignored while focus is in a text field. `J` / `K` move the focused entry.
- The review sidebar's changed-file row (button "README.md · unstaged") offers it on right-click: menuitem "Mark as reviewed" / "Unmark as reviewed" (see `reviews.changed-file-menu`).

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. No setup: the sample repository's modified README.md is the changed file.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

1. Open `/` on the instance web URL
   Look for: region "Review content", heading "Changes", button "Mark README.md as reviewed".
2. Click the button named 'Mark README.md as reviewed'
   Look for: button "Unmark README.md as unreviewed" [pressed]; the toolbar's mark-all button now reads "Unmark all". `$C server reviewed-files` lists README.md in `marks`.
3. Click the button named 'Unmark README.md as unreviewed'
   Look for: button "Mark README.md as reviewed" enabled; toolbar button "Mark all 1 files reviewed". `$C server reviewed-files` shows `"marks": []`.
4. Press `r`
   Look for: button "Unmark README.md as unreviewed" (the shortcut marked the focused, first entry).
5. Press `r`
   Look for: button "Mark README.md as reviewed" again.

## What proves it works

- The control flips in steps 2 to 5 and browser network evidence shows `PUT /api/worktrees/<id>/reviewed` (mark) and `DELETE /api/worktrees/<id>/reviewed?...` (unmark), each 200.
- Persistence: `$C server reviewed-files` reads the mark after steps 2 and 4 and none after 3 and 5; open `/` on the instance web URL after step 2 or 4 still shows "Unmark README.md as unreviewed".
- `apps/web/spec/integration/reviews-mark-file.test.tsx`: clicking "Mark README.md as reviewed" yields an enabled "Unmark README.md as unreviewed" and `server.reviewedFiles()` lists README.md; unmarking removes it.

## Gotchas

- Pressing `r` must reach the page, not a text field: after typing or with a comment composer open, press `Escape` first. Press lowercase `r`; `Shift+R` adds a modifier and does not match.
- `R` acts only in the active document of the focused pane, on the focused entry (the first one until `J`/`K`, a line click or a header toggle moves it).
- The button is disabled while its request is pending; inspect the page again if it still shows a spinner.
- Marks persist on the server; leave README.md unmarked for the next feature.
- Right after `start` or loading `/`, the diff loads after the toolbar; wait for the button to appear before clicking it in step 2.
