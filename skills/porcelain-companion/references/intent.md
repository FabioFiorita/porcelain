# Intent — "What is this, and what's the idea?"

Intent is the **narrative** of the unit of work (feature, bug, chore, investigation): purpose, plan, rationale. It is not the file inventory (that's Execution) and not the proof (that's Evidence).

**Start of session:** publish Intent first (`review set` with name + thesis). Execution may still be thin; grow it during the session.

## What Porcelain shows

- **Structured document (default):** thesis at the top, then walkthrough **sections** (title + markdown prose + optional SVG diagram or HTML embed). Anchored **code is not the main surface** here — files live on Execution / the sidebar.
- **Freeform board (optional):** full-height HTML or Excalidraw via `review set-canvas`. When both a board and a document exist, the human can switch Board | Document.

## CLI

```bash
~/.porcelain/porcelain review clear   # always before a new unit (drops old Board + evidence too)
~/.porcelain/porcelain review set --name "…" --thesis "…" --sections '[…]' --files '[…]'
~/.porcelain/porcelain review set-canvas --medium html --html-file ./intent.html
~/.porcelain/porcelain review set-canvas --medium excalidraw --file ./board.excalidraw
~/.porcelain/porcelain review clear-canvas
```

### Thesis

`--thesis` — one short markdown paragraph: what this unit is and the single most important thing to understand (for a bug: symptom + suspected cause). Opening line a senior engineer would give before the walkthrough.

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
- **html** — optional self-contained embed (inline CSS; 512 KB cap; height 160–1600).
- **anchors** — still declare them: they drive which files belong under this chapter in Execution and the sidebar, even when Intent does not paint the code blocks.

Keep sections tight: enough steps to tell the whole feature, not a section per file.

## Choosing structured vs freeform

| Prefer structured document when… | Prefer freeform (HTML/Excalidraw) when… |
|----------------------------------|----------------------------------------|
| Story has clear steps and prose | Architecture / data-flow needs a spatial map |
| Diagrams are small SVGs per step | One board carries the whole idea better |
| Default for most features | Human needs to *see the shape* at a glance |

See [excalidraw.md](excalidraw.md) for board authoring rules.
