---
route: /
selectors:
  - "Review"
  - "Files"
  - "Hide file"
  - "Show file"
  - " hidden "
  - "Show"
  - "Hide"
tests:
  - apps/web/spec/integration/projects-hide-file.test.tsx
api:
  - GET /api/projects/:projectId/file-preferences
  - PUT /api/projects/:projectId/file-preferences
---

# projects.hide-file

Hiding a file from the Files tree's context menu takes it out of the tree and the server keeps it hidden for the whole project; a row under All files (`N hidden files · Show`) reveals hidden entries, and `Show file` returns the file for good.

## How to get to it (user POV)

- Workspace → `Review` (phone width; at desktop width the review sidebar stands beside the document) → tab `Files` → right-click a file → `Hide file`. A folder gets `Hide folder`.
- With at least one hidden entry, region "All files" ends with a row naming them (`1 hidden file`, `3 hidden folders`, or `N hidden items` when mixed) and a button `Show`; once clicked it reads `Hide` and the hidden entries reappear in the tree.
- On a revealed hidden entry, right-click → `Show file` (`Show folder`; a file inside a hidden folder offers `Show <folder name>`).
- `Alt+1` goes to the Files surface (the tree itself still needs the `Review` sheet at phone width).

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

 the sample's `README.md` is the file to hide.

### Hide README.md

1. Navigate to `/`
   Expect: title "Changes — repository"; button "Review".
2. Click button `Review`
   Expect: the review sheet (dialog "Worktree review") with tabs "Files", "Changes", "History".
3. Click tab `Files`
   Expect: tab "Files" selected; treeitem "README.md"; no text "1 hidden file".
4. Right-click treeitem `README.md`
   Expect: a context menu with menuitems "Rename", "Duplicate", "Open diff", "Open file", "Show timeline", "Pin file", "Hide file", "Copy relative path", "Copy full path", "Move to trash".
5. Click menuitem `Hide file`
   Expect: treeitem "README.md" is gone; region "All files" ends with "1 hidden file" and button "Show".
6. Inspect HTTP traffic
   Expect: `PUT /api/projects/<projectId>/file-preferences` with status 200.

### The server kept it

7. Navigate to `/`, then click button `Review`, then click tab `Files`
   Expect: still no treeitem "README.md"; "1 hidden file" and button "Show" present (the preference came back from `GET /api/projects/<projectId>/file-preferences`).

### Show it again

8. Click button `Show` in region "All files"
   Expect: the button now reads `Hide`; treeitem "README.md" is back.
9. Right-click treeitem `README.md`
   Expect: menuitem "Show file" where "Hide file" was.
10. Click menuitem `Show file`
    Expect: the hidden row and its button are gone (no hidden entries left); treeitem "README.md" stays.
11. Inspect HTTP traffic
    Expect: a second `PUT /api/projects/<projectId>/file-preferences` with status 200.

### Observable proof

Reload hidden and shown states: "1 hidden file" and absent README, then visible README without the hidden row.

Automated coverage: `projects-hide-file.test.tsx`.

## Gotchas

- Project preferences persist on the server; leave README shown before another map. The hidden row changes with the hidden count.
