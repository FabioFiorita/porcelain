# Git visibility — what the repo carries

Companion data lives in `<repo>/.porcelain/`. **Where it lives never changes; only what git does with it does.** There is no second storage location and no "which copy wins" — one place on disk, three layers of git rules.

**These are plain files in the repo. Edit them directly with your normal tools — there is no CLI verb for them, and none is needed.** The CLI exists to read and write the *channels* (board, actions, review, …); git disposition is just text.

## Contents

- **The three layers** — the whole model in one table
- **Layer 0 — the Git overlay**: what promotion puts in the repo, and the verbs that do it
- **Layer 1 — the clone exclude** (`info/exclude`), and how to lift it
- **Layer 2 — the managed block** in `.porcelain/.gitignore`
- **Layer 3 — publishing one review** past the ignore rule
- **Worktrees** — why visibility is one decision per clone
- **Checking your work**

## The three layers

| Layer | Where | Scope | Question |
|---|---|---|---|
| **Git overlay** | `.porcelain/canvases/`, `.porcelain/project.json` | Per promoted item | What did someone deliberately put in the repo? |
| **Clone exclude** | `$GIT_COMMON_DIR/info/exclude` | Whole clone, every worktree | Is Porcelain visible to git here at all? |
| **Managed block** | `.porcelain/.gitignore` | Per channel | Once visible, what is shared? |
| **Always-ignored** | same file, same block | Fixed | Derived + in-flight state, never shared |

Later rules win, and **git cannot re-include a path whose parent directory is excluded** — that single fact explains most of the layout below.

## Layer 0 — the Git overlay

Canvases and Project defaults live in the **daemon's private store**, not in the repo. `.porcelain/`
appears in a working tree only when someone **promotes** something into it. Promotion is always
explicit, always names a target checkout, and always writes plain files — it never runs `git add`
and never commits. You decide when the result enters history.

| Promoted | Path | Verb |
|---|---|---|
| A Canvas bundle | `.porcelain/canvases/<id>/` (files + `canvas.json`) | `canvas promote --id <id>` |
| Project defaults | `.porcelain/project.json` (`hiddenPaths`, `pinnedPaths`, `worktrees`) | `project promote-overrides` |

```bash
# Move one private Canvas into this checkout's overlay (default target: this repo)
~/.porcelain/porcelain canvas promote --id <canvas-id>
~/.porcelain/porcelain canvas promote --id <canvas-id> --worktree /abs/path/to/checkout

# Track the current hidden/pinned defaults so a clone starts focused the same way
~/.porcelain/porcelain project promote-overrides
~/.porcelain/porcelain project promote-overrides --hidden apps/legacy --pinned apps/web,apps/api

# Update a Canvas that is ALREADY tracked — writes the tracked path on purpose
~/.porcelain/porcelain canvas set --tracked --id <canvas-id> \
  --title 'Architecture' --kind html --source-dir /abs/dir
```

**A promoted Canvas is canonical.** Promotion *moves* the bundle: the private copy is deleted, so a
tracked and a private version can never drift apart. Tracked wins over private for the same id, and
Porcelain never writes back into a tracked bundle on its own — `canvas set --tracked` is the only
way to change one, and it is something you do deliberately.

Two consequences worth remembering:

- **Opening a repository creates nothing.** If you have not promoted, `.porcelain/` does not exist
  and `git status` is untouched. Do not create it by hand to "set things up".
- **A promoted Canvas is third-party code once it can be cloned.** Porcelain serves it with
  `script-src` pinned to its own link bridge, so author scripts in a tracked Canvas do not run.
  Keep tracked Canvases to markup, CSS, images, and links; put anything interactive in a private
  Canvas instead.

## Layer 1 — the clone exclude

Porcelain writes `.porcelain/` into `$GIT_COMMON_DIR/info/exclude` **before the first companion file lands**, so opening a project never changes its `git status`. It is skipped entirely when the repo already tracks companion files (someone shared it for the team).

```bash
git rev-parse --git-common-dir           # where info/exclude actually lives
grep -n porcelain "$(git rev-parse --git-common-dir)/info/exclude"
```

