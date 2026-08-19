# Sync Environments

Porcelain keeps the canonical Review Canvas, Tasks, and Actions in the daemon-root store. An
Environment is a daemon connection; a Project identifies a repository family and its Worktrees.
The browser and desktop clients always name the Environment and Worktree they are showing.

## What travels in git

Most daemon state is private to the Environment. A human can deliberately promote two overlays
into a checkout:

```text
.porcelain/
  canvases/<id>/       # a promoted Canvas bundle
  project.json         # promoted hide/pin and Worktree defaults
```

Use `porcelain_promote` with `what: "canvas"` or `what: "overrides"`; promotion never stages or commits. The
project's managed git rules keep private daemon state out of normal status while allowing these
explicit overlays to be tracked. Read [git-visibility.md](git-visibility.md) for the exact
rules.

## Moving between Environments

Open or pair the destination daemon, then let its Hub inventory discover the same Project and
Worktrees. Recreate private Actions or Canvas content in that Environment through the `porcelain_*` tools
when the human wants it there; do not copy daemon databases by hand. Use tracked overlays when the
team should receive the same Canvas or project defaults from git.

Share tracked repo-local overlays deliberately; private daemon state remains with its Environment.

Machine credentials and UI preferences stay in the daemon's user-data directory. They never enter
the checkout or an evidence bundle.
