# Worktrees and Porcelain

The daemon owns Project state across a repository's Worktrees. A Worktree is still the target for
file reads, Git changes, terminal sessions, and actions, so always make the target explicit when a
flow could touch more than one checkout.

## Targeting

Name the Worktree in `workspace` on every call. The absolute path of the checkout you are standing
in is the ordinary answer; Porcelain resolves it through the Hub inventory and uses that Project
and Worktree identity:

```jsonc
porcelain_canvas { "op": "get", "workspace": "/abs/path/to/worktree", "id": "…" }
```

To act on a checkout other than your own, read the ids first and pass them:

```jsonc
porcelain_project { "op": "list" }
porcelain_canvas { "op": "get", "workspace": { "projectId": "…", "worktreeId": "…" }, "id": "…" }
```

A Decision Canvas is stored under the Project and uses the Worktree named by `workspace` for its
repository file references. Update the returned Canvas id as the same decision changes. Actions run
only after the human chooses an Environment and Worktree in the client. They never guess a checkout.

## Harness hand-off

When a harness creates a Worktree, keep the implementation and its proof there until the branch is
ready to merge. Update the relevant Decision Canvas through the target Worktree and let the PR
carry the final hand-off if the Worktree is removed.

Tracked `.porcelain/canvases/` and `.porcelain/project.json` overlays travel with a commit. Private
Canvas, Actions, and other daemon state stays with the Environment. Do not seed a Worktree
by copying another daemon's private directory.
