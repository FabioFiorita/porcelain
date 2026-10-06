# files.html-preview

## What it is

An HTML page opened from the file tree renders in a sandboxed frame with its local images inlined as `data:` URLs, names every reference it could not load, and switches to its source.

## How a user reaches it

- Review → Files → click an `.html`/`.htm` file: a single click opens the page itself, even when it is a change (the tree menu's "Open file" or "Open" does the same).
- In the file toolbar, tabs "Preview" and "Source"; Preview is the default unless Settings sets HTML files to open as source.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. `$REPO` is the path `start` prints after `repository`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

A page with one local image that exists and one that does not:

```sh
printf '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="teal"/></svg>\n' > "$REPO/logo.svg"
printf '<!doctype html><html><body><h1>Preview heading</h1><img src="logo.svg" alt="Preview logo"><img src="missing.png" alt="Missing picture"></body></html>\n' > "$REPO/page.html"
```

### 1. The page previews with its local image and names the one it could not load

1. Open `/` on the instance web URL, click the button named 'Review', click the tab named 'Files'
   Look for: treeitems "page.html" and "logo.svg".
2. Click the tree item named 'page.html'
   Look for: the sheet closes; tab "page.html Close page.html" selected; tab "Preview" selected (`[selected]`) and tab "Source"; the paragraph starting "Sandboxed preview: scripts run"; status "Some assets could not be loaded: missing.png. This preview supports local static assets." (it names `missing.png` only, never `logo.svg`); an `iframe` (the aria snapshot prints it without a name or content).
3. Capture a screenshot
   Look for: the heading "Preview heading" and a teal 48 px square inside the frame.
4. Inspect browser network evidence
   Look for: `GET /api/worktrees/<id>/text?path=page.html` answered 200 and `POST /api/worktrees/<id>/preview-assets` answered 200; no request to `logo.svg` or `missing.png` itself (the frame loads nothing from the network).

### 2. Switching to Source shows the markup instead of the preview

1. Click the tab named 'Source'
   Look for: tab "Source" selected; the code shows `<!doctype html><html><body><h1>Preview heading</h1>…`; the "Some assets could not be loaded" status and the iframe are gone.
2. Click the tab named 'Preview'
   Look for: the `iframe` and the status about `missing.png` again.

## What proves it works

- Scenario 1: the status names exactly `missing.png`, the screenshot shows the inlined teal logo, and the only asset traffic is the `preview-assets` POST.
- Scenario 2: tab "Source" selected with the raw markup in the code view.
- `apps/web/spec/integration/files-html-preview.test.tsx`: the frame labelled "page.html HTML preview" is visible, the status reads "Some assets could not be loaded: missing.png. This preview supports local static assets.", tab "Preview" has `aria-selected="true"` and nothing names `logo.svg` as missing; after clicking "Source" it is selected, `<h1>Preview heading</h1>` shows and the missing-assets status is gone.

## Gotchas

- While assets are read the panel shows status "Loading preview…".
- The frame is sandboxed (`allow-scripts` only, no same origin) with a CSP that allows only `data:` and `blob:` images; external URLs and references outside the page's folder are reported as missing, not fetched.
- The display default is a per-browser preference: if an earlier feature in this instance set HTML files to open as source in Settings, the page opens on "Source"; click "Preview".
- At a narrow browser viewport, the tree lives in the sheet behind "Review", which closes when the page opens.
