# Feature Review (the Review)

Porcelain is where agent work becomes trusted work. The **Feature** tab is **the Review**: the three-part story the human uses to understand and sign off after (or during) agent work.

| Tab | Job | Human question |
|-----|-----|----------------|
| **Intent** | Why / plan / shape of the feature | *What is this, and what's the idea?* |
| **Execution** | What changed (files, notes, diffs) | *What did the agent touch, and is the code right?* |
| **Evidence** | Proof the loop closed | *Did it actually work?* |

**Sidebar:** pills for Intent · Execution · Evidence, shortcuts for Intent and Evidence, and an **inline Execution** file list (so the human can open files while Intent or Evidence fills the viewer).

**Viewer:** the same three tabs, each with the human question as a subtitle.

Without a review set the Feature tab shows **No review yet** — there is no automatic baseline. You built the feature, so you declare its boundary.

## Publish flow (agent)

1. **Intent + Execution** — one `review set` (thesis, sections, files) and optionally `review set-canvas` for a freeform Intent board.
2. **Evidence** — after you validate, `evidence prepare` + write `index.html` (HTML only).
3. Confirm with `review get` / `feature get` / `evidence get`.

CLI: `~/.porcelain/porcelain` (from inside the repo; `help` lists verbs).

### Quick reference

```bash
# Intent + Execution (structured)
~/.porcelain/porcelain review set --name "Feature name" \
  --thesis "One paragraph: what this is and the key idea." \
  --files '[{ "path": "src/…", "note": "invariant" }, …]' \
  --sections '[{ "title": "…", "prose": "…", "anchors": [{ "path": "…" }] }, …]'

# Intent freeform (optional — board HTML or Excalidraw; outline still uses files/sections)
~/.porcelain/porcelain review set-canvas --medium html --html-file ./intent.html
~/.porcelain/porcelain review set-canvas --medium excalidraw --file ./board.excalidraw
~/.porcelain/porcelain review clear-canvas

# Evidence (HTML only — never Excalidraw here)
~/.porcelain/porcelain evidence prepare --title "Smoke: …"
# then Write index.html (+ screenshots) into the printed directory
~/.porcelain/porcelain evidence check --label "pnpm test" --status pass --detail "…"
```

## Tab deep dives

| Topic | File |
|-------|------|
| **Intent** — thesis, sections prose, freeform board | [intent.md](intent.md) |
| **Execution** — files, sources, notes, layers | [execution.md](execution.md) |
| **Evidence** — HTML proof, checks, sandbox rules | [evidence.md](evidence.md) |
| **Excalidraw** — Intent freeform board only | [excalidraw.md](excalidraw.md) |

## Medium policy

| Surface | Allowed mediums |
|---------|-----------------|
| **Intent** | Structured document (thesis + section prose/diagrams) **or** freeform HTML **or** Excalidraw |
| **Execution** | Native app UI (files from `--files` / anchors) — not a freeform medium |
| **Evidence** | **HTML only** (`index.html` + optional screenshots) |

**Bias:** structured Intent + HTML Evidence. Reach for Excalidraw only when a spatial board is clearly better for Intent (architecture map, data-flow whiteboard). Never put Excalidraw on Evidence.

## When to use

After a meaningful implement, or when asked to "set up the review" — especially when the change spans the client/server seam (diff can't show the other half).

## Comments & reviewed marks (app → agent)

- `comments list` / `comments resolve --id` / `comments answer --id --body`
- `reviewed list` — read-only; don't mark reviewed for the human

## What not to do

- Don't invent evidence — only publish what you actually ran.
- Don't use `evidence set --medium excalidraw` (removed). Freeform boards → Intent canvas.
- Don't push multi-MB HTML through `evidence set`; use `prepare` + Write tools.
- Don't re-implement a second file browser in Intent; Execution + sidebar own the files.
