---
route: /
selectors:
  - "Review"
  - "Files"
  - "README.md"
  - "Open file"
  - "Edit"
  - "Saved"
  - "Done"
tests:
  - apps/web/spec/integration/files-edit.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
  - POST /api/worktrees/:worktreeId/files
---

# files.edit

## What it is

Editing a file saves after a pause, with Done and when its tab closes, and the server holds each saved text.

## How a user reaches it

- Review → Files → README.md → right-click → Open file → Edit
- Shortcut: `Mod+S`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### An edited file saves after a pause, with Done and when its tab closes

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
6. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "README.md" "Browser autosave marker"`
   Look for: the text “Saved” shows.
7. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "README.md" "Browser done marker"`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Done"`
   Look for: the button “Edit” shows.
9. `.agents/skills/web-verify/scripts/cli click --role button --name "Edit"`
   Look for: the page settles; take a snapshot to read what it shows.
10. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "README.md" "Browser close marker"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-edit.test.tsx` (Browser Mode integration): an edited file saves after a pause, with Done and when its tab closes.
- The tests read back what the server kept through the kit: `server.text()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
