# Guided review layers

A layer can optionally carry a `guide`: a short purpose and an ordered path through
actual source. The layer opens the guide first. **All layer files** retains the
complete assigned diffs and explicit reviewed controls. Layers without a guide
continue to open their files. File counts and unassigned changes remain independent
of guide references.

## First slice and trust boundary

References identify current-worktree UTF-8 source with a repository-relative path,
one-based inclusive line range and the `contentFingerprint` returned by `read_file`.
This is not a `review_evidence` fingerprint, an index snapshot, or a commit snapshot.
The client reads only the selected source, including unchanged files and related
sources assigned to other layers. It polls that source while the document is active.
It does not claim that unvisited references are current.

A matching fingerprint and valid range open actual complete source through Pierre
and scroll to the referenced lines. Full-document content preserves syntax context,
absolute line numbers and existing current-file comment anchors. A missing file,
failed refresh, absent fingerprint, changed content or invalid range displays an
explicit explanation instead of silently pointing at different code. **Open full
file** remains an escape hatch. **Current diff** shows the live comparisons for that
path, including staged and unstaged changes, and does not claim to be the guide's
published snapshot.

This slice does not reconstruct immutable before/after content or overlay changed
lines on the source view. Those require versioned source reads, not a larger patch
container. Deleted or binary sources remain inspectable in the existing diff/file
surfaces when supported; the guide does not invent a text preview.

Verification notes are agent-provided instructions or claims, not passing-check
attestations. Reading a guide never marks a file reviewed. Source comments reuse the
existing thread model. Only the last selected step ID is saved locally, scoped to
environment, project, worktree and layer. Missing steps fall back to the first;
reordering retains stable IDs. Related-source detours preserve that selected step.
Browser storage failure must not prevent review.

## Metadata and compatibility

The optional guide is validated and replaced atomically with the existing layer
revision. SQLite's JSON storage needs no migration. Bounds include 24 steps per
guide, 4 related sources per step and 1000 references across a layer set. A guide
reference is context, not an additional changed-file assignment.

Commit association deliberately copies titles, summaries and selected files without
the live-source guide. Path membership alone cannot establish guide/content
identity after a split commit, amend or rebase. Historical guided navigation,
immutable source snapshots, rich-report links, a behavior-oriented sidebar and
cross-device resume remain follow-on work.

For authoring and the existing MCP workflow, see [agent handoff](../agent-review.md).
