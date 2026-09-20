# 0002: Environment-owned inventory

Status: accepted.

An environment is one independently managed server data directory, with a persistent random ID.
Addresses are connection routes, not identity: LAN, Tailscale, and HTTPS can reach the same environment.
Each client connects directly to each environment. Environment identity does not establish trust;
authentication and route fallback remain separate design work.

## Registration and discovery

Registration is explicit. Registering any checkout discovers its main checkout first and all linked
worktrees. They share one project ID. A separate clone is a separate project, regardless of remote URL.
Porcelain reads Git inventory; worktree creation and removal belong to external tools.

Porcelain assigns IDs independently of paths and branches. The Git adapter uses filesystem device,
inode, and birth time of the common Git directory and individual checkout Git directories as matching
evidence. This preserves ordinary same-filesystem moves and distinguishes recreated metadata directories.
Filesystems without birth time are unsupported for registration in this slice. Copying across filesystems,
restoring repository metadata, and Git repairs that replace metadata do not establish continuity.
No matching scheme here claims to prove continuity under arbitrary filesystem restoration.

An unreachable repository retains unavailable last-known entries. A worktree still reported by Git but
not inspectable also remains unavailable. Once an accessible repository no longer reports a worktree,
it disappears from active inventory. Future review-history retention is a separate decision.
A moved repository can be registered at its new path; matching metadata preserves its project identity.
There is no disk scan or automatic search for moved repositories.

## Persistence and refresh

One SQLite database in an explicitly supplied absolute data directory stores the environment ID and
project/worktree associations. The stable Drizzle adapter uses `better-sqlite3`.
Drizzle owns relational environment, project, and worktree tables and migration execution, as defined
in the [persistence and transport decision](0003-drizzle-and-fastify.md). Project inventory updates
are transactional. Migration-history validation runs before access and rejects unsupported histories.

Startup and explicit refresh inspect registered Git state. Registration inspects its target and refreshes
only old projects with overlapping checkout paths, so unrelated repositories do not delay registration.
Operations within an application instance are serialized. One server instance owns a data directory;
the [local startup decision](0005-local-server-startup.md) defines executable ownership enforcement
and loopback listening. Process supervision remains separate work.

A restored environment data directory retains its ID. Running an active clone requires a new identity;
cloning, migration tooling, and backup procedures are not supported workflows yet.

Clients may retain last-known navigator entries, visibly unavailable until refreshed. Offline or loading
projects must not permit inspection. TanStack Query focus/reconnect behavior belongs to the future clients.
Authenticated inventory HTTP is defined in [the HTTP decision](0004-inventory-http.md). There is no client cache or UI.

## Package scope

The server composition accepts an isolated data directory and an optional Git adapter. The health
and inventory response schemas are shared through explicit contracts subpaths. Internal filesystem
identity evidence remains server-private. Workspace type checking covers package consumers; the [Git package decision](0006-git-package-and-task-cache.md) now defines cached task ordering.

[Explicit project removal](project-removal.md) defines the user-requested deletion exception to retention,
including associated review data and operation recovery constraints.

Superseded, 2026-09-20: Git owns the worktree list. `git worktree list` is read on the way out of
every inventory request; no table stores worktrees, and nothing reconciles a stored list against a
discovered one. A worktree's ID is derived, not assigned: the SHA-256 of a version prefix, the
project ID and the device, inode and birth time of the worktree's administrative Git directory,
truncated to 32 hex characters. The same checkout therefore keeps its ID across moves and restarts
without anything being written down, and a recreated metadata directory gets a new one. Derivation
is best effort — inode reuse, coarse birth time and network filesystems can all break it — and the
[worktree ID model](../../apps/server/src/models/worktree-id.ts) says what that costs.

Resolution is an in-memory map rebuilt by each listing, so review data can be reached for a worktree
Git has stopped reporting. `worktree_presence` records when a successful listing first omitted an ID;
after thirty days [collection](../../apps/server/src/use-cases/collect-absent-worktrees.ts) deletes
that worktree's review data. Only a successful listing sets absence: an unreachable repository
leaves presence alone, so an unplugged drive never starts the clock.

Environment identity and project metadata are read without Git, so health and pairing never wait on a
repository. Existing review data carried over in one migration
([0004_worktrees_from_git.sql](../../apps/server/drizzle/0004_worktrees_from_git.sql)), which rewrote
both ID columns and the IDs inside stored JSON payloads in a single transaction. Rows it could not map
kept their legacy IDs rather than being attached to a worktree by path.

A registered project is listed with one Git process: the server already stores its common
directory, so nothing has to go and find it first. Discovering a repository from an arbitrary
checkout still costs the extra `rev-parse`. A checkout folder someone deleted is unreadable
rather than gone — Git still reports it and its administrative directory still exists, so it
keeps its ID and its review data, and only a real omission from Git's list starts the clock.
Every resolution asks the checkout whether it still belongs to that administrative directory,
so a different repository moved into its path is refused rather than read.
