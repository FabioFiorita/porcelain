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

0. **`review clear` first** — always. Removes the previous feature's review set **and** its loop-evidence directory (HTML + images). Matches the app Feature → Clear button. Skipping this is how a later agent leaves an old Excalidraw board under a new Intent document.
1. **Intent + Execution** — one `review set` (thesis, sections, files). A full `review set` replaces the structured set and does **not** keep a previous freeform canvas.
2. **Optional Intent board** — only if *this* feature needs one: `review set-canvas` (html or Excalidraw). Never set-canvas alone for a new feature without step 0–1.
3. **Evidence** — after you validate, `evidence prepare` + write `index.html` (HTML only). Prepare/set start from an empty evidence dir (no leftover screenshots).
4. Confirm with `review get` / `feature get` / `evidence get`.

CLI: `~/.porcelain/porcelain` (from inside the repo; `help` lists verbs).

### Quick reference

```bash
# Always start clean (set + evidence HTML/images)
~/.porcelain/porcelain review clear

# Intent + Execution (structured) — full replace, no leftover Board
~/.porcelain/porcelain review set --name "Feature name" \
  --thesis "One paragraph: what this is and the key idea." \
  --files '[{ "path": "src/…", "note": "invariant" }, …]' \
  --sections '[{ "title": "…", "prose": "…", "anchors": [{ "path": "…" }] }, …]'

# Intent freeform (optional — only for THIS feature)
~/.porcelain/porcelain review set-canvas --medium html --html-file ./intent.html
~/.porcelain/porcelain review set-canvas --medium excalidraw --file ./board.excalidraw
~/.porcelain/porcelain review clear-canvas

# Evidence (HTML only — never Excalidraw here; dir is wiped on prepare/set)
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

- Don't publish a new Review without `review clear` first — old Board/Evidence will mix with the new story.
- Don't invent evidence — only publish what you actually ran.
- Don't use `evidence set --medium excalidraw` (removed). Freeform boards → Intent canvas.
- Don't push multi-MB HTML through `evidence set`; use `prepare` + Write tools.
- Don't re-implement a second file browser in Intent; Execution + sidebar own the files.
- Don't `set-canvas` alone as a "feature review" — that keeps the previous files/thesis.
