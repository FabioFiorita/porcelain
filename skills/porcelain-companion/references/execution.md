# Execution — "What did the agent touch, and is the code right?"

Execution is the **code surface** of the Review: the files **you** (the agent) choose to show for this unit, in the order **you** choose, with notes and source tags (changed / context / shipped). It is **not** an auto-dump of every working-tree change — incidental fixes (config, test harness, drive-by tidy) stay on the Changes tab unless you list them here. The Review **sidebar** outline shows this list so the human can jump files while reading Intent or Evidence in the viewer.

**Mid / end of session:** grow `--files` as you work; full Execution is required before claiming done (with Evidence). Intent-only / empty files is fine at **start**.

## What Porcelain shows

- **Exactly** the files from `--files`, in that array order (and grouped by optional `layer`).
- Per-file **note** (invariants, cross-seam contracts).
- Markers: filled = changed (git dirty among listed files), diamond = shipped, ring = context.
- Primary open: **diff** for `changed`, **file** (with highlights) for context/shipped.
- Unlisted dirty files never appear in Execution — publish only the story for this unit.

## CLI — `--files`

Array of `{ path, source?, note?, layer? }` in **your** flow order (entry point → data). Porcelain does **not** reorder to match Changes-tab regex layers when you set `layer`, and does **not** inject extra paths from git status.

| Field | Meaning |
|-------|---------|
| `path` | Repo-relative |
| `source` | Omit for files you changed (git detects dirty → `changed`). `"shipped"` = already-landed cross-seam deps. `"context"` = unchanged files needed to follow the flow |
| `note` | Cross-file invariant the reviewer must check |
| `layer` | Optional group heading. When **any** file has `layer`, Porcelain groups by your layers + order (nothing lands in "Other") |

```bash
~/.porcelain/porcelain review set --name "…" --files '[
  { "path": "src/routes/callouts.ts", "layer": "Routes" },
  { "path": "src/services/callout-service.ts", "source": "shipped", "layer": "Services",
    "note": "labels must match CALLOUT_TEMPLATES in the client" }
]' --thesis "…" --sections '[…]'

~/.porcelain/porcelain review add --files '[{ "path": "src/new.ts" }]'
~/.porcelain/porcelain feature get   # computed view after git tags listed dirty files
```

Files listed but not section-anchored still appear under **More files** / layer groups. Files you omit from `--files` are simply not in the Review — even if they are dirty.

## What to include

The **story of the unit**, not every path you touched while working:

- Files the human should read to trust the feature/bug/chore.
- Cross-seam `shipped` (server route/service a client change calls).
- `context` types/constants both sides depend on.
- A `note` wherever there's an invariant the reviewer would miss.
- **Leave out** drive-by fixes, harness/config noise, and unrelated dirty files unless they are part of the unit's story.

## Human progress

`reviewed list` — paths the human ticked. Focus explanations on paths **not** listed. Read-only; do not mark reviewed for them.
