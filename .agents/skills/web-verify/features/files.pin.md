---
route: /
selectors:
  - "Review"
  - "Files"
  - "guide.md"
  - "Pin file"
  - "README.md"
  - "Pinned files"
tests:
  - apps/web/spec/integration/files-pin.test.tsx
api:
  - GET /api/projects/:projectId/file-preferences
  - PUT /api/projects/:projectId/file-preferences
---

# files.pin

## What it is

Pinning a file lists it under Pinned above the file tree, where it opens the file and offers the same commands as the tree with Unpin file in place of Pin file, and the server keeps it pinned for the project until it is unpinned.

## How a user reaches it

- Review → Files → a file → right-click → Pin file, then Pinned → right-click, then Unpin

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### A pinned file is listed under Pinned, opens from there, and unpins

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `guide.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the treeitem “guide.md” shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "guide.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Pin file"`
   Look for: the text “guide.md” shows.
5. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "guide.md" --button right`
   Look for: the menuitem “Pin file” is gone.
6. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "/guide\\.md/" --button right`
   Look for: the menuitem “Pin file” is gone.
8. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the page settles; take a snapshot to read what it shows.
9. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "README.md"`
   Look for: the text “A change to review.” shows.
10. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
11. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
12. `.agents/skills/web-verify/scripts/cli click --role button --name "/guide\\.md/"`
   Look for: the text “Pinned reading” shows.
13. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
14. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the region “Pinned files” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-pin.test.tsx` (Browser Mode integration): a pinned file is listed under Pinned, opens from there, and unpins.
- The tests read back what the server kept through the kit: `server.filePreferences()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
