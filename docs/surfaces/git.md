# Git surfaces

Read this before adding anything that shows a diff, a commit, or a git action. Git is **supporting**
— it is not a pillar — and the failure mode here is breadth: rebuilding a git client one convenience
at a time until Porcelain is competing with the terminal it sits beside.

## The surfaces

- **Changeset** — the multi-file read of a change, ordered by the worktree profile's layers
  (`docs/surfaces/worktree-profile.md`). This is where story-ordered review actually happens, and it
  is the surface that carries pillar 3.
- **Diff** — a single file's change.
- **Commit** — one commit's detail. It stays, and it **absorbs** git surfaces as other tabs retire
  (ADR 0005); it is the natural home for git detail that no longer justifies a tab of its own.
- **History** — the log, in the right panel.
- **Quick actions and the commit composer** — stage, commit, pull, push, without a terminal.

## Rules

**One diff UX.** Changeset, diff, and commit share one renderer and one set of interactions. A
second diff implementation for a "special case" is the thing that must not happen; previews hand off
to the real surface instead of growing their own.

**Story order comes from the profile, never from git.** Git supplies the changed files; the layer
sequence supplies the order. If ordering logic starts living in the git feature, the profile has
been bypassed and pillar 3 has quietly become a git feature again.

**Unlisted files still appear.** A file matching no declared layer is shown plainly at the end. A
reviewer who cannot see a change cannot review it.

**Push stays prompted.** Pushing is outward-facing and is never the implicit consequence of another
action.

**Destructive git is not a convenience.** Discarding, resetting, and force-pushing are confirmed
explicitly, and Porcelain never runs `git add` on a user's behalf as a side effect of something else
(ADR 0002).

**Breadth is the failure, not the gap.** A missing git convenience costs one terminal command. A
half-built git client costs the identity in `product.md` — *companion, not cockpit*. When in doubt,
leave it to git.
