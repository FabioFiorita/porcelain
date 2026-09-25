# Working in Porcelain

This codebase is written and maintained by agents. No person reads the code; trust comes from the guardrails and the proof, not from review. Everything below exists so that an agent copies the right shape and cannot drift from it unnoticed.

## The rulebook is the tooling

TypeScript, the architecture check, Oxlint and Oxfmt are the rules; the codebase is the example. When a rule blocks you, the rule wins: change the code, never the rule, a config, a spec or a verifier case. If you believe a rule is wrong, finish what you can, say so in your report with the rule name and the case, and stop there. Never add a disable directive, an override, a cast, `any`, a comment, or a code file outside `src/` and `spec/` (feature-map cases, probes and tooling have their own homes and their own checks).

Copy the nearest feature's shape. Every lint message says why its rule exists; read the message before working around it.

## Before you finish a server change

Run from the repository root, all of them, and report every result honestly:

```
pnpm typecheck:server
pnpm lint:server
pnpm format:server:check
pnpm test
pnpm arch:check
pnpm db:check
node .agents/skills/server-verify/scripts/verify.ts --all
```

`.githooks/pre-push`, active after `pnpm install`, runs typecheck, lint, format check, test and arch before every push; `db:check`, the net and `pnpm probes` stay yours to run.

A change to behaviour is not done until a behaviour spec states its promise (`server-spec`) and the verification net has a case that reaches it over HTTP (`server-verify`). A change to a guardrail is not done until `pnpm probes` reports every probe under `architecture/probes/` rejected.

## Web rebuild

Keep existing web behavior while moving each file to its app, feature or shared owner. The web checks now pass; keep them green by changing code instead of weakening a check. The server contract stays the server's contract.

Views render feature data and own local UI state and DOM interactions. Queries, commands and models own API, cache and business behavior. DOM refs and effects are allowed in views; they do not carry business work.

Use shadcn registry components for UI primitives. Search the installed registry with `pnpm --filter @porcelain/web exec shadcn list @shadcn --query <name>` and add a missing primitive through the shadcn CLI. Do not create a local replacement in a feature view or add a hand-written primitive to `components/ui`; that folder holds shadcn registry components. Compose product-specific views in their feature folders.

Run `pnpm typecheck:web`, `pnpm lint:web`, `pnpm format:web:check`, `pnpm arch:web`, `pnpm probes:web` and `pnpm verify:web --all` before declaring a web feature done. Browser behavior cases run with Vitest Browser Mode and its Playwright Chromium provider against a disposable real server. Agent inspection and performance use `pnpm devtools` through the `web-verify` skill. Do not add a runtime mock API or a separate prototype.

## Skills

- `server-spec`: whether a unit gets a spec, how to derive its cases from the promise, fakes and fixtures.
- `server-verify`: run the HTTP regression net, add a feature case, read the evidence.
- `server-feature`: add, change or remove an endpoint end to end: contract, use case, route, scope, wiring, spec, net case, gates.
- `web-verify`: browser behavior tests and Chrome DevTools CLI against a disposable server.

## Working rules the tooling cannot see

- Commit only the paths you changed; never `git add -A`; never stash or reset hard; never commit anything under `.claude/`.
- One short imperative sentence per commit; no attribution lines of any kind.
- Before using a library, check its current documentation for a built-in pattern and prefer it over a helper.
- Do not make the server bend to the old web code during its rebuild.
- Limits live in `packages/contracts/src/shared/limits.ts` and `apps/server/src/config/limits.ts`, nowhere else.
