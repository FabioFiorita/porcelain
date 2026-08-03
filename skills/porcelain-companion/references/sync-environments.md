# Sync environments (project companion)

Porcelain stores **project companion data** in the repo:

```text
<repo>/.porcelain/
  actions.json
  board.json
  layers.json
  scope.json
  notes.md
  review.json          # active unit
  comments.json
  reviewed.json
  feature-view.json    # app-computed snapshot
  evidence/            # gitignored by default
  reviews/<id>/        # archived units
  .gitignore
```

Machine secrets (daemon token, remotes, UI prefs) stay under `~/.porcelain` (or
`PORCELAIN_HOME` for the dev stack). They are never copied into the work tree.

## Share with a teammate or another machine

1. Track the files you want under `.porcelain/` (edit `.porcelain/.gitignore` —
   evidence is ignored by default).
2. Commit and push.
3. Teammate (or remote clone) pulls — companion data is present.

There is **no** daemon-side “copy settings between remotes” or “seed worktree”
path. Linked worktrees share whatever is on the checked-out revision of
`.porcelain/` (same as any other project file).

## One-way migrate from home (existing installs)

Older Porcelain stored channels in `~/.porcelain/*.json` keyed by absolute path.
On open, if the repo has no `.porcelain/` yet but home still has data for that
path, Porcelain copies it into the repo once and **purges** the home keys. There
is no move-back.

Greenfield projects write `.porcelain/` on first companion write (CLI or app).
