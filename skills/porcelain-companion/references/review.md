# The Review — Intent · Execution · Evidence

The one active story per repo, start to finish. Read this file whenever you open, grow, or close
a unit of work — feature, bug, chore, or investigation.

## Contents

- **Shape** — the three tabs, where a review lives on disk, publishing
- **Lifecycle** — start / during / end / after, and the publish flow
- **Intent** — thesis, sections, documents on disk, freeform canvas
- **Execution** — the curated file list, sources, notes, layers
- **Evidence** — HTML proof, structured checks, sandbox and CSS rules
- **Medium policy** — what belongs on which surface (including Excalidraw)
- **Comments & reviewed marks** — app → agent
- **What not to do**

## Shape

Porcelain is where agent work becomes trusted work. The **Review** sidebar tab is the home for a
unit of work: the three-part story the human uses to understand and sign off.

| Tab | Job | Human question |
|-----|-----|----------------|
| **Intent** | Why / plan / shape of the unit | *What is this, and what's the idea?* |
| **Execution** | Agent-curated files, notes, diffs (not every dirty path) | *What did the agent touch, and is the code right?* |
| **Evidence** | Proof the loop closed | *Did it actually work?* |

**Viewer:** the same three tabs, each with the human question as a tooltip.
**Sidebar:** name + progress + Open Review; Clear is also on the right-rail companion. The file
outline is Execution.

Without a review set the tab shows **Start this unit of work** — there is no automatic baseline.
You declare the boundary.

### Where a review lives

One folder per review, and the unit in flight has the **same shape** as an archived one:

```
.porcelain/
  actions.json  board.json  layers.json  scope.json  notes.md   ← durable project data
  active-review/          ← the unit in flight
    review.json  intent/  evidence/  comments.json  reviewed.json
  reviews/<id>/           ← history, same shape + meta.json
```

`review clear` and the app's Archive move `active-review/` into `reviews/<id>/` wholesale.

**Reviews are Local by default** — git ignores `reviews/`, so an agent publishing a review does
not dirty anybody else's tree. The human **publishes** one deliberately (right rail → *Publish
review to the repo*), which force-adds that one folder past the ignore rule and reports the byte
cost first. It stages; committing stays the human's call.

So: write the review for a reader, not for a diff. It may be read by a teammate who was not here,
from a clone, weeks later.

## Lifecycle

| Phase | Agent does | UI cue |
|-------|------------|--------|
| **Start** | `review clear` (if previous unit done) → `review set` name + thesis | Empty → Intent appears; "In progress" while Execution/Evidence thin |
| **During** | Grow Execution; Intent updates OK; respond to comments | "In progress — Execution/Evidence still thin" |
| **End** | Full Execution + real Evidence | "Ready to close" + handoff to Changes |
| **After** | Human Clear (or you clear before next unit) | Empty / start again |

**Board** is a queue of cards; **Review** is one active story per repo. Optional handoff: Doing
card → Start Review (title prefilled). Do not turn Review into a second kanban — see
[board.md](board.md).

### Publish flow

0. **`review clear` first** when starting a **new** unit — removes the previous set **and** its
   loop-evidence directory (HTML + images). Matches the app Clear control. Skipping this is how a
   later agent leaves an old Excalidraw board under a new Intent document.
1. **Intent-first** — one `review set` with name + thesis. `--files` and `--sections` are
   optional; omit them entirely at the start. A full `review set` replaces the structured set and
   does **not** keep a previous freeform canvas.
2. **Optional Intent board** — only if *this* unit needs one: `review set-canvas` (html or
   Excalidraw). Never `set-canvas` alone for a new unit without steps 0–1.
3. **Execution grows** — re-`review set` with files + notes as you work.
4. **Evidence** — after you validate, `evidence prepare` + write a self-contained `index.html`
   (**include CSS**). **Required to claim done.**
5. Confirm with `review get` / `feature get` / `evidence get`, or run
   `scripts/check-evidence.mjs` (below).

