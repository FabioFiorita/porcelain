---
route: /
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Find in file"
  - "3 of 3"
tests:
  - apps/web/spec/integration/files-find-refresh.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
---

# files.find-refresh

## What it is

When the file changes on disk under an open find, the count follows the new text and never names a match past its last one.

## How a user reaches it

- Review → Files → a file → right-click → Open file → Mod+F, while the file changes on disk
- Shortcut: `Mod+F`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### The find count follows a file that changes on disk and stays within its matches

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `notes.txt` in the sample repository
- write `notes.txt` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "notes.txt" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Open file"`
   Look for: the text “needle three” shows.
5. `.agents/skills/web-verify/scripts/cli press ControlOrMeta+f`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Find in file" "needle"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli press Enter`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli press Enter`
   Look for: the text “3 of 3” shows; the text “needle only” shows; the text “1 of 1” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-find-refresh.test.tsx` (Browser Mode integration): the find count follows a file that changes on disk and stays within its matches.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
