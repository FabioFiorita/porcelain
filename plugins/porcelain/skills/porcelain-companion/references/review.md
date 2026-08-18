# Review Canvas

The Review is one daemon-root Canvas template with four tabs: Intent, Process, Execution, and
Evidence. It belongs to a Project in the daemon that serves the current Environment.
`porcelain_review` is the agent-facing writer; the browser and desktop clients render the same
Canvas bundle.

## Publish or update

`porcelain_review` takes `workspace` (the checkout path) and a `mode`:

```jsonc
// Intent-first: a name and a thesis, before a file is listed.
{ "workspace": "/abs/path/to/checkout", "mode": "replace",
  "name": "Fix null dereference on save",
  "thesis": "Guard the missing record before the save path reaches persistence." }

// The whole set.
{ "workspace": "/abs/path/to/checkout", "mode": "replace",
  "name": "Fix null dereference on save",
  "thesis": "…",
  "files": [{ "path": "src/save.ts", "source": "changed", "note": "guard" }],
  "sections": [{ "title": "Guard the boundary",
                 "prose": "Validate the lookup before persistence.",
                 "anchors": [{ "path": "src/save.ts" }] }] }

// Add files to the Review that already exists.
{ "workspace": "/abs/path/to/checkout", "mode": "append",
  "files": [{ "path": "src/save.test.ts", "source": "changed" }] }
```

Read it back with `porcelain_context` (`include: ["review"]`).

`mode: "replace"` replaces the structured set while retaining the Review Canvas identity. It writes
daemon-root Project data; it does not write a repo-local Review directory. `mode: "clear"` removes
the daemon-root Review Canvas and is reserved for an explicit replacement requested by the human.
Do not clear another active Review automatically.

The fields map directly to the tabs:

| Input | Canvas tab | Meaning |
|---|---|---|
| `thesis` | Intent | why this unit exists and its central idea |
| `sections` | Process | ordered walkthrough prose, optional inline SVG/HTML, and anchors |
| `files` | Execution | the declared files, source tags, notes, and flow layers |
| Canvas Evidence bundle | Evidence | checks, Results documents, and an image/video/link gallery |

Keep the set truthful as implementation changes. The `files` array is a deliberate review
selection, not an automatic dump of the working tree. A section should explain an invariant or
boundary rather than repeat one file per paragraph.

## Evidence

Evidence is part of the Canvas bundle. It is the proof of the loop, not a second Review lifecycle:

- checks record commands and their real result;
- Results documents explain output that needs more than a label;
- the gallery holds screenshots, recordings, and safe external links.

Use the app's Evidence tab or the Canvas writer used by the surrounding workflow to add this data.
The renderer treats authored HTML as sandboxed content and keeps scripts disabled for received or
tracked bundles. Keep documents self-contained, include CSS, and use relative local media.

Evidence must be proportional to the change and real. A passing unit test does not prove a
browser-visible change; include browser proof for UI work and the relevant command output for
integration work. Never claim a check that did not run.

## Targeting

The Review is Project-owned, while file anchors and actions can name a Worktree. When working in a
harness Worktree, pass that checkout's absolute path as `workspace`. Runtime proof
must use an isolated Playground and dev daemon; the production home/listener and real repositories are
outside the proof boundary.
