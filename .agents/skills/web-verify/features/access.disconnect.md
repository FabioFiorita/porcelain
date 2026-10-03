---
route: /
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Edit"
  - "Not saving: changed on disk"
  - "Toggle Sidebar"
  - "Settings"
  - "Connection"
  - "Disconnect this browser"
  - "Save or discard unsaved file drafts before disconnecting."
  - "Back"
  - "Resume edit"
  - "Reload"
  - "This browser is not paired"
tests:
  - apps/web/spec/e2e/access-disconnect.e2e.ts
api:
  - DELETE /api/session
  - GET /api/inventory
---

# access.disconnect

## What it is

Settings → Connection → "Disconnect this browser" ends this browser's session and shows how to pair it again, while the device stays on the server's paired list. It is refused, with the file on disk left alone, while a file draft cannot be saved.

## How a user reaches it

- Sidebar (phone width: `Toggle Sidebar` first) → `Settings` → `Connection` section → `Disconnect this browser`.
- `Alt+Shift+S` opens Settings (ignored while focus is in a text field or the file editor); then the `Connection` section.
- Route `/settings/connection` opens the section directly (a full page load: it drops unsaved drafts, so do not use it for the refusal case).
- Settings section `Connection` exists in both web and desktop modes.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`, then `REPO=<the repository path start printed>`. Once disconnected, `$C pair` pairs the browser again through a fresh one-time link.

### Setup

None before step 1. Step 5 writes README.md on disk in the middle of the flow (after the editor is open, before the draft is typed).

### Case 1: refused while a draft cannot be saved

1. `$C open /`
   Look for: Page URL `/<projectId>/<worktreeId>`, Page Title "Changes — repository", button "Review".
2. `$C click --role button --name "Review"`
   Look for: the review sheet opens with tabs "Changes", "Files", "History".
3. `$C click --role tab --name "Files"`
   Look for: tab "Files" selected; treeitem "README.md"; Page URL gains `?surface=files`.
4. `$C click --role treeitem --name "README.md" --button right`, then `$C click --role menuitem --name "Open file"`
   Look for: a document tab for README.md opens; button "Edit".
5. `$C click --role button --name "Edit"`
   Look for: textbox "README.md" (the file editor) and status "Saves as you pause".
   Then on disk: `printf 'Changed on disk before the browser disconnects\n' > "$REPO/README.md"`
6. `$C fill --role textbox --name "README.md" "A draft the browser cannot save"`, then `$C wait --text "Not saving: changed on disk"`
   Look for (within about 3 s, the autosave wait): status text "Not saving: changed on disk" and an alert "The file changed on disk since you opened it. Reload it before saving. Your draft is kept here." with buttons "Copy draft" and "Reload".
7. `$C click --role button --name "Toggle Sidebar"`, then `$C click --role button --name "Settings"`
   Look for: main "Settings", Page URL `/settings/appearance`, Page Title "Settings".
8. `$C click --role button --name "Connection"`
   Look for: Page URL `/settings/connection`; text "This browser"; button "Disconnect this browser".
9. `$C click --role button --name "Disconnect this browser"`
   Look for: an alert inside main "Settings" reading "Save or discard unsaved file drafts before disconnecting."; Page URL stays `/settings/connection`.
   Disk: `cat "$REPO/README.md"` prints `Changed on disk before the browser disconnects`.
   `$C network`: exactly one `POST /api/worktrees/<worktreeId>/files` answered 409, and no `DELETE /api/session`.

### Case 2: disconnect ends the session (continues from case 1)

10. `$C click --role button --name "Back"`
    Look for: main "Settings" is gone; the README.md document shows button "Resume edit" (the draft still differs from the saved text).
11. `$C click --role button --name "Resume edit"`, then `$C click --role button --name "Reload"`
    Look for: "Not saving: changed on disk" is gone; the editor closes (textbox "README.md" gone), the document shows the disk text "Changed on disk before the browser disconnects" and its button reads "Edit" again.
12. `$C click --role button --name "Toggle Sidebar"`, `$C click --role button --name "Settings"`, `$C click --role button --name "Connection"`
    Look for: button "Disconnect this browser".
13. `$C click --role button --name "Disconnect this browser"`, then `$C wait --text "This browser is not paired"`
    Look for: heading "This browser is not paired", the text `porcelain pair "This browser" --address http://127.0.0.1:<port>`, Page URL `/pair`.
14. `$C open /`
    Look for: redirected to Page URL `/pair` with heading "This browser is not paired" again (the session is really gone, not just the page state).
    `$C network` lists only the requests since the last page load: run right after step 13 it shows `DELETE /api/session` answered 204; run after step 14 it shows `GET /api/inventory` answered 401.
15. `$C server devices`
    Look for: "Verification browser" still listed: the device stays paired, only this browser's session ended.

## What proves it works

- Refusal: the alert "Save or discard unsaved file drafts before disconnecting.", README.md on disk still holding the outside change, one refused file write (409) and no `DELETE /api/session` in `$C network`.
- Disconnect: heading "This browser is not paired" after the click, and still after `$C open /` (inventory now answers 401).
- The device staying paired: `$C server devices` still lists "Verification browser" after step 14.
- `apps/web/spec/e2e/access-disconnect.e2e.ts`: (1) the refusal alert shows, the server saw exactly one file write before and after the click, and README.md on disk keeps its outside change; (2) after Back, Resume edit, Reload and Disconnect, the not-paired heading shows and `server.devices()` still contains the browser's label.

## Gotchas

- To go on driving after step 15, `$C pair` and `$C wait --role region --name "Review content"`; the server then lists a second "Verification browser" device, since each pairing link pairs a new one.
- The disk write must come after `Edit` has opened the editor and before `fill`; written earlier, the editor opens on the new text and the draft saves fine.
- Navigate to Settings in-app (sidebar or `Alt+Shift+S`), never with `$C open /settings/connection` in case 1: a full page load discards the in-memory draft, so nothing blocks the disconnect.
- `Alt+Shift+S` is ignored while focus is in the file editor; use the sidebar's `Settings` button.
- Phone width: the sidebar is a sheet behind `Toggle Sidebar`; the review panel is a sheet behind `Review`. The `Edit`/`Resume edit` labels are visually hidden below 720 px but keep their accessible names.
