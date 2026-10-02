---
route: /
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Not shown"
tests:
  - apps/web/spec/integration/files-image-preview.test.tsx
api:
  - GET /api/worktrees/:worktreeId/asset
  - GET /api/worktrees/:worktreeId/text
---

# files.image-preview

## What it is

An image opened from the file tree shows as a picture, and a binary file is not shown as text and says why.

## How a user reaches it

- Review → Files → logo.svg, or data.bin → right-click → Open file

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. An image opened from the file tree shows as a picture

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "logo.svg"`
   Look for: the img “logo.svg” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. A binary file opened from the file tree is not shown as text and says why

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "data.bin" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Open file"`
   Look for: the text “Not shown” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-image-preview.test.tsx` (Browser Mode integration): an image opened from the file tree shows as a picture; a binary file opened from the file tree is not shown as text and says why.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
