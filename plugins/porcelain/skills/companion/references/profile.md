# Project navigation profile

Pinned and hidden paths are manual, project-wide file-tree choices. Agents preserve them exactly
and never add, remove, reorder, or recommend them. They are independent from Review layers.

## MCP tool

```jsonc
{ "workspace": "/abs/path/to/checkout", "level": "project", "op": "get" }
{ "workspace": "/abs/path/to/checkout", "level": "project", "op": "promote" }
```

`get` reads only `pinnedPaths` and `hiddenPaths`. `promote` writes those existing portable choices
to `.porcelain/project.json`; it never stages or commits them.

Review layer order belongs in the relevant Review Canvas `templateData.layers` value. A new Review
starts with its own value and never inherits the order from an earlier Review in the same Worktree.
Each layer is `{ "label": string, "pattern": string }`, where `pattern` is matched against
repository-relative paths.

Hiding is focus, never access control. The full tree remains reachable and every hidden path is one
gesture away.