**To start sharing, remove that line.** Either edit the file, or let the human flip any channel to Shared in Settings › Data, which removes it for them.

```bash
# Make the WHOLE companion visible to git in this clone (idempotent)
EX="$(git rev-parse --git-common-dir)/info/exclude"
grep -vE '^\.porcelain/?\*?$|^!\.porcelain/' "$EX" > "$EX.tmp" && mv "$EX.tmp" "$EX"
```

**Promotion rewrites this line rather than removing it.** The blanket `.porcelain/` becomes
`.porcelain/*` plus one negation per overlay path (`!.porcelain/canvases/`,
`!.porcelain/project.json`). Git will not descend into an excluded *directory*, so no negation under
the blanket form could ever be reached; excluding the contents instead makes the promoted paths
visible while every other channel stays exactly as hidden as before. A repo that already tracks its
companion is left alone.

While the exclude is in place, **negation rules inside `.porcelain/.gitignore` do nothing** — the parent is excluded, so git never descends to read them. `git add -f` still reaches through, which is how publishing one review works from an otherwise hidden companion.

**Never write to the repo's root `.gitignore`.** That file is tracked: putting Porcelain there lands it in the human's diff and then in their history permanently. `info/exclude` is per-clone and never committed. This is a hard rule.

## Layer 2 — the managed block

`.porcelain/.gitignore` carries a block Porcelain owns:

```
# >>> porcelain:managed — Settings › Data owns these lines
…
# <<< porcelain:managed
```

**Anything outside those markers is the human's and is never rewritten** — put your own rules there freely. Inside the block, a channel is Local when its pattern is present:

| Channel | Pattern | Default |
|---|---|---|
| Saved actions | `/actions.json` | Shared |
| Repo notes | `/notes.md` | Local |
| Hidden & pinned paths | `/scope.json` | Shared |
| Flow layers | `/layers.json` | Shared |
| Board | `/board.json` | Local |
| Reviews | `/reviews/*` | Local |

Reviews ignores the **contents** (`/reviews/*`), not the directory, precisely so a single review can be negated back in.

Always ignored, no toggle: `/active-review.json` (derived), `/active-review/` (the unit in flight),
the current disposable `/.migrated-from-home` marker, `*.tmp`, `*.corrupt-*`, and per-review
evidence.

## Layer 3 — publishing one review

Publishing appends negations **after** everything else, so they win:

```
!/reviews/<id>/
!/reviews/<id>/**
```

Both lines are needed: git will not descend into an excluded directory, so re-including only `**` is never reached, and re-including only the directory leaves the evidence glob winning underneath. The human triggers this from the Review rail; it also lifts the clone exclude, because otherwise the rule is inert.

**A published review is committed with its rule**, so the repo itself records what the team shares and `git check-ignore -v <path>` can explain any decision.

## Worktrees

`info/` resolves through `$GIT_COMMON_DIR` (see `gitrepository-layout`), so **there is no per-worktree exclude file**. One entry covers every worktree of a clone, including ones created later. That is also the right scope: sharing is a property of the project, not of a branch.

What this means in practice:

- **`.porcelain/` is per checkout** — each worktree has its own board, notes, and active review on disk. Shared channels arrive with the checkout because git carries them.
- **The visibility decision is per clone** — you cannot hide in one worktree and share in another, and you should not try.
- **The active review is per worktree by design.** `active-review/` is always ignored, so two worktrees never fight over one review file.
- Run the CLI **from inside the worktree** and it targets that checkout (git toplevel of the cwd). Use `--repo <absolute path>` only to reach a different one.

```bash
cd /path/to/worktree && ~/.porcelain/porcelain review get      # this checkout
~/.porcelain/porcelain --repo /path/to/other review get        # a different one
```

## Checking your work

```bash
git check-ignore -v .porcelain/board.json     # which rule decided, and where
git status --porcelain=v1 -uall               # what the human will actually see
git ls-files .porcelain                       # what the team already tracks
```

If `check-ignore` names `info/exclude`, the whole companion is hidden and the per-channel rules are not in play yet.
