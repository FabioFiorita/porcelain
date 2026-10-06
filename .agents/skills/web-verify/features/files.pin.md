# files.pin

## What it is

Pinning a file lists it under "Pinned" above the file tree. There it opens the file, and its menu offers the same commands as the tree, with "Unpin file" in place of "Pin file". The server keeps the pin for the project until the file is unpinned.

## How a user reaches it

- Review (phone width) → tab Files → right-click a file row → menuitem "Pin file" (files only; folders have no pin).
- Unpin: button "Unpin <path>" on the pinned row, or right-click the pinned row or the tree row → menuitem "Unpin file".

## Driving it

Start with `$C start`. Set `REPO` to the path it prints after `repository`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

Before a page load:

```sh
printf '# Guide\n\nPinned reading\n' > "$REPO/guide.md"
```

### Steps

1. Open `/` on the instance web URL
   Look for: Page Title "Changes — repository".
2. Click the button named 'Review'
   Look for: dialog "Worktree review".
3. Click the tab named 'Files'
   Look for: treeitem "guide.md" in the tree of region "All files", and no region "Pinned files".
4. Right-click the tree item named 'guide.md'
   Look for: menuitem "Pin file".
5. Click the menu item named 'Pin file'
   Look for: region "Pinned files" holding button "guide.md" and button "Unpin guide.md"; the sheet stays open.
6. Right-click the tree item named 'guide.md'
   Look for: menu "guide.md actions" with menuitems "Rename", "Duplicate", "Open diff", "Open file", "Show timeline", "Unpin file", "Hide file", "Copy relative path", "Copy full path", "Move to trash", and no menuitem "Pin file".
7. Press `Escape`
   Look for: the menu is gone; dialog "Worktree review" still shows.
8. Right-click the button named 'guide.md'
   Look for: the same menuitems as step 6, with "Unpin file" and without "Pin file".
9. Press `Escape`
   Look for: the menu is gone.
10. Click the tree item named 'README.md'
    Look for: the dialog is gone and the text "A change to review." shows (README's diff).
11. Click the button named 'Review'
    Look for: dialog "Worktree review" on tab "Files", still showing region "Pinned files".
12. Click the button named 'guide.md'
    Look for: the dialog is gone; Page Title "guide.md — repository"; the text "Pinned reading" shows.
13. Open `/` on the instance web URL, then click the button named 'Review' and click the tab named 'Files'
    Look for: after the full reload, region "Pinned files" still holds button "guide.md" (the server kept the pin).
14. Click the button named 'Unpin guide.md'
    Look for: region "Pinned files" is gone; treeitem "guide.md" remains in the tree.
15. Inspect browser network evidence
    Look for: two `PUT /api/projects/<projectId>/file-preferences` requests with a 2xx status (pin and unpin), and `GET /api/projects/<projectId>/file-preferences` after the reload.

## What proves it works

- The pin survives a full reload (step 13): the region is rebuilt from `GET .../file-preferences`, so the server kept it. A second reload after step 14 shows no region "Pinned files".
- `apps/web/spec/integration/files-pin.test.tsx` runs these steps. It asserts the server's file preferences list `guide.md` as pinned, and that both the tree menu and the pinned row's menu show the eight commands without "Pin file". It asserts the pinned row opens "Pinned reading" after README was opened, and that "Unpin guide.md" removes the region and leaves the server with no pinned path.

## Gotchas

- At phone width the tree lives in the sheet behind button "Review". Pin, unpin and the menus open nothing, so the sheet stays open. Opening a file (steps 10 and 12) closes it.
- Address the pinned row with the exact name "guide.md". A pattern such as `/guide\.md/` also matches button "Unpin guide.md" and fails as ambiguous. The tree row has role treeitem, so it does not collide with role button.
- Pins belong to the project and stay on the server for the life of the instance. Unpin before driving again, or the region is there from the start.
