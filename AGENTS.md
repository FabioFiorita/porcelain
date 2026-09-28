# Working in Porcelain

This codebase is written and maintained by agents. No person reads the code; trust comes from the guardrails and the proof, not from review. Everything below exists so that an agent copies the right shape and cannot drift from it unnoticed.

## The rulebook is the tooling

TypeScript, the architecture check, Oxlint and Oxfmt are the rules; the codebase is the example. When a rule blocks you, the rule wins: change the code, never the rule, a config, a spec or a verifier case. If you believe a rule is wrong, finish what you can, say so in your report with the rule name and the case, and stop there. Never add a disable directive, an override, a cast, `any`, a comment, or a code file outside `src/` and `spec/` (feature-map cases, probes and tooling have their own homes and their own checks).

Copy the nearest feature's shape. Every lint message says why its rule exists; read the message before working around it.

## Proof at each stage

Run commands from the repository root and report every result honestly.

- **Ordinary change:** run `pnpm check` once at completion. It runs typecheck, lint, format, architecture, unit tests, Oxlint RuleTester fixtures and read-only probe preflight. For server behavior, run the affected HTTP features with `node .agents/skills/server-verify/scripts/verify.ts <feature>` and `pnpm db:check` if storage changed. For web behavior, run the affected browser journeys once. Broaden the affected set for shared code or uncertain impact. Do not call a feature done without its focused proof. Aim for task verification under two minutes.
- **Race or flaky-test investigation:** request repetitions explicitly with `pnpm verify:web <journey> --repeat <count>`. Each repetition gets fresh state. Stop at the first failure and preserve the evidence. Repetition is an investigation tool, not a requirement for every change.
- **Guardrail or verifier change:** run `pnpm check`, `pnpm probes --check`, the affected rule fixtures and named integration probes. Custom lint rules use Oxlint's built-in RuleTester with valid and invalid examples. Keep a focused integration probe for gate wiring. The full mutation suite is an explicit maintenance audit, never a requirement for an ordinary edit or push.
- **Completed cross-cutting migration or release:** run `pnpm check`, `pnpm db:check`, the full HTTP net, the web build and `pnpm verify:web --all` once. Use this checkpoint for shared infrastructure or contracts changes whose impact cannot be bounded. Stop the checkpoint at a failed stage and report incomplete coverage honestly. Browser and probe audits stop at the first failure and keep partial evidence.

Lefthook's pre-push runs `pnpm check`; when pushing, use that as the final fast check instead of manually running it immediately beforehand. Automatic CI runs only `pnpm check`. The runtime checkpoint and probe audit workflows run only on explicit dispatch. Porcelain is a solo developer project with no external users: keep proof proportional to the change and prioritize product progress. Hosted Actions require Fabio's approval while spending is blocked.

A change to server behaviour is not done until a behaviour spec states its promise (`server-spec`) and an affected HTTP case reaches it (`server-verify`). A guardrail change needs positive and negative fixture proof plus its affected wiring checks.

## Web rebuild

Keep existing web behavior while moving each file to its app, feature or shared owner. The server contract stays the server's contract.

Views render feature data and forward events; they hold no state, effects, refs, awaits or try blocks. A feature's `api.ts` talks to the server, `queries/` and `commands/` own reads, writes and the cache, `store.ts` owns client state, `overlays.ts` owns Base UI handles, `rules/` holds pure functions, and `adapters/` is the only home for effects, refs and DOM listeners. The React Compiler memoizes; write no `useMemo` or `useCallback`.

Existing web code still breaks many of these rules. `architecture/web-baseline.json` holds those findings per file and rule, and it only shrinks: a new finding or a growing count fails, a fixed finding must be written down, and nothing is added after the commit that introduces its rule. Keep the checks green by changing code, never a rule or the baseline.

Use shadcn registry components for UI primitives. Search the installed registry with `pnpm --filter @porcelain/web exec shadcn list @shadcn --query <name>` and add a missing primitive through the shadcn CLI. Do not create a local replacement in a feature view or add a hand-written primitive to `components/ui`; that folder holds shadcn registry components. Compose product-specific views in their feature folders.

Use the proof stages above for web work. Browser behavior cases run with Vitest Browser Mode and its Playwright Chromium provider against a disposable real server. Agent inspection and performance use `pnpm devtools` through the `web-verify` skill. Do not add a runtime mock API or a separate prototype.

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
- Limits live in `packages/contracts/src/shared/limits.ts` when the server enforces them, otherwise in `apps/server/src/config/limits.ts` or `apps/web/src/config/limits.ts`, nowhere else.
