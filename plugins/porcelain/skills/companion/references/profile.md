# Worktree profile

Pins, hides, and story layer order. Read this when the human asks you to set up
their focus, when you start substantial work in a worktree, or when the shape of
the work changes.

## Two levels, and the lower one is the default

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
  pinnedPaths            + this task's files
  hiddenPaths            + noise for this task only
  unhiddenPaths          − show something the project hides
  layers                 replaces the project order; null inherits it
```

A worktree with no override inherits the project profile. That is the normal
state — do not write an override just to restate the baseline.

## MCP tool

```jsonc
{ "workspace": "/abs/path/to/checkout", "level": "project", "op": "get" }
{ "workspace": "/abs/path/to/checkout", "level": "project", "op": "set", "profile": { "pinnedPaths": [], "hiddenPaths": [], "layers": [] } }
{ "workspace": "/abs/path/to/checkout", "level": "worktree", "op": "get" }
{ "workspace": "/abs/path/to/checkout", "level": "worktree", "op": "set", "profile": { "pinnedPaths": [], "hiddenPaths": [], "unhiddenPaths": [], "layers": null } }
{ "workspace": "/abs/path/to/checkout", "level": "worktree", "op": "clear" }
```

Writes are whole-document. There are no pin/unpin/hide/layer-move verbs, and
inventing one is the mistake this shape exists to prevent — `set` replaces the
level it addresses, so read with `get` first and send back the whole thing.

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

| The thing you are declaring | Level |
|---|---|
| True whatever anyone works on here | project |
| True for the task this worktree is doing | worktree override |
| The human asked for it from the file tree | already written — the tree writes the project level |

Put the boring baseline in the project profile once. If you find yourself writing
the same hide into a third worktree, it belonged in the project profile.

## Rules

- **Never write a profile unasked.** Porcelain ships the mechanism, not the
  policy. Write one when the human asks, or when their own agent
  instructions tell you to. Show the JSON and wait for a yes on the first run.
- **Layers are declared, never inferred.** Derive them from the repository in
  front of you — its directories, its build config, its actual commits — not from
  a framework convention you recognise. A confident wrong order makes a reader
  trust a story that isn't true, which is worse than no order at all.
- **Do not name a language you have not checked for.** `node_modules` is not a
  universal answer. Read `.gitignore` and the build config to find what this
  repository generates.
- **A stale profile is worse than none.** `get` before you `set`. Clear the
  override when the work it described is finished.
- **Nothing here is shared.** Both levels are personal and neither is
  promoted into git. `porcelain_profile` with `op: "promote"` writes portable hides and
  pins only; it never carries layers or another worktree's override into a checkout.
- **Hiding is focus, never access control.** The full tree stays reachable and
  every hidden path is one gesture from the tree away. Do not hide something to
  stop the human seeing it.
