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

## What it is

Quick open searches every worktree file name and opens the one chosen. Files an ignore rule hides are never offered.

## How a user reaches it

- `Mod+P` (`ControlOrMeta+p` with the browser driver) while the Files tree is mounted: at phone width, Review → tab Files first. It opens the command dialog "Find a file" with combobox "Find a file by name".
- Pressing `Mod+P` again closes it.

## Driving it

Start with `$C start`; pair your browser using the card’s pairing-link command. Set `REPO` to `fixtures.repositoryPath` in the card’s `connection.json`.

### Setup

Before a full page load (the name list is read when the Files tab mounts):

```sh
printf '# Quick target\n' > "$REPO/quick-target.md"
printf 'build.log\n' > "$REPO/.gitignore"
printf 'ignored output\n' > "$REPO/build.log"
```

### 1. Find a file by name and open it

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Changes — repository".
2. Click button named `Review`
   Look for: dialog "Worktree review".
3. Click tab named `Files`
   Look for: treeitem "README.md" in the tree of region "All files".
4. Press `ControlOrMeta+p`
   Look for: dialog "Find a file" with combobox "Find a file by name" and options listing the worktree files (`.gitignore`, `README.md`, `quick-target.md`).
5. Replace the contents of combobox named `Find a file by name` with 'quick'
   Look for: exactly one option, "quick-target.md".
6. Click option named `quick-target.md`
   Look for: both dialogs are gone; heading "Quick target" (the rendered Markdown) and heading "quick-target.md" [level=1]; Page Title "quick-target.md — repository".

### 2. An ignored file is not offered

7. Click button named `Review`
   Look for: dialog "Worktree review" on tab "Files".
8. Press `ControlOrMeta+p`
   Look for: combobox "Find a file by name", empty.
9. Replace the contents of combobox named `Find a file by name` with 'build.log'
   Look for: the text "No file matches that name." and no option. The tree behind still lists `build.log` (marked ignored); only quick open leaves it out.
10. Press `Escape`
    Look for: dialog "Find a file" is gone.
11. Inspect HTTP requests and responses
    Look for: `GET /api/worktrees/<worktreeId>/paths` and `GET /api/worktrees/<worktreeId>/text?path=quick-target.md`, both 200.

## What proves it works

- Step 6 opens the file's content, which the server reads through `GET .../text`. Step 9 shows the server's path list leaves out the ignored `build.log`.
- `apps/web/spec/integration/files-quick-open.test.tsx` opens Review → Files and presses `ControlOrMeta+p`. It asserts that choosing "quick-target.md" shows heading "Quick target" and that the server's paths include it. For `build.log` it asserts "No file matches that name." and that the server's paths exclude it.

## Gotchas

- `Mod+P` is registered by the Files tree. At phone width it does nothing until the sheet "Worktree review" is open on tab Files. With the sheet closed, Chromium's own Ctrl+P is not intercepted either.
- The name list is fetched once when the Files tab mounts. Write setup files before step 3, or reopen with a full reload of `/` after writing them.
- While the list loads the dialog shows "Reading file names…". Wait for options before filling.
- The match is a case-insensitive substring of the whole path, capped at 50 results.
