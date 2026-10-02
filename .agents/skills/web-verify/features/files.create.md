---
route: /
selectors:
  - "Review"
  - "Files"
  - "New file"
  - "Worktree review"
  - "New folder"
tests:
  - apps/web/spec/integration/files-create.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - POST /api/worktrees/:worktreeId/files
---

# files.create

## What it is

At phone width, both creation buttons open an inline name editor and create the named entry on disk.

## How a user reaches it

- Review → Files → New file or New folder

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### New file and New folder open inline names at phone width and create entries

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "New file"`
   Look for: the textbox “/rename/i” shows.
4. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "/rename/i" "phone-created.md"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli press Enter`
   Look for: the dialog “Worktree review” is gone.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "New folder"`
   Look for: the textbox “/rename/i” shows.
9. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "/rename/i" "phone-folder"`
   Look for: the page settles; take a snapshot to read what it shows.
10. `.agents/skills/web-verify/scripts/cli press Enter`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-create.test.tsx` (Browser Mode integration): New file and New folder open inline names at phone width and create entries.
- The tests read back what the server kept through the kit: `server.directory()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
