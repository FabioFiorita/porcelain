# Sync environments (project companion)

Porcelain stores **project companion data** in the repo:

```text
<repo>/.porcelain/
  actions.json         # shared by default
  scope.json           # shared by default
  layers.json          # shared by default
  board.json           # local by default
  notes.md             # local by default
  feature-view.json    # app-computed snapshot, never shared
  active-review/       # the unit in flight — always ignored
    review.json  intent/  evidence/  comments.json  reviewed.json
  reviews/<id>/        # archived units; local until published
  .gitignore
```

Machine secrets (daemon token, remotes, UI prefs) stay under `~/.porcelain` (or
`PORCELAIN_HOME` for the dev stack). They are never copied into the work tree.

## Share with a teammate or another machine

1. Lift the clone-wide exclude if it is still there — Porcelain hides
   `.porcelain/` from git until you share something. See
   [git-visibility.md](git-visibility.md).
2. Pick what to share (Settings › Data, or edit the managed block in
   `.porcelain/.gitignore` directly).
3. Commit and push.
4. Teammate (or remote clone) pulls — the shared channels are present. A clone
   that already tracks a companion is never re-hidden.

There is **no** daemon-side “copy settings between remotes” or “seed worktree”
path. Linked worktrees share whatever is on the checked-out revision of
`.porcelain/` (same as any other project file).

## One-way migrate from home (existing installs)

Older Porcelain stored channels in `~/.porcelain/*.json` keyed by absolute path.
On open, if the repo has no `.porcelain/` yet but home still has data for that
path, Porcelain copies it into the repo once and **purges** the home keys. There
is no move-back.

Greenfield projects write `.porcelain/` on first companion write (CLI or app).
