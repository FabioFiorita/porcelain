# Review Canvas

The Review is one daemon-root Canvas template with four tabs: Intent, Process, Execution, and
Evidence. It belongs to a Project in the daemon that serves the current Environment. `review set`
is the agent-facing writer; the browser and desktop clients render the same Canvas bundle.

## Publish or update

Run from the target checkout so the CLI can resolve its Project and Worktree:

```bash
~/.porcelain/porcelain review set \
  --name "Fix null dereference on save" \
  --thesis "Guard the missing record before the save path reaches persistence."

~/.porcelain/porcelain review set \
  --name "Fix null dereference on save" \
  --thesis "…" \
  --files '[{"path":"src/save.ts","source":"changed","note":"guard"}]' \
  --sections '[{"title":"Guard the boundary","prose":"Validate the lookup before persistence.","anchors":[{"path":"src/save.ts"}]}]'

~/.porcelain/porcelain review get
```

`review set` replaces the structured set while retaining the Review Canvas identity. It writes
daemon-root Project data; it does not write a repo-local Review directory. `review clear` removes
the daemon-root Review Canvas and is reserved for an explicit replacement requested by the human.
Do not clear another active Review automatically.

The fields map directly to the tabs:

| Input | Canvas tab | Meaning |
|---|---|---|
| `--thesis` | Intent | why this unit exists and its central idea |
| `--sections` | Process | ordered walkthrough prose, optional inline SVG/HTML, and anchors |
| `--files` | Execution | the declared files, source tags, notes, and flow layers |
| Canvas Evidence bundle | Evidence | checks, Results documents, and an image/video/link gallery |

Keep the set truthful as implementation changes. The `--files` array is a deliberate review
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
harness Worktree, run the CLI from that checkout or pass its absolute `--repo` path. Runtime proof
must use an isolated Playground and dev daemon; production port 43117 and real repositories are
outside the proof boundary.
