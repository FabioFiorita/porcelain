---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Not shown"
  - "This file is binary or uses an unsupported text encoding."
  - "Timeline"
  - "Copy path"
tests:
  - apps/web/spec/integration/files-image-preview.test.tsx
api:
  - GET /api/worktrees/:worktreeId/asset
  - GET /api/worktrees/:worktreeId/text
---

# files.image-preview

## What it is

An image opened from the file tree shows as a picture (read through the asset route), and a binary file opened as a file is not shown as text and says why.

## How a user reaches it

- Review → Files → click an image (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.svg`, `.ico`): a single click opens the image itself, even when it is a change.
- Review → Files → right-click a changed binary file → Open file (a single click on a changed file opens its diff; on an unchanged one the menu item is "Open").

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. `$REPO` is the path `start` prints after `repository`.

### Setup

```sh
printf '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="teal"/></svg>\n' > "$REPO/logo.svg"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' | base64 -d > "$REPO/pixel.png"
printf 'binary\000content\n' > "$REPO/data.bin"
```

### 1. An image opened from the file tree shows as a picture

1. `$C open /`, `$C click --role button --name "Review"`, `$C click --role tab --name "Files"`
   Look for: treeitems "logo.svg", "pixel.png" and "data.bin".
2. `$C click --role treeitem --name "logo.svg"`
   Look for: the sheet closes; tab "logo.svg Close logo.svg" selected; heading "logo.svg"; img "logo.svg"; buttons "Timeline" and "Copy path" (no "Edit"). The screenshot shows a teal square.
3. `$C click --role button --name "Review"`, then `$C click --role treeitem --name "pixel.png"`
   Look for: img "pixel.png" (a 1 by 1 pixel PNG).
4. `$C network`
   Look for: `GET /api/worktrees/<id>/asset?path=logo.svg` and `...asset?path=pixel.png` answered 200, and no `GET .../text` for either.

### 2. A binary file opened from the file tree is not shown as text and says why

1. `$C click --role button --name "Review"`, then `$C click --role treeitem --name "data.bin" --button right`
   Look for: menuitems "Open diff" and "Open file".
2. `$C click --role menuitem --name "Open file"`
   Look for: tab "data.bin Close data.bin" selected; heading "data.bin"; the text "Not shown" with "This file is binary or uses an unsupported text encoding." under it; no button "Edit".
3. `$C network`
   Look for: `GET /api/worktrees/<id>/text?path=data.bin` answered 422.

## What proves it works

- Scenario 1: img "logo.svg" and img "pixel.png" render from 200 asset reads (the image's `src` is a `data:` URL built from the server's base64).
- Scenario 2: the "Not shown" panel with the binary reason, backed by the 422 text read.
- `apps/web/spec/integration/files-image-preview.test.tsx`: clicking `logo.svg` in the tree shows img "logo.svg"; opening `data.bin` with "Open file" shows "Not shown" and "This file is binary or uses an unsupported text encoding.".

## Gotchas

- While the asset loads the panel shows status "Loading image…"; an unreadable asset shows its error message as a status in place of the picture.
- `printf` needs the octal `\000` to write the NUL byte that makes `data.bin` binary.
- The CLI browser is 414 px wide: the tree lives in the sheet behind "Review", which closes each time a document opens, so click "Review" before each tree click.
