# Architecture

This is the agreed layout and responsibility model. The server inventory foundation exists in `apps/server`; other
application and package directories are added with their first behavior. The
[inventory decision](decisions/0002-environment-inventory.md) defines identity.
[Drizzle and Fastify](decisions/0003-drizzle-and-fastify.md) own persistence and HTTP infrastructure.
Health and inventory HTTP schemas live in `packages/contracts`;
[the HTTP decision](decisions/0004-inventory-http.md) defines the current public boundary.

| Owner | Responsibility | Allowed workspace dependencies |
| --- | --- | --- |
| `apps/server` | Node server, repository operations, private persistence, HTTP/MCP and live events | contracts |
| `apps/desktop` | Electron lifecycle, local server supervision, OS integration | contracts |
| `apps/web` | React presentation shared by browser and Electron | contracts, client, design-tokens |
| `apps/mobile` | Expo presentation and native platform adapters | contracts, client, design-tokens |
| `packages/contracts` | Zod runtime schemas and inferred wire types | none |
| `packages/client` | Transport, query definitions, connections, shared client behavior | contracts |
| `packages/design-tokens` | Semantic visual values | none |

Electron packages/launches the server and web assets; it does not import their implementation.
Packages expose explicit subpath exports. Cross-package relative imports into source are forbidden.
The dependency rules live in `scripts/boundary-rules.ts` and have adversarial fixture specs.
Dependencies cannot cycle. Server use cases import internal models and adapter interfaces, not
infrastructure implementations. Model and adapter-interface guards reject server implementation imports; they do not classify every
third-party dependency. Use-case guards also reject common infrastructure libraries and direct process,
filesystem, and network APIs. Portable packages cannot import Node, Electron, React DOM, or native
platform modules. Biome also restricts direct platform globals there. This does not prove portability
against every possible third-party library or indirect global access; review remains necessary.

## Source conventions

Server code is organized by technical responsibility at both directory levels:

- `db/connection.ts` and `db/migrate.ts` own database initialization and migrations.
- `db/schema` owns named Drizzle table modules.
- `http/server.ts` configures Fastify; `http/routes` validates requests, establishes authorization
  context, calls use cases, and maps results and errors to HTTP.
- `use-cases` owns product rules and coordinates explicit dependencies independently of Fastify.
- `repositories` owns persistence queries and transactions for Porcelain-owned data.
- `models` owns internal project, worktree, and inventory types; these are not wire DTOs.
- `git` owns Git execution and output parsing.
- `app.ts` composes dependencies and coordinates operation/shutdown ordering; `main.ts` owns process
  startup and shutdown when introduced.

Nested directories describe roles, not product features: `git/commands` owns command implementations,
`git/dtos` describes discovered data, and `git/interfaces` exposes injectable Git capabilities.
`git/git.ts` is the public checkout-bound facade; shared execution lives in `git/execute-command.ts`.
Use cases live directly in `use-cases`; pure state reconciliation lives in `use-cases/reconciliation`.
Lifecycle cancellation and scheduling belong in `lifecycle`; validated runtime settings belong in `config`.
Repository dependency interfaces live in `repositories/interfaces`, separate from Drizzle implementations.
Errors live in their owner's `errors` directory with one class per file. Mappers belong in `mappers`
when translating representations; do not call identity reconciliation a mapper. DTOs describe a boundary's
input or output, not every internal model, and do not require a parallel Zod schema unless validated at runtime.

Add directories only with their implementation; do not scaffold empty roles. Dependency contracts
expose the operations consumers need without requiring concrete implementations.
Use classes for Git, repositories, and use cases, with explicit constructor dependencies and instance
methods. Use cases expose `execute()`. Git instances bind to a checkout and own command execution,
environment isolation, timeouts, and parsing. Add commands only with their implemented behavior.
Keep pure reconciliation and HTTP routes as functions. Do not introduce base classes, generic
repository frameworks, static global services, or service locators.

Named errors distinguish failures callers can handle without parsing messages. Preserve `cause` when
wrapping external failures; leave unexpected database diagnostics intact. Expected repository inspection failures mark affected entries unavailable and retain diagnostics.
System failures, cancellation, and timeouts propagate without being converted to unavailable entries.
Internal models use TypeScript types; Zod validates runtime boundaries, and Drizzle owns database
schemas. Do not duplicate an existing boundary schema with a hand-maintained DTO.

Use descriptive kebab-case module filenames and PascalCase classes/types. JavaScript and TypeScript
index modules (`index.ts`, `index.tsx`, `index.js`, and their module variants) are forbidden, including
barrels. Import named modules directly and expose explicit package subpaths. The convention gate runs
with lint in CI. Specs are colocated and named `.spec.ts` or `.spec.tsx`.

Web/mobile features use product vocabulary with platform-specific components and navigation; the
server's technical directories are not a required UI layout. Shared behavior does not imply a universal
UI framework. Styling and UI primitive libraries are undecided.
Use `async`/`await`, explicit errors, and `AbortSignal` where cancellation is required.

## State and protocol

Zod owns boundary validation; infer types instead of maintaining parallel interfaces for the same schema.
TanStack Query owns client caches of server data. Zustand owns shared presentation state; React owns
component-local state. Do not copy query data into a second authoritative store.
Query identities include environment and relevant project/worktree identity.

HTTP carries operations and artifact assets. A WebSocket per connected environment carries change
notifications and operation progress. Reconnection refreshes authoritative state rather than assuming
all events arrived. Request idempotency, event envelopes, credentials, and protocol compatibility
must be designed before implementation. Browser hosting/authentication and remote routes require
real integration proof, not assumptions based on a local connection.

## Test ownership

Pure rules use unit specs. Git, persistence, and protocol behavior use real disposable integration
fixtures. User paths gain CI smoke tests as their surface is introduced. Renderer specs need a
browser/DOM test project; Expo/native checks need their own platform setup. The Vitest project
covers tooling and disposable server inventory integration specs, not application end-to-end behavior.
