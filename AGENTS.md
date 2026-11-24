# Porcelain

Porcelain is a companion to coding agents: it is where a developer reviews what an agent changed, asks questions about the Walkthrough, reads the code and makes small edits, from a browser, the Mac app or a phone. One server runs on the developer's machine; the web, desktop and mobile apps connect to it locally, over the local network or across several remote environments.

## Product

- Porcelain never runs the agent that builds; it runs its own read-only agent, through the developer's signed-in `claude` or `codex` CLI, to write a Walkthrough and answer questions about it. That agent never edits code and never produces evidence: it places what already exists, and a step without evidence shows none.
- **A file tree for very large repositories.** The developer pins the files and folders they care about and hides the ones they never open.
- **Git beside the review:** history, a per-file timeline, commit, pull and push.
- **Phone and tablet.** The iPhone is a companion away from the desk: check, read, comment and small controls. The iPad is a reading tool, never a larger phone: used in landscape with a keyboard, it keeps its lists beside the content that changes and must be faster to move through than the phone. Neither manages files or adds projects. The platform draws the bars (top bar, tabs, sidebar, search, sheets, menus) and Porcelain's own style, taken from the web, draws everything inside them. The iPad is verified in landscape and portrait.

## How we work

Simple systems, the smallest model that makes the correct behaviour unsurprising, and no machinery because it looks impressive. Fight scope creep; honour the developer's intent in a minimal and realistic way. Everything below is a good default, and the developer's request overrides it. Work autonomously and ask only when the answer would change the result.

Agents author this codebase. Prefer one enforced, typed abstraction per responsibility; dependency requirements and invalid alternatives should fail before runtime. Familiarity with the old implementation is not a reason to preserve it: when a new path replaces an old one, move every caller and delete the old path and its tests in the same change.

The codebase is the example. Copy the nearest feature's shape, and extract a second copy into its owner rather than pasting it. Patched TypeScript, Vite+ lint and format, and the architecture check are the rulebook, and every lint message says why its rule exists: when one blocks you, change the code. When a rule fights the task itself, say so and ask before changing the rule. Code comments, including `@ts-ignore`, are banned by `no-comments`: express rules in code or a verification skill, because comment prose can drift from the behavior enforced by executable checks.

## Ways to hurt yourself

1. **Killing by pattern.** Stop only processes you started, by the PID you captured; the verification CLIs stop their own instances. Your own agent's command line contains the worktree path, and other worktrees run on the same machine.
2. **Touching the installed app.** Never build, install or launch the installed Porcelain app or service, and never point a test at its data. Development uses disposable instances and `pnpm dev --desktop` (Porcelain Dev, with its own profile).
3. **Running whole suites locally.** Use focused local checks. The release lane runs every runtime suite. A full local run has exhausted these machines before.

## Hit every surface

Before calling a change done, check each of these and say which applied:

- **Entry points:** sidebar, context menu, keyboard shortcut, settings. Fixing one is not fixing the feature.
- **Clients:** web, desktop (the web plus the Electron bridge) and mobile (native, its own navigation). Shared client logic lives in `packages/client`.
- **Contract:** anything crossing the wire is a schema in `packages/contracts`. The server contract stays the server's; clients follow it.
- **The way back:** a way in needs a way out and a way to see it.
- **Connections:** local, local network and remote environments behave differently.

For visible web, desktop, and mobile changes, use the [UI review checklist](.agents/skills/ui-review/SKILL.md).

## Libraries

Each job has one library. Rules already hold Zustand's ban, the UI SDK owner and the ban on replaced UI libraries (Base UI, cmdk), routing, forms, hotkeys and Expo UI chrome; these choices have no check:

- On web and desktop, code, diffs and file trees render with Pierre (`@pierre/diffs`, `@pierre/trees`) and Markdown with TanStack Markdown. Pierre's renderers need a browser page, so mobile draws its own code, diff, tree and Markdown views and highlights with Shiki.
- `useState` holds only one component's UI details; anything shared or saved is an Effect atom.

