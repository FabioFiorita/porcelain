---
name: server-engineering
description: Develop or refactor Porcelain server behavior using its route-controller-service-port structure and trust checks. Use for server features and architecture changes; use server-verify separately for HTTP evidence.
---

# Server engineering

Read `architecture/server.md` and the relevant current feature path before editing. Identify the transport, controller, service, domain port, and concrete adapter that own the behavior. If the path is legacy, move it toward the single route → controller → service → port pattern instead of copying the legacy path. The controller should show the whole service sequence without hiding the flow inside a service that calls another service.

For a library change, use current official documentation to find its intended API before adding a helper or dependency. Keep Zod at untyped ingress and output boundaries; preserve TypeScript checks between typed layers. An HTTP route uses the shared contract, authenticated scope, and one controller call. A service receives only focused ports. Bootstrap wires concrete implementations, one port at a time.

Before declaring the work complete:

1. Run `pnpm typecheck:server`, `pnpm arch:check`, `pnpm lint:server`, `pnpm format:server:check`, and `pnpm test:architecture`. Fix new violations and report pre-existing failures precisely. Do not add suppressions or legacy exceptions to make a check green.
2. For a behavior change, use `server-spec` to select cases that could falsify the intended behavior. Add only meaningful specs after choosing a stable runner.
3. If the feature is in `.agents/skills/server-verify/feature-map/`, run its isolated CLI and read the evidence. If the behavior or path changed, update the map and the corresponding CLI assertion together. Distinguish coverage gaps from passing checks.

When a recurring anti-pattern appears, change the structure or add a narrow automated rule. Update this skill only for workflow knowledge that a static check cannot enforce. Keep `architecture/server.md` as the concise convention source and the codebase as the executable example.
