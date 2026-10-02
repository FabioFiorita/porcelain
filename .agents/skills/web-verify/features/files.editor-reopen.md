---
route: /
selectors:
  - "Saves as you pause"
  - "Done"
  - "Review"
  - "Files"
  - "README.md"
  - "Open file"
  - "Edit"
tests:
  - apps/web/spec/integration/files-editor-reopen.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
  - POST /api/worktrees/:worktreeId/files
---

# files.editor-reopen

## What it is

A live editor keeps its draft ownership across panes; closing it saves the draft, and reopening starts an editor with the saved text.

## How a user reaches it

- Review → Files → README.md → Open file → Edit → close tab → reopen

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Closing an editor saves its draft and reopening starts a fresh editor session

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the text “Saves as you pause” shows.
1. `.agents/skills/web-verify/scripts/cli click --role button --name "Done"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. An editor keeps its draft ownership while the file opens in another pane

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
5. `.agents/skills/web-verify/scripts/cli click --role tab --name "/README.md/" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "/Open to the side/"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Edit"`
   Look for: the textbox “README.md” shows; the button “Edit” is disabled; the button “Done” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-editor-reopen.test.tsx` (Browser Mode integration): closing an editor saves its draft and reopening starts a fresh editor session; an editor keeps its draft ownership while the file opens in another pane.
- The tests read back what the server kept through the kit: `server.text()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
