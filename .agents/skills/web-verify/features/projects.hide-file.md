# projects.hide-file

## What it is

Hiding a file from the Files tree's context menu takes it out of the tree and the server keeps it hidden for the whole project; an eye button (`Hidden (N)`) reveals hidden entries, and `Show file` returns the file for good.

## How a user reaches it

- Workspace → `Review` (phone width; at desktop width the review sidebar stands beside the document) → tab `Files` → right-click a file → `Hide file`. A folder gets `Hide folder`.
- With at least one hidden entry, the Files toolbar shows the toggle button `Hidden (N)`; pressed, it is named `Showing hidden` and the hidden entries reappear in the tree.
- On a revealed hidden entry, right-click → `Show file` (`Show folder`; a file inside a hidden folder offers `Show <folder name>`).
- `Alt+2` goes to the Files surface (the tree itself still needs the `Review` sheet at phone width).

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (web mode).
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

None: the sample's `README.md` is the file to hide.

### Hide README.md

1. Open `/` on the instance web URL
   Look for: Page Title "Changes — repository"; button "Review".
2. Click the button named 'Review'
   Look for: the review sheet (dialog "Worktree review") with tabs "Changes", "Files", "History".
3. Click the tab named 'Files'
   Look for: tab "Files" selected; treeitem "README.md"; no button "Hidden (1)".
4. Right-click the tree item named 'README.md'
   Look for: a context menu with menuitems "Rename", "Duplicate", "Open diff", "Open file", "Show timeline", "Pin file", "Hide file", "Copy relative path", "Copy full path", "Move to trash".
5. Click the menu item named 'Hide file'
   Look for: treeitem "README.md" is gone; button "Hidden (1)" appears beside textbox "Search files".
6. Inspect browser network evidence
   Look for: `PUT /api/projects/<projectId>/file-preferences` with status 200.

### The server kept it

7. Open `/` on the instance web URL, then click the button named 'Review', then click the tab named 'Files'
   Look for: still no treeitem "README.md"; button "Hidden (1)" present (the preference came back from `GET /api/projects/<projectId>/file-preferences`).

### Show it again

8. Click the button named 'Hidden (1)'
   Look for: the button is now named "Showing hidden" (pressed); treeitem "README.md" is back.
9. Right-click the tree item named 'README.md'
   Look for: menuitem "Show file" where "Hide file" was.
10. Click the menu item named 'Show file'
    Look for: button "Showing hidden" is gone (no hidden entries left, so no toggle at all); treeitem "README.md" stays.
11. Inspect browser network evidence
    Look for: a second `PUT /api/projects/<projectId>/file-preferences` with status 200.

## What proves it works

- End state: after step 7 a full reload still hides README.md and shows `Hidden (1)`; after step 10 the tree shows README.md with no hidden toggle, and a reload keeps it that way.
- `apps/web/spec/integration/projects-hide-file.test.tsx`: hiding removes the treeitem, shows `Hidden (1)` and the server's file preferences list README.md as hidden; revealing with `Hidden (1)` and choosing `Show file` removes the `Showing hidden` button and the server no longer lists it hidden (read through `server.filePreferences()`).

## Gotchas

- Phone width: the Files tree lives in the `Review` sheet; there is no review sidebar beside the document below the `xl` breakpoint.
- The preference belongs to the project and persists on the server: leave README.md shown (step 10) before driving other features in the same instance, or later Files steps will not find it.
- `Hidden (1)` is built from the count (`Hidden (${hidden.size})`): with two hidden entries it reads `Hidden (2)`.
