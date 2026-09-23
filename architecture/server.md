# Server architecture

This is the working structure for the server. The interactive blueprint is a review aid; this file and the checks define the convention. `pnpm arch:check` is green after the structural migration, while behavior evidence remains limited to the mapped verification cases.

## One request path

HTTP, MCP, CLI, and jobs establish typed input and context, then call a feature controller. A controller has a named `*Controller` class, constructor-injected services and only the runtime ports it needs, and one public `execute` method with an explicit result type. Read its method from top to bottom to see the complete sequence. It owns coordination, operation admission, and event timing. It never parses typed values, checks authentication, queries a repository, or calls Git commands.

Each business operation lives in one named `*Service` class with one public `execute` method and an explicit domain result type. A service owns business decisions and resource-dependent authorization. It receives focused, domain-owned ports. Services do not import other services or concrete Git, storage, AI, HTTP, or transport schemas. A controller sequences multiple services when a flow requires them.

Routes contain method, path, shared Zod request and response schemas, and one controller call. Fastify route scopes and hooks perform transport authentication and request policy. One HTTP status policy translates domain failures. The HTTP error body uses Fastify's `{ statusCode, error, message }` shape, defined in a shared Zod response schema. Routes do not repeat parsing, map response objects, or contain business decisions. Zod parses untyped ingress and model/provider output; TypeScript checks typed internal handoffs. A controller may import only contract **types**, never runtime schemas.

## Ownership and imports

| Owner               | May depend on                                                    | Must not depend on                                                           |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Route and transport | Contracts, hooks, controller                                     | Domain service, Git, storage, AI, repository                                 |
| Controller          | Public domain service API, relevant runtime port, contract types | Raw adapters, repositories, schema parsing, another controller               |
| Domain service      | Own models, errors, and ports                                    | Another service or domain, Fastify, Drizzle, Git implementation, wire schema |
| Domain port         | Own domain models                                                | Adapter implementation or transport type                                     |
| Bootstrap           | Public package APIs and concrete adapters                        | Business decisions                                                           |
| Git                 | Explicit discovery, inspection, history, action APIs             | Domain or server source                                                      |
| Storage             | Focused repository factories and private Drizzle internals       | Domain business decisions                                                    |
| Agents              | Model provider integration and untyped output validation         | Git, storage, domain service                                                 |

Dependency Cruiser plus `architecture/policy.ts` checks imports and blocks new unclassified source. Domain packages export only `./services`, `./models`, `./ports`, and `./errors` through folder indexes. Git exports capabilities; storage exports one opaque session plus focused repository factories. `bootstrap/compose-server.ts` owns lifetimes and injects each dependency separately. The legacy inventory is empty and rejects reintroduced legacy paths.

Inside Git, imports follow discovery → inspection → history → actions. A later capability may use an earlier one; each may use `shared`. `shared` imports no capability. The architecture check enforces this order so a change cannot create a capability cycle.

## File conventions

- New domain operations use `packages/<domain>/src/services/<operation>-service.ts`. Co-locate a model, error, port, or pure policy only when the operation needs it. No generic helpers folder.
- New controllers use `apps/server/src/controllers/<operation>-controller.ts`. Keep orchestration in `execute`; private helpers are for clarity within that flow.
- New HTTP endpoints use one file under `apps/server/src/http/routes/<feature>/`. Shared hooks live in `http/scopes/`; domain failures map in `http/status-policy.ts`. Request and response schemas live in the appropriate `@porcelain/contracts/<domain>` entry.
- Prefer a TypeScript type or domain failure inside typed code. Do not add `parse`, `safeParse`, `any`, `null`, or casts to conceal a contract mismatch. `null` remains valid where a wire or SQLite contract actually requires it.
- Do not add code comments. Express intent through naming, types, code structure, focused specs, or this guide. Configuration and prose documentation may contain explanatory text.
- Before using a library to solve a problem, check its current official documentation for an existing API or pattern.

## Checks and evidence

Run `pnpm typecheck:server`, `pnpm arch:check`, `pnpm lint:server`, `pnpm format:server:check`, and `pnpm test:architecture` for a server change. Treat each diagnostic as a named convention to fix; do not suppress it or add a new legacy exception. The server engineering skill guides the change, the server spec skill selects adversarial behavioral cases, and the server verification skill runs mapped HTTP behavior in an isolated environment. A passing static gate proves its own rule set, not feature correctness.

The feature map lives with the verification skill. Add a feature entry when its request path and intended outcomes are settled; then add executable CLI cases. The map records how a client reaches the feature, expected successes and failures, and what the CLI actually covers. Keep unimplemented behavior explicit.

## Current review focus

The structural checks establish the import boundaries and file conventions. Review `bootstrap/compose-server.ts` for coordination that belongs in a controller or domain service, especially inventory refresh and scheduled collection. Keep new behavior out of bootstrap. Expand the feature map and isolated HTTP verifier before treating other routes as behaviorally established.
