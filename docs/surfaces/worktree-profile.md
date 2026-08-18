# Worktree profile

Read this before writing anything that hides a path, pins a path, or orders a diff. Focus and story
order look like two features and are one mechanism — the profile (ADR 0003). Building them
separately is the mistake this document exists to prevent.

## What it is

A profile holds three things:

- **pinned paths** — lifted to the top of the tree
- **hidden paths** — folded out of the tree
- **layer order** — the sequence that orders a changeset as a story

It exists at **two levels**, and the lower one is the default. The **project** profile is the
baseline every worktree of that repository inherits — the boring things that are true whatever
you are working on. The **worktree** profile is an optional override on top of it, normally
absent. `resolveProfile` in `packages/contracts/src/worktree-profile.ts` is the one place they
meet: pins and hides are additive, `unhiddenPaths` negates an inherited hide, and layer order
replaces wholesale rather than interleaving two stories into a third neither of them meant.

One object, one write path, one CLI surface per level. A change that touches pins but not layers
still edits the profile.

## Rules

**The full tree is always reachable.** Hiding is focus, never access control and never a filter the
user has to remember to undo. Every hidden path stays one deliberate gesture away, and that gesture
is discoverable from the tree itself rather than from settings. A user must never be unable to open
a file because Porcelain decided it was uninteresting.

**A worktree with no override inherits the project profile.** It does not fall back to a plain
tree — the whole point of the lower level is that someone who never opens a second worktree, or
who wants every worktree to look the same, gets that without configuring anything off. A
repository with no profile at either level is the plain tree, and that is still a good default.

Inheritance is **live, not a copy** taken when the worktree was created. Editing the project
profile moves every worktree that has not overridden it. A snapshot per worktree would recreate
the stale-setup problem the profile exists to solve: eight places to fix instead of one.

**Profiles are personal and private** (ADR 0006). Never shared, never promoted into Git, never
inherited. `hiddenPaths` and `pinnedPaths` leave the tracked `project.json` overlay; committing
someone's focus for a teammate to inherit is incoherent when two people in one monorepo work on
unrelated parts of it. Do not fork a second store, and do not reintroduce a shared baseline.

**A worktree OVERRIDE dies with its worktree; the project baseline survives.** The override
describes one task, and resurrected task focus reads as deliberate when it is merely stale. The
baseline describes the repository, which outlives any task. `porcelain worktree profile clear`
is the manual form; dispose-time cleanup lands with the create/dispose slice. Canvases outlive
disposal because they are evidence; a profile is convenience.

**Reads and writes are whole-document.** `porcelain profile get|set` for the project level and
`porcelain worktree profile get|set|clear` for the override, `set` taking the entire profile as
JSON. No granular pin/unpin/hide/layer-move verbs — they multiply argument shapes and
half-written states, and agents write whole documents more reliably than they chain edits.

**A human gesture in the tree writes the PROJECT level.** Hide and pin from the file tree mean
"everywhere", because inheritance is the default and that is what the gesture meant before the
profile had two levels. Unhide reaches into both levels, so the escape hatch always works in one
gesture wherever the entry came from. Task-shaped, worktree-only focus is what the agent writes.

**Settings → Personalization is read-only.** It shows the two levels apart, because a single
merged list cannot say which focus is inherited and which this worktree added, and a reader who
cannot tell them apart cannot decide which one to change. It never becomes an editor: pins and
hides belong to the tree, and layers belong to the agent — the copyable prompts there are the
affordance.

**Ordering lives in `apps/daemon/src/review/flow.ts`** — `groupByLayer` is the one grouping
implementation, already shared by `buildFlow` and `buildActiveReview`. Profile-driven ordering
extends it; it never grows a second implementation beside it (ADR 0006).

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

**Layers are per worktree when they need to be.** A web change and a mobile change in one
monorepo want different sequences, and the override expresses that. Most repositories have one
sensible order most of the time, which is why the project level holds it and the override is the
exception rather than the ceremony. An override's `layers: null` inherits; `[]` declines the
project's order and falls back to the starters in `apps/daemon/src/review/default-layers.ts`.

**Unlisted paths are never dropped.** A file that matches no declared layer still appears in the
changeset, at the end, plainly. Story order groups what it knows about; it never conceals a change
because the profile did not anticipate it. This is the failure mode most likely to ship silently and
it is the most damaging one: a reviewer who cannot see a change cannot review it.

## Proving it

The pillar exists because most of a monorepo is never opened. A 745-file fixture cannot exercise
that, so scale claims are proven against a large fixture or against real use, never against the
default playground.
