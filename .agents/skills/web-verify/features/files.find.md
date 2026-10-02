---
route: /
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Find in file"
  - "1 of 2"
  - "2 of 2"
  - "Previous match"
  - "Edit"
  - "Search"
tests:
  - apps/web/spec/integration/files-find.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
---

# files.find

## What it is

Finding in a long file counts its matches and brings a match far below the fold into view, in the file view and in the editor.

## How a user reaches it

- Review → Files → a long file → right-click → Open file → Mod+F, then Edit → Mod+F
- Shortcut: `Mod+F`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Finding in a long file brings a match far below the fold into view in the file view and the editor

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `long.txt` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the treeitem “long.txt” shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "long.txt" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Open file"`
   Look for: the text “filler 0” shows; the text “the needle line near the end” is gone.
5. `.agents/skills/web-verify/scripts/cli press ControlOrMeta+f`
   Look for: the textbox “Find in file” has focus.
6. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Find in file" "needle"`
   Look for: the text “1 of 2” shows; the text “an early NEEDLE” shows.
7. `.agents/skills/web-verify/scripts/cli press Enter`
   Look for: the text “2 of 2” shows; the text “the needle line near the end” shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Previous match"`
   Look for: the text “1 of 2” shows.
9. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the textbox “Find in file” is gone.
10. `.agents/skills/web-verify/scripts/cli click --role button --name "Edit"`
   Look for: the textbox “long.txt” shows.
11. `.agents/skills/web-verify/scripts/cli press ControlOrMeta+f`
   Look for: the textbox “Search” shows.
12. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Search" "the needle line near the end"`
   Look for: the page settles; take a snapshot to read what it shows.
13. `.agents/skills/web-verify/scripts/cli press Enter`
   Look for: the text “the needle line near the end” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-find.test.tsx` (Browser Mode integration): finding in a long file brings a match far below the fold into view in the file view and the editor.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
