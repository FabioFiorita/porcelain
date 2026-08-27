# Canvas and templates

Canvas is Porcelain's authored surface. Use `porcelain_canvas` for all Canvas operations; there
is no separate Review or promotion entry point.

## Generic Canvas

Create from bundle files:

```jsonc
{
  "op": "create",
  "workspace": "/abs/path/to/checkout",
  "title": "Release evidence",
  "kind": "markdown",
  "files": [{ "path": "index.md", "content": "# Checks\n" }]
}
```

An HTML Canvas can include relative CSS, JavaScript, and media in the bundle. `sourceDir` is a
daemon-host directory alternative when the bundle already exists on disk. Use `get` to read the
authoritative content and `list` to see private/tracked records.

### Structured Canvas

Prefer the versioned structured document when the content fits a small set of named views. It uses
the same renderer for built-in templates and custom Canvases:

```jsonc
{
  "op": "create",
  "workspace": "/abs/path/to/checkout",
  "document": {
    "version": 1,
    "title": "Architecture decision",
    "tabs": [
      {
        "id": "why",
        "label": "Why",
        "blocks": [{ "type": "markdown", "content": "# Context\nThe current seam leaks." }]
      },
      {
        "id": "how",
        "label": "How",
        "blocks": [
          { "type": "html", "content": "<figure>...</figure>", "height": 360 }
        ]
      }
    ],
    "assets": [
      { "type": "image", "path": "assets/result.png", "alt": "Result after the change" }
    ]
  },
  "sourceDir": "/abs/path/to/bundle-assets"
}
```

Version 1 allows one to four tabs, tab labels up to 24 characters, and Markdown or sandboxed HTML
blocks. Put image and video collections in `assets` instead of creating more content tabs; asset
paths are bundle-relative and resolve from the optional `sourceDir`. The daemon rejects malformed
documents before persistence with the failing field path, and clients validate tracked documents
again before rendering them. A video may include a bundle-relative `captionsPath` pointing to a
WebVTT captions file.

### HTML presentation

Make HTML Canvases self-contained and intentional: include base CSS in the bundle, set explicit
foreground and background colors, and style the document rather than relying on browser defaults.
Use CSS custom properties with `prefers-color-scheme` so the Canvas stays legible in both client
themes. Keep screenshots and videos within their container to prevent horizontal overflow.

Adapt this starter to the content instead of treating its exact colors or spacing as a fixed
design system:

```css
:root {
  color-scheme: light dark;
  --canvas-bg: #f5f1e8;
  --canvas-panel: #fffaf0;
  --canvas-text: #29241f;
  --canvas-muted: #6f665c;
  --canvas-border: #d9d0c3;
  --canvas-accent: #7c3aed;
}

@media (prefers-color-scheme: dark) {
  :root {
    --canvas-bg: #181614;
    --canvas-panel: #211e1b;
    --canvas-text: #f3eee7;
    --canvas-muted: #b8aea3;
    --canvas-border: #3b3530;
    --canvas-accent: #a78bfa;
  }
}

* { box-sizing: border-box; }

html, body { margin: 0; min-height: 100%; }

body {
  background: var(--canvas-bg);
  color: var(--canvas-text);
  font: 15px/1.6 system-ui, sans-serif;
}

.canvas {
  width: min(100% - 2rem, 72rem);
  margin-inline: auto;
  padding-block: 2rem 4rem;
}

h1, h2, h3 { line-height: 1.2; }
p, li { max-width: 75ch; }
.muted { color: var(--canvas-muted); }

.checkpoint {
  margin-block: 1rem;
  padding: 1rem;
  border: 1px solid var(--canvas-border);
  border-left: 0.25rem solid var(--canvas-accent);
  border-radius: 0.75rem;
  background: var(--canvas-panel);
}

img, video {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
}
```

Place the CSS in a bundled stylesheet or an inline `<style>` element; avoid runtime dependencies
for presentation that should render consistently in browser, Electron, and mobile clients.

## Review template

Review is structured Canvas content, not a separate domain:

```jsonc
{
  "op": "create",
  "workspace": "/abs/path/to/checkout",
  "template": "review",
  "templateData": {
    "name": "Fix the save boundary",
    "thesis": "Guard the missing record before persistence.",
    "files": [{ "path": "src/save.ts", "source": "changed", "note": "guard" }],
    "sections": [{ "title": "Boundary", "prose": "Validate the lookup first." }]
  }
}
```

Every `create` produces a new Review Canvas scoped to the Worktree named by `workspace`; parallel
reviews can therefore coexist in one Project. Keep the returned Canvas id and use `update` with
that id for later changes to the same review. Never use `create` as an upsert.

Evidence and Handoff belong inside this Canvas/template as checks, results, artifacts, and a
next-step summary. Do not create parallel stores or tools for them.

## Persistence and promotion

Private Canvases live in the daemon's own store. Review Canvases are listed only with their
Worktree review context; generic Canvases remain Project-wide. `promote` writes a bundle to:

```text
.porcelain/canvases/<canvas-id>/
```

Promotion never stages or commits. The tracked bundle is canonical for that checkout: `list` and
`get` read it, updates rewrite it, and `delete` removes it. A successful promotion removes the
private source so a stale duplicate cannot reappear.

Keep authored content self-contained and safe to receive from Git. Never claim Evidence that was
not actually observed.
