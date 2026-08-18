# The worktree is the core object, and it carries a profile

Porcelain's domain spine is the **worktree**, not the repository and not the Review. A worktree is
where an agent works, where a change is read, and what the client navigates between; several are
open and legible at once, because several agents run at once. The one-repository-per-window model is
gone (ADR 0001) and the one-worktree-per-window behaviour that survived it is gone with it.

Each worktree carries a **profile**: the paths pinned to the top of its tree, the paths hidden from
it, and the layer sequence that orders its story (view → RPC → controller → service → repository →
schema, or whatever that repository's architecture actually is). A profile describes *this task*,
not the repository — a web change and a mobile change in the same monorepo want different pins and
different layers, and a permanent per-repository setting cannot express that.

**The whole tree is always reachable.** Hiding is focus, never access control and never a filter the
user has to remember undoing. A worktree with no profile shows the plain tree in path order; the
stable worktree normally keeps that default.

**The agent writes the profile; the human overrides it.** The companion skill and MCP tools are the write
path, invoked when a worktree is created or when the work changes shape. This is the same division
the product uses everywhere: the agent configures and explains, the human runs and decides. It is
also the only division that scales — a human will not hand-curate pins for eight parallel worktrees,
and that is exactly when focus is worth the most.

Storage extends ADR 0002 rather than adding a store. `<repo>/.porcelain/project.json` already holds
`hiddenPaths`, `pinnedPaths`, and `worktrees`; project-level values stay the default and a worktree
profile layers over them. Private profiles live in the daemon-root Project record; promotion into
Git stays explicit and unchanged.

Two consequences worth stating, because they will be tempting to violate.

**Porcelain ships the mechanism, not the policy.** The product provides MCP tools and a companion
skill for reading and writing profiles, and nothing more. Whether a profile gets written when a
worktree is created, and what goes in it, is the user's own instruction to their own agent — wired
through their `create` hook or their repository's agent instructions. Porcelain never writes a
profile on its own initiative and never ships a default that decides this for someone. A user who
wants their tree reorganised on every worktree creation can have exactly that; a user who wants
nothing to move can have that too, without configuring anything off.

**Layers are declarative, not heuristic.** The ordering comes from what a profile names, so a
repository Porcelain has never seen is ordered by what its agent declares, not by a guess about
framework conventions. A repository with no declared layers has no story order yet — that is
correct, and better than a confident wrong order.
