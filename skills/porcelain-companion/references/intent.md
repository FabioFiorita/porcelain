# Intent — "What is this, and what's the idea?"

Intent is the **case for the change** (feature, bug, chore, investigation): purpose, plan, rationale. Not the file inventory (that's Execution) and not the proof (that's Evidence).

**Start of session:** publish Intent first (`review set` with name + thesis). Execution may still be thin; grow it during the session.

## Two ways to say it

**1. Documents on disk (`.porcelain/active-review/intent/`) — reach for this when prose alone won't carry it.**

```bash
~/.porcelain/porcelain intent prepare          # makes the dir + assets/, prints the paths
# …write documents there with your normal file tools…
~/.porcelain/porcelain intent order --files overview.md,before-after.html,flow.excalidraw
~/.porcelain/porcelain intent list
```

Each document becomes a **tab**. One document renders bare with no chrome, so a lone `index.md` costs nothing.

| Extension | Renders as | Rules |
|---|---|---|
| `.md` / `.markdown` | Prose | Escaped markdown — a raw `<script>` shows as text, not markup |
| `.html` / `.htm` | Sandboxed page | Sibling `.css` and images are **inlined for you**, so relative paths work. No scripts, ever |
| `.excalidraw` | Read-only diagram | Scene JSON; see [excalidraw.md](excalidraw.md) |

Images live in `.porcelain/active-review/intent/assets/` and are referenced relatively:

```html
<link rel="stylesheet" href="index.css">
<img src="assets/before.png" alt="Sidebar before the change">
```

**There is no script medium.** A `.js` file is ignored. Reviews are shareable now — a published review can arrive with someone else's `git clone` — so agent-authored HTML runs in a fully sandboxed frame with no `allow-scripts`. Anything that needs interactivity to be understood is a sign the document should be simpler, or a diagram.

**Caps:** 12 documents, 2 MB each, 8 MB total. Over-cap documents are dropped silently — check `intent list` if a tab is missing.

**2. The review set's own fields — the default for most units.**

```bash
~/.porcelain/porcelain review clear   # always before a new unit
~/.porcelain/porcelain review set --name "…" --thesis "…" --sections '[…]' --files '[…]'
~/.porcelain/porcelain review set-canvas --medium html --html-file ./intent.html
~/.porcelain/porcelain review clear-canvas
```

### Thesis

`--thesis` — one short markdown paragraph: what this unit is and the single most important thing to understand (for a bug: symptom + suspected cause). The opening line a senior engineer would give before the walkthrough.

### Sections (walkthrough prose)

`--sections` — array in flow order (entry point → data):

```json
{
  "title": "string",
  "prose": "string",
  "diagram": "string",
  "html": "string",
  "htmlHeight": 448,
  "anchors": [{ "path": "src/…", "startLine": 12, "endLine": 40 }]
}
```

- **prose** — *why* this step exists, invariants, traps (markdown; no raw HTML execution).
- **diagram** — self-contained **inline SVG** only (sandboxed; no scripts/remote loads). Render mermaid yourself if needed.
- **html** — optional self-contained embed (**own CSS** in `<style>` or fully inlined; no parent theme; 512 KB cap; height 160–1600).
- **anchors** — still declare them: they drive which files belong under this chapter in Execution and the sidebar.

Keep sections tight: enough steps to tell the whole feature, not a section per file.

## Choosing

| Use… | When |
|---|---|
| `--thesis` alone | Small unit; one paragraph is the whole story |
| `--thesis` + `--sections` | Default. Ordered walkthrough with code anchors |
| `intent prepare` + `.md` | The rationale is longer than a thesis and wants headings |
| `intent prepare` + `.html` | A before/after, a table of measurements, a styled report |
| `intent prepare` + `.excalidraw` | Architecture or data flow that needs a spatial map |
| `set-canvas` | One board carries the whole idea and you want it full-height |

Combining is fine — documents, board, and the structured walkthrough all appear as tabs on Intent.

## Where it goes

`.porcelain/active-review/intent/` belongs to the review in flight. `review clear` (or the app's Archive) moves it into `.porcelain/reviews/<id>/intent/` with the rest of the story, so history keeps the whole thing. Reviews are **Local by default** — the human publishes one deliberately (see [feature-review.md](feature-review.md)).
