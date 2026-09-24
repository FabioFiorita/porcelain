---
name: server-feature
description: Add, change or remove a Porcelain server endpoint end to end, from the contract to the HTTP net. Use when a server route is added, changed or removed; server-spec and server-verify own their own steps.
---

# Server features

A feature is one route over one use case. Copy the nearest feature in the same area at every step; this skill says where each piece goes and which check fails until it is right. The rules themselves live in the lints named below, and each lint message says why.

## Adding an endpoint

1. **Contract.** Add the schemas to `packages/contracts/src/<area>/<topic>.ts` and export them from that area's `index.ts`. Name them after the operation: `<verbNoun>ParamsSchema`, `<verbNoun>QuerySchema`, `<verbNoun>RequestSchema`, `<verbNoun>ResponseSchema`, each with its `z.output` type `<VerbNoun>Params`, `Query`, `Request`, `Response`. A new limit goes in `packages/contracts/src/shared/limits.ts` or `apps/server/src/config/limits.ts` (`no-number-outside-limits`).
2. **Domain.** When the endpoint needs a new decision, add it to `packages/<domain>/src/`: a service `services/<verb-noun>-service.ts`, its models in `models/`, ports in `ports/`, one error class per failure in `errors/`, pure logic in `rules/`. Folder roles are `architecture/policy.ts`; shapes are `operation-class-shape`, `models-file-shape`, `port-shape` and `rules-are-pure`.
3. **Use case.** `apps/server/src/use-cases/<area>/<verb-noun>.ts`, class `<VerbNoun>UseCase` with one `execute(input, context)`. A worktree route resolves the worktree with `CheckWorktreeService` first and then runs in `laneKeys.repository(worktree)`; reads go in a `'read'` lane, writes in a `'write'` lane, events after the lane settles and only on change. Enforced by `use-case-imports`, `lane-after-check`, `events-after-lane` and `lane-mode-matches-service` (arch).
4. **Route.** `apps/server/src/http/routes/<area>/<verb-noun>.ts`: one `api.<method>` with a literal path, contract schemas for every input and response (spread `errorResponses`), and a handler that is one call to `options.useCase.execute` (`feature-route-shape`, `feature-route-handler`, `feature-route-registrations`). A fixed status is `reply.code(<literal>)` in the route; a status that depends on the result is a function in `http/status-policy.ts`.
5. **Scope.** Register the route in its audience's scope in `apps/server/src/http/scopes/` (`public.ts` unauthenticated, `paired.ts` paired devices, `owner.ts` the owner socket, `page.ts` pages and static files) and add the use case to that scope's use-case type (`scope-shape`).
6. **Wiring.** Construct the service and the use case in `apps/server/src/bootstrap/compose-<area>.ts` and return the use case (`bootstrap-constructs-only`, `bootstrap-starts-nothing`).
7. **Errors.** Give every new error class its status in `apps/server/src/http/status-policy.ts`; `status-policy.spec.ts` fails until it has one.
8. **Spec.** Follow `server-spec` for each new service, rule, parser or sequencing use case.
9. **Net case.** Follow `server-verify`: name the route in a feature's `reaches` under `.agents/skills/server-verify/feature-map/` and request it from a case. `verify.ts --all` fails while any registered route is in no feature's `reaches`.
10. **Gates.** Run the seven commands in `AGENTS.md` and report each result.

## Changing or removing one

Change the contract first; `pnpm typecheck:server` then leads through the route, the use case and the composition. To remove, delete the route, its scope registration, the use case, its composition entry, the contract exports and the feature's reach together; `verify.ts --all` fails on a reach that is no longer registered.

## When a guardrail changed

A change to a lint, `architecture/policy.ts`, `architecture/type-rules.ts` or a gate's configuration is committed and then proved with `pnpm probes`, which plants every probe in `architecture/probes/` and fails unless its gate rejects it. A new guardrail adds a probe there, `<decision>-<what-it-plants>.ts`, shaped like its neighbours (`architecture/probe.ts`).
