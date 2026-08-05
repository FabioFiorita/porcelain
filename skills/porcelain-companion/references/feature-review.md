# The Review

Porcelain is where agent work becomes trusted work. The **Review** sidebar tab is **the home for a unit of work** (feature, bug, chore, investigation): the three-part story the human uses to understand and sign off — from **start of session** (Intent) through **end** (Execution + Evidence).

| Tab | Job | Human question |
|-----|-----|----------------|
| **Intent** | Why / plan / shape of the unit | *What is this, and what's the idea?* |
| **Execution** | Agent-curated files, notes, diffs (not every dirty path) | *What did the agent touch, and is the code right?* |
| **Evidence** | Proof the loop closed | *Did it actually work?* |

**Viewer:** the same three tabs, each with the human question as a tooltip.

**Sidebar:** name + progress + Open Review; Clear is also on the right-rail companion (not only a buried menu). File outline is Execution.

Without a review set the tab shows **Start this unit of work** — there is no automatic baseline. You declare the boundary.

## Where a review lives

One folder per review under `.porcelain/reviews/<id>/` once archived — review set, intent documents, comments, reviewed marks, evidence and its assets, together. The **active** review is the loose set at the companion root (`review.json`, `intent/`, `evidence/`, …); `review clear` and the app's Archive move it into `reviews/<id>/`.

**Reviews are Local by default** — git ignores `reviews/`, so an agent publishing a review does not dirty anybody else's tree. The human **publishes** one deliberately (right rail → *Publish review to the repo*), which force-adds that one folder past the ignore rule and reports the byte cost first. It stages; committing stays the human's call.

That means: write the review for a reader, not for a diff. It may be read by a teammate who was not here, from a clone, weeks later.

## Lifecycle

| Phase | Agent does | UI cue |
|-------|------------|--------|
| **Start** | `review clear` (if previous unit done) → `review set` name + thesis (+ optional light sections/files) | Empty → Intent appears; "In progress" while Execution/Evidence thin |
| **During** | Grow Execution; Intent updates OK; respond to comments | "In progress — Execution/Evidence still thin" |
| **End** | Full Execution + real Evidence | "Ready to close" + handoff to Changes |
| **After** | Human Clear (or you clear before next unit) | Empty / start again |

**Board** is a queue of cards; **Review** is one active story per repo. Optional handoff: Doing card → Start Review (title prefilled for the agent prompt). Do not turn Review into a second kanban.

## Publish flow (agent)

0. **`review clear` first** when starting a **new** unit — removes the previous set **and** its loop-evidence directory (HTML + images). Matches the app Clear control. Skipping this is how a later agent leaves an old Excalidraw board under a new Intent document.
1. **Intent-first** — one `review set` with name + thesis. Files/sections may be thin at start; a full `review set` replaces the structured set and does **not** keep a previous freeform canvas.
2. **Optional Intent board** — only if *this* unit needs one: `review set-canvas` (html or Excalidraw). Never set-canvas alone for a new unit without step 0–1.
3. **Execution grows** — re-`review set` with files + notes as you work.
4. **Evidence** — after you validate, `evidence prepare` + write self-contained `index.html` (**include CSS** — inline `<style>` or sibling `.css`; no app default theme). Prepare/set start from an empty evidence dir. **Required to claim done.**
5. Confirm with `review get` / `feature get` / `evidence get`.

CLI: `~/.porcelain/porcelain` (from inside the repo; `help` lists verbs).

### Quick reference

```bash
# Always start clean when beginning a new unit (set + evidence HTML/images)
~/.porcelain/porcelain review clear

# Start / mid: Intent-first (bug or feature example)
~/.porcelain/porcelain review set --name "Fix null deref on save" \
  --thesis "One paragraph: what this is and the key idea / bug." \
  --files '[]' \
  --sections '[{ "title": "Repro", "prose": "…", "anchors": [] }]'

# End: full Execution + Evidence
~/.porcelain/porcelain review set --name "Fix null deref on save" \
  --thesis "…" \
  --files '[{ "path": "src/…", "note": "invariant" }, …]' \
  --sections '[{ "title": "…", "prose": "…", "anchors": [{ "path": "…" }] }, …]'

# Intent freeform (optional — only for THIS unit)
~/.porcelain/porcelain review set-canvas --medium html --html-file ./intent.html
~/.porcelain/porcelain review set-canvas --medium excalidraw --file ./board.excalidraw
~/.porcelain/porcelain review clear-canvas

# Evidence (HTML only — never Excalidraw here; dir is wiped on prepare/set)
~/.porcelain/porcelain evidence prepare --title "Smoke: …"
# then Write index.html WITH its own CSS (+ optional styles.css sibling + screenshots).
# Sandboxed preview has no Porcelain theme — unstyled HTML looks broken. See evidence.md.
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
| **Execution** | Native app UI (exactly the files from `--files`, agent order; anchors group chapters) — not a freeform medium |
| **Evidence** | **HTML only** (`index.html` + own CSS + optional screenshots / sibling `.css`) |

**Bias:** structured Intent + HTML Evidence. Reach for Excalidraw only when a spatial board is clearly better for Intent (architecture map, data-flow whiteboard). Never put Excalidraw on Evidence.

## When to use

- **Start of any multi-step unit** — set Intent so the human sees scope early.
- **End of session** — complete Execution + Evidence so the human can trust and ship.
- When the change spans the client/server seam (diff can't show the other half).
- Bugs and chores are first-class — same lifecycle as features.

## Comments & reviewed marks (app → agent)

- `comments list` / `comments resolve --id` / `comments answer --id --body`
- `reviewed list` — read-only; don't mark reviewed for the human

## What not to do

- Don't publish a new unit without `review clear` first — old Board/Evidence will mix with the new story.
- Don't claim done without Evidence — only publish what you actually ran.
- Don't invent evidence.
- Don't ship Evidence HTML without CSS (sandboxed; Porcelain does not style it for you).
- Don't use `evidence set --medium excalidraw` (removed). Freeform boards → Intent canvas.
- Don't push multi-MB HTML through `evidence set`; use `prepare` + Write tools.
- Don't re-implement a second file browser in Intent; Execution + sidebar own the files.
- Don't `set-canvas` alone as a "review" — that keeps the previous files/thesis.
- Don't turn Review into a second kanban (Board owns the queue).