## Library documentation

Learn a library's API from its official documentation: Expo from docs.expo.dev and other libraries from their own docs sites.

Before writing Effect code, read the official guide and source shipped in `node_modules/effect` (`AGENTS.md`, `ai-docs/`, `src/`), with the same layout in `node_modules/@effect/platform-node`, `node_modules/@effect/vitest` and `apps/web/node_modules/@effect/atom-react`; these match the installed versions exactly, and the installed source, not memory, is the truth for idiomatic Effect v4.

## Native Effect CLI

Declare application CLI commands, flags, arguments and help in `apps/server/src/cli/command-tree.ts` with `effect/cli`. Commands obtain `CliOperations` through `yield*`; its Layer obtains machine capabilities through `CliHost`. Bootstrap composes the complete Layers and Node platform services. Configuration uses Effect Config and Schema. Change callers directly when removing an entry point; keep no forwarding files or compatibility exports.

## Building a feature

A feature crosses the repository in one order: the contract, the domain decision in `packages/<domain>`, the server use case and route, the shared client in `packages/client` (api, queries, commands, store, rules), then each app's views and adapters. The architecture check enforces each role.

Domain services and server use cases use named `Context.Service` capabilities with one readonly typed `execute` and a static Layer. The Layer resolves dependencies with `yield*`; execute uses named `Effect.fn`. Ports declare the capability key and its shape; models declare canonical native Schema values and inferred types, with business behavior in rules and services. Bootstrap supplies implementations and configuration through Layers. Copy `packages/access/src/services/read-environment-service.ts`; do not add constructor injection or a forwarding file when migrating an owner. Build a scoped graph with `Layer.build` in its application scope before extracting capabilities; `Effect.provide` owns a shorter scope and cannot return borrowed resources for later use. Runtime jobs expose native Effect start and stop operations, and application shutdown drains foreign IO and durable recovery before releasing persistence.

## Testing

| Layer         | Server                                            | Web                                             | Desktop                                  | Mobile                                  |
| ------------- | ------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| Unit (Vitest) | services, rules, parsers                          | rules, stores                                   | main-process modules                     | rules; `packages/client`                |
| Integration   | the built server over HTTP, real database and Git | Browser Mode: one feature against a real server | the bridge in Electron on Linux or macOS | `packages/client` against a real server |
| E2E           | covered by integration                            | Playwright Test                                 | Playwright Electron                      | none                                    |

The mobile-verify skill drives mobile features on demand.

Use Linux Electron and Android phone/tablet emulators for shared behavior. Select macOS or iOS when the changed promise depends on that platform, such as Keychain, Mac menus and Dock behavior, or iOS navigation and sheets. Shared tablet layouts need a device recognized as a tablet and portrait/landscape checks; Android proof does not establish iPad-specific behavior. Verification skills own disposable app lifecycles and feature evidence; the caller supplies its available browser, desktop or device driver.

A test states an observable promise. Derive its cases from the contract, feature or request before reading the code, so a wrong implementation fails it. Choose the cheapest layer that proves the promise; no test is required per export or file, and test counts or coverage quotas are never a goal. A file that only forwards, wires or re-exports gets no test of its own. Assert literal values and observable effects; rewrite or delete tests that mirror constants, types, implementation or mocks, or would still pass if every import returned `undefined`. Before deleting a test, preserve the sole coverage of a promise, especially authentication, trust boundaries, persistence, real Git and deterministic races. Fakes stand in only at ports; Git, files and the database are real when the unit is about them.

Choose test setups with judgment: weigh what each layer of isolation, retry or extra job protects against what it costs, and add it where a case needs it.

Prove a new or changed test can fail: revert the change it protects, watch it fail with the intended assertion, then restore.

## Verifying

