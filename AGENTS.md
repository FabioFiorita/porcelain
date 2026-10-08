# Porcelain

Porcelain is a companion to coding agents: it is where a developer reviews what an agent changed, comments back to the agent through MCP, reads the code and makes small edits, from a browser, the Mac app or a phone. One server runs on the developer's machine; the web, desktop and mobile apps connect to it locally, over the local network or across several remote environments.

## How we work

Simple systems, the smallest model that makes the correct behaviour unsurprising, and no machinery because it looks impressive. Fight scope creep; honour the developer's intent in a minimal and realistic way. Everything below is a good default, and the developer's request overrides it. Work autonomously and ask only when the answer would change the result.

Agents author this codebase. Prefer one enforced, typed abstraction per responsibility; dependency requirements and invalid alternatives should fail before runtime. Familiarity with the old implementation is not a reason to preserve it.

The codebase is the example. Copy the nearest feature's shape, and extract a second copy into its owner rather than pasting it. TypeScript, Oxlint, Oxfmt and the architecture check are the rulebook, and every lint message says why its rule exists: when one blocks you, change the code. When a rule fights the task itself, say so and ask before changing the rule.

## Ways to hurt yourself

1. **Killing by pattern.** Stop only processes you started, by the PID you captured; the verification CLIs stop their own instances. Your own agent's command line contains the worktree path, and other worktrees run on the same machine.
2. **Touching the installed app.** Never build, install or launch the installed Porcelain app or service, and never point a test at its data. Development uses disposable instances and `pnpm dev --desktop` (Porcelain Dev, with its own profile).
3. **Running whole suites locally.** CI runs every suite on each pull request, free. A full local run has exhausted these machines before.

## Hit every surface

Before calling a change done, check each of these and say which applied:

- **Entry points:** sidebar, context menu, keyboard shortcut, settings. Fixing one is not fixing the feature.
- **Clients:** web, desktop (the web plus the Electron bridge) and mobile (native, its own navigation). Shared client logic lives in `packages/client`.
- **Contract:** anything crossing the wire is a schema in `packages/contracts`. The server contract stays the server's; clients follow it.
- **The way back:** a way in needs a way out and a way to see it.
- **Connections:** local, local network and remote environments behave differently.

## Library documentation

Learn a library's API from its official documentation, never from `node_modules`: Expo from docs.expo.dev, other libraries from their own docs sites, Effect from `repos/effect`.

## Effect reference

`repos/effect` vendors the Effect source as read-only reference. Before writing Effect code, read `repos/effect/LLMS.md`; the vendored source, not memory, is the truth for idiomatic Effect v4. Never edit or import from `repos/`; no tool builds, lints or installs it. Refresh it with `git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git main --squash`.

## Native Effect CLI

Declare application CLI commands, flags, arguments and help in `apps/server/src/cli/command-tree.ts` with `effect/cli`. Commands obtain `CliOperations` through `yield*`; its Layer obtains machine capabilities through `CliHost`. Bootstrap composes the complete Layers and Node platform services. Configuration uses Effect Config and Schema. Change callers directly when removing an entry point; keep no forwarding files or compatibility exports.

## Building a feature

A feature crosses the repository in one order: the contract, the domain decision in `packages/<domain>`, the server use case and route, the shared client in `packages/client` (api, queries, commands, store, rules), then each app's views and adapters. The architecture check enforces each role.

Domain services and server use cases use named `Context.Service` capabilities with one readonly typed `execute` and a static Layer. The Layer resolves dependencies with `yield*`; execute uses named `Effect.fn`. Ports declare the capability key and its shape; models declare canonical native Schema values and inferred types, with business behavior in rules and services. Bootstrap supplies implementations and configuration through Layers. Copy `packages/access/src/services/read-environment-service.ts`; do not add constructor injection or a forwarding file when migrating an owner. Build a scoped graph with `Layer.build` in its application scope before extracting capabilities; `Effect.provide` owns a shorter scope and cannot return borrowed resources for later use. Runtime jobs expose native Effect start and stop operations, and application shutdown drains foreign IO and durable recovery before releasing persistence.

## Testing

| Layer | Server | Web | Desktop | Mobile |
|---|---|---|---|---|
| Unit (Vitest) | services, rules, parsers | rules, stores | main-process modules | rules; `packages/client` |
| Integration | the built server over HTTP, real database and Git | Browser Mode: one feature against a real server | the bridge on macOS | `packages/client` against a real server |
| E2E | covered by integration | Playwright Test | Playwright Electron | Maestro |

A test states a promise. Derive its cases from what the unit is for (its contract, the feature, the request) before reading the code, so a wrong implementation fails it. A file that only forwards, wires or re-exports gets no test of its own, and coverage is never a reason. Assert literal values and observable effects; a test that would still pass if every import returned `undefined` is rewritten or deleted. Fakes stand in only at ports; Git, files and the database are real when the unit is about them.

Choose test setups with judgment: weigh what each layer of isolation, retry or extra job protects against what it costs, and add it where a case needs it.

Prove a new or changed test can fail: revert the change it protects, watch it fail with the intended assertion, then restore.

## Verifying

Prove a change with the smallest local proof: `pnpm check:local`, the test files you changed by name, and the feature driven through its surface's skill (`server-verify`, `web-verify`, `desktop-verify`, `mobile-verify`). Each skill's CLI at `scripts/cli` prepares a disposable instance, publishes its connections, records deterministic fixture operations and owns cleanup; the agent drives the surface with its harness tools and retains evidence. Its feature map (or the server contract) says how to reach each feature. CI runs `pnpm check` and owns the full suites. A guardrail change proves its rule with a fixture in `architecture/rule-cases.mjs`.

While you iterate with the developer, keep one verification instance running between edits and restart it only when its skill says the edit requires it; it is their preview too. Run the changed E2E specs once, when the work is done.

The root integration command runs suite tasks sequentially, because each Vitest runner already owns a machine-sized worker budget. Keep parallelism inside the suite; concurrent runners must not multiply that budget or require longer product deadlines.

## Pull requests

Work on your own branch from `main`, in your own worktree. Open a pull request into `main` from the template once the work is done; while the developer is still iterating with you, keep commits local and push nothing, not even a draft. One concern per pull request. The developer reviews and merges, so make the body easy to read: what and why in a few sentences, how it was verified, screenshots attached with `gh pr create --attach` inside a collapsed section, and the risks. Commit only the paths you changed, each commit one short imperative sentence. Plans and scratch notes stay out of the repository.

## Where code lives

- `apps/server`: the Effect HTTP server, its use cases, routes and installer.
- `apps/web`: React and Vite; UI primitives come from the shadcn registry and stay as installed.
- `apps/desktop`: Electron around the web.
- `apps/mobile`: Expo, with Expo UI controls and Uniwind.
- `packages/contracts`, `packages/client` and the domain packages.
- `.agents/skills`: the verification skills and their feature maps.
- `repos/`: vendored reference source, read-only.
