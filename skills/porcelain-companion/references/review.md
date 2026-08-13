# The Review — Intent · Execution · Evidence

The one active story per repo, start to finish. Read this file whenever you open, grow, or close
a unit of work — feature, bug, chore, or investigation.

## Contents

- **Shape** — the three tabs, where a review lives on disk, publishing
- **Lifecycle** — start / during / end / after, and the publish flow
- **Intent** — thesis, sections, documents on disk
- **Execution** — the curated file list, sources, notes, layers
- **Evidence** — checks, the Results document set, the asset gallery, sandbox and CSS rules
- **Medium policy** — what belongs on which surface
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
    review.json  intent/  evidence/{results/,assets/}  comments.json  reviewed.json
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
| **Start when publication is requested** | `review set` name + thesis; clear an existing Review only for an explicitly requested replacement | Empty → Intent appears; "In progress" while Execution/Evidence thin |
| **During** | Grow Execution; Intent updates OK; respond to comments | "In progress — Execution/Evidence still thin" |
| **End** | Full Execution + real Evidence | "Ready to close" + handoff to Changes |
| **After** | Human-controlled Clear, or an explicitly requested replacement | Empty / start again |

**Board** is a queue of cards; **Review** is one active story per repo. Optional handoff: Doing
card → Start Review (title prefilled) only when publication is requested. Do not turn Review into a second kanban — see
[board.md](board.md).

### Publish flow

0. **Explicit replacement only** — do not clear another active Review automatically. When the
   human requests a replacement, `review clear` removes the previous set **and** its Evidence
   directory (HTML + images), then the deliberate publication can start. Otherwise leave the active
   Review untouched.
1. **Intent-first** — one `review set` with name + thesis. `--files` and `--sections` are
   optional; omit them entirely at the start. A full `review set` replaces the structured set.
2. **Execution grows** — re-`review set` with files + notes as you work.
3. **Evidence** — after you validate, `evidence check` for each thing you ran, then
   `evidence prepare` + Results documents (**include CSS**) + screenshots in `assets/`.
   **Required to claim done.**
4. Confirm with `review get` / `evidence get`, or run
   `scripts/check-evidence.mjs` (below).

```bash
# For an explicitly requested replacement, clear the old set and evidence HTML/images first
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

**Caps:** 30 sections, title ≤ 200 chars, prose ≤ 32 KB, diagram ≤ 256 KB, 40 anchors per section.

Keep sections tight: enough steps to tell the whole unit, not a section per file.

### Documents on disk

Reach for these when prose alone won't carry it.

```bash
~/.porcelain/porcelain intent prepare          # dir + assets/ + the recommended tab order
# …write documents there with your normal file tools…
~/.porcelain/porcelain intent order --files why.md,approach.md,decisions.md
~/.porcelain/porcelain intent list
```

Each document becomes a **tab**. One document renders bare with no chrome, so a lone `index.md`
costs nothing.

#### The three tabs we recommend

`intent prepare` seeds this order; `--tabs why,approach,decisions` (or any other list) overrides it.

| Tab | File | What belongs there |
|---|---|---|
| **Why** | `why.md` | The motivation and problem as understood **before** work started |
| **Approach** | `approach.md` | The solution shape that was agreed |
| **Decisions** | `decisions.md` | Trade-offs taken, alternatives rejected, scope cut |

Intent captures what was agreed **before work started**, even though you author it at completion.
Write it as the brief you wished you'd had, not as a changelog.

**A convention, not a schema.** Porcelain renders whatever is on disk, in manifest order, whatever
it is named — add or drop tabs freely and re-pin with `intent order`. A manifest entry for a
document you never wrote is not an error; it simply is not a tab. Re-running `intent prepare` never
touches an existing `meta.json`, so your own order and labels survive.

| Extension | Renders as | Rules |
|---|---|---|
| `.md` / `.markdown` | Prose | Escaped markdown — a raw `<script>` shows as text, not markup |
| `.html` / `.htm` | Sandboxed page | Sibling `.css` and images are **inlined for you**, so relative paths work. No scripts, ever |

Those two are the whole media story, on every client — web, desktop shell, and mobile. Anything
else in the directory is skipped. A diagram is inline SVG inside an `.html` document (or a section
`diagram`), not a third format.

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

### Choosing

| Use… | When |
|---|---|
| `--thesis` alone | Small unit; one paragraph is the whole story |
| `--thesis` + `--sections` | Default. Ordered walkthrough with code anchors |
| `intent prepare` + `.md` | The rationale is longer than a thesis and wants headings |
| `intent prepare` + `.html` | A before/after, a table of measurements, a styled report, an architecture or data-flow map as inline SVG |

Combining is fine — documents and the structured walkthrough all appear as tabs.

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
| `layer` | Optional group heading. Each file's group is its explicit `layer` if set, else the repo-wide regex layer match (same layers the Changes tab uses), else "Other" — so "Other" only disappears when **every** listed file carries an explicit `layer` |

```bash
~/.porcelain/porcelain review set --name "…" --thesis "…" --files '[
  { "path": "src/routes/callouts.ts", "layer": "Routes" },
  { "path": "src/services/callout-service.ts", "source": "shipped", "layer": "Services",
    "note": "labels must match CALLOUT_TEMPLATES in the client" }
]'

