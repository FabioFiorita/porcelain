# Project navigation profile

Pinned and hidden paths are manual, project-wide file-tree choices. Agents preserve them exactly
and never add, remove, reorder, or recommend them. Canvas presentation is independent from this
profile.

## MCP tool

```jsonc
{ "workspace": "/abs/path/to/checkout", "level": "project", "op": "get" }
{ "workspace": "/abs/path/to/checkout", "level": "project", "op": "promote" }
```

`get` reads only `pinnedPaths` and `hiddenPaths`. `promote` writes those existing portable choices
to `.porcelain/project.json`; it never stages or commits them.

Hiding is focus, never access control. The full tree remains reachable and every hidden path is one
gesture away.