```bash
# Always start clean when beginning a new unit (set + evidence HTML/images)
~/.porcelain/porcelain review clear

# Start: Intent-first. Name + thesis is a complete opening move.
~/.porcelain/porcelain review set --name "Fix null deref on save" \
  --thesis "One paragraph: what this is and the key idea / bug."

# End: full Execution + Evidence
~/.porcelain/porcelain review set --name "Fix null deref on save" \
  --thesis "…" \
  --files '[{ "path": "src/…", "note": "invariant" }]' \
  --sections '[{ "title": "…", "prose": "…", "anchors": [{ "path": "…" }] }]'
```

## Intent — "What is this, and what's the idea?"

The **case for the change**: purpose, plan, rationale. Not the file inventory (Execution) and not
the proof (Evidence). Publish it first; Execution may still be thin.

### Thesis

`--thesis` — one short markdown paragraph: what this unit is and the single most important thing
to understand (for a bug: symptom + suspected cause). The opening line a senior engineer would
give before the walkthrough.

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
- **diagram** — self-contained **inline SVG** only (sandboxed; no scripts/remote loads). Render
  mermaid yourself if needed.
- **html** — optional self-contained embed (**own CSS**; no parent theme; 512 KB cap; height
  160–1600).
- **anchors** — still declare them: they drive which files belong under this chapter in Execution
  and the sidebar.

Keep sections tight: enough steps to tell the whole unit, not a section per file.

### Documents on disk

Reach for these when prose alone won't carry it.

```bash
~/.porcelain/porcelain intent prepare          # makes the dir + assets/, prints the paths
# …write documents there with your normal file tools…
~/.porcelain/porcelain intent order --files overview.md,before-after.html,flow.excalidraw
~/.porcelain/porcelain intent list
```

Each document becomes a **tab**. One document renders bare with no chrome, so a lone `index.md`
costs nothing.

| Extension | Renders as | Rules |
|---|---|---|
| `.md` / `.markdown` | Prose | Escaped markdown — a raw `<script>` shows as text, not markup |
| `.html` / `.htm` | Sandboxed page | Sibling `.css` and images are **inlined for you**, so relative paths work. No scripts, ever |
| `.excalidraw` | Read-only diagram | Scene JSON; export from the app, don't hand-author |

Images live in `.porcelain/active-review/intent/assets/` and are referenced relatively:

```html
<link rel="stylesheet" href="index.css">
<img src="assets/before.png" alt="Sidebar before the change">
```

**There is no script medium.** A `.js` file is ignored. Reviews are shareable — a published review
can arrive with someone else's `git clone` — so agent-authored HTML runs in a fully sandboxed
frame with no `allow-scripts`. Anything that needs interactivity to be understood is a sign the
document should be simpler, or a diagram.

**Caps:** 12 documents, 2 MB each, 8 MB total. Over-cap documents are dropped silently — check
`intent list` if a tab is missing.

### Freeform canvas

```bash
~/.porcelain/porcelain review set-canvas --medium html --html-file ./intent.html
~/.porcelain/porcelain review set-canvas --medium excalidraw --file ./board.excalidraw
~/.porcelain/porcelain review clear-canvas
```

The outline still uses thesis / sections / files for Execution and chapter jumps. Canvas replaces
only the Intent body when set.

### Choosing

| Use… | When |
|---|---|
| `--thesis` alone | Small unit; one paragraph is the whole story |
| `--thesis` + `--sections` | Default. Ordered walkthrough with code anchors |
| `intent prepare` + `.md` | The rationale is longer than a thesis and wants headings |
| `intent prepare` + `.html` | A before/after, a table of measurements, a styled report |
| `intent prepare` + `.excalidraw` | Architecture or data flow that needs a spatial map |
| `set-canvas` | One board carries the whole idea and you want it full-height |

Combining is fine — documents, board, and the structured walkthrough all appear as tabs.

## Execution — "What did the agent touch, and is the code right?"

The files **you** choose to show for this unit, in the order **you** choose, with notes and source
tags. **Not** an auto-dump of every working-tree change — incidental fixes (config, test harness,
drive-by tidy) stay on the Changes tab unless you list them here.

### What Porcelain shows

