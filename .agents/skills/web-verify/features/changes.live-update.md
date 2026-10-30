---
route: /
selectors:
  - 'Review'
  - 'Files'
  - 'Open file'
  - 'Source'
  - 'Changes'
tests:
  - apps/web/spec/integration/changes-live-update.test.tsx
  - apps/web/spec/integration/files-disk-refresh.test.tsx
api:
  - GET /api/live
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/text
---

# changes.live-update

While the page stays open, a file another writer rewrites, creates or removes on disk updates the open file's text, the Files tree and the Changes list through the live socket (`GET /api/live`), with no reload and without moving the reader off the tab they chose.

## How to get to it (user POV)

- Nothing to click: it happens on any open workspace when the worktree changes on disk.
- To watch it: button "Review" → tab "Files" (shortcut `Alt+1`) shows the tree; tab "Changes" (`Alt+2`) shows the change list; right-click a changed file in the tree → menuitem "Open file" opens its text (a Markdown file opens on tab "Reader" unless Documents open as says Source; tab "Source" shows the raw text).

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

None before a full page load: every disk write below happens while the page is open, after the step that shows the old state. Never a full page load between the write and the check, or the reload hides what is under test.

### 1. An open file rewritten on disk shows the new text

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Review`
   Expect: tabs "Files" [selected], "Changes", "History".
3. Click tab `Files`
   Expect: treeitem "README.md".
4. Right-click treeitem `README.md`
   Expect: menu with menuitems "Open diff" and "Open file".
5. Click menuitem `Open file`
   Expect: the sheet closes; title "README.md — repository"; the URL contains `entry=file%3AREADME.md`; text "A change to review.".
6. Click tab `Source`
   Expect: tab "Source" [selected]; text "A change to review.".
7. On disk: `printf '# Sample repository\n\nRewritten by another writer while the page is open.\n' > "$REPO/README.md"`
8. Inspect the accessibility tree
   Expect: text "Rewritten by another writer while the page is open."; no "A change to review."; tab "Source" still [selected]; the URL unchanged.

### 2. A file created on disk appears in the tree and the change list

1. Click button `Review`
   Expect: the sheet opens again (opening README.md in part 1 closed it).
2. Click tab `Files`
   Expect: tab "Files" [selected]; treeitem "README.md"; no treeitem "live-note.md".
3. On disk: `printf 'Written by another writer.\n' > "$REPO/live-note.md"`
4. Inspect the accessibility tree
   Expect: treeitem "live-note.md"; tab "Files" still [selected].
5. Click tab `Changes`
   Expect: button "live-note.md · untracked".

### 3. A file removed from disk leaves the change list and the tree

Continuing with the sheet open on tab "Changes" and "live-note.md · untracked" listed:

1. On disk: `rm "$REPO/live-note.md"`
2. Inspect the accessibility tree
   Expect: no button "live-note.md · untracked"; a button whose name starts "README.md · " is still listed.
3. Click tab `Files`
   Expect: treeitem "README.md"; no treeitem "live-note.md".

### Observable proof

No reload between mutations. Disk agrees with rendered text/tree; `git status --porcelain` adds then removes live-note.md. Refreshed text/directory/changes reads answer 200.

Repeat the open-file update with the file tab's context menu → Open to the side. Both clean panes show the new text, including when another writer restores an earlier version. Open Edit afterward and confirm the editor starts with the latest disk text. The console stays free of React render-update warnings throughout.

With an unsaved edit in one pane, repeat the disk update. The other pane shows the disk text while the editor keeps its draft. Done reports the existing conflict; Reload shows the disk text. Follow [files.edit-conflict](files.edit-conflict.md) for the conflict controls and independent disk readback.

Edit the open file, save it with Done, and rewrite it on disk as soon as Edit returns. The view shows the rewritten text, not the saved one: the save never hides a later outside change.

Edit the open file, save it with `Ctrl+S` and wait for status "Saved", then rewrite it on disk with the editor still open. The editor shows the rewritten text and status "Saves as you pause", including when the outside writer restores the text originally opened before the save. Done shows the rewritten text, Edit opens on it again, and a further edit saves with Done without the conflict alert.

Automated coverage: `changes-live-update.test.tsx`, `files-disk-refresh.test.tsx`.

## Gotchas

- Wait for changed content/tree after each write. A changed README click opens its diff; context menu Open file opens text.
- Match the exact Changes tab, distinct from Changes. Restore rewritten README; live-note.md is removed in the recipe.
