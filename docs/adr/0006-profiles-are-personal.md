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

**Layer ordering is a pure function in `client-runtime`.** Ordering a changed-file list by declared
Layers is pure UI semantics, which `internals/architecture.md` already assigns to that package.
Computing it daemon-side would make the `git` domain reach into profile data — a cross-domain
coupling that hard rule 4 forces through a narrow capability for no benefit. Computing it per client
duplicates it. It is a pure function over two plain inputs, which makes it cheap to test in the
layer where coverage is thinnest. `apps/mobile` is frozen and will not call it; that is accepted,
and the placement stands on the remaining reasons.

**The write path is whole-document.** `porcelain worktree profile get` and `porcelain worktree
profile set`, the latter taking the entire profile as JSON. Granular mutation verbs multiply into
many argument shapes, many validation paths, and many ways to leave a profile half-written. Agents
produce whole documents more reliably than they chain edits, and `porcelain review set` already sets
this precedent.
