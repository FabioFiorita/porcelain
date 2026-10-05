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

## Native Effect CLI

Declare application CLI commands, flags, arguments and help in `apps/server/src/cli/command-tree.ts` with `effect/cli`. Commands obtain `CliOperations` through `yield*`; its Layer obtains machine capabilities through `CliHost`. Bootstrap composes the complete Layers and Node platform services. Configuration uses Effect Config and Schema. Change callers directly when removing an entry point; keep no forwarding files or compatibility exports.

## Building a feature

A feature crosses the repository in one order: the contract, the domain decision in `packages/<domain>`, the server use case and route, the shared client in `packages/client` (api, queries, commands, store, rules), then each app's views and adapters. The architecture check enforces each role.

## Testing

| Layer | Server | Web | Desktop | Mobile |
|---|---|---|---|---|
| Unit (Vitest) | services, rules, parsers | rules, stores | main-process modules | rules; `packages/client` |
| Integration | the built server over HTTP, real database and Git | Browser Mode: one feature against a real server | the bridge on macOS | `packages/client` against a real server |
| E2E | covered by integration | Playwright Test | Playwright Electron | Maestro |

A test states a promise. Derive its cases from what the unit is for (its contract, the feature, the request) before reading the code, so a wrong implementation fails it. A file that only forwards, wires or re-exports gets no test of its own, and coverage is never a reason. Assert literal values and observable effects; a test that would still pass if every import returned `undefined` is rewritten or deleted. Fakes stand in only at ports; Git, files and the database are real when the unit is about them.

Choose test setups with judgment: weigh what each layer of isolation, retry or extra job protects against what it costs, and add it where a case needs it.

## Verifying

Prove a change with the smallest local proof: `pnpm check`, the test files you changed by name, and the feature driven through its surface's skill (`server-verify`, `web-verify`, `desktop-verify`, `mobile-verify`). Each skill's CLI at `scripts/cli` starts a disposable instance, drives it and records evidence; its feature map says how to reach each feature. CI owns the full suites. A guardrail change proves its rule with a fixture in `architecture/rule-cases.mjs`, or a probe in `architecture/probes/` run by name.

## Pull requests

Work on your own branch from `main`, in your own worktree, and open a pull request into `main` from the template. One concern per pull request. The developer reviews and merges, so make the body easy to read: what and why in a few sentences, how it was verified, screenshots attached with `gh pr create --attach` inside a collapsed section, and the risks. Commit only the paths you changed, each commit one short imperative sentence. Plans and scratch notes stay out of the repository.

## Where code lives

- `apps/server`: the Fastify server, its use cases, routes and installer.
- `apps/web`: React and Vite; UI primitives come from the shadcn registry and stay as installed.
- `apps/desktop`: Electron around the web.
- `apps/mobile`: Expo, with Expo UI controls and Uniwind.
- `packages/contracts`, `packages/client` and the domain packages.
- `.agents/skills`: the verification skills and their feature maps.
