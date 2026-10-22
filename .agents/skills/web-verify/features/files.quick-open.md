---
route: /
selectors:
  - "Review"
  - "Worktree review"
  - "Files"
  - "Find a file by name"
  - "No file matches that name."
tests:
  - apps/web/spec/integration/files-quick-open.test.tsx
api:
  - GET /api/worktrees/:worktreeId/paths
  - GET /api/worktrees/:worktreeId/text
---

# files.quick-open

Quick open searches every worktree file name and opens the one chosen. Files an ignore rule hides are never offered.

## How to get to it (user POV)

- `Mod+P` (`ControlOrMeta+p` with the browser driver) while the Files tree is mounted: at phone width, Review → tab Files first. It opens the command dialog "Find a file" with combobox "Find a file by name".
- Pressing `Mod+P` again closes it.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

Before a full page load (the name list is read when the Files tab mounts):

```sh
printf '# Quick target\n' > "$REPO/quick-target.md"
printf 'build.log\n' > "$REPO/.gitignore"
printf 'ignored output\n' > "$REPO/build.log"
```

### 1. Find a file by name and open it

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Review`
   Expect: dialog "Worktree review".
3. Click tab `Files`
   Expect: treeitem "README.md" in the tree of region "All files".
4. Press `ControlOrMeta+p`
   Expect: dialog "Find a file" with combobox "Find a file by name" and options listing the worktree files (`.gitignore`, `README.md`, `quick-target.md`).
5. Replace the contents of combobox named `Find a file by name` with 'quick'
   Expect: exactly one option, "quick-target.md".
6. Click option named `quick-target.md`
   Expect: both dialogs are gone; heading "Quick target" (the rendered Markdown) and heading "quick-target.md" [level=1]; title "quick-target.md — repository".

### 2. An ignored file is not offered

7. Click button `Review`
   Expect: dialog "Worktree review" on tab "Files".
8. Press `ControlOrMeta+p`
   Expect: combobox "Find a file by name", empty.
9. Replace the contents of combobox named `Find a file by name` with 'build.log'
   Expect: the text "No file matches that name." and no option. The tree behind still lists `build.log` (marked ignored); only quick open leaves it out.
10. Press `Escape`
    Expect: dialog "Find a file" is gone.
11. Inspect HTTP traffic
    Expect: `GET /api/worktrees/<worktreeId>/paths` and `GET /api/worktrees/<worktreeId>/text?path=quick-target.md`, both 200.

### Observable proof

Open result content through text GET; server path list excludes ignored build.log.

Automated coverage: `files-quick-open.test.tsx`.

## Gotchas

- `Mod+P` is registered by the Files tree. At phone width it does nothing until the sheet "Worktree review" is open on tab Files. With the sheet closed, Chromium's own Ctrl+P is not intercepted either.
- The name list is fetched once when the Files tab mounts. Write setup files before step 3, or reopen with a full reload of `/` after writing them.
- While the list loads the dialog shows "Reading file names…". Wait for options before filling.
- The match is a case-insensitive substring of the whole path, capped at 50 results.
