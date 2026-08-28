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
    "title": "Fix the save boundary",
    "why": [
      { "type": "markdown", "content": "# Why\nThe missing record reached persistence." }
    ],
    "how": [
      { "type": "markdown", "content": "# How\nGuard the lookup before writing." }
    ],
    "layers": [
      { "label": "Contract", "pattern": "packages/contracts/" },
      { "label": "Daemon", "pattern": "apps/daemon/" }
    ],
    "files": [{ "path": "src/save.ts", "source": "changed", "note": "guard" }],
    "assets": [{ "type": "image", "path": "assets/result.png", "alt": "Passing save flow" }]
  }
}
```

Every `create` produces a new Review Canvas scoped to the Worktree named by `workspace`; parallel
reviews can therefore coexist in one Project. Keep the returned Canvas id and use `update` with
that id for later changes to the same review. Never use `create` as an upsert. `layers` orders the
Changes/History narrative only for this Review; a later Review in the same Worktree starts with its
own order and does not inherit this one.

When the addressed checkout is clean, a Review create/update records its current commit. History
uses that immutable association across Worktrees. A Review authored while files are still dirty
continues to shape the live Changes surface; update the same Canvas once after committing to make
its layers follow the commit into History.

The Review Canvas always has **Why** and **How** content tabs. It has no Execution tab: `layers`
orders the changed files while the Canvas explains them. Evidence belongs in the shared Assets
gallery; provide its bundle files with `sourceDir`.

## Plan template

Plan uses the same structured renderer but lets the agent choose the bounded tabs:

```jsonc
{
  "op": "create",
  "workspace": "/abs/path/to/checkout",
  "template": "plan",
  "templateData": {
    "title": "Pairing migration",
    "tabs": [
      {
        "id": "approach",
        "label": "Approach",
        "blocks": [{ "type": "markdown", "content": "# Sequence\n1. Add the seam." }]
      },
      {
        "id": "risks",
        "label": "Risks",
        "blocks": [{ "type": "html", "content": "<table>...</table>", "height": 320 }]
      }
    ],
    "assets": []
  }
}
```

Plan tab count, labels, blocks, and Assets use the same limits as a custom structured Canvas. Use a
custom `document` instead when Review or Plan does not fit; conforming content needs no renderer
change.

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
