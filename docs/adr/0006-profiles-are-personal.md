# Worktree profiles are personal, and promoted focus is retired

A profile — pinned paths, hidden paths, and ordered Layers — is **personal**. It is never shared,
never promoted into Git, and never inherited by anyone *else*.

**Amended: the profile has two levels, and Layers have a project-level default.** This ADR first
argued that Layer order is per-task only. That argument survives — see below — but it was made
against an empty field, and using the thing showed the default was wrong way round. A profile
that starts blank in every worktree is a profile nobody fills in: the person who wanted the same
focus everywhere had to restate it per worktree, and the person who wanted per-task focus was no
better served, because a stale hand-curated set is what they had already. So the **project**
profile is now the baseline every Worktree of that repository inherits, and the **Worktree**
profile is an optional override on top of it.

Nothing about *personal* changes. The project level lives in the daemon-root private Project
record, not in the tracked `.porcelain/project.json`, and `stripPersonalProfileFields` drops
`layers` and `worktreeProfiles` on the READ path as well as on promotion — a hand-written Layer
order committed into a checkout must not reach a reader. Two developers in one monorepo still get
entirely different profiles; they simply each get one that is worth having.

The per-task argument below is why the override exists at all, and it is unchanged.

The argument is the monorepo it was built for. Two developers in one large repository work on
entirely different parts of it: one on the web client, one on an unrelated team's services. Their
useful pins are different, their useful hides are different, and — this is the part that surprised
us — **their useful Layers are different too**. Layer order looked at first like shared architectural
knowledge, the kind of thing a repository could declare once. It is not. A layer sequence describes
the path a *particular* change travels, and someone working on a different part of the system reads
a different path. Focus and story order have the same owner, the same lifetime, and the same
personal scope, which is why they are one object rather than two.

**This retires promoted focus.** ADR 0002 shipped `hiddenPaths` and `pinnedPaths` as part of the
tracked `<repo>/.porcelain/project.json` overlay (#26). Committing personal focus into a shared
repository is incoherent under this decision — a teammate who pulls it inherits pins chosen for
someone else's task. Those two keys leave the promotable overlay; `project.json` keeps `worktrees`.
Canvas promotion is untouched: a Canvas is evidence, which is worth sharing, and focus is
convenience, which is not.

**A worktree OVERRIDE dies with its Worktree; the project baseline survives.** The override
describes one task; a Worktree recreated on the same branch months later is usually a different
task, and resurrected focus reads as deliberate when it is merely stale. The baseline describes
the repository, which outlives every task in it. This is the deliberate opposite of the Canvas rule in ADR 0002 — Canvases outlive
Worktree disposal because losing evidence loses proof, while a profile is cheap to rewrite and, if a
create Action is wired, rewritten before anyone notices it was gone.

**Layer ordering stays daemon-side, in `apps/daemon/src/review/flow.ts`.** This decision was first
written the other way — a pure function in `client-runtime` — and that was wrong, because it was
argued against an empty field. `flow.ts` already implements it: `Layer`, `compileLayers`,
`layerForCompiled`, and `groupByLayer`, described in its own comment as "the ONE grouping
implementation" and shared by `buildFlow` and `buildActiveReview`. It is landed and tested.

Reusing it costs nothing and keeps one implementation; porting it would re-test working code to
satisfy an argument made in ignorance of it. The cross-domain worry that drove the original
placement is also smaller than assumed: `flow.ts` lives under `review/`, not under `git/`, so
profile-driven ordering does not make the Git domain reach for profile data. Profile-driven
changeset ordering extends this function rather than growing a second one beside it — two grouping
implementations is the outcome to avoid, and it is the outcome the first version of this paragraph
would have produced.

**The write path is whole-document.** `porcelain profile get|set` for the project level and
`porcelain worktree profile get|set|clear` for the override, `set` taking the entire profile as
JSON. Granular mutation verbs multiply into
many argument shapes, many validation paths, and many ways to leave a profile half-written. Agents
produce whole documents more reliably than they chain edits, and `porcelain review set` already sets
this precedent.
