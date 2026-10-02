---
route: /
selectors:
  - "Review"
  - "Files"
  - "Rename"
  - "Change no longer present"
  - "Invalid name"
tests:
  - apps/web/spec/integration/files-rename.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - POST /api/worktrees/:worktreeId/files
---

# files.rename

## What it is

Renaming a file in the tree moves it on disk and shows the new name without opening it, and renaming it onto an existing name is refused and keeps both files.

## How a user reaches it

- Review → Files → file → right-click → Rename

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Renaming a file in the tree moves it on disk and shows the new name

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `draft-notes.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "draft-notes.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Rename"`
   Look for: the textbox “/rename/i” shows.
5. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "/rename/i" "final-notes.md"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli press Enter`
   Look for: the treeitem “final-notes.md” shows; the treeitem “draft-notes.md” is gone; the text “Change no longer present” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Renaming a file onto an existing name is refused and keeps both files

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `final-notes.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "final-notes.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli press ArrowDown`
   Look for: the menuitem “Rename” has focus.
5. `.agents/skills/web-verify/scripts/cli press Enter`
   Look for: the textbox “/rename/i” shows.
6. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "/rename/i" "README.md"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli press Enter`
   Look for: the text “Invalid name” shows; the treeitem “final-notes.md” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-rename.test.tsx` (Browser Mode integration): renaming a file in the tree moves it on disk and shows the new name; renaming a file onto an existing name is refused and keeps both files.
- The tests read back what the server kept through the kit: `server.directory()`, `server.text()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