- **Exactly** the files from `--files`, in that array order (grouped by optional `layer`).
- Per-file **note** (invariants, cross-seam contracts).
- Markers: filled = changed (git dirty among listed files), diamond = shipped, ring = context.
- Primary open: **diff** for `changed`, **file** (with highlights) for context/shipped.
- Unlisted dirty files never appear — publish only the story for this unit.

### `--files`

Array of `{ path, source?, note?, layer? }` in **your** flow order (entry point → data). Porcelain
does **not** reorder to match Changes-tab regex layers when you set `layer`, and does **not**
inject extra paths from git status.

| Field | Meaning |
|-------|---------|
| `path` | Repo-relative |
| `source` | Omit for files you changed (git detects dirty → `changed`). `"shipped"` = already-landed cross-seam deps. `"context"` = unchanged files needed to follow the flow |
| `note` | Cross-file invariant the reviewer must check |
| `layer` | Optional group heading. When **any** file has `layer`, Porcelain groups by your layers + order (nothing lands in "Other") |

```bash
~/.porcelain/porcelain review set --name "…" --thesis "…" --files '[
  { "path": "src/routes/callouts.ts", "layer": "Routes" },
  { "path": "src/services/callout-service.ts", "source": "shipped", "layer": "Services",
    "note": "labels must match CALLOUT_TEMPLATES in the client" }
]'

~/.porcelain/porcelain review add --files '[{ "path": "src/new.ts" }]'
~/.porcelain/porcelain feature get   # computed view after git tags listed dirty files
```

Files listed but not section-anchored still appear under **More files** / layer groups. Files you
omit are simply not in the Review — even if they are dirty.

### What to include

The **story of the unit**, not every path you touched:

- Files the human should read to trust the change.
- Cross-seam `shipped` (server route/service a client change calls).
- `context` types/constants both sides depend on.
- A `note` wherever there's an invariant the reviewer would miss.
- **Leave out** drive-by fixes, harness/config noise, and unrelated dirty files.

Grouping across the whole repo (not just this unit) is [layers.md](layers.md).

## Evidence — "Did it actually work?"

Ephemeral HTML proof that you closed the loop: browser, simulator, screenshots, pass/fail. Do not
claim a unit done without real Evidence of what you ran. Don't invent proof.

**HTML only.** Excalidraw is not an evidence medium.

**Screenshots yes, video no.** Images (`.png`, `.jpg`, `.webp`, `.gif`, `.svg`) are inlined as
data URIs. Video would mean widening the CSP that backstops agent-authored HTML, or serving the
review over HTTP and losing that CSP entirely. A short sequence of stills says the same thing and
survives being committed. If a recording is genuinely the only proof, link to where it lives and
put the stills here.

**Size is not free.** Evidence is git-ignored by default, but a **published** review carries it
into history permanently. Prefer WebP over PNG and keep a pack in the low single-digit MB.

### Preferred flow — prepare, then write files

**Do not push large HTML or base64 screenshots through the CLI.**

1. `~/.porcelain/porcelain evidence prepare --title "<title>"` → prints
   `<repo>/.porcelain/active-review/evidence/`
2. Write into that directory:
   - **`index.html`** — the document (**must include its own CSS**)
   - Optional **CSS sibling** (`styles.css` + `<link rel="stylesheet" href="styles.css">`)
   - Screenshots with a relative `src`. Put more than one or two under **`assets/`** —
     sub-directories are inlined the same way, and it keeps a published review readable.
3. Optionally add **more documents** beside `index.html` — a run log, a query plan, a diagram. Any
   `.md` / `.html` / `.excalidraw` there becomes a tab next to Report, with the structured checks
   pinned above all of them.
4. Record structured checks:

```bash
~/.porcelain/porcelain evidence check --label "pnpm lint"  --status pass --detail "0 errors"
~/.porcelain/porcelain evidence check --label "pnpm test"  --status pass --detail "1348 passed"
~/.porcelain/porcelain evidence check --label "e2e login"  --status skip --detail "no display"
```

