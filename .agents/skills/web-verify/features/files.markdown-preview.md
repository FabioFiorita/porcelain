---
route: /
selectors:
  - "README.md"
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

A Markdown file opened from the file tree reads as formatted text and switches to its source, and one too large to read as text is not shown and says why.

## How a user reaches it

- Review → Files → README.md → right-click → Open file → Reader or Source

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. A Markdown file opened from the file tree reads as formatted text and switches to its source

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the treeitem “README.md” shows.
1. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "README.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Open file"`
   Look for: the tab “Reader” has aria-selected="true"; the heading “Sample repository” shows.
3. `.agents/skills/web-verify/scripts/cli click --role tab --name "Source"`
   Look for: the tab “Source” has aria-selected="true"; the text “# Sample repository” shows; the heading “Sample repository” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. A Markdown file too large to read as text is not shown and says why

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "large.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Open file"`
   Look for: the text “Not shown” shows; the text “This file is too large to display as text.” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-markdown-preview.test.tsx` (Browser Mode integration): a Markdown file opened from the file tree reads as formatted text and switches to its source; a Markdown file too large to read as text is not shown and says why.
- The tests read back what the server kept through the kit: `server.text()`.

## Gotchas

- None known.
