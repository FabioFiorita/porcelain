# Working in Porcelain

This codebase is written and maintained by agents. No person reads the code; trust comes from the guardrails and the proof, not from review. Everything below exists so that an agent copies the right shape and cannot drift from it unnoticed.

## The rulebook is the tooling

TypeScript, the architecture check, Oxlint and Oxfmt are the rules; the codebase is the example. When a rule blocks you, the rule wins: change the code, never the rule or a config. Never add a disable directive, an override, a cast, `any`, a comment, or a code file outside `src/` and `spec/` (feature-map cases, probes and tooling have their own homes and their own checks).

Specs, verifier cases and journeys state promises. Never loosen, skip or delete one to get green. When the owner changes a behaviour, the spec, case or journey that states it changes in the same commit, and the commit message names the promise that changed; tightening a check is always allowed.

When a rule or a promise stands in the way of what the owner asked for, stop and ask the owner before working around it; never shape the product around a test. Without the owner in the session, finish what you can, say so in your report with the rule name and the case, and stop there.

Copy the nearest feature's shape, but not its duplication: before writing a component, helper or type, search `components/ui`, `shared/` and the feature for one that exists; a second copy is extracted into its owner, never pasted. Every lint message says why its rule exists; read the message before working around it.

A new rule needs a reason: a pattern that has already repeated, or a defect it would have caught. Ship it with Oxlint RuleTester valid and invalid examples. When an agent routes around a rule, fix the example code or the architecture before adding another rule; every rule is paid for by every future change.

## Proof at each stage

Run commands from the repository root and report every result honestly.

- **Ordinary change:** run `pnpm check` once at completion. It runs typecheck, lint, format, architecture, unit tests and the lint rule fixtures. For server behavior, run the affected HTTP features with `node .agents/skills/server-verify/scripts/verify.ts <feature>` and `pnpm db:check` if storage changed. For web behavior, write or update the journey that proves each new or changed behaviour in the same commit (a new route, control, menu or setting gets a feature-map entry and a journey), then run the affected journeys once; run `--all` when `components/ui` or `shared/` changed. Broaden the affected set for shared code or uncertain impact. Do not call a feature done without its focused proof.
- **Race or flaky-test investigation:** request repetitions explicitly with `pnpm verify:web <journey> --repeat <count>`. Each repetition gets fresh state. Stop at the first failure and preserve the evidence. Repetition is an investigation tool, not a requirement for every change.
- **Guardrail or verifier change:** a lint rule gets an invalid fixture, and a valid one where natural, in `architecture/rule-cases.mjs`; `pnpm check` fails while any Porcelain rule has none. Each architecture and style rule, each verifier protection and each gate's wiring keeps one probe in `architecture/probes/`. Run `pnpm check`, `pnpm probes --check` and the probes you touched by name with `pnpm probes <name>`. The whole probe run is an explicit maintenance audit, never a requirement for an ordinary edit or push.
- **Completed cross-cutting migration or release:** run `pnpm check`, `pnpm db:check`, the full HTTP net, the web build and `pnpm verify:web --all` once. Use this checkpoint for shared infrastructure or contracts changes whose impact cannot be bounded. Stop the checkpoint at a failed stage and report incomplete coverage honestly. Browser and probe audits stop at the first failure and keep partial evidence.

Budgets: `pnpm check` under 30 seconds, an ordinary task's proof under two minutes, a full checkpoint under five minutes. A check that breaks its budget is a tooling defect: fix or remove it in its own change, never skip it silently.

Lefthook's pre-push runs `pnpm check`; when pushing, use that as the final fast check instead of manually running it immediately beforehand. Automatic CI runs only `pnpm check`. The runtime checkpoint and probe audit workflows run only on explicit dispatch. Porcelain is a solo developer project with no external users: keep proof proportional to the change and prioritize product progress.

A change to server behaviour is not done until a behaviour spec states its promise (`server-spec`) and an affected HTTP case reaches it (`server-verify`). A guardrail change needs positive and negative fixture proof plus its affected wiring checks.

## Web rebuild

Move a web file to its app, feature or shared owner when a change touches it, keeping its behavior. The server contract stays the server's contract.

Views render feature data and forward events. A view may keep local UI state, effects and refs for its own UI, but never reaches the server, the Query client or the cache, and never awaits, chains or catches a command. A feature's `api.ts` talks to the server, `queries/` and `commands/` own reads, writes and the cache, `store.ts` owns shared client state and Web Storage, `overlays.ts` owns Base UI handles, `rules/` holds pure functions, and `adapters/` wraps imperative libraries such as Pierre and the editor. The React Compiler memoizes; write no `useMemo` or `useCallback`.

Use shadcn registry components for UI primitives. Search the installed registry with `pnpm --filter @porcelain/web exec shadcn list @shadcn --query <name>` and add a missing primitive through the shadcn CLI. Never edit a file in `components/ui`: it stays exactly what the shadcn CLI installed, and `architecture/shadcn-pins.json` pins each file to what the registry serves. After `shadcn add` and the format, run `node scripts/shadcn-pin.ts`, which pins the registry's version, never the file on disk; re-pinning an edited file or editing the pins is a guard change the owner approves. Do not create a local replacement in a feature view. Compose product-specific views in their feature folders from the existing variants and layout classes; when a look needs a new variant or a restyle the lint refuses, ask the owner.

Use the proof stages above for web work. Browser behavior cases run with Vitest Browser Mode and its Playwright Chromium provider against a disposable real server. Agent inspection and performance use `pnpm devtools` through the `web-verify` skill. `pnpm dev --desktop` runs the desktop app unpackaged from the checkout, as Porcelain Dev with its own profile beside the installed app, and `pnpm devtools start --desktop` serves the web in Chrome as the desktop app shows it; never edit `shared/shell.ts` to preview desktop UI, and never build, install or launch the owner's installed app to test a change. Do not add a runtime mock API or a separate prototype.

## Skills

- `server-spec`: whether a unit gets a spec, how to derive its cases from the promise, fakes and fixtures.
- `server-verify`: run the HTTP regression net, add a feature case, read the evidence.
- `server-feature`: add, change or remove an endpoint end to end: contract, use case, route, scope, wiring, spec, net case, gates.
- `web-verify`: browser behavior tests and Chrome DevTools CLI against a disposable server.
- `desktop-verify`: the development Mac app, its proof against an unpackaged build on macOS, the locked installed app and its check, and where each keeps its data and logs.

## Working rules the tooling cannot see

- Commit only the paths you changed; never `git add -A`; never stash or reset hard; never commit anything under `.claude/`.
- One short imperative sentence per commit; no attribution lines of any kind.
- Push your branch when its checks pass, unless the owner says otherwise in the session; never push `main`, which takes `rebuild` only when the owner merges it.
- When you ask the owner a question, wait for the answer before changing anything it decides.
- Work in the area the owner gave you; ask before changing code outside it.
- Write no prose documents: the workflow lives in skills, the rules in the tooling, the example in the code.
- Before using a library, check its current documentation for a built-in pattern and prefer it over a helper.
- Do not make the server bend to the old web code during its rebuild.
- Limits live in `packages/contracts/src/shared/limits.ts` when the server enforces them, otherwise in `apps/server/src/config/limits.ts`, `apps/web/src/config/limits.ts` or `apps/mobile/src/config/limits.ts`, nowhere else.
