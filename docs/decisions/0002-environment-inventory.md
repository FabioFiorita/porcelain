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
process supervision and enforcing exclusive ownership across processes belong to server startup work.
There is no executable server entrypoint or network listener in this slice.

A restored environment data directory retains its ID. Running an active clone requires a new identity;
cloning, migration tooling, and backup procedures are not supported workflows yet.

Clients may retain last-known navigator entries, visibly unavailable until refreshed. Offline or loading
projects must not permit inspection. TanStack Query focus/reconnect behavior belongs to the future clients.
Authenticated inventory HTTP is defined in [the HTTP decision](0004-inventory-http.md). There is no client cache or UI.

## Package scope

The server composition accepts an isolated data directory and an optional Git adapter. The health
and inventory response schemas are shared through explicit contracts subpaths. Internal filesystem
identity evidence remains server-private. Recursive pnpm type checking covers both packages; revisit
Turborepo when build ordering or reusable task outputs justify it.
