---
route: /
selectors:
  - "Review"
  - "Worktree review"
  - "Files"
  - "Pin file"
  - "Unpin file"
  - "Unpin"
  - "Pinned files"
tests:
  - apps/web/spec/integration/files-pin.test.tsx
api:
  - GET /api/projects/:projectId/file-preferences
  - PUT /api/projects/:projectId/file-preferences
---

# files.pin

Pinning a file or folder lists it under "Pinned" above the file tree; the plain section heading shows the count; sections stay visible and individual folders expand and collapse. There it opens the file, and its menu offers the same commands as the tree, with "Unpin file" in place of "Pin file". The server keeps the pin for the project until the file is unpinned.

## How to get to it (user POV)

- Review (phone width) → tab Files → right-click a file row → menuitem "Pin file" or a folder row → menuitem "Pin folder".
- Unpin: button "Unpin <path>" on the pinned row, or right-click the pinned row or the tree row → menuitem "Unpin file".

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

Before a full page load:

```sh
printf '# Guide\n\nPinned reading\n' > "$REPO/guide.md"
```

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Review`
   Expect: dialog "Worktree review".
3. Click tab `Files`
   Expect: treeitem "guide.md" in the tree of region "All files", and no region "Pinned files".
4. Right-click treeitem `guide.md`
   Expect: menuitem "Pin file".
5. Click menuitem `Pin file`
   Expect: region "Pinned files" holding button "guide.md" and button "Unpin guide.md"; the sheet stays open.
6. Right-click treeitem `guide.md`
   Expect: menu "guide.md actions" with menuitems "Rename", "Duplicate", "Open diff", "Open file", "Show timeline", "Unpin file", "Hide file", "Copy relative path", "Copy full path", "Move to trash", and no menuitem "Pin file".
7. Press `Escape`
   Expect: the menu is gone; dialog "Worktree review" still shows.
8. Right-click button `guide.md`
   Expect: the same menuitems as step 6, with "Unpin file" and without "Pin file".
9. Press `Escape`
   Expect: the menu is gone.
10. Click treeitem `README.md`
    Expect: the dialog is gone and the text "A change to review." shows (README's file document).
11. Click button `Review`
    Expect: dialog "Worktree review" on tab "Files", still showing region "Pinned files".
12. Click button `guide.md`
    Expect: the dialog is gone; title "guide.md — repository"; the text "Pinned reading" shows.
13. Navigate to `/`, then click button `Review` and click tab `Files`
    Expect: after the full reload, region "Pinned files" still holds button "guide.md" (the server kept the pin).
14. Click button `Unpin guide.md`
    Expect: region "Pinned files" is gone; treeitem "guide.md" remains in the tree.
15. Inspect HTTP traffic
    Expect: two `PUT /api/projects/<projectId>/file-preferences` requests with a 2xx status (pin and unpin), and `GET /api/projects/<projectId>/file-preferences` after the reload.

### Observable proof

Reload with pin: Pinned files remains. Unpin and reload: region is absent; read server preferences independently.

Automated coverage: `files-pin.test.tsx`.

## Gotchas

Pin, unpin and the menus open nothing, so the sheet stays open. Opening a file (steps 10 and 12) closes it.
- Address the pinned row with the exact name "guide.md". A pattern such as `/guide\.md/` also matches button "Unpin guide.md" and fails as ambiguous. The tree row has role treeitem, so it does not collide with role button.
- Pins belong to the project and stay on the server for the life of the instance. Unpin before driving again, or the region is there from the start.

## Pinned folders and unavailable entries

1. Pin an unopened folder with two child files. Its Pinned folder row has a chevron and `aria-expanded=false`, and no directory read for that folder occurs. Click it once: a bounded Pierre subtree appears, loads that folder, and opens a child as a file document.
2. Return to Files: the pin stays expanded. Close its row: its subtree unmounts. Unpin removes the row and updates server preferences.
3. Hide a pinned file or ancestor folder: its Pinned row disappears. Files → Show restores it.
4. Pins resolve against actual parent directory listings. Loading, Missing and Unavailable entries cannot open a guessed file; Unavailable has Try again, and every row retains its Unpin button. Symlinks and submodules are not followed.
