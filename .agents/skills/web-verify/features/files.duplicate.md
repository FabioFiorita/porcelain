---
route: /
selectors:
  - "Review"
  - "Files"
  - "notes.md"
  - "Duplicate"
  - "notes copy.md"
tests:
  - apps/web/spec/e2e/files-duplicate.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/directory
  - POST /api/worktrees/:worktreeId/files
---

# files.duplicate

## What it is

Duplicating a file writes a copy named after it beside it and opens the copy, from the file menu or with Mod+D on the open file.

## How a user reaches it

- Review → Files → a file → right-click → Duplicate, or Mod+D on the open file
- Shortcut: `Mod+D`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A file is duplicated from its menu and the open copy again with Mod+D

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `notes.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "notes.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Duplicate"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the treeitem “notes copy.md” shows.
7. `.agents/skills/web-verify/scripts/cli press ControlOrMeta+d`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/files-duplicate.e2e.ts` (Playwright e2e): a file is duplicated from its menu and the open copy again with Mod+D.
- The tests read back what the server kept through the kit: `server.directory()`, `server.project()`, `server.text()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
