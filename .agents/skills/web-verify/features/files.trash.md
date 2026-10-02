---
route: /
selectors:
  - "Review"
  - "Files"
  - "Move to trash"
  - "Cancel"
tests:
  - apps/web/spec/integration/files-trash.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - POST /api/worktrees/:worktreeId/files
---

# files.trash

## What it is

Moving a file to the trash from the tree removes it from disk and the tree, and moving one another writer already removed is refused and says so.

## How a user reaches it

- Review → Files → file → right-click → Move to trash → Move to trash

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Moving a file to the trash from the tree removes it from disk and the tree

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `old-notes.md` in the sample repository
- write `gone-notes.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "old-notes.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Move to trash"`
   Look for: the text “Move old-notes.md to the trash?” shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Move to trash"`
   Look for: the alertdialog is gone; the treeitem “old-notes.md” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Moving a file another writer already removed to the trash is refused and says so

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `gone-notes.md` in the sample repository
- delete `gone-notes.md` from the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "gone-notes.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Move to trash"`
   Look for: the text “Move gone-notes.md to the trash?” shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Move to trash"`
   Look for: the alert reads 'Path not found'.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Cancel"`
   Look for: the alertdialog is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-trash.test.tsx` (Browser Mode integration): moving a file to the trash from the tree removes it from disk and the tree; moving a file another writer already removed to the trash is refused and says so.
- The tests read back what the server kept through the kit: `server.directory()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
