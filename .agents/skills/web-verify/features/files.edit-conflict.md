---
route: /
selectors:
  - "Review"
  - "Files"
  - "README.md"
  - "Open file"
  - "Edit"
  - "Done"
  - "Not saving: changed on disk"
tests:
  - apps/web/spec/integration/files-edit-conflict.test.tsx
api:
  - POST /api/worktrees/:worktreeId/files
---

# files.edit-conflict

## What it is

Saving an edit to a file that changed on disk since it was opened is refused, the editor says so and keeps the draft, and the disk keeps the other change.

## How a user reaches it

- Review → Files → README.md → right-click → Open file → Edit, while the file changes on disk

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Saving over a file that changed on disk is refused and keeps both texts

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the treeitem “README.md” shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "README.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Open file"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Edit"`
   Look for: the textbox “README.md” shows.
6. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "README.md" "Browser edit made before the disk changed"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Done"`
   Look for: the alert reads /The file changed on disk since you opened it\./; the text “Not saving: changed on disk” shows; the button “Done” is disabled.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-edit-conflict.test.tsx` (Browser Mode integration): saving over a file that changed on disk is refused and keeps both texts.
- The tests read back what the server kept through the kit: `server.fileWriteCount()`, `server.text()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
