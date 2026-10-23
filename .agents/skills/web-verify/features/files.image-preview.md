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

An image opened from the file tree shows as a picture (read through the asset route), and a binary file opened as a file is not shown as text and says why.

## How to get to it (user POV)

- Review → Files → click an image (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.svg`, `.ico`): a single click opens the image itself, even when it is a change.
- Review → Files → right-click a changed binary file → Open file (a single click on a changed file opens its diff; on an unchanged one the menu item is "Open").

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

```sh
printf '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="teal"/></svg>\n' > "$REPO/logo.svg"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' | base64 -d > "$REPO/pixel.png"
printf 'binary\000content\n' > "$REPO/data.bin"
```

### 1. An image opened from the file tree shows as a picture

1. Navigate to `/`, click button `Review`, click tab `Files`
   Expect: treeitems "logo.svg", "pixel.png" and "data.bin".
2. Click treeitem `logo.svg`
   Expect: the sheet closes; tab "logo.svg" selected; heading "logo.svg"; img "logo.svg"; buttons "Timeline" and "Copy path" (no "Edit"). The screenshot shows a teal square.
3. Click button `Review`, then click treeitem named `pixel.png`
   Expect: img "pixel.png" (a 1 by 1 pixel PNG).
4. Inspect HTTP traffic
   Expect: `GET /api/worktrees/<id>/asset?path=logo.svg` and `...asset?path=pixel.png` answered 200, and no `GET .../text` for either.

### 2. A binary file opened from the file tree is not shown as text and says why

1. Click button `Review`, then right-click treeitem named `data.bin`
   Expect: menuitems "Open diff" and "Open file".
2. Click menuitem `Open file`
   Expect: tab "data.bin" selected; heading "data.bin"; the text "Not shown" with "This file is binary or uses an unsupported text encoding." under it; no button "Edit".
3. Inspect HTTP traffic
   Expect: `GET /api/worktrees/<id>/text?path=data.bin` answered 422.

### Observable proof

Capture SVG/PNG images and 200 asset reads; binary Not shown corresponds to 422 text response.

Automated coverage: `files-image-preview.test.tsx`.

## Gotchas

- While the asset loads the panel shows status "Loading image…"; an unreadable asset shows its error message as a status in place of the picture.
- `printf` needs the octal `\000` to write the NUL byte that makes `data.bin` binary.