- `--status`: `pass | fail | skip`. Same `--label` updates in place.
- Overall: any fail → Fail; all pass (≥1) → Pass; skip-only → no badge.
- Caps: 32 checks, label ≤ 120, detail ≤ 400.

5. **Validate before claiming done:**

```bash
node <skill>/scripts/check-evidence.mjs          # inside the repo
```

It reports missing `index.html`, missing CSS, broken image references, script tags, remote
assets, and the inlined size against the 4 MB cap. Fix what it reports and run it again.

### Small docs only

```bash
~/.porcelain/porcelain evidence set --title "Login smoke" --html-file ./evidence.html
```

Exactly one of `--html-file` or `--html` (`-` = stdin). Never for multi-screenshot packs.

### Authoring HTML

Fully **sandboxed** iframe (`sandbox=""` — scripts never run; no remote assets). Porcelain does
**not** inject a default theme. Bare unstyled markup will look wrong.

**CSS is required — own the template.** There is no shared Porcelain evidence CSS and no default
template. Design the look for *this* unit. Pick one (or combine):

1. **Inline** — a full `<style>…</style>` in `index.html` (safest, one file).
2. **Sibling stylesheet** — `styles.css` next to `index.html`, linked relatively. The daemon
   inlines local relative stylesheets for the sandboxed viewer. Missing or remote CSS is left
   as-is and **will not load**.

Do **not** omit CSS, link CDN/`https://` stylesheets (blocked), use absolute `file:` paths, or
ship only a screenshot when the human needs to read steps and logs.

Read cap is **4 MB after data-URI inlining**. Over that, the Evidence tab shows *"Evidence too
large (X MB > 4.0 MB)"* — not "cleared". Shrink screenshots (e.g. JPEG ~540px) and rewrite
`index.html`. `evidence get` prints a WARNING when the estimate is over.

A useful pack usually has: title + overall status, what you ran (commands, URLs, env), steps,
screenshots / key logs, and what's left if partial. Structure is yours.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Evidence title</title>
  <style>
    :root { color-scheme: dark; }
    body { font: 14px/1.45 system-ui, sans-serif; margin: 1.25rem; color: #e8eaed; background: #0f1115; }
    h1 { font-size: 1.15rem; margin: 0 0 0.75rem; }
    .ok { color: #6ee7a8; } .bad { color: #fca5a5; }
    pre { overflow: auto; padding: 0.75rem; background: #1a1d24; border-radius: 8px; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>… <span class="ok">PASS</span></h1>
  <!-- content + <img src="assets/shot.png" alt="…"> -->
</body>
</html>
```

That skeleton is an example only — rewrite the CSS per review.

## Medium policy

| Surface | Allowed mediums |
|---------|-----------------|
| **Intent** | Structured document (thesis + section prose/diagrams) **or** freeform HTML **or** Excalidraw |
| **Execution** | Native app UI (exactly the files from `--files`, agent order) — not a freeform medium |
| **Evidence** | **HTML only** (`index.html` + own CSS + optional screenshots) |

**Bias:** structured Intent + HTML Evidence. Reach for Excalidraw only when a spatial board is
clearly better for Intent (architecture map, data-flow whiteboard) — and export it from the
Excalidraw app rather than hand-authoring scene JSON. Never put Excalidraw on Evidence.

## Comments & reviewed marks (app → agent)

- `comments list` / `comments resolve --id` / `comments answer --id --body`
- `reviewed list` — read-only; focus explanations on paths **not** listed. Don't mark reviewed for
  the human.

## What not to do

- Don't publish a new unit without `review clear` first — old Intent/Evidence will mix in.
- Don't claim done without Evidence — only publish what you actually ran.
- Don't invent evidence.
- Don't ship Evidence HTML without CSS (sandboxed; Porcelain does not style it for you).
- Don't push multi-MB HTML through `evidence set`; use `prepare` + your file tools.
- Don't re-implement a second file browser in Intent; Execution + sidebar own the files.
- Don't `set-canvas` alone as a "review" — that keeps the previous files/thesis.
- Don't turn Review into a second kanban (Board owns the queue).
