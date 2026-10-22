---
route: /
selectors:
  - 'Review'
  - 'Files'
  - 'Open file'
  - 'Edit'
  - 'Not saving: changed on disk'
  - 'Toggle Sidebar'
  - 'Settings'
  - 'Computers'
  - 'Open This computer'
  - 'Disconnect this browser'
  - 'Save or discard unsaved file drafts before disconnecting.'
  - 'Back'
  - 'Resume edit'
  - 'Reload'
  - 'This browser is not paired'
tests:
  - apps/web/spec/e2e/access-disconnect.e2e.ts
api:
  - DELETE /api/session
  - GET /api/session
  - GET /api/inventory
---

# access.disconnect

Settings → Computers → This computer → "Disconnect this browser" ends this browser's session and shows how to pair it again, while the device stays on the server's paired list. It is refused, with the file on disk left alone, while a file draft cannot be saved.

## How to get to it (user POV)

- Sidebar (phone width: `Toggle Sidebar` first) → `Settings` → `Computers` → `Open This computer` → `Disconnect this browser`.
- `Alt+Shift+S` opens Settings (ignored while focus is in a text field or the file editor); then the `Computers` → `Open This computer`.
- Route `/settings/computers/this-computer` opens the section directly (a full page load: it drops unsaved drafts, so do not use it for the refusal case).
- Disconnect this browser is nested in This computer in web mode. The desktop app omits that browser-only action.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

None before step 1. Step 5 writes README.md on disk in the middle of the flow (after the editor is open, before the draft is typed).

### Case 1: refused while a draft cannot be saved

1. Navigate to `/`
   Expect: URL `/<projectId>/<worktreeId>`, title "Changes — repository", button "Review".
2. Click button `Review`
   Expect: the review sheet opens with tabs "Files", "Changes", "History".
3. Click tab `Files`
   Expect: tab "Files" selected; treeitem "README.md"; URL gains `?surface=files`.
4. Right-click treeitem `README.md`, then click menuitem `Open file`
   Expect: a document tab for README.md opens; button "Edit".
5. Click button `Edit`
   Expect: textbox "README.md" (the file editor) and status "Saves as you pause".
   Then on disk: `printf 'Changed on disk before the browser disconnects\n' > "$REPO/README.md"`
6. Fill textbox `README.md` with 'A draft the browser cannot save', then wait for 'Not saving: changed on disk'
   Look for (within about 3 s, the autosave wait): status text "Not saving: changed on disk" and an alert "The file changed on disk since you opened it. Reload it before saving. Your draft is kept here." with buttons "Copy draft" and "Reload".
7. Click button `Toggle Sidebar`, then click button `Settings`
   Expect: main "Settings", URL `/settings/general`, title "Settings".
8. Click button `Computers`, then button named `Open This computer`
   Expect: URL `/settings/computers/this-computer`; text "This browser"; button "Disconnect this browser".
9. Click button `Disconnect this browser`
   Expect: an alert inside main "Settings" reading "Save or discard unsaved file drafts before disconnecting."; URL stays `/settings/computers/this-computer`.
   Disk: `cat "$REPO/README.md"` prints `Changed on disk before the browser disconnects`.
   Inspect HTTP traffic: exactly one `POST /api/worktrees/<worktreeId>/files` answered 409, and no `DELETE /api/session`.

### Case 2: disconnect ends the session (continues from case 1)

10. Click button `Back`
    Expect: main "Settings" is gone; the README.md document shows button "Resume edit" (the draft still differs from the saved text).
11. Click button `Resume edit`, then click button `Reload`
    Expect: "Not saving: changed on disk" is gone; the editor closes (textbox "README.md" gone), the document shows the disk text "Changed on disk before the browser disconnects" and its button reads "Edit" again.
12. Click button `Toggle Sidebar`, click button `Settings`, click button `Computers`, then button named `Open This computer`
    Expect: button "Disconnect this browser".
13. Click button `Disconnect this browser`, then wait for 'This browser is not paired'
    Expect: heading "This browser is not paired", the text `porcelain pair "This browser" --address http://127.0.0.1:<port>`, URL `/pair`.
14. Navigate to `/`
    Expect: redirected to URL `/pair` with heading "This browser is not paired" again (the session is really gone, not just the page state).
    Inspect HTTP traffic must include the requests from each load: immediately after step 13, check `DELETE /api/session` answered 204; after step 14, check `GET /api/session` answered 401.
15. `$C server devices`
    Expect: "Verification browser" still listed: the device stays paired, only this browser's session ended.

### Observable proof

Keep the refused draft/disk text and 409 with zero session DELETEs. After disconnect, reload still shows `/pair`/401 while `$C server devices` retains Verification browser.

Automated coverage: `access-disconnect.e2e.ts`.

## Gotchas

- Write the outside change after Edit opens and before entering the draft. In-app Settings navigation preserves the draft; full navigation discards it and invalidates the refusal proof. Alt+Shift+S is ignored in the editor, so use sidebar Settings.
- Below 720 px Edit/Resume edit are visually hidden but keep their accessible names.
- After disconnect mint/redeem a fresh link in the same tab; each pairing creates another Verification browser device.
