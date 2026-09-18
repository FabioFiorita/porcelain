# Guided review layers

A layer can optionally carry a `guide`: a short purpose and an ordered path through
actual source. The web layer document opens that guide first; **All layer files**
retains the existing complete diff view and review controls. Layers without guides
keep their existing behavior. Guides do not change file assignments or review marks.

## Source, not copied snippets

Each step has a stable UUID, title, review question and source reference. References
contain a repository-relative path, inclusive one-based line range, and the
`contentFingerprint` returned by `read_file`. Related references can include tests,
callers and unchanged files without assigning those files to another layer.

This first slice intentionally supports **current working-tree source only**. It
loads real text through the existing bounded, authenticated file API, checks the
fingerprint, and focuses the referenced range in the existing Pierre reader. The
whole file remains readable and inline discussion uses the existing file anchors.
It never reconstructs full source from a patch or labels current text as staged or
committed content. Before/after source hydration and changed-line highlighting in
context are follow-on work; **Current diff** keeps the existing scoped comparisons.

A changed fingerprint, absent fingerprint, missing file, invalid range, or failed
refresh is explicit. A stale range is not applied to different code. The reviewer
can still open the current file or inspect the raw changes. Multi-file reads are
best-effort observations, not an atomic repository snapshot.

## Reading position is not approval

The browser remembers only the selected step UUID, scoped by environment, project,
worktree and layer. Reordering retains that step; removing it selects the first
remaining step. Related-source detours do not change the main reading position.
Storage failure must not prevent review. This bookmark is local to the browser and
is not a synchronized checkpoint or a mark that any file has been reviewed.

Verification notes are agent-authored prose, explicitly not an attestation from
Porcelain. There is no new test runner, agent runtime, approval score or discussion
system. Human file-review controls remain in the complete diff view.

## Publication and limits

The existing revision-checked `replace_layers` operation publishes guides with the
rest of the layer set. SQLite retains the nested metadata without a migration. The
wire contract bounds titles, prose, paths, ranges, 24 steps per guide, 4 related
references per step and 1000 source references across a layer set. Source references
are not changed-file assignments and do not claim to exhaust Git changes.

Authors should organize steps around behavior and decisions, not repeat filenames
or session chronology. Read source before publishing a reference. Preserve existing
layers and revision-conflict handling. See [agent handoff](../agent-review.md).

History navigation, immutable guide snapshots, rich-report links, a collapsed
behavior-oriented sidebar, and device-synchronized resume state remain deferred.
Existing commit-association semantics are unchanged; a live-worktree guide must not
be treated as evidence about a commit merely because paths match.