Prove a change with the smallest sufficient local proof: `pnpm check:local` and the relevant test files by name. Changed runtime behavior also needs the affected feature driven through its surface's skill (`server-verify`, `web-verify`, `desktop-verify`, `mobile-verify`); documentation, configuration, policy and test deletion changes use direct checks of what changed. Each skill's CLI at `scripts/cli` prepares a disposable instance, publishes its connections, records deterministic fixture operations and owns cleanup; the agent drives the surface with its harness tools and retains evidence. Its feature map (or the server contract) says how to reach each feature. The CI lanes are described below. A new or changed guardrail proves its rule with a fixture in `architecture/rule-cases.mjs`; removing one removes its wiring and fixtures and runs the remaining architecture fixtures.

While you iterate with the developer, keep one verification instance running between edits and restart it only when its skill says the edit requires it; it is their preview too. Run the changed E2E specs once, when the work is done.

Vite+ runs the workspace tasks and the Vitest projects. Use `pnpm test` with a project and file for a focused unit run. The root integration command runs suite tasks sequentially, because each Vitest runner already owns a machine-sized worker budget. Keep parallelism inside the suite; concurrent runners must not multiply that budget or require longer product deadlines.

## Pull requests

Work on your own branch from `main`, in your own worktree, one concern per pull request. Open it into `main` from the template. The developer reads every body, so make it easy to read: what and why in a few sentences, how it was verified, screenshots attached with `gh pr create --attach` inside a collapsed section, and the risks. Commit only the paths you changed, each commit one short imperative sentence. Plans and scratch notes stay out of the repository.

Feature PRs into `main` run affected static and unit checks, changed browser specs, a browser smoke test for web or shared runtime changes, and the migration check for storage changes. After green CI, the Decisions API checks whether the owner needs to decide. Routine owner-authored changes merge automatically. Keep a PR in draft or add `hold` to defer landing.

Promote `main` into `release` with a PR. This lane runs full static, unit, server, browser and desktop suites, mobile exports, migrations and package checks. The hosted agent reviews the accumulated changes. Address findings on main. Promotion preserves main’s history. Only an explicit version tag publishes the qualified commit.

The workflow reuses a completed decision or review for the same candidate. Failed CI on an eligible trusted, open, non-draft PR gets an explanation for its current head when it has failed jobs to explain. A maintainer can request an additional hosted review on a feature PR with `agent-review`. Verify `agent-fixes` findings. A local verification marked `reviewed` can satisfy an optional feature review; a release requires its hosted review.

In Risks, declare `Door: one-way` for a release, destructive data change, breaking compatibility, permission or secret change. Explain what needs deciding. The loop also checks release, migration, landing-policy and workflow permission changes, outside contributions and an explicit `decision` label. Routine features, dependency updates and backward-compatible API additions use `Door: two-way`. When a PR needs approval, name the PR and commit to the owner. Apply `approved` only after they approve that commit. Recheck after a push. The loop rechecks the head before merging. Never use GitHub auto-merge or merge around it.

Workers open the pull request, fix CI failures and `agent-fixes` findings until it merges or gets `decision`, then hand off its URL and full head commit. Never enable GitHub auto-merge or merge around the loop.

When `main` turns red after a pull request merges, fix it forward with a follow-up pull request instead of reverting.

## Where code lives

- `apps/server`: the Effect HTTP server, its use cases, routes and installer.
- `apps/web`: React and Vite; UI primitives live in `src/components/ui`. They are Porcelain's own wrappers over UI SDK, which only `components/ui` imports, styled with Tailwind and shadcn's class conventions; change them like any other Porcelain code.
- `apps/desktop`: Electron around the web.
- `apps/mobile`: Expo and Uniwind; controls are web-styled primitives in `src/components/ui`, Expo UI keeps system chrome (menus, navigation, tabs), and sheets are expo-router form-sheet routes drawn with `src/components/ui/sheet`.
- `packages/contracts`, `packages/client` and the domain packages.
- `.agents/skills`: the verification skills and their feature maps, and the release skill.
