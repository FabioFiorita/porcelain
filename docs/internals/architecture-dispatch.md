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
| `dependsOn` | Other group ids that must be integrated first (manual gate) |

Validation rejects unknown fields, duplicate or overlapping recipes, invalid
ids/slugs, group cycles, missing catalog rows/files, and Ready recipes whose
dependencies are not Landed.

## Fresh-context guarantee

`run` launches a **new** OS process per recipe. No resume, continue, memory, or
subagents. Between recipes the dispatcher re-checks: exit 0, recipe+catalog
Landed, new commit, clean worktree, required packet, and no unrelated status
drift. Any mismatch stops closed.

## Executor selection

| Manifest value | Binary | Notes |
| --- | --- | --- |
| `grok` | `~/.grok/bin/grok` | `--prompt-file`, `--no-subagents`, `--no-memory`, `--reasoning-effort high`, `--permission-mode bypassPermissions`, `--output-format plain` |
| `claude-personal` | `~/.local/bin/claude` | `-p --model opus --effort max --dangerously-skip-permissions --disable-slash-commands`. Vocabulary is **claude-personal**, not a subscription alias |

## Managed worktree base

`pnpm worktree create <slug> [--base <ref>]` records the normalized base in
`.porcelain-worktree.json`. Existing profiles without `base` still mean `main`.
Removal requires the branch tip to be reachable from that base (unless
`--force`). PR creation remains main-only. The dispatcher never merges,
cherry-picks, or pushes.

## Commands

```bash
# Schema + catalog checks (file, group id, or directory)
node scripts/architecture/dispatch.mjs validate [path|id]

# Create/adopt managed worktree from the manifest base; write orchestration state
node scripts/architecture/dispatch.mjs prepare <path|id> [--skip-install] [--force] [--dry-run]

# Sequential fresh executor processes; stop-closed postconditions
node scripts/architecture/dispatch.mjs run <path|id>

# Inspect durable state (interrupted runs keep pid/start/current recipe)
node scripts/architecture/dispatch.mjs status <path|id>

# Read-only summary for human/Codex review before explicit integrate
node scripts/architecture/dispatch.mjs review <path|id>
```

After a group completes: review packets under
`scripts/agent-scratch/orchestration/<id>/`, integrate into the group `base`
explicitly, then `pnpm worktree remove <slug>`.

## Security posture

- Spawn via `execFile`/`spawn` argv only (`shell: false`)
- Every child uses scrubbed git repository-local env; `cwd` is authoritative
- Worktree targets must sit under the managed sibling `*-worktrees/` directory
- Orchestration writes are atomic JSON under gitignored agent-scratch
- Tracked files never store tokens or host-personal paths
