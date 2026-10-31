---
route: /
selectors:
  - 'Review'
  - 'Worktree review'
  - 'Files'
  - 'Find a file by name'
  - 'No file matches that name.'
tests:
  - apps/web/spec/integration/files-quick-open.test.tsx
api:
  - GET /api/worktrees/:worktreeId/paths
  - GET /api/worktrees/:worktreeId/text
---

# files.quick-open

Quick open searches eligible worktree file names and opens the chosen file document. Ignore rules keep files out of name results. Entering an explicit relative path, such as `config/.env`, offers `Open path config/.env` without scanning ignored folders; the existing server path guards still decide whether it can be read. Project-hidden paths stay out until Files → Show is enabled.

## How to get to it (user POV)

- `Mod+P` (`ControlOrMeta+p` with the browser driver) while reading the worktree, including with the Files panel closed. It opens the command dialog "Find a file" with combobox "Find a file by name".
- Pressing `Mod+P` again closes it.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

Before a full page load:

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
   Expect: dialog "Find a file" with combobox "Find a file by name". With no open file tabs or pinned files, it prompts "Type a file name or relative path.".
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

- `Mod+P` belongs to the worktree document workspace. Verify it with the Files panel closed too.
- Write setup files before loading the workspace. Name results exclude Git-ignored paths; an explicit path is an intentional direct open, not a broader search.
- While the list loads the dialog shows "Reading file names…". Wait for options before filling.
- Matches ignore case and surrounding whitespace. Exact basenames rank first, followed by basename prefixes, basename contains, then path contains. Shorter paths win ties, followed by deterministic path order. The 50-result limit applies after ranking. Rows show the basename first and the parent folder dimmed.

## Explicit path and hidden preferences

1. Create `config/.env` containing a distinctive value and ignore `config/` in `.gitignore` before loading.
2. Close the Files panel, press Mod+P, enter `config/.env`, and choose `Open path config/.env`. The document displays the value, while GET paths still omits it.
3. Hide a named file from Files, then search for it through Mod+P. It is absent. Enable Files → Show and repeat: it is offered. Hidden ancestors also apply to direct paths.
4. Absolute paths, traversal, `.git`, repeated separators and backslashes never get an explicit-path action.

Opening the worktree with Files closed makes no name-list or file-preference request for Quick Open. The shortcut opens the popup and reads preferences. Name-list reads begin only after entering a query. While visibility preferences are pending, candidates and explicit-path actions stay absent; failure offers Try again. Closing the popup unmounts those reads. Reopening the same file focuses its existing document tab.

## Empty query suggestions

1. Open three different file documents, then activate the middle tab and the first tab. Open Mod+P with an empty query.
2. Expect actual open file document tabs in most recent activation order, followed by pinned files. A file present in both appears once; folders, hidden paths, Changes, review documents, timelines and history do not appear.
3. Select an already-open file: its existing tab gains focus without moving tab positions. Open Mod+P again and confirm it is first. Close an unpinned file tab and confirm it leaves the suggestions.
4. Inspect traffic: empty suggestions use only open tab state and targeted parent-directory reads for pinned file kinds, without GET paths. Closing the popup unmounts its data reads.

Activation order lasts for the browser session in the existing tab owner and contains only currently open tabs. A cold reload seeds active-first followed by the saved tab order; it adds no stored history.
