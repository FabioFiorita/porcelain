---
route: /$projectId/$worktreeId
selectors:
  - 'Review'
  - 'Files'
  - 'Open file'
  - 'Reader'
  - 'Source'
  - 'Not shown'
  - 'This file is too large to display as text.'
tests:
  - apps/web/spec/integration/files-markdown-preview.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
---

# files.markdown-preview

A Markdown file opened from the file tree reads as formatted text ("Reader") and switches to its source without writing anything; one larger than the server's 1 MiB text limit is not shown and says why.

## How to get to it (user POV)

- Review → Files → right-click a changed `.md`/`.mdx` file → Open file (a single click on a changed file opens its diff; on an unchanged file the menu item is "Open" and a single click opens the file).
- In the file toolbar, tabs "Reader" and "Source"; Reader is the default unless Settings → General → Documents open as is Source.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

The sample `README.md` ("# Sample repository\n\nA change to review.\n", modified) serves scenario 1. For scenario 2, a Markdown file over 1 MiB limit = 1048576 bytes:

```sh
{ printf '# Large\n\n'; yes 'A long line of notes.' | head -c 1100000; } > "$REPO/large.md"
```

### 1. A Markdown file reads as formatted text and switches to its source

1. Navigate to `/`, click button `Review`, click tab `Files`
   Expect: treeitem "README.md".
2. Right-click treeitem `README.md`, then click menuitem `Open file`
   Expect: the sheet closes; tab "README.md Close README.md" selected; tab "Reader" selected; heading "Sample repository" (level 1) and paragraph "A change to review.".
3. Click tab `Source`
   Expect: tab "Source" selected; the code shows "# Sample repository"; heading "Sample repository" is gone.
4. Disk: `cat "$REPO/README.md"`
   Expect: exactly `# Sample repository`, a blank line, `A change to review.` (switching views wrote nothing; Inspect HTTP traffic shows no `POST .../files`).

### 2. A Markdown file too large to read as text is not shown and says why

1. Click button `Review`, then right-click treeitem named `large.md`
   Expect: menuitem "Open file".
2. Click menuitem `Open file`
   Expect: tab "large.md Close large.md" selected; heading "large.md"; the text "Not shown" with "This file is too large to display as text." under it; no tabs "Reader"/"Source" and no button "Edit".
3. Inspect HTTP traffic
   Expect: `GET /api/worktrees/<id>/text?path=large.md` answered 422.

### Observable proof

Reader/source show the same unchanged disk content; oversize Not shown corresponds to 422.

Automated coverage: `files-markdown-preview.test.tsx`.

## Gotchas

- The display default is a per-browser preference: if an earlier feature in this instance set Documents open as to Source in Settings, the file opens on "Source"; click "Reader".
- The limit is the server's 1 MiB limit; a file just under it opens normally.
