# Execution — "What did the agent touch, and is the code right?"

Execution is the **code surface** of the Review: every file in the feature, agent notes, source tags (changed / context / shipped), and open-as-diff / open-as-file. The Feature **sidebar** always shows this list so the human can jump files while reading Intent or Evidence in the viewer.

## What Porcelain shows

- Files from `--files` and section anchors, flow-ordered.
- Per-file **note** (invariants, cross-seam contracts).
- Markers: filled = changed, diamond = shipped, ring = context.
- Primary open: **diff** for `changed`, **file** (with highlights) for context/shipped.

## CLI — `--files`

Array of `{ path, source?, note?, layer? }` in **flow order** (entry point → data):

| Field | Meaning |
|-------|---------|
| `path` | Repo-relative |
| `source` | Omit for files you changed (git detects). `"shipped"` = already-landed cross-seam deps. `"context"` = unchanged files needed to follow the flow |
| `note` | Cross-file invariant the reviewer must check |
| `layer` | Optional group heading. When **any** file has `layer`, Porcelain groups by your layers + order (nothing lands in "Other") |

```bash
~/.porcelain/porcelain review set --name "…" --files '[
  { "path": "src/routes/callouts.ts", "layer": "Routes" },
  { "path": "src/services/callout-service.ts", "source": "shipped", "layer": "Services",
    "note": "labels must match CALLOUT_TEMPLATES in the client" }
]' --thesis "…" --sections '[…]'

~/.porcelain/porcelain review add --files '[{ "path": "src/new.ts" }]'
~/.porcelain/porcelain feature get   # computed view after git fold
```

Files listed but not anchored still appear under **More files** / layer groups — nothing is dropped.

## What to include

The **complete feature**, not just the diff:

- Files you changed.
- Cross-seam `shipped` (server route/service a client change calls).
- `context` types/constants both sides depend on.
- A `note` wherever there's an invariant the reviewer would miss.

## Human progress

`reviewed list` — paths the human ticked. Focus explanations on paths **not** listed. Read-only; do not mark reviewed for them.
