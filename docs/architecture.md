# Architecture

This is the agreed layout and responsibility model. Only engineering tooling exists today;
application directories are added when their first behavior is implemented.

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

## Feature conventions

Use product vocabulary for feature folders: `projects`, `worktrees`, `files`, `changes`, `comments`,
`artifacts`. Use kebab-case filenames and PascalCase classes/types. Specs are colocated.
A server feature can have `<feature>.handler.ts`, `<feature>.service.ts`, and
`<feature>.repository.ts`, but only create the roles it needs. Git is an external adapter, not a
Porcelain database repository. Dependency interfaces belong with their consumer.

Handlers validate requests, establish authorization context, call services, and map errors.
Services own product rules and coordinate dependencies. Repositories persist Porcelain-owned data.
Adapters isolate filesystem, Git, database, and process details. Plain functions implement pure rules.
Classes are useful for dependencies and lifecycle; no inheritance framework or service locator.
Composition belongs in an application's `app.ts`, process startup/shutdown in `main.ts`.
Use `async`/`await`, explicit errors, and `AbortSignal` where cancellation is required.

Web/mobile features use the same vocabulary, with platform-specific components and navigation.
Shared behavior does not imply a universal UI framework. Styling and UI primitive libraries are undecided.

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
browser/DOM test project; Expo/native checks need their own platform setup. The initial Vitest project
covers tooling only and must not be described as application end-to-end coverage.
