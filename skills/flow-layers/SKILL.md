---
name: flow-layers
description: Tune Porcelain's review-flow layers for a repo — the ordered rules that group changed files into a story from entry point to data. Use to check the codebase's actual structure and decide which layers to add, edit, reorder, or remove so a human reviews changes grouped the way THIS repo is built, especially when the human says the grouping is wrong, files land in "Other", or you've just learned the repo's layout.
---

# Porcelain flow layers

Porcelain groups a change into **flow layers** — an ordered list of `{ label, pattern }` rules — so a human reviews the diff as a story from the entry point down to the data, not as an alphabetical file list. Each changed file is bucketed into the **furthest-right matching** layer; anything no layer matches falls into **Other** (rendered last). You know how this repo is actually laid out, so tune the layers to fit it instead of leaving the generic defaults.

**Scope — these layers drive the Changes/History tabs (the whole repo).** They're regex rules applied to every review, so they suit broad, repo-wide structure. They are NOT the lever for one feature's flow: if a regex layer is hard to write (files would land in "Other", or a catch-all like `app/` sweeps unrelated files together), that's a sign you're fighting the wrong tool. To shape **the feature view** for a specific feature, don't bend the repo-wide regex — set each file's `layer` in `set_feature_review` (see the review-with-porcelain skill). There you place each file in a named layer and declared order verbatim, per-feature, with no regex and no "Other". Reach for repo-wide layers below only for the Changes-tab grouping.

## When to use

- The human says the grouping looks wrong, or too many files are landing in **Other**.
- You've just mapped the repo's structure (a monorepo, a framework with its own conventions, an unusual folder layout) and the default layers don't reflect it.
- The human asks you to "set up the review flow", "fix the layers", or "group my changes by layer".

## How

Call the `porcelain` MCP tools with `repoPath` set to the ABSOLUTE path of the repo you're working in (your cwd). This is a **whole-set replace** — there is no per-layer add/delete; you always send the COMPLETE ordered list.

- `get_flow_layers` — `{ repoPath }` → the effective layers (the repo's custom set, or the built-in defaults), as a numbered list AND JSON. **Always read this first**, then modify and set — that's how you add, edit, remove, or reorder.
- `set_flow_layers` — `{ repoPath, layers: [{ label, pattern }, ...] }` → replace the whole set with your new ordered list (at least one layer).
- `reset_flow_layers` — `{ repoPath }` → drop the custom set and fall back to the defaults.

## Designing the layers

1. `get_flow_layers` to see what's in effect.
2. Look at the repo: the directories under `src` (or the package roots in a monorepo), the framework's conventions, where the entry points, the data/schema, and the tests live.
3. Order them **entry point → data**: the surface the user touches first at the top (pages/routes/screens), shared UI and logic in the middle (components, hooks, services), persistence at the bottom (models, schema, migrations), and tests last.
4. Write a regex `pattern` per layer, tested against the **repo-relative path**. The three shapes the defaults use:
   - **Folder**: `(^|/)(components|ui)/` — files inside a folder of that name.
   - **Extension**: `\.(sql|prisma)$` — files with that extension.
   - **Filename suffix**: `\.(test|spec)\.[a-z]+$` — files whose name ends that way before the extension.
5. `set_flow_layers` with the full ordered list.

**Order matters twice**: it's the order groups render in, AND the furthest-right match on a path wins (so `apps/api/controllers/x.ts` is a Controller, not a Route, even though `api/` also matches). Put the more-specific layer so its match sits further right in the path, or rely on a filename-suffix pattern (which matches to the right of any directory). Keep the set tight — a handful of meaningful layers beats one per folder; let the long tail fall into **Other**.
