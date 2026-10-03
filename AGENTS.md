# Working in Porcelain

This codebase is written and maintained by agents. No person reads the code; trust comes from the guardrails and the proof, not from review. Everything below exists so that an agent copies the right shape and cannot drift from it unnoticed.

## The rulebook is the tooling

TypeScript, the architecture check, Oxlint and Oxfmt are the rules; the codebase is the example. When a rule blocks you, the rule wins: change the code, never the rule or a config. Never add a disable directive, an override, a cast, `any`, a comment, or a code file outside `src/` and `spec/` (skill scripts, probes and tooling have their own homes and their own checks).

Tests and feature maps state promises. Never loosen, skip or delete one to get green. When the owner changes a behaviour, the test or map entry that states it changes in the same commit, and the commit message names the promise that changed; tightening a check is always allowed.

When a rule or a promise stands in the way of what the owner asked for, stop and ask the owner before working around it; never shape the product around a test. Without the owner in the session, finish what you can, say so in your report with the rule name and the case, and stop there.

Copy the nearest feature's shape, but not its duplication: before writing a component, helper or type, search `components/ui`, `shared/` and the feature for one that exists; a second copy is extracted into its owner, never pasted. Every lint message says why its rule exists; read the message before working around it.

A new rule needs a reason: a pattern that has already repeated, or a defect it would have caught. Ship it with Oxlint RuleTester valid and invalid examples. When an agent routes around a rule, fix the example code or the architecture before adding another rule; every rule is paid for by every future change.

## Building a feature

A feature crosses the repository in one order, and each part has one job. The architecture check and the lint enforce every role; copy the nearest feature at each step.

1. **Contract.** Schemas in `packages/contracts/src/<area>/`, named after the operation (`<verbNoun>RequestSchema`, `<verbNoun>ResponseSchema` and their types). The server contract stays the server's contract: clients adapt to it, never the reverse.
2. **Domain.** A new decision lives in `packages/<domain>/src/`: a service, its models and ports, one error class per failure, pure logic in `rules/`.
3. **Server.** A use case in `apps/server/src/use-cases/<area>/` with one `execute`; a route in `apps/server/src/http/routes/<area>/` whose handler is one call to it, registered in its audience's scope; construction in `bootstrap/compose-<area>.ts`; every new error class mapped in `http/status-policy.ts`.
4. **Client.** `packages/client/src/features/<area>/` serves web and mobile alike: `api.ts` talks to the server, `queries/` and `commands/` own reads, writes and the cache, `store.ts` owns shared client state and persists through the interfaces in `ports/`, and `rules/` holds pure functions. It imports no app, browser, DOM, Expo or React Native code.
5. **Apps.** Each app owns its views and implements the client's ports in its `adapters/`.
   - **Web** (`apps/web/src/features/<area>/`): views render feature data and forward events. A view may keep local UI state, effects and refs for its own UI, but never reaches the server, the Query client or the cache, and never awaits, chains or catches a command. `overlays.ts` owns Base UI handles; `adapters/` wraps Web Storage and imperative libraries such as Pierre and the editor. The React Compiler memoizes; write no `useMemo` or `useCallback`. Move a web file to its feature or shared owner when a change touches it.
   - **Mobile** (`apps/mobile/src/features/<area>/`): native controls from Expo UI, content in React Native styled through Uniwind with the shared theme; `adapters/` implements the ports with SecureStore and SQLite; navigation lives in `app/` and `shell/`.
   - **Desktop** (`apps/desktop/src/`): a thin Electron shell around the web. The main process owns windows, the server host, the Keychain and the native picker; the preload exposes them to the web as a typed bridge.
6. **Proof.** In the same commit: the tests the change owes, and a feature-map entry for each new route, screen or flow.

Use shadcn registry components for web UI primitives. Search with `pnpm --filter @porcelain/web exec shadcn list @shadcn --query <name>` and add a missing primitive through the shadcn CLI. Never edit a file in `components/ui`: `architecture/shadcn-pins.json` pins each file to what the registry serves; after `shadcn add` and the format, run `node scripts/shadcn-pin.ts`. Re-pinning an edited file or editing the pins is a guard change the owner approves. Compose product views in their feature folders from the existing variants and layout classes; when a look needs a new variant or a restyle the lint refuses, ask the owner.

Limits live in `packages/contracts/src/shared/limits.ts` when the server enforces them, otherwise in `apps/server/src/config/limits.ts`, `apps/web/src/config/limits.ts` or `apps/mobile/src/config/limits.ts`, nowhere else.

## Testing

| Layer | Proves | Server | Web | Desktop | Mobile |
|---|---|---|---|---|---|
| Static | the code has the agreed shape | TypeScript, Oxlint, architecture check, Oxfmt | same, plus shadcn no-restyle | same | same |
| Unit (Vitest) | one unit keeps its promise, fakes only at its ports | use cases, services, rules, parsers | `rules/`, stores | main-process modules | mobile rules; `packages/client` rules and stores |
| Integration | real pieces work together | Vitest: the built server over HTTP, real database and Git, route budgets | Vitest Browser Mode: one feature in Chromium against a real server | Vitest on macOS: bridge handlers against a real server and the Keychain | `packages/client` against a real server, in Node |
| E2E | a user flow works end to end | covered by integration | Playwright Test: the real app against a real server | Playwright Electron: Porcelain Dev | Maestro: flows, and view states reached by deep link into a server already in that state |

