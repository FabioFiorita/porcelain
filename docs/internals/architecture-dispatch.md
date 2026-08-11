# Architecture execution-group dispatcher

Tooling for running architecture-refactor recipes in isolated groups without
touching product behavior or automatic integration.

## Group model

An **execution group** is a tracked JSON manifest under
`plans/architecture-refactor/execution-groups/*.group.json`:

| Field | Meaning |
| --- | --- |
| `id` | Group id (slug-shaped); orchestration state key |
| `slug` | Managed worktree slug → `work/<slug>` |
| `base` | Local git ref the worktree branches from (default `main`) |
| `executor` | `grok` or `claude-personal` only |
| `recipes` | Ordered recipe IDs (exactly one process each) |
| `dependsOn` | Other group ids that must be **completed and integrated** into `base` first |

Validation always loads the **complete tracked group set** (even for a single-file
path) so unknown `dependsOn`, cycles, and recipe overlap fail closed. Ready
recipes whose dependencies are not Landed are also rejected.

`prepare` / `run` go further than structural presence: each `dependsOn` group
must have orchestration `status=completed` **and** its `endingHead` must be a
git ancestor of this group's `base` (proves explicit integrate happened). The
dispatcher never merges, cherry-picks, or pushes.

## Ownership (controller vs executor worktree)

| Concern | Location |
| --- | --- |
| Manifest snapshot, durable state, logs, prompts | **Controller** checkout: `scripts/agent-scratch/orchestration/<id>/` |
| Catalog + recipe status snapshots (before/after) | **Executor group worktree** under `plans/architecture-refactor/specs/` |
| Required README review packet | **Executor group worktree**: absolute path under `scripts/agent-scratch/orchestration/<id>/packets/<recipe>.md` |

The executor is given that absolute packet path and postconditions check the
same path. Controller-only packets do not satisfy the gate.

## Fresh-context guarantee

`run` launches a **new** OS process per recipe. No resume, continue, memory, or
subagents. Child PID is written to atomic state **while the process is running**
(`status=running`, `endTime=null`) and cleared on close. Between recipes the
dispatcher re-checks: exit 0, recipe+catalog Landed (from the executor
worktree), new commit, clean worktree, required packet at the absolute executor
path, and no unrelated status drift. Any mismatch stops closed.

Post-executor evidence (clean probe, ending HEAD, catalog/spec snapshot, packet,
postconditions) runs inside one finalization boundary. Internal probes return
structured results or throw ordinary errors — never `process.exit`. On any
failure after child start/exit, durable state is written as `failed` with
`pid` and `currentRecipe` cleared and reasons preserved for investigation.

## Prepared identity binding

Before any spawn, `run` compares the live manifest to `manifest.snapshot.json`
and `state.json` on: `id`, `slug`, normalized `base`, `executor`, ordered
`recipes`, and `dependsOn`. It also re-validates the managed profile
(`parseWorktreeConfig`), linked-worktree membership of this repository, and
that the current branch is exactly `work/<slug>`. Any mismatch or manifest
replacement fails closed (re-run `prepare`).

## Executor selection

| Manifest value | Binary | Notes |
| --- | --- | --- |
| `grok` | `~/.grok/bin/grok` | `--prompt-file`, `--no-subagents`, `--no-memory`, `--reasoning-effort high`, `--permission-mode bypassPermissions`, `--output-format plain` |
| `claude-personal` | `CLAUDE_CONFIG_DIR=~/.claude-personal ~/.local/bin/claude` | `-p --model opus --effort high --dangerously-skip-permissions --disable-slash-commands`. The explicit config directory prevents use of the default work account |

## Managed worktree base

`pnpm worktree create <slug> [--base <ref>]` records the normalized base in
`.porcelain-worktree.json`. Existing profiles without `base` still mean `main`.
Removal requires the branch tip to be reachable from that base (unless
`--force`). PR creation remains main-only. The dispatcher never merges,
cherry-picks, or pushes.

`prepare` adopts an existing path only after `parseWorktreeConfig` succeeds,
the path is a linked worktree of this repository, the current branch is
`work/<slug>`, and the stored normalized base matches the manifest. Stale,
malformed, wrong-repo, or wrong-branch profiles are rejected.

## Commands

```bash
# Schema + catalog + full tracked-set checks (file, group id, or directory)
node scripts/architecture/dispatch.mjs validate [path|id]

# Create/adopt managed worktree; write controller orchestration state
# (also enforces dependsOn completed + ancestor-of-base)
node scripts/architecture/dispatch.mjs prepare <path|id> [--skip-install] [--force] [--dry-run]

# Bind identity, re-check dependsOn, sequential fresh executor processes
node scripts/architecture/dispatch.mjs run <path|id>

# Inspect durable controller state (interrupted runs keep pid/start/current recipe)
node scripts/architecture/dispatch.mjs status <path|id>

# Read-only summary for human/Codex review before explicit integrate
node scripts/architecture/dispatch.mjs review <path|id>
```

After a group completes: review executor packets and commits, integrate into the
group `base` explicitly, then `pnpm worktree remove <slug>`.

## Security posture

- Spawn via `spawn` argv only (`shell: false`)
- Every child uses scrubbed git repository-local env; `cwd` is authoritative
- Worktree targets must sit under the managed sibling `*-worktrees/` directory
- Controller orchestration writes are atomic JSON under gitignored agent-scratch
- Packet path is absolute inside the executor worktree's agent-scratch
- Tracked files never store tokens or host-personal paths