~/.porcelain/porcelain review add --files '[{ "path": "src/new.ts" }]'
~/.porcelain/porcelain review get    # computed view after git tags listed dirty files
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

Proof that you closed the loop: browser, simulator, screenshots, pass/fail. Do not claim a unit
done without real Evidence of what you ran. Don't invent proof.

Evidence is **one pack, three sub-tabs**, all under
`<repo>/.porcelain/active-review/evidence/`:

| Sub-tab | On disk | Job |
|---|---|---|
| **Checks** | `meta.json` (`evidence check`) | The summary a human reads in one second |
| **Results** | `results/*.md` / `*.html` + `results/meta.json` | The narrated proof, as ordered tabs |
| **Assets** | `assets/*.png` … | Raw screenshots, rendered as a native gallery |

```bash
~/.porcelain/porcelain evidence prepare --title "…"   # makes the pack, prints all three paths
```

`prepare` wipes any previous pack first, so a new unit never inherits an old screenshot.
`evidence clear` also wipes the whole pack, standalone — no new one is written, and Intent/Execution
are untouched. Independent of `review clear`, which cascades into wiping Evidence too.

**Screenshots yes, video no.** Images (`.png`, `.jpg`, `.webp`, `.gif`, `.svg`) are inlined as
data URIs. Video would mean widening the CSP that backstops agent-authored HTML, or serving the
review over HTTP and losing that CSP entirely. A short sequence of stills says the same thing and
survives being committed. If a recording is genuinely the only proof, link to where it lives and
put the stills here.

**Size is not free.** Evidence is git-ignored by default, but a **published** review carries it
into history permanently. Prefer WebP over PNG and keep a pack in the low single-digit MB.

### Checks — the one-second read

```bash
~/.porcelain/porcelain evidence check --label "pnpm lint"  --status pass --detail "0 errors"
~/.porcelain/porcelain evidence check --label "pnpm test"  --status pass --detail "1348 passed"
~/.porcelain/porcelain evidence check --label "e2e login"  --status skip --detail "no display"
```

- `--status`: `pass | fail | skip`. Same `--label` updates in place.
- Overall: any fail → Fail; all pass (≥1) → Pass; skip-only → no badge.
- Caps: 32 checks, label ≤ 120, detail ≤ 400.

Record what you actually ran, including the skips — a skip with a reason is information; a missing
check reads as "never tried".

### Results — the narrated proof

**Do not push large HTML or base64 screenshots through the CLI.**

1. `evidence prepare` (above) → prints `…/evidence/results/`.
2. Write documents there with your normal file tools — a report, a run log, a query plan, a
   before/after. Same primitive as Intent: each file is a tab.
3. Reference screenshots from the gallery one level up: `<img src="../assets/shot.png">`.
4. Pin the order (readdir order is not stable):

```bash
~/.porcelain/porcelain evidence results-order --files index.html,run-log.md
~/.porcelain/porcelain evidence results-list
```

| Extension | Renders as | Rules |
|---|---|---|
| `.md` / `.markdown` | Prose | Escaped markdown — a raw `<script>` shows as text, not markup |
| `.html` / `.htm` | Sandboxed page | Local `.css` and images (including `../assets/…`) are **inlined for you**. No scripts, ever |

