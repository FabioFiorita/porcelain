# Worktree profile

Read this before writing anything that hides a path, pins a path, or orders a diff. Focus and story
order look like two features and are one mechanism — the profile (ADR 0003). Building them
separately is the mistake this document exists to prevent.

## What it is

A profile belongs to one worktree and holds three things:

- **pinned paths** — lifted to the top of the tree
- **hidden paths** — folded out of the tree
- **layer order** — the sequence that orders a changeset as a story

One object, one write path, one CLI surface. A change that touches pins but not layers still edits
the profile.

## Rules

**The full tree is always reachable.** Hiding is focus, never access control and never a filter the
user has to remember to undo. Every hidden path stays one deliberate gesture away, and that gesture
is discoverable from the tree itself rather than from settings. A user must never be unable to open
a file because Porcelain decided it was uninteresting.

**A worktree with no profile behaves like a plain tree.** Path order, nothing pinned, nothing
hidden, no story order. This is the default and it is a good default — a stable worktree usually
keeps it.

**Profiles layer over project defaults.** `<repo>/.porcelain/project.json` already carries
`hiddenPaths` and `pinnedPaths` (ADR 0002); those remain the project-wide baseline and a worktree
profile overrides them. Do not fork a second store.

**Porcelain ships the mechanism, not the policy.** CLI verbs and a companion skill are the entire
product surface. Whether a profile is written when a worktree is created, and what goes in it, is
the user's instruction to their own agent — through their `create` hook or their repository's agent
instructions. Porcelain never writes a profile on its own initiative and never ships a default that
makes this decision for someone.

**Layers are declarative, not heuristic.** Ordering comes from what the profile names. Porcelain
never infers layers from framework conventions, directory names, or import graphs, because a
confident wrong order is worse than none — it makes a reader trust a story that isn't true. A
repository with no declared layers has no story order yet, and the changeset falls back to a plain,
honest ordering.

**Layers are per worktree because tasks differ.** A web change and a mobile change in one monorepo
want different sequences. A design that can only express one ordering per repository has missed the
point of the pillar.

**Unlisted paths are never dropped.** A file that matches no declared layer still appears in the
changeset, at the end, plainly. Story order groups what it knows about; it never conceals a change
because the profile did not anticipate it. This is the failure mode most likely to ship silently and
it is the most damaging one: a reviewer who cannot see a change cannot review it.

## Proving it

The pillar exists because most of a monorepo is never opened. A 745-file fixture cannot exercise
that, so scale claims are proven against a large fixture or against real use, never against the
default playground.
