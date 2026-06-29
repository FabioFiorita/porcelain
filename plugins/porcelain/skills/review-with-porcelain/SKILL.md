---
name: review-with-porcelain
description: Push a feature review set to the Porcelain app — and read the human's review comments and which files they've marked reviewed — so a human can review the WHOLE feature (including server/cross-seam files that aren't in the git diff) in flow order. Use after implementing, or while working on, a multi-file feature (especially one spanning the client/server seam), and when the human says they left comments or notes on your change or asks what they've reviewed so far.
---

# Review with Porcelain

Porcelain is a macOS review companion that shows a "feature view": the whole feature in flow order (entry point → data), not just the git diff. You built the feature, so you know its true boundary — hand it over so the human reviews the complete picture instead of only the files that happen to have changed.

## When to use

After you implement a feature, finish a meaningful slice, or are asked to "set up the review" — especially when your change touches only part of a feature that spans many files or the client/server seam (the diff can't show the other half, because it didn't change and the link is a route string, not an import).

## How

Call the `porcelain` MCP tools with `repoPath` set to the ABSOLUTE path of the repo you're working in (your cwd):

- `set_feature_review` — replace the review set: `{ repoPath, name, files: [...] }`. List files in FLOW ORDER (entry point → data) — Porcelain renders them in that order.
- `add_review_files` — add files to it incrementally while you work
- `get_feature_review` — read back the current set (name, files, sources, notes, layers); use it to verify what you pushed or to make an idempotent update (read → modify → `set`), and to recover the set if you lose context
- `get_feature_view` — read back the COMPUTED view: every file Porcelain renders, grouped in flow order, each tagged with its real source (`changed` = in the git diff, `context`/`shipped` = the unchanged rest) and layer. Where `get_feature_review` echoes what you declared, this shows what Porcelain made of it after folding in git status + the import baseline — use it to confirm the view rendered as intended.
- `clear_feature_review` — remove it

Each file is `{ path, source?, note?, layer? }`:
- `path` — repo-relative.
- `source` — OMIT for files you changed (Porcelain detects those from git). Use `"shipped"` for files already landed that the change depends on (the server route/controller/service, an existing endpoint), and `"context"` for unchanged files needed to follow the flow (shared types, constants).
- `note` — the cross-file invariant a reviewer must check, e.g. "labels here must match CALLOUT_TEMPLATES in the service" or "this mutation must invalidate the listX query".
- `layer` — OPTIONAL, and the way to control the feature view's grouping. Set it to the flow-layer heading this file belongs to (e.g. `"Store"`, `"Routes"`, `"Data"`). When ANY file has a `layer`, Porcelain groups the FEATURE VIEW by your declared layers + file order verbatim, instead of the repo-wide regex layers — so you place every file exactly where it belongs in THIS feature, no file lands in "Other", and nothing gets swept up by a catch-all pattern. Files left without a `layer` fall back to the regex match. (The repo-wide regex layers still group the Changes/History tabs — tune those with the flow-layers skill; the feature view is yours to shape per-feature here.)

## What to include

The COMPLETE feature, not just your diff:
- The files you changed (no `source` needed).
- The cross-seam files the diff can't show — the server route/controller/service a client change calls (`shipped`), and shared types or constants both sides depend on (`context`).
- A `note` on every file where there's an invariant, contract, or gotcha the reviewer would otherwise miss.

Keep it tight: the files that make up THIS feature, broad enough that the human can read it as one story from entry point to data.

## Reviewer comments

The human also leaves comments in Porcelain — anchored to specific lines (or a whole file) — as concrete review context for you. They're the counterpart to the review set: app → agent. Check them:

- `get_review_comments` — `{ repoPath }` → the OPEN comments, each with its file/line anchor, the snippet it was attached to, the note, and an id. Each is also tagged with the file's feature-view status — `(changed)` (in the git diff), `(context)`, or `(shipped)` — so you can tell a comment on a file you diffed from one on an unchanged context/cross-seam file the human is asking about. Read these before and during the work: they tell you exactly what to explain, fix, or look at.
- `resolve_review_comment` — `{ repoPath, id }` → mark one resolved once you've ACTUALLY addressed the note; it then drops off the reviewer's open list.

When the human says "look at my comments", "I left some notes", or asks about a specific line/diff, call `get_review_comments` first.

## Reviewed files

The human also ticks off files as they review them — a per-file "reviewed" checkbox in Porcelain's Changes/Feature lists. This is the other half of their review state (app → agent, read-only):

- `get_reviewed_files` — `{ repoPath }` → the repo-relative paths the human has marked reviewed. Any changed file NOT in this list is still unreviewed, so focus your explanations and double-checks there and treat the listed ones as already vetted. The marks describe the current working tree and reset when the changes are committed.

When the human asks "what have I reviewed", "where was I", or "what's left to review", call `get_reviewed_files`. It's read-only — "reviewed" is the human's act, so there is no tool to set it; don't mark files reviewed on their behalf.
