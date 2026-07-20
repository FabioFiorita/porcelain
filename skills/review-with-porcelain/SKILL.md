---
name: review-with-porcelain
description: Push a feature review set to the Porcelain app — and read the human's review comments and which files they've marked reviewed — so a human can review the WHOLE feature (including server/cross-seam files that aren't in the git diff) in flow order. Use after implementing, or while working on, a multi-file feature (especially one spanning the client/server seam), and when the human says they left comments or notes on your change or asks what they've reviewed so far.
---

# Review with Porcelain

Porcelain is a desktop review companion (macOS and Linux). Its **Feature** tab is the **Review**: sidebar **outline** (section titles + files + Loop evidence row) and a viewer **canvas** opened from the review title.

- **Overview** (default canvas tab) — thesis, then walkthrough sections in flow order (entry point → data), each with prose / optional diagram or HTML embed / anchored code, then unanchored **"More files"**.
- **Loop evidence** (second canvas tab, when present) — full-height proof you closed the loop (see `loop-evidence` skill). Not buried at the bottom of a long scroll.
- **File rows** in the outline open the **file** with agent-changed lines highlighted (diff is available from the file row's context menu as "Open diff").

You built the feature, so you know its true boundary — hand it over as a narrative the human can read as a story, not just the files that happen to have changed. Without a review set the Feature tab shows "No review yet" — there is no automatic baseline.

## When to use

After you implement a feature, finish a meaningful slice, or are asked to "set up the review" — especially when your change touches only part of a feature that spans many files or the client/server seam (the diff can't show the other half, because it didn't change and the link is a route string, not an import).

## How

Talk to Porcelain through the bundled CLI at `~/.porcelain/porcelain` — installed automatically and kept fresh on every app launch (no registration, no MCP config). Run it from **inside the repo** and it targets that repo automatically (git toplevel of the cwd); add `--repo <absolute path>` only to point at a different checkout.

- `~/.porcelain/porcelain review set --name <name> [--thesis <s>] [--sections <json|->] --files <json|->` → replace the whole review set (files + thesis + sections). `--name` defaults to "Feature view".
- `~/.porcelain/porcelain review add --files <json|->` → add FILES to the existing set incrementally while you work. Name, thesis, and sections are whole-set — they're replaced by `review set`, never merged by `review add`.
- `~/.porcelain/porcelain review get` → read back the current set (name, thesis, files, and sections) as JSON; use it to verify what you pushed or to make an idempotent update (read → modify → `review set`), and to recover the set if you lose context.
- `~/.porcelain/porcelain feature get` → read back the COMPUTED view: every file Porcelain renders, grouped in flow order, each tagged with its real source (`changed` = in the git diff, `context`/`shipped` = the unchanged rest) and layer. Where `review get` echoes what you declared, this shows what Porcelain made of it after folding in git status — use it to confirm the view rendered as intended.
- `~/.porcelain/porcelain review clear` → remove it (the Feature tab returns to its empty state).

`--files` and `--sections` take inline JSON, or `-` to read the JSON from stdin — pipe or heredoc them for anything non-trivial.

### The files

`--files` is an array of `{ path, source?, note?, layer? }`, in FLOW ORDER (entry point → data):

- `path` — repo-relative.
- `source` — OMIT for files you changed (Porcelain detects those from git). Use `"shipped"` for files already landed that the change depends on (the server route/controller/service, an existing endpoint), and `"context"` for unchanged files needed to follow the flow (shared types, constants).
- `note` — the cross-file invariant a reviewer must check, e.g. "labels here must match TEMPLATES in the service" or "this mutation must invalidate the listX query".
- `layer` — OPTIONAL, and the way to control grouping. Set it to the flow-layer heading this file belongs to (e.g. `"Store"`, `"Routes"`, `"Data"`). When ANY file has a `layer`, Porcelain groups by your declared layers + file order verbatim, instead of the repo-wide regex layers — so every file lands exactly where it belongs, none in "Other". Files left without a `layer` fall back to the regex match. (The repo-wide regex layers still group the Changes/History tabs — tune those with the flow-layers skill; the Review is yours to shape per-feature here.)

Files you list but don't anchor in any section still render, grouped in flow order under a **"More files"** block at the end of the walkthrough — nothing is dropped.

### The thesis

`--thesis <s>` — one short paragraph of markdown at the top of the Review: what this feature is and the single most important thing to understand about it. Think of it as the opening line a senior engineer would give before walking you through the code.

### The sections (the walkthrough)

`--sections` is an array of walkthrough sections, in FLOW ORDER (entry point → data — the same spine as the files). Each section is one step of the change explained the way a senior engineer would explain it, with the exact lines shown inline beneath the prose:

```
{
  "title": "string",                    // section heading
  "prose": "string",                    // markdown; the explanation of this step
  "diagram": "string",                  // OPTIONAL inline SVG markup (see below)
  "html": "string",                     // OPTIONAL self-contained HTML embed (see below)
  "htmlHeight": 448,                    // OPTIONAL well height in px (160–1600, default 448)
  "anchors": [                          // the code this section walks through, in order
    { "path": "src/routes/callouts.ts", "startLine": 12, "endLine": 40 },
    { "path": "src/services/callout-service.ts" }
  ]
}
```

- `title` — the heading for this step (≤200 chars).
- `prose` — markdown, rendered with default escaping (**no raw HTML** — a `<script>` or `<img>` in prose is shown as text, not executed). Explain *why* this code is the way it is, the invariant it upholds, the trap it avoids — not a line-by-line paraphrase the reader can see for themselves.
- `anchors` — the code blocks this section shows inline, in document order. Each is `{ path, startLine?, endLine? }`:
  - `path` — repo-relative (must stay inside the repo; absolute or `..`-escaping paths are dropped).
  - Omit both line numbers to anchor the file's **normal reading block** (diff hunks for a changed file; a symbol slice otherwise).
  - Give `startLine`/`endLine` (1-based, inclusive) to anchor a specific range — for a changed file, the hunks intersecting that range; otherwise those exact lines (clamped, capped).
  - A file anchored in a section does NOT repeat in "More files".

Order sections and their anchors so the Review reads as one story from entry point to data. Keep it tight: enough sections to tell the whole feature, not a section per file.

### Diagrams — render mermaid to SVG yourself

A section's optional `diagram` is **self-contained inline SVG markup**. Porcelain displays it in a fully sandboxed iframe (no scripts, no external loads), so it must be finished SVG — Porcelain does not run mermaid, a layout engine, or any renderer for you.

If you'd normally reach for a mermaid sequence/state/ER diagram to illuminate the flow, **render the mermaid to SVG yourself** and pass that SVG string as `diagram`. Keep it self-contained: inline any styles, embed nothing remote (no external fonts, images, or stylesheets — they're blocked and would just render blank). Only add a diagram where it genuinely clarifies the step (a request path across the seam, a state machine); skip it otherwise.

### HTML embeds — richer than markdown

A section may also carry a self-contained `html` embed for content richer than markdown prose — a styled comparison table, a metric summary, a small before/after report. Porcelain renders it in the same fully sandboxed iframe as diagrams: scripts don't execute and external loads are blocked, so inline all styles and embed any images as data URIs. `htmlHeight` (px, 160–1600, default 448) sizes the well and taller content scrolls inside it; the whole embed is capped at 512 KB. Reach for it only when a table or laid-out summary carries the step better than prose would.

### Example

`--sections` reads one stdin at a time, so for anything sizeable pass the files inline and pipe the sections (or vice versa), or write the JSON to a temp file and `--sections "$(cat sections.json)"`:

```bash
~/.porcelain/porcelain review set --name "Callout templates" \
  --thesis "Adds server-driven callout templates; the client renders whatever labels the service ships." \
  --files '[
    { "path": "src/routes/callouts.ts", "layer": "Routes" },
    { "path": "src/services/callout-service.ts", "source": "shipped", "layer": "Services",
      "note": "labels here must match CALLOUT_TEMPLATES in the client" },
    { "path": "src/shared/callout-types.ts", "source": "context", "layer": "Data" }
  ]' \
  --sections '[
    { "title": "The route accepts a template id",
      "prose": "The handler validates the id and delegates straight to the service — no business logic at the edge.",
      "anchors": [ { "path": "src/routes/callouts.ts", "startLine": 12, "endLine": 40 } ] },
    { "title": "The service owns the template list",
      "prose": "`CALLOUT_TEMPLATES` is the single source of truth; the client mirrors these labels, so a change here is a cross-seam contract.",
      "anchors": [ { "path": "src/services/callout-service.ts" } ] }
  ]'
```

## What to include

The COMPLETE feature, not just your diff:

- The files you changed (no `source` needed).
- The cross-seam files the diff can't show — the server route/controller/service a client change calls (`shipped`), and shared types or constants both sides depend on (`context`).
- A `note` on every file where there's an invariant, contract, or gotcha the reviewer would otherwise miss.
- Walkthrough sections in flow order that turn the file list into a narrative, each anchoring the exact lines it explains.

Keep it tight: the files and steps that make up THIS feature, broad enough that the human can read it as one story from entry point to data.

## Loop evidence — its own canvas tab

After you've validated the work yourself (browser, simulator, screenshots, pass/fail), author **loop evidence** with the **`loop-evidence`** skill. Porcelain shows it on the Review canvas as the **Loop evidence** tab (outline row opens that tab directly — no scrolling). It's a separate, ephemeral channel the human clears after review; you don't publish it through `review set`.

(There is no longer a separate "feature artifact" — the narrative explainer folded into the walkthrough sections above. If you're looking for the old `artifact set` verb, it's gone; write sections instead.)

**Workflow tip:** you can push the review set early as a pre-flight outline (intent + sections), then attach loop evidence last when validation is done.

## Reviewer comments

The human also leaves comments in Porcelain — anchored to specific lines (or a whole file) — as concrete review context for you. They're the counterpart to the Review: app → agent. Check them:

- `~/.porcelain/porcelain comments list` → the OPEN comments, each with its file/line anchor, the snippet it was attached to, the note, and an id. Each is also tagged with the file's feature-view status — `(changed)` (in the git diff), `(context)`, or `(shipped)` — so you can tell a comment on a file you diffed from one on an unchanged context/cross-seam file the human is asking about. Read these before and during the work: they tell you exactly what to explain, fix, or look at.
- `~/.porcelain/porcelain comments resolve --id <id>` → mark one resolved once you've ACTUALLY addressed the note; it then drops off the reviewer's open list.
- `~/.porcelain/porcelain comments answer --id <id> --body <text>` → attach one reply to a review comment (overwritten on re-answer); Porcelain renders it under the comment.

When the human says "look at my comments", "I left some notes", or asks about a specific line/diff, run `comments list` first.

## Reviewed files

The human also ticks off files as they review them — a per-file "reviewed" checkbox in Porcelain's Changes/Feature lists. This is the other half of their review state (app → agent, read-only):

- `~/.porcelain/porcelain reviewed list` → the repo-relative paths the human has marked reviewed. Any changed file NOT in this list is still unreviewed, so focus your explanations and double-checks there and treat the listed ones as already vetted. The marks describe the current working tree and reset when the changes are committed.

When the human asks "what have I reviewed", "where was I", or "what's left to review", run `reviewed list`. It's read-only — "reviewed" is the human's act, so there is no command to set it; don't mark files reviewed on their behalf.
