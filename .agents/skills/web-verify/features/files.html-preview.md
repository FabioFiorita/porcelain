---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Files"
  - "Preview"
  - "Source"
  - "HTML preview"
  - "Some assets could not be loaded: "
tests:
  - apps/web/spec/integration/files-html-preview.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
  - POST /api/worktrees/:worktreeId/preview-assets
---

# files.html-preview

An HTML page opened from the file tree renders in a sandboxed frame with its local images inlined as `data:` URLs, names every reference it could not load, and switches to its source.

## How to get to it (user POV)

- Review → Files → click an `.html`/`.htm` file: a single click opens the page itself, even when it is a change (the tree menu's "Open file" or "Open" does the same).
- In the file toolbar, tabs "Preview" and "Source"; Preview is the default unless Settings sets HTML files to open as source.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

A page with one local image that exists and one that does not:

```sh
printf '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="teal"/></svg>\n' > "$REPO/logo.svg"
printf '<!doctype html><html><body><h1>Preview heading</h1><img src="logo.svg" alt="Preview logo"><img src="missing.png" alt="Missing picture"></body></html>\n' > "$REPO/page.html"
```

### 1. The page previews with its local image and names the one it could not load

1. Navigate to `/`, click button `Review`, click tab `Files`
   Expect: treeitems "page.html" and "logo.svg".
2. Click treeitem `page.html`
   Expect: the sheet closes; tab "page.html Close page.html" selected; tab "Preview" selected (`[selected]`) and tab "Source"; the paragraph starting "Sandboxed preview: scripts run"; status "Some assets could not be loaded: missing.png. This preview supports local static assets." (it names `missing.png` only, never `logo.svg`); an iframe titled "page.html HTML preview" (some accessibility snapshots omit its content).
3. Capture a screenshot
   Expect: the heading "Preview heading" and a teal 48 px square inside the frame.
4. Inspect HTTP traffic
   Expect: `GET /api/worktrees/<id>/text?path=page.html` answered 200 and `POST /api/worktrees/<id>/preview-assets` answered 200; no request to `logo.svg` or `missing.png` itself (the frame loads nothing from the network).

### 2. Switching to Source shows the markup instead of the preview

1. Click tab `Source`
   Expect: tab "Source" selected; the code shows `<!doctype html><html><body><h1>Preview heading</h1>…`; the "Some assets could not be loaded" status and the iframe are gone.
2. Click tab `Preview`
   Expect: the `iframe` and the status about `missing.png` again.

### Observable proof

Capture missing.png notice, inlined teal logo and only preview-assets POST traffic; Source shows raw markup.

Automated coverage: `files-html-preview.test.tsx`.

## Gotchas

- While assets are read the panel shows status "Loading preview…".
- The frame is sandboxed (`allow-scripts` only, no same origin) with a CSP that allows only `data:` and `blob:` images; external URLs and references outside the page's folder are reported as missing, not fetched.
- The display default is a per-browser preference: if an earlier feature in this instance set HTML files to open as source in Settings, the page opens on "Source"; click "Preview".
