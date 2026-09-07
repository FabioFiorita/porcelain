# Architecture

This is the agreed layout and responsibility model. The server inventory foundation exists in `apps/server`; other
application and package directories are added with their first behavior. The
[inventory decision](decisions/0002-environment-inventory.md) defines identity.
[Drizzle and Fastify](decisions/0003-drizzle-and-fastify.md) own persistence and HTTP infrastructure.
The health response is the first schema in `packages/contracts`.

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
Dependencies cannot cycle. Portable packages cannot import Node, Electron, React DOM, or native
platform modules. Biome also restricts direct platform globals there. This does not prove portability
against every possible third-party library or indirect global access; review remains necessary.

## Source conventions

Server code is organized by responsibility, with product grouping inside each directory when useful:

- `db/connection.ts` and `db/migrate.ts` own database initialization and migrations.
- `db/schema` owns named Drizzle table modules.
- `http/server.ts` configures Fastify; `http/routes` validates requests, establishes authorization
  context, calls use cases, and maps results and errors to HTTP.
- `use-cases` owns product rules and coordinates explicit dependencies independently of Fastify.
- `repositories` owns persistence queries and transactions for Porcelain-owned data.
- `git` owns Git execution and output parsing.
- `app.ts` composes dependencies; `main.ts` owns process startup and shutdown when introduced.

The current inventory implementation still needs to be aligned with this layout. Add directories only
with their implementation; do not scaffold empty roles. Dependency interfaces belong with their consumer.
Use plain functions by default. Classes may clarify dependencies or lifecycle; do not introduce base
classes, generic repository frameworks, or service locators.

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
