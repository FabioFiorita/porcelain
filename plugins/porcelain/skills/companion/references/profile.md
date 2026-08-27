# Worktree profile

Manual pins and hides plus agent-maintained story layer order. Read this when the human asks about
their profile, when story order should follow substantial work, or when that work changes shape.

## Project navigation, optional worktree story order

```
PROJECT profile        personal, private, one per repository
  pinnedPaths            what you open on ANY task here
  hiddenPaths            dependency dirs, build output, generated code, lockfiles
                         — exact repo-relative paths, never globs
  layers                 the order a change travels through this codebase
        │
        │  inherited — live, not copied
        ▼
WORKTREE override      optional, usually absent
  layers                 replaces the project order; null inherits it
```

A worktree with no override inherits the project profile. That is the normal
state — do not write an override just to restate the baseline.

## MCP tool

```jsonc
{ "workspace": "/abs/path/to/checkout", "level": "project", "op": "get" }
{ "workspace": "/abs/path/to/checkout", "level": "project", "op": "set", "profile": { "layers": [] } }
{ "workspace": "/abs/path/to/checkout", "level": "worktree", "op": "get" }
{ "workspace": "/abs/path/to/checkout", "level": "worktree", "op": "set", "profile": { "layers": null } }
{ "workspace": "/abs/path/to/checkout", "level": "worktree", "op": "clear" }
```

`set` replaces the selected level's layer order. Read with `get` first and send the complete
`layers` value. Pins and hides are project-scoped manual choices; the handler does not expose
agent pin/unpin or hide/unhide writes.

Paths are repo-relative. A layer is `{ label, pattern }` where `pattern` is a
regular expression matched against repo-relative paths; the deepest (right-most)
match wins, so a filename pattern beats the directory a file sits in.

```json
{
  "pinnedPaths": ["README.md", "apps/api/src/routes"],
  "hiddenPaths": ["dist", "vendor", "pnpm-lock.yaml"],
  "layers": [
    { "label": "Route", "pattern": "(^|/)routes/" },
    { "label": "Service", "pattern": "(^|/)services/" },
    { "label": "Schema", "pattern": "(^|/)(schema|migrations)/" }
  ]
}
```

## Which level

| The thing being declared | Level |
|---|---|
| True whatever anyone works on here | project |
| Story order true for the task this worktree is doing | worktree override |
| The human asked for it from the file tree | already written — the tree writes the project level |

The human manages pins and hides from the file tree. An agent may update story layers at either
level only when instructed. Switching worktrees never changes manual navigation paths.

## Rules

- **Pins and hides are manual and project-wide.** Preserve `pinnedPaths` and `hiddenPaths`
  exactly as read. Do not propose, add, remove, or reorder them.
- **Never write story layers unasked.** Porcelain ships the mechanism, not the policy. Write them
  when the human asks, or when their own agent instructions tell you to. Show the proposed layer
  order and wait for a yes on the first run.
- **Layers are declared, never inferred.** Derive them from the repository in
  front of you — its directories, its build config, its actual commits — not from
  a framework convention you recognise. A confident wrong order makes a reader
  trust a story that isn't true, which is worse than no order at all.
- **A stale profile is worse than none.** `get` before you `set`. Clear the
  worktree's layer override when the work it described is finished.
- **Nothing here is shared.** Both levels are personal and neither is
  promoted into git. `porcelain_profile` with `op: "promote"` writes portable hides and
  pins only; it never carries layers or another worktree's override into a checkout.
- **Hiding is focus, never access control.** The full tree stays reachable and
  every hidden path is one gesture from the tree away. Do not hide something to
  stop the human seeing it.