How to write a test:

- **Start from the promise, not the code.** Read what the unit is for: its contract, its feature-map entry, the owner's request. List the cases first: the success path, every failure by error class, the boundaries (empty, one, the limit, one past it) and hostile input (unknown ids, duplicates, traversal paths, repeated calls). Only then open the code, to check the list missed nothing. A wrong implementation must fail the test, and a reader must learn the behaviour from it without opening the code.
- **Coverage is never a reason.** A file that forwards a call, re-exports, wires parts together or restates what TypeScript enforces gets no test of its own; the test of the behaviour it serves covers it. Never test a library we chose.
- **A test must be able to catch a bug.** Before keeping one, ask whether it would still pass if every imported function returned `undefined`; if so, rewrite or delete it. Assert literal expected values and observable effects (state read back, files written, what the user sees), never only that something was called.
- **Fake only at ports.** A fake is hand-written, typed by its port, and stores and fails like the real adapter. Git, files and the database are real wherever the unit is about them. There is never a runtime mock API.

What a change owes: new logic owes a unit test; a new or changed route, client call or bridge handler owes an integration test; a new web view state or adapter behaviour owes a Browser Mode integration test; a new user flow or mobile view state owes an e2e test and a feature-map entry. Every change owes the static checks and verification.

## Verification

Before a change is called done, an agent drives the real app the way a user does and reads the evidence. Each surface has a skill (`server-verify`, `web-verify`, `desktop-verify`, `mobile-verify`) with its control CLI at `scripts/cli` and its feature map in `features/`. Run `scripts/cli start`, find the feature in the map, follow its drive steps, read what the evidence folder recorded, then `scripts/cli stop`. The report names the evidence folder and what it shows.

The CLI is the only way to drive and collect evidence, so every agent and session does it the same way. Computer use or an in-app browser may look at an instance the CLI started, never drive it. When the CLI reports a missing tool, install that tool; never substitute another. Verification proves this change; a behaviour that must stay proven gets a test.

## Proof and budgets

Run commands from the repository root and report every result honestly. Local proof stays small and fast; CI runs the heavy suites, free, on every push.

- **Locally, prove only what you changed.** Run `pnpm check` (typecheck, lint, format, unit tests, the architecture check, the rule fixtures and the feature-map check, through Turborepo's cache), the test files that state the promise you changed, by file name, and the verification of the changed feature through its CLI. Never run a whole suite locally: no full `pnpm test:integration`, no full `pnpm test:e2e`, no whole probe run. Lefthook runs `pnpm check` before each push.
- **CI runs the rest.** Every push runs `pnpm check`, the integration suites and the web e2e suite on Linux, and the desktop and mobile e2e suites on macOS, each limited to what the change affects. After pushing, read the result with `gh run list --branch <branch>` and `gh run view <id> --log-failed`. A red run is fixed before new work starts, by the change that broke it.
- **A cross-cutting change or a release** runs every suite once in CI through the workflow's full-run dispatch, plus `pnpm db:check` and the web build. Report incomplete coverage honestly.
- **A flaky test** is investigated locally with its runner's repeat option on that one file, stopping at the first failure and keeping the evidence.
- **A guardrail change:** a lint rule gets an invalid fixture, and a valid one where natural, in `architecture/rule-cases.mjs`; each architecture and style rule and each gate's wiring keeps one probe in `architecture/probes/`. Run `pnpm probes --check` and only the probes you touched, by name, with `pnpm probes <name>`.

Budgets: `pnpm check` under 30 seconds and an ordinary task's local proof under two minutes. A check that breaks its budget is a tooling defect: fix or remove it in its own change, never skip it silently. Porcelain is a solo developer project with no external users: keep proof proportional to the change and prioritize product progress. Test harnesses and CI take the simplest setup that works; add isolation, retries, extra jobs or pins only after a real failure shows the need, and only for that case.

`pnpm dev --desktop` runs the desktop app unpackaged from the checkout as Porcelain Dev, with its own profile beside the installed app. Never edit `shared/shell.ts` to preview desktop UI, and never build, install or launch the owner's installed app to test a change.

## Skills

- `server-verify`, `web-verify`, `desktop-verify`, `mobile-verify`: start a disposable instance, drive it through the feature map, read the evidence.
- `maintain-verification`: the periodic pass that drives every mapped feature and corrects drift in the maps and CLIs.

## Working rules the tooling cannot see

- Commit only the paths you changed; never `git add -A`; never stash or reset hard; never commit anything under `.claude/`.
- One short imperative sentence per commit; no attribution lines of any kind.
- Push your branch when its checks pass, unless the owner says otherwise in the session; never push `main`, which takes `rebuild` only when the owner merges it.
- When you ask the owner a question, wait for the answer before changing anything it decides.
- Work in the area the owner gave you; ask before changing code outside it.
- Write no prose documents: the workflow lives in skills, the rules in the tooling, the example in the code.
- Before using a library, check its current documentation for a built-in pattern and prefer it over a helper.
