---
route: /$projectId/$worktreeId
selectors:
  - 'Review'
  - 'Files'
  - 'Open file'
  - 'Reader'
  - 'Source'
  - 'This file is too large to display as text.'
tests:
  - apps/web/spec/integration/files-markdown-preview.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
  - POST /api/worktrees/:worktreeId/preview-assets
  - GET /api/worktrees/:worktreeId/preview-file
---

# files.markdown-preview

A Markdown file opened from the file tree reads as formatted text ("Reader") and switches to its source without writing anything; one larger than the server's 1 MiB text limit is not shown and says why. Relative repository images, audio, video and posters load through file-scoped preview URLs.

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
   Expect: the sheet closes; tab "README.md" selected; tab "Reader" selected; heading "Sample repository" (level 1) and paragraph "A change to review.".
3. Click tab `Source`
   Expect: tab "Source" selected; the code shows "# Sample repository"; heading "Sample repository" is gone.
4. Disk: `cat "$REPO/README.md"`
   Expect: exactly `# Sample repository`, a blank line, `A change to review.` (switching views wrote nothing; Inspect HTTP traffic shows no `POST .../files`).

### 2. A Markdown file too large to read as text is not shown and says why

1. Click button `Review`, then right-click treeitem named `large.md`
   Expect: menuitem "Open file".
2. Click menuitem `Open file`
   Expect: tab "large.md" selected; heading "large.md"; the one line "This file is too large to display as text."; no tabs "Reader"/"Source" and no button "Edit".
3. Inspect HTTP traffic
   Expect: `GET /api/worktrees/<id>/text?path=large.md` answered 422.

### 3. A repository video plays and seeks

1. Add a Markdown file that references a repository image and a video larger than 10 MiB. Open it in Reader from Files.
   Expect: the image renders, and the video starts and seeks to a position beyond the initially loaded buffer.
2. Inspect HTTP traffic.
   Expect: the asset batch returns a ticket for each supported media file. Media GETs use the preview-file route. A byte range returns 206 with Content-Range. A ticket presented for another file or after expiry returns 401.

### Observable proof

Reader/source show the same unchanged disk content; the oversize notice corresponds to 422. Retain the media requests and the successful seek position for the large-video case.

Automated coverage: `files-markdown-preview.test.tsx`.

## Gotchas

- The display default is a per-browser preference: if an earlier feature in this instance set Documents open as to Source in Settings, the file opens on "Source"; click "Reader".
- The limit is the server's 1 MiB limit; a file just under it opens normally.
- The desktop app uses inline previews for files on remote computers. Its media policy only allows the app origin and inline sources.

Reader styles headings, lists, quotes, tables and code as a reading document. Open a Markdown file with those elements and an inline repository image. Verify the rendered roles and media, then switch to Source and verify the original markup and unchanged file contents.
