# Navigator

Read this before touching the left rail. The navigator is Porcelain's spine — it is the only thing
that lives on the left, and every surface that used to share that space now lives in the right panel
(ADR 0005).

## What it is

Projects expand to worktrees. Selecting a worktree switches the window to it. That is the whole
model, and its quality is measured in one thing: **how fast you can move between worktrees when
several agents are working at once.** Parallel worktrees are the normal case here, not the advanced
one — a navigator that is pleasant with two and unusable with eight has failed.

## Rules

**Worktrees are peers, not children of a window.** Two worktrees of the same project are read
without opening a second window. If a change makes "open another window" the answer to anything,
it is wrong — that is the behaviour ADR 0003 exists to remove.

**The rail holds navigation only.** No file lists, no commit lists, no search, no recent-search.
Those are right-panel surfaces. When something needs to be somewhere, the right panel is the
default answer and the rail is the exception that must be argued for.

**Creation takes a branch and a destination.** The user picks both. Porcelain does not decide where
a worktree lands on disk — that choice is the main thing missing from the tools this replaces, and
guessing it well is not a substitute for asking.

**Creation and disposal run repository hooks.** A repository declares a `create` hook and a
`dispose` hook; Porcelain runs them and shows their output. Hooks are how a repository installs
dependencies, seeds a database, links a config, writes a worktree profile, or tears any of that
down. Porcelain has no opinion about what belongs in them.

**Hook failure is visible and non-destructive.** A failing `create` hook leaves the worktree in
place with the failure shown, rather than rolling back work the user may want to inspect. A failing
`dispose` hook stops disposal rather than deleting a worktree whose teardown did not complete.

**Disposal is destructive and always confirmed.** It removes a worktree. It is never the accidental
outcome of a mis-click, and it never runs without the human choosing it.

## Relationship to Actions

Hooks and Actions are the same idea at different lifecycle points, and they share a store
(`$PORCELAIN_HOME/projects/<projectId>/actions.json`, ADR 0002): saved named commands, agent-curated
and human-run. Hooks are the two Actions bound to worktree creation and disposal. Adding a second,
parallel mechanism for "a command this repository runs" is the mistake to avoid.

## Proving it

A single playground fixture proves nothing about a rail whose job is switching. Exercise it against
a fleet with several projects and several worktrees per project, and against a repository large
enough that rendering the tree is not free.
