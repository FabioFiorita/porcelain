---
name: feature-artifact
description: Author a "feature artifact" for the Porcelain app — a self-contained HTML document (prose, inline SVG diagrams, tables, images) that explains a feature, which Porcelain renders in the viewer so the human gets an enhanced way to understand what you built. Use after implementing or explaining a feature when a rich visual/narrative explainer helps more than a plain chat message, or when the human asks you to "write it up in Porcelain".
---

# Porcelain feature artifact

Porcelain can render a **feature artifact**: a self-contained HTML document you author that explains a feature — with prose, diagrams, tables, and images — shown in the viewer. It COMPLEMENTS the feature review set (which is the file-by-file flow in `review-with-porcelain`) and loop evidence (`loop-evidence`): the review set is the code walkthrough; the artifact is the narrative/visual explainer (how it works, the architecture, the data flow, the decisions); **loop evidence** is the ephemeral proof that you validated the running app (browser/simulator screenshots) — use that skill for close-the-loop proof, not this one.

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

## Review before you say you're done (required)

**Do not tell the human the artifact is ready until you've re-read the HTML you just wrote and fixed anything that fails the checks below.** Prefer a second pass + another `set_feature_artifact` call over shipping a first draft that clips or overflows.

Porcelain cannot run your scripts in the iframe, so *you* are the QA. Re-open the HTML you produced (from your own message / draft, or rewrite from the same structure if you only have the MCP response metadata) and walk it as a visual layout review — especially every SVG diagram.

### Always check

- **Self-contained / sandbox-safe.** No `<script>`, no remote `src`/`href` assets, no web fonts, no external CSS. Dark background + light text still look right.
- **Size.** Under ~1.5 MB; no huge base64 blobs.
- **Structure.** Sensible heading order, readable prose length, tables not wider than the content column without intentional horizontal scroll.

### Diagrams and cards (the usual breakage)

Inline SVG is where most artifacts fail. For **every** box/card/node and label:

- **Text fits inside its shape.** Title/body text must not spill past the rect/rounded-rect bounds. If a label is longer than the box, **widen the box, wrap the text (`<tspan>` lines), or shorten the copy** — never leave overflow.
- **Padding.** Leave real inset from text to the edge of the card (roughly ≥8–12px equivalent in user units). Text flush against a border looks cut off even when it technically fits.
- **No clipping.** Nothing important sits outside the SVG `viewBox`, and no group is half-cut by a parent with a hard width/height. If you set `width`/`height` on the `<svg>`, keep them consistent with the `viewBox` so the diagram isn't scaled into illegibility or crop.
- **No overlaps.** Labels don't sit on top of other labels, arrow heads, or node borders unless intentional. Connectors (lines/paths) don't cross through text.
- **Readable type.** Diagram font sizes large enough to read in the viewer (prefer ≥12–14px equivalent for body labels; titles larger). Tiny SVG text that "fits" but can't be read is still a fail.
- **Alignment.** Rows/columns of cards share consistent sizes and spacing when they're the same kind of node; arrows meet box edges cleanly, not mid-padding or floating.

### HTML layout (non-SVG)

- Cards/sections using CSS: long words or titles don't blow out of the card; padding isn't zero; flex/grid children aren't forced into a width that truncates with `overflow: hidden` unless you meant a truncate.
- Code blocks and tables: horizontal overflow is ok if intentional; content shouldn't be permanently cut off with no way to read it.
- Images (`data:` URIs): not stretched into unreadable distortion; have sensible max-width.

### If anything fails

1. Fix the HTML (resize boxes, wrap text, bump padding, adjust `viewBox`, shorten labels).
2. Call `set_feature_artifact` again with the corrected full document (same title is fine — it's a replace).
3. Re-check the changed spots only, then stop.

Only after that pass: tell the human the artifact is ready and where to open it (Feature list → artifact / the artifact view tab).
