---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Reader"
  - "Source"
  - "Not shown"
  - "This file is too large to display as text."
tests:
  - apps/web/spec/integration/files-markdown-preview.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
---

# files.markdown-preview

## What it is

A Markdown file opened from the file tree reads as formatted text ("Reader") and switches to its source without writing anything; one larger than the server's 1 MiB text limit is not shown and says why.

## How a user reaches it

- Review → Files → right-click a changed `.md`/`.mdx` file → Open file (a single click on a changed file opens its diff; on an unchanged file the menu item is "Open" and a single click opens the file).
- In the file toolbar, tabs "Reader" and "Source"; Reader is the default unless Settings sets Markdown files to open as source.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. `$REPO` is the path `start` prints after `repository`.

### Setup

The sample `README.md` ("# Sample repository\n\nA change to review.\n", modified) serves scenario 1. For scenario 2, a Markdown file over `TEXT_BYTES` = 1048576 bytes:

```sh
{ printf '# Large\n\n'; yes 'A long line of notes.' | head -c 1100000; } > "$REPO/large.md"
```

### 1. A Markdown file reads as formatted text and switches to its source

1. `$C open /`, `$C click --role button --name "Review"`, `$C click --role tab --name "Files"`
   Look for: treeitem "README.md".
2. `$C click --role treeitem --name "README.md" --button right`, then `$C click --role menuitem --name "Open file"`
   Look for: the sheet closes; tab "README.md Close README.md" selected; tab "Reader" selected; heading "Sample repository" (level 1) and paragraph "A change to review.".
3. `$C click --role tab --name "Source"`
   Look for: tab "Source" selected; the code shows "# Sample repository"; heading "Sample repository" is gone.
4. Disk: `cat "$REPO/README.md"`
   Look for: exactly `# Sample repository`, a blank line, `A change to review.` (switching views wrote nothing; `$C network` shows no `POST .../files`).

### 2. A Markdown file too large to read as text is not shown and says why

1. `$C click --role button --name "Review"`, then `$C click --role treeitem --name "large.md" --button right`
   Look for: menuitem "Open file".
2. `$C click --role menuitem --name "Open file"`
   Look for: tab "large.md Close large.md" selected; heading "large.md"; the text "Not shown" with "This file is too large to display as text." under it; no tabs "Reader"/"Source" and no button "Edit".
3. `$C network`
   Look for: `GET /api/worktrees/<id>/text?path=large.md` answered 422.

## What proves it works

- Scenario 1: the Reader heading, then the raw `# Sample repository` under "Source", with the disk unchanged.
- Scenario 2: the "Not shown" panel with the size reason, backed by the 422 text read.
- `apps/web/spec/integration/files-markdown-preview.test.tsx`: "Open file" on `README.md` selects "Reader" and shows heading "Sample repository"; "Source" selects it, shows "# Sample repository" and removes the heading; `server.text()` still equals the sample's changed text. Opening `large.md` shows "Not shown" and "This file is too large to display as text.".

## Gotchas

- The display default is a per-browser preference: if an earlier feature in this instance set Markdown files to open as source in Settings, the file opens on "Source"; click "Reader".
- The limit is the server's `TEXT_BYTES` (`packages/contracts/src/shared/limits.ts`, 1 MiB); a file just under it opens normally.
- The CLI browser is 414 px wide: the tree lives in the sheet behind "Review", which closes each time a document opens.
