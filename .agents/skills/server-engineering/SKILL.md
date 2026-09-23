---
name: server-engineering
description: Develop or refactor Porcelain server behavior using its route-controller-service-port structure and its lint rules. Use for server features and architecture changes; use server-spec for behaviour specs and server-verify for HTTP evidence.
---

# Server engineering

The rules are code, not prose:

- `architecture/policy.ts` decides which layer may import which, checked by `pnpm arch:check`.
- `architecture/oxlint-plugin.mjs` decides the shape of routes, controllers, services and specs, checked by `pnpm lint:server`.

Read both before changing server code.

The codebase is the example. Before editing, open the nearest existing feature end to end, route → controller → service → port → adapter, and copy its shape. If that feature is legacy, move it toward this path instead of copying it.

For a library change, use its current official documentation to find the intended API before adding a helper or a dependency.

Before declaring the work complete, run:

1. `pnpm typecheck:server`
2. `pnpm arch:check`
3. `pnpm lint:server`
4. `pnpm format:server:check`
5. `pnpm test`
6. `node .agents/skills/server-verify/scripts/verify.ts --all`

Fix every new violation and report pre-existing failures precisely. Never suppress a rule, add an exception or loosen a check to make it pass; if a rule is wrong, change the rule deliberately and say so.

For a behaviour change, use `server-spec` to decide whether the unit needs a spec and to write it. If a mapped feature's behaviour or path changed, update its `server-verify` feature map entry and assertion together.

When a recurring anti-pattern appears, add a narrow rule to the policy or the lint plugin rather than a paragraph here. This skill holds workflow only.
