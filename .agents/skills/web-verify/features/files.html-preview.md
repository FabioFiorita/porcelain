---
route: /
selectors:
  - "Preview"
  - "Source"
tests:
  - apps/web/spec/integration/files-html-preview.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
  - POST /api/worktrees/:worktreeId/preview-assets
---

# files.html-preview

## What it is

An HTML page opened from the file tree previews in a sandboxed frame with its local images inlined, and names the references it could not load.

## How a user reaches it

- Review → Files → page.html

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. An HTML page opened from the file tree previews with its local images and names the ones it could not load

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the field “page.html HTML preview” shows.
After `open`, look for: the tab “Preview” has aria-selected="true".
After `open`, look for: the text “/could not be loaded: .*logo\.svg/” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Switching the HTML page to its source shows the markup instead of the preview

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role tab --name "Source"`
   Look for: the tab “Source” has aria-selected="true"; the text “/<h1>Preview heading<\/h1>/” shows; the text “/^Some assets could not be loaded/” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-html-preview.test.tsx` (Browser Mode integration): an HTML page opened from the file tree previews with its local images and names the ones it could not load; switching the HTML page to its source shows the markup instead of the preview.

## Gotchas

- None known.