**There is no script medium.** A `.js` file is ignored. A published review can arrive with someone
else's `git clone`, so agent-authored HTML runs in a fully sandboxed frame with no `allow-scripts`.
Anything that needs interactivity to be understood should be simpler, or a diagram.

**Caps:** 12 documents, 2 MB each, 8 MB total. Over-cap documents are dropped silently — check
`evidence results-list` if a tab is missing.

Evidence documents belong under `results/`; `evidence set` writes the canonical
`results/index.html` document for the Results tab.

### Assets — the gallery

Drop raw screenshots in `assets/`; Porcelain renders the gallery natively in both clients, so a
screenshot needs no HTML around it. Anything you want **narrated** also gets an `<img>` in a
Results document; anything that is just **proof** can live in the gallery alone.

```bash
~/.porcelain/porcelain evidence assets-list   # names, sizes, and what will not render
```

**Caps:** 60 images, 8 MB each. Non-images in `assets/` are skipped, not tiles.

### Validate before claiming done

```bash
node <skill>/scripts/check-evidence.mjs          # inside the repo
```

It reports an empty pack, missing CSS, broken image references (resolving `../assets/`), script
tags, remote assets, the gallery count, and the inlined size against the 4 MB cap. Fix what it
reports and run it again.

### Small docs only

```bash
~/.porcelain/porcelain evidence set --title "Login smoke" --html-file ./evidence.html
```

Writes `results/index.html`. Exactly one of `--html-file` or `--html` (`-` = stdin). Never for
multi-screenshot packs.

### Authoring HTML

Fully **sandboxed** iframe (`sandbox=""` — scripts never run; no remote assets). Porcelain does
**not** inject a default theme. Bare unstyled markup will look wrong.

**CSS is required — own the template.** There is no shared Porcelain evidence CSS and no default
template. Design the look for *this* unit. Pick one (or combine):

1. **Inline** — a full `<style>…</style>` in the document (safest, one file).
2. **Sibling stylesheet** — `styles.css` next to it in `results/`, linked relatively. The daemon
   inlines local relative stylesheets for the sandboxed viewer. Missing or remote CSS is left
   as-is and **will not load**.

Do **not** omit CSS, link CDN/`https://` stylesheets (blocked), use absolute `file:` paths, or
ship only a screenshot when the human needs to read steps and logs.

Read cap is **4 MB after data-URI inlining**. Over that, the Evidence tab shows *"Evidence too
large (X MB > 4.0 MB)"* — not "cleared". Shrink screenshots (e.g. JPEG ~540px) and rewrite the
document. `evidence get` prints a WARNING when the estimate is over.

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
| **Intent** | thesis + sections + Intent documents (`.md` / `.html`) |
| **Execution** | Native app UI (exactly the files from `--files`, agent order) — not a freeform medium |
| **Evidence** | Structured checks + `results/` documents (`.md` / `.html` + own CSS) + an `assets/` image gallery |

**Bias:** structured Intent + HTML Evidence. Two media, everywhere: HTML and markdown. When a
spatial map (architecture, data flow) is the clearest way to say it, draw it as inline SVG in an
HTML document — that renders on every client, including mobile.

## Comments & reviewed marks (app → agent)

- `comments list` / `comments resolve --id` / `comments answer --id --body`
- `reviewed list` — read-only; focus explanations on paths **not** listed. Don't mark reviewed for
  the human.

## What not to do

- Don't clear another active Review automatically or publish over one without an explicit
  replacement request.
- Don't claim done without Evidence — only publish what you actually ran.
- Don't invent evidence.
- Don't ship Evidence HTML without CSS (sandboxed; Porcelain does not style it for you).
- Don't push multi-MB HTML through `evidence set`; use `prepare` + your file tools.
- Don't hand-author an HTML gallery page — `assets/` already renders as one, natively.
- Don't duplicate every screenshot into a Results document; narrate the few that need narrating.
- Don't leave Intent as a changelog — it is the brief, written as of before the work started.
- Don't re-implement a second file browser in Intent; Execution + sidebar own the files.
- Don't turn Review into a second kanban (Board owns the queue).
