---
name: feature-artifact
description: Author a "feature artifact" for the Porcelain app — a self-contained HTML document (prose, inline SVG diagrams, tables, images) that explains a feature, which Porcelain renders in the viewer so the human gets an enhanced way to understand what you built. Use after implementing or explaining a feature when a rich visual/narrative explainer helps more than a plain chat message, or when the human asks you to "write it up in Porcelain".
---

# Porcelain feature artifact

Porcelain can render a **feature artifact**: a self-contained HTML document you author that explains a feature — with prose, diagrams, tables, and images — shown in the viewer. It COMPLEMENTS the feature review set (which is the file-by-file flow in `review-with-porcelain`): the review set is the code walkthrough; the artifact is the narrative/visual explainer (how it works, the architecture, the data flow, the decisions).

## When to use

- After you implement or explain a feature and a rich, visual write-up beats a wall of chat text — an architecture diagram, a sequence of steps, a comparison table.
- When the human says "write it up in Porcelain", "make me a diagram of this", or "explain the feature visually".

## How

Call the `porcelain` MCP tools with `repoPath` set to the ABSOLUTE path of the repo you're working in (your cwd):

- `set_feature_artifact` — `{ repoPath, title, html }` → author/replace the artifact.
- `get_feature_artifact` — `{ repoPath }` → check whether one exists (title, size, when set — not the full HTML).
- `clear_feature_artifact` — `{ repoPath }` → remove it.

## Authoring the HTML — read this before you write it

Porcelain renders your HTML in a **FULLY SANDBOXED iframe**. This is a hard constraint, not a preference:

- **Scripts NEVER run.** `<script>` is inert — don't rely on JS for anything.
- **External resources NEVER load.** No CDN scripts or stylesheets, no web fonts, no remote images, no `fetch`. Anything pointing at a URL silently fails to load.

So the document must be **ONE self-contained file**:

- **Inline all CSS** in a `<style>` tag (never `<link rel="stylesheet">`).
- **Diagrams = inline `<svg>`** drawn directly in the HTML — not `<img>` to a diagram service, not a Mermaid script.
- **Images = `data:` URIs** (e.g. `<img src="data:image/png;base64,…">`). No remote `src`.
- **Tables, headings, lists** = plain semantic HTML.
- Use system fonts (`font-family: system-ui, sans-serif`) — web fonts won't load.

**Dark styling.** Porcelain's UI is dark. Style the document itself to match: a dark background and light text, e.g.

```html
<style>
  body { margin: 0; padding: 2rem; background: #0b0b0d; color: #e5e5e7;
         font-family: system-ui, sans-serif; line-height: 1.6; }
  h1, h2 { color: #fff; } a { color: #7aa2f7; }
  table { border-collapse: collapse; } td, th { border: 1px solid #2a2a2e; padding: .4rem .6rem; }
</style>
```

**Size cap.** The HTML must be under ~1.5 MB. If you're embedding images, keep them small (or prefer inline SVG, which is tiny) — don't paste huge base64 blobs.

Write the whole `<html>…</html>` document (or just the body content — Porcelain renders whatever you send via `srcdoc`). Keep it focused: one feature, one clear explanation the human can read top to bottom.
