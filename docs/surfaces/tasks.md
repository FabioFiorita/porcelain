# Tasks

Read this before changing the Tasks table. Tasks is the one surface that deliberately does **not**
scope to a worktree.

## What it is

One personal board across every project: things to do, with tags, statuses, descriptions, and
attachments. Agents read it and pick work up from it. It replaced the repo-local Board, which was
the wrong shape because the work it tracked was never confined to one repository.

The reference point is Linear, and the specific quality being copied is **how little friction there
is between having a thought and it being on the board.**

In the browser shell, Tasks is a left-rail row (not a right-hand Surface). Clicking it opens the
board in the Viewer without changing the selected worktree. The row plus (and ⌘⇧N when Files is
not focused) opens a new-task dialog. Pictures, file/folder tags, and project/worktree tags are
coming soon.

## Rules

**Tasks span projects, and that is the feature.** A task references a Project, Environment, or
Worktree explicitly when it needs to; it is never filed inside one. Tasks live in
`$PORCELAIN_HOME/tasks/` and never appear in a repository.

**Quick Add is the surface that matters most.** Adding a task is measured in gestures, not
capabilities. **Pasting a screenshot is a first-class path**, not an attachment flow behind a
button — the most common thing worth capturing is something on screen right now, and every step
between seeing it and it being on the board is a step where the thought is lost.

**Agents read and write it over the CLI.** That seam is the point: an agent picks up a task and
starts working. Tasks does not need to chain into Canvas or execution to earn its place, and
building that chain is not a prerequisite for the pillar.

**Every write names the Environment it targets.** The Hub aggregates the Environments it can reach
and omits the ones it cannot; an ambiguous target is rejected rather than guessed.

**It must be good on a narrow viewport.** The current board is awkward on both web and mobile. A
table that only works at desk width has not shipped.

## What it is not

Not Jira. Not a workflow engine, not estimates, not sprints, not assignees — this is one person's
board across their own projects. Every field added is friction on the gesture that matters, so a new
field has to earn its place against Quick Add getting slower.
