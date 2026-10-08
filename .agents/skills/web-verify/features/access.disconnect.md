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
  - GET /api/session
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

`$C start`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`. Once disconnected, Run `$C pairing-link` and navigate this same tab to its fresh one-time link pairs the browser again through a fresh one-time link.

### Setup

None before step 1. Step 5 writes README.md on disk in the middle of the flow (after the editor is open, before the draft is typed).

### Case 1: refused while a draft cannot be saved

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page URL `/<projectId>/<worktreeId>`, Page Title "Changes — repository", button "Review".
2. Click button named `Review`
   Look for: the review sheet opens with tabs "Changes", "Files", "History".
3. Click tab named `Files`
   Look for: tab "Files" selected; treeitem "README.md"; Page URL gains `?surface=files`.
4. Right-click treeitem named `README.md`, then click menuitem named `Open file`
   Look for: a document tab for README.md opens; button "Edit".
5. Click button named `Edit`
   Look for: textbox "README.md" (the file editor) and status "Saves as you pause".
   Then on disk: `printf 'Changed on disk before the browser disconnects\n' > "$REPO/README.md"`
6. Replace the contents of textbox named `README.md` with 'A draft the browser cannot save', then wait for text 'Not saving: changed on disk' to be visible
   Look for (within about 3 s, the autosave wait): status text "Not saving: changed on disk" and an alert "The file changed on disk since you opened it. Reload it before saving. Your draft is kept here." with buttons "Copy draft" and "Reload".
7. Click button named `Toggle Sidebar`, then click button named `Settings`
   Look for: main "Settings", Page URL `/settings/appearance`, Page Title "Settings".
8. Click button named `Connection`
   Look for: Page URL `/settings/connection`; text "This browser"; button "Disconnect this browser".
9. Click button named `Disconnect this browser`
   Look for: an alert inside main "Settings" reading "Save or discard unsaved file drafts before disconnecting."; Page URL stays `/settings/connection`.
   Disk: `cat "$REPO/README.md"` prints `Changed on disk before the browser disconnects`.
   Inspect HTTP requests and responses: exactly one `POST /api/worktrees/<worktreeId>/files` answered 409, and no `DELETE /api/session`.

### Case 2: disconnect ends the session (continues from case 1)

10. Click button named `Back`
    Look for: main "Settings" is gone; the README.md document shows button "Resume edit" (the draft still differs from the saved text).
11. Click button named `Resume edit`, then click button named `Reload`
    Look for: "Not saving: changed on disk" is gone; the editor closes (textbox "README.md" gone), the document shows the disk text "Changed on disk before the browser disconnects" and its button reads "Edit" again.
12. Click button named `Toggle Sidebar`, click button named `Settings`, click button named `Connection`
    Look for: button "Disconnect this browser".
13. Click button named `Disconnect this browser`, then wait for text 'This browser is not paired' to be visible
    Look for: heading "This browser is not paired", the text `porcelain pair "This browser" --address http://127.0.0.1:<port>`, Page URL `/pair`.
14. Navigate to `/` on the card’s web URL (full page load)
    Look for: redirected to Page URL `/pair` with heading "This browser is not paired" again (the session is really gone, not just the page state).
    Inspect HTTP requests and responses must include the requests from each load: immediately after step 13, check `DELETE /api/session` answered 204; after step 14, check `GET /api/session` answered 401.
15. `$C server devices`
    Look for: "Verification browser" still listed: the device stays paired, only this browser's session ended.

## What proves it works

- Refusal: the alert "Save or discard unsaved file drafts before disconnecting.", README.md on disk still holding the outside change, one refused file write (409) and no `DELETE /api/session` in the browser network log.
- Disconnect: heading "This browser is not paired" after the click, and still after Navigate to `/` on the card’s web URL (full page load) (session restoration now answers 401).
- The device staying paired: `$C server devices` still lists "Verification browser" after step 14.
- `apps/web/spec/e2e/access-disconnect.e2e.ts`: (1) the refusal alert shows, the server saw exactly one file write before and after the click, and README.md on disk keeps its outside change; (2) after Back, Resume edit, Reload and Disconnect, the not-paired heading shows and `server.devices()` still contains the browser's label.

## Gotchas

- To go on driving after step 15, Run `$C pairing-link` and navigate this same tab to its fresh one-time link and wait for region named `Review content` to be visible; the server then lists a second "Verification browser" device, since each pairing link pairs a new one.
- The disk write must come after `Edit` has opened the editor and before replacing the field contents; written earlier, the editor opens on the new text and the draft saves fine.
- Navigate to Settings in-app (sidebar or `Alt+Shift+S`), never with Navigate to `/settings/connection` on the card’s web URL (full page load) in case 1: a full page load discards the in-memory draft, so nothing blocks the disconnect.
- `Alt+Shift+S` is ignored while focus is in the file editor; use the sidebar's `Settings` button.
- Phone width: the sidebar is a sheet behind `Toggle Sidebar`; the review panel is a sheet behind `Review`. The `Edit`/`Resume edit` labels are visually hidden below 720 px but keep their accessible names.
