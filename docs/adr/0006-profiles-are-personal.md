# Worktree profiles are personal, and promoted focus is retired

A Worktree profile — pinned paths, hidden paths, and ordered Layers — is **personal**. It is never
shared, never promoted into Git, and never inherited by anyone else.

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

**A profile dies with its Worktree.** It describes one task; a Worktree recreated on the same branch
months later is usually a different task, and resurrected focus reads as deliberate when it is
merely stale. This is the deliberate opposite of the Canvas rule in ADR 0002 — Canvases outlive
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

**The write path is whole-document.** `porcelain worktree profile get` and `porcelain worktree
profile set`, the latter taking the entire profile as JSON. Granular mutation verbs multiply into
many argument shapes, many validation paths, and many ways to leave a profile half-written. Agents
produce whole documents more reliably than they chain edits, and `porcelain review set` already sets
this precedent.
