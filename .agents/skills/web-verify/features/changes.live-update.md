---
route: /
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Source"
  - "Changes"
tests:
  - apps/web/spec/integration/changes-live-update.test.tsx
api:
  - GET /api/live
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/text
---

# changes.live-update

## What it is

While the page stays open, a file another writer rewrites, creates or removes on disk updates the open file's text, the Files tree and the Changes list through the live socket (`GET /api/live`), with no reload and without moving the reader off the tab they chose.

## How a user reaches it

- Nothing to click: it happens on any open workspace when the worktree changes on disk.
- To watch it: button "Review" → tab "Files" (shortcut `Alt+2`) shows the tree; tab "Changes" (`Alt+1`) shows the change list; right-click a changed file in the tree → menuitem "Open file" opens its text (a Markdown file opens on tab "Reader" unless the Markdown default preference says Source; tab "Source" shows the raw text).

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`, then `REPO=<the repository path start printed>`.

### Setup

None before `open`: every disk write below happens while the page is open, after the step that shows the old state. Never `open` between the write and the check, or the reload hides what is under test.

### 1. An open file rewritten on disk shows the new text

1. `$C open /`
   Look for: Page Title "Changes — repository".
2. `$C click --role button --name "Review"`
   Look for: tabs "Changes" [selected], "Files", "History".
3. `$C click --role tab --name "Files"`
   Look for: treeitem "README.md".
4. `$C click --role treeitem --name "README.md" --button right`
   Look for: menu with menuitems "Open diff" and "Open file".
5. `$C click --role menuitem --name "Open file"`
   Look for: the sheet closes; Page Title "README.md — repository"; the Page URL contains `entry=file%3AREADME.md`; text "A change to review.".
6. `$C click --role tab --name "Source"`
   Look for: tab "Source" [selected]; text "A change to review.".
7. On disk: `printf '# Sample repository\n\nRewritten by another writer while the page is open.\n' > "$REPO/README.md"`
8. `$C snapshot`
   Look for: text "Rewritten by another writer while the page is open."; no "A change to review."; tab "Source" still [selected]; the Page URL unchanged.

### 2. A file created on disk appears in the tree and the change list

1. `$C click --role button --name "Review"`
   Look for: the sheet opens again (opening README.md in part 1 closed it).
2. `$C click --role tab --name "Files"`
   Look for: tab "Files" [selected]; treeitem "README.md"; no treeitem "live-note.md".
3. On disk: `printf 'Written by another writer.\n' > "$REPO/live-note.md"`
4. `$C snapshot`
   Look for: treeitem "live-note.md"; tab "Files" still [selected].
5. `$C click --role tab --name "Changes"`
   Look for: button "live-note.md · untracked".

### 3. A file removed from disk leaves the change list and the tree

Continuing with the sheet open on tab "Changes" and "live-note.md · untracked" listed:

1. On disk: `rm "$REPO/live-note.md"`
2. `$C snapshot`
   Look for: no button "live-note.md · untracked"; a button whose name starts "README.md · " is still listed.
3. `$C click --role tab --name "Files"`
   Look for: treeitem "README.md"; no treeitem "live-note.md".

## What proves it works

- Each change appears with no `open` in between, so it came through the live socket. `$C network` may list the socket `GET /api/live` once from page load (the request log can omit WebSockets), and shows fresh `GET /api/worktrees/<worktreeId>/text?…`, `…/directory?…` and `…/changes` reads after each disk write, all 200.
- Disk agrees: `cat "$REPO/README.md"` ends with the rewritten line; `git -C "$REPO" status --porcelain` lists `?? live-note.md` in part 2 and not in part 3.
- `apps/web/spec/integration/changes-live-update.test.tsx`: for each part, waits until the server reports the new text or change list, then asserts the page shows the new text (old text gone, Source still selected), the new treeitem and "live-note.md · untracked" row, or their removal.

## Gotchas

- The watcher and the socket take a moment; if the snapshot still shows the old state, run `$C snapshot` again after a second.
- The tree's README.md is a changed file, so a plain click opens its diff; only the right-click menu's "Open file" opens its text.
- "Changes" is also the start of the document tab name "Changes Close Changes"; the exact name `--name "Changes"` resolves to the sidebar tab only.
- Part 1 leaves README.md rewritten; part 3 removes live-note.md again, so the instance otherwise returns to its start state.
