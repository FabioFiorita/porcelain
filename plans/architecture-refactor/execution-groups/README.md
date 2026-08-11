# Execution groups

Tracked manifests for the architecture-executor dispatcher. Each `*.group.json`
file is one dependency-safe batch of recipes that share a managed worktree and
run sequentially in fresh Grok or Claude Personal processes.

Copy `template.group.json`, replace the example fields, and validate:

```bash
node scripts/architecture/dispatch.mjs validate plans/architecture-refactor/execution-groups/<name>.group.json
```

`validate` always loads the **complete tracked set** of `*.group.json` files
(excluding the template) so unknown `dependsOn`, cycles, and recipe overlap
fail closed even when you pass a single file path.

`dependsOn` is not decorative:

1. Structural: dependency ids must exist in the tracked set; no cycles; no recipe overlap.
2. Before `prepare` / `run`: each dependency group must be `status=completed` in
   controller orchestration state **and** its `endingHead` must be a git ancestor
   of this group's `base` (you integrated explicitly). The dispatcher never
   merges, cherry-picks, or pushes.

## Ownership

| Artifact | Where |
| --- | --- |
| `state.json`, `manifest.snapshot.json`, logs, prompts | Controller checkout `scripts/agent-scratch/orchestration/<group-id>/` (gitignored) |
| Runtime catalog/recipe snapshots + required packet | Executor group worktree under the same relative `scripts/agent-scratch/orchestration/<group-id>/packets/` path (absolute path given to the executor) |

Full operator model: [`docs/internals/architecture-dispatch.md`](../../../docs/internals/architecture-dispatch.md).
