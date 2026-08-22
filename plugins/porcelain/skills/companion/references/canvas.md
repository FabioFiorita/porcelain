# Canvas and templates

Canvas is Porcelain's authored surface. Use `porcelain_canvas` for all Canvas operations; there
is no separate Review or promotion entry point.

## Generic Canvas

Create from bundle files:

```jsonc
{
  "op": "create",
  "workspace": "/abs/path/to/checkout",
  "title": "Release evidence",
  "kind": "markdown",
  "files": [{ "path": "index.md", "content": "# Checks\n" }]
}
```

An HTML Canvas can include relative CSS, JavaScript, and media in the bundle. `sourceDir` is a
daemon-host directory alternative when the bundle already exists on disk. Use `get` to read the
authoritative content and `list` to see private/tracked records.

## Review template

Review is structured Canvas content, not a separate domain:

```jsonc
{
  "op": "create",
  "workspace": "/abs/path/to/checkout",
  "template": "review",
  "templateData": {
    "name": "Fix the save boundary",
    "thesis": "Guard the missing record before persistence.",
    "files": [{ "path": "src/save.ts", "source": "changed", "note": "guard" }],
    "sections": [{ "title": "Boundary", "prose": "Validate the lookup first." }]
  }
}
```

Evidence and Handoff belong inside this Canvas/template as checks, results, artifacts, and a
next-step summary. Do not create parallel stores or tools for them.

## Persistence and promotion

Private Canvases live in the daemon's own store. `promote` writes a bundle to:

```text
.porcelain/canvases/<canvas-id>/
```

Promotion never stages or commits. The tracked bundle is canonical for that checkout: `list` and
`get` read it, updates rewrite it, and `delete` removes it. A successful promotion removes the
private source so a stale duplicate cannot reappear.

Keep authored content self-contained and safe to receive from Git. Never claim Evidence that was
not actually observed.
