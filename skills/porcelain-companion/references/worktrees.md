# Worktrees and Porcelain

The daemon owns Project state across a repository's Worktrees. A Worktree is still the target for
file reads, Git changes, terminal sessions, and actions, so always make the target explicit when a
flow could touch more than one checkout.

## Targeting

Run the CLI from inside the desired Worktree. Porcelain resolves the checkout through Git and
uses its Project identity:

```bash
cd "$WORKTREE" && ~/.porcelain/porcelain review get
~/.porcelain/porcelain --repo /abs/path/to/worktree tasks add --title "…"
```

The Review Canvas is Project-owned, while its Execution anchors and Evidence proof should describe
the Worktree that was actually inspected. Actions run only after the human chooses an Environment
and Worktree in the client. They never guess a checkout.

## Harness hand-off

When a harness creates a Worktree, keep the implementation and its proof there until the branch is
ready to merge. Publish or update the daemon-root Review through the target Worktree, include the
real checks in Evidence, and let the PR carry the final hand-off if the Worktree is removed.

Tracked `.porcelain/canvases/` and `.porcelain/project.json` overlays travel with a commit. Private
Canvas, Tasks, Actions, and other daemon state stays with the Environment. Do not seed a Worktree
by copying another daemon's private directory.

Legacy repo-local Review and queue files are migration inputs only; see [migrate.md](migrate.md).
