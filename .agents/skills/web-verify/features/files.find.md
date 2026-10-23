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
  - apps/web/spec/integration/reviews-sheet-focus.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
---

# files.find

Find in file counts the matches of a case-insensitive query and scrolls a match far below the fold into view, in the read-only file view (Porcelain's find bar) and in the editor (the editor's own search panel).

## How to get to it (user POV)

- With a file open as source (code files, or Markdown/HTML switched to "Source"), not editing: `Mod+F` (find shortcut) opens the find bar, a search region with textbox "Find in file", a status "N of M", and buttons "Previous match", "Next match", "Close find". `Enter` goes to the next match, `Shift+Enter` the previous one, `Escape` closes.
- In the editor (after Edit): `Mod+F` opens the editor's search panel, textbox "Search"; `Enter` goes to the next match.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

A 4002-line file with one match near the top and one near the end:

```sh
awk 'BEGIN{for(i=0;i<4000;i++){if(i==20)print "an early NEEDLE"; if(i==3900)print "the needle line near the end"; print "filler " i}}' > "$REPO/long.txt"
```

1. Navigate to `/`, click button `Review`, click tab `Files`
   Expect: treeitem "long.txt".
2. Right-click treeitem `long.txt`, then click menuitem `Open file`
   Expect: tab "long.txt" selected; the code shows "filler 0"; the snapshot does not contain "the needle line near the end" (the view renders only the lines near the viewport).
3. Press `ControlOrMeta+f`
   Expect: search region with textbox "Find in file", focused.
4. Fill textbox `Find in file` with 'needle'
   Expect: status "1 of 2"; the code shows "an early NEEDLE".
5. Press `Enter`
   Expect: status "2 of 2"; the code shows "the needle line near the end".
6. Click button `Previous match`
   Expect: status "1 of 2"; "an early NEEDLE" in view again.
7. Press `Escape`
   Expect: textbox "Find in file" is gone.
8. Click button `Edit`
   Expect: textbox "long.txt" (the editor).
9. Click textbox `long.txt`, then press `ControlOrMeta+f`
   Expect: textbox "Search" (the editor's search panel, with buttons "Match Case", "Whole Word", "Regexp").
10. Fill textbox `Search` with 'the needle line near the end', then press `Enter`
    Expect: the aria snapshot does not print the editor's lines, so capture a screenshot: the search panel reads "1 of 1" and line 3902 "the needle line near the end" is highlighted in view.

### Observable proof

Verify navigation to far line 3902 in reader/editor. Only the text GET occurs; zero file-write POSTs.

Automated coverage: `files-find.test.tsx`, `reviews-sheet-focus.test.tsx`.

## Gotchas

- `Mod+F` opens the find bar only while the file shows as source and is not being edited; on a Markdown file in Reader or an HTML file in Preview it does nothing until you click tab "Source". It works with focus anywhere in the page (it is not ignored in inputs).
- In the editor, the editor itself must hold focus for `Mod+F` to open its panel (step 9's click); otherwise nothing opens.
- Matching is case-insensitive ("needle" matches "NEEDLE"); the count caps at 10,000 and then reads "N of 10000+". An empty result reads "No results".
- A single click on `long.txt` (untracked, so a change) opens its diff, not the file; use the tree menu's "Open file".
