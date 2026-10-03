---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Find in file"
  - "Previous match"
  - "Next match"
  - "Close find"
  - "Edit"
  - "Search"
tests:
  - apps/web/spec/integration/files-find.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
---

# files.find

## What it is

Find in file counts the matches of a case-insensitive query and scrolls a match far below the fold into view, in the read-only file view (Porcelain's find bar) and in the editor (the editor's own search panel).

## How a user reaches it

- With a file open as source (code files, or Markdown/HTML switched to "Source"), not editing: `Mod+F` (`SHORTCUTS.findInFile`) opens the find bar, a search region with textbox "Find in file", a status "N of M", and buttons "Previous match", "Next match", "Close find". `Enter` goes to the next match, `Shift+Enter` the previous one, `Escape` closes.
- In the editor (after Edit): `Mod+F` opens the editor's search panel, textbox "Search"; `Enter` goes to the next match.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. `$REPO` is the path `start` prints after `repository`.

### Setup

A 4002-line file with one match near the top and one near the end:

```sh
awk 'BEGIN{for(i=0;i<4000;i++){if(i==20)print "an early NEEDLE"; if(i==3900)print "the needle line near the end"; print "filler " i}}' > "$REPO/long.txt"
```

1. `$C open /`, `$C click --role button --name "Review"`, `$C click --role tab --name "Files"`
   Look for: treeitem "long.txt".
2. `$C click --role treeitem --name "long.txt" --button right`, then `$C click --role menuitem --name "Open file"`
   Look for: tab "long.txt Close long.txt" selected; the code shows "filler 0"; the snapshot does not contain "the needle line near the end" (the view renders only the lines near the viewport).
3. `$C press ControlOrMeta+f`
   Look for: search region with textbox "Find in file", focused.
4. `$C fill --role textbox --name "Find in file" "needle"`
   Look for: status "1 of 2"; the code shows "an early NEEDLE".
5. `$C press Enter`
   Look for: status "2 of 2"; the code shows "the needle line near the end".
6. `$C click --role button --name "Previous match"`
   Look for: status "1 of 2"; "an early NEEDLE" in view again.
7. `$C press Escape`
   Look for: textbox "Find in file" is gone.
8. `$C click --role button --name "Edit"`
   Look for: textbox "long.txt" (the editor).
9. `$C click --role textbox --name "long.txt"`, then `$C press ControlOrMeta+f`
   Look for: textbox "Search" (the editor's search panel, with buttons "Match Case", "Whole Word", "Regexp").
10. `$C fill --role textbox --name "Search" "the needle line near the end"`, then `$C press Enter`
    Look for: the aria snapshot does not print the editor's lines, so take `$C screenshot`: the search panel reads "1 of 1" and line 3902 "the needle line near the end" is highlighted in view.

## What proves it works

- Steps 4 to 6: the count follows the query and the step buttons, and step 5 brings line 3902 into a view that did not render it before.
- Step 10: the editor scrolls to the same far match.
- Nothing is written: `$C network` shows only `GET /api/worktrees/<id>/text?path=long.txt` for the file, no `POST .../files`.
- `apps/web/spec/integration/files-find.test.tsx`: `Mod+F` focuses "Find in file"; "needle" reads "1 of 2" with the early line visible; `Enter` reads "2 of 2" with the far line visible; "Previous match" reads "1 of 2"; `Escape` removes the field; in the editor `Mod+F` shows "Search" and `Enter` brings the far line into view.

## Gotchas

- `Mod+F` opens the find bar only while the file shows as source and is not being edited; on a Markdown file in Reader or an HTML file in Preview it does nothing until you click tab "Source". It works with focus anywhere in the page (it is not ignored in inputs).
- In the editor, the editor itself must hold focus for `Mod+F` to open its panel (step 9's click); otherwise nothing opens.
- Matching is case-insensitive ("needle" matches "NEEDLE"); the count caps at `FILE_FIND_MAX_MATCHES` = 10000 and then reads "N of 10000+". An empty result reads "No results".
- A single click on `long.txt` (untracked, so a change) opens its diff, not the file; use the tree menu's "Open file".
- The CLI browser is 414 px wide: the tree lives in the sheet behind "Review", which closes when the file opens.
