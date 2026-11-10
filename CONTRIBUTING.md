# Contributing to Porcelain

Porcelain is built by one developer working with coding agents, and it moves quickly. Issues are the best way to help: a bug with the steps to reproduce it, a walkthrough that explained a change badly, or a problem you hit while reading an agent's work. For anything larger than a small fix, open an issue before a pull request, so we can agree on the shape first.

[AGENTS.md](AGENTS.md) is the full development guide, for people and agents alike. It covers how a feature crosses the repository, testing, verification and pull requests.

## How a pull request lands

An automated loop reviews and lands pull requests into `main`. Once CI passes, an OpenAI model decides whether the change needs a review, an OpenAI agent reviews it when it does, and another model judges whether the change is easy to undo. A comment on your pull request shows each verdict, and findings are labelled `agent-fixes`: push fixes and the loop looks again. A pull request from someone without write access waits until the maintainer adds the `agent-review` label, and it always needs the maintainer's approval before it lands.

## Architecture and decisions

Porcelain is a TypeScript monorepo using pnpm, Turborepo and Effect. The server owns repositories and persistent state; the clients present that state and send commands.

| Path                                       | Responsibility                                                       |
| ------------------------------------------ | -------------------------------------------------------------------- |
| [apps/server](apps/server)                 | HTTP and WebSocket entry points, server use cases, CLI and installer |
| [apps/web](apps/web)                       | React and Vite browser views                                         |
| [apps/desktop](apps/desktop)               | Electron host around the web app                                     |
| [apps/mobile](apps/mobile)                 | Expo native client                                                   |
| [packages/contracts](packages/contracts)   | Schemas for data crossing the wire                                   |
| [packages/client](packages/client)         | Shared client queries, commands, stores and rules                    |
| Domain packages under [packages](packages) | Access, agents, changes, files, projects, reviews, walkthroughs and Git actions |

- **Porcelain writes the Walkthrough.** Its own read-only agent, run through the developer's Claude Code or Codex CLI, explains the change and answers questions; it never runs the agent that builds. The CLI invocation and its isolation live in [agent-turn.ts](packages/agents/src/walkthrough-writing/agent-turn.ts), and the prompts in [writing-prompts.ts](packages/agents/src/walkthrough-writing/writing-prompts.ts).
- **Browser devices pair with single-use links.** Local owner commands use the owner socket.
- **Git remains Git.** Repository operations use the [Git CLI](packages/git/src/shared/commands/run-git.ts); persistent walkthrough, review and access data use SQLite with [migrations](packages/storage/drizzle).
- **Each layer has one job.** Features move from contracts through domain services, server use cases and the shared client to app views. [read-environment-service.ts](packages/access/src/services/read-environment-service.ts) shows the Effect service and Layer pattern. [Architecture checks](scripts/architecture.ts) and [dependency rules](architecture/dependency-cruiser.cjs) enforce the boundaries.

[AGENTS.md](AGENTS.md) is the development guide: it explains these decisions, testing, verification and pull requests.

## Develop from source

Use the Node version in [.node-version](.node-version) and the pnpm version named by `packageManager` in [package.json](package.json). Disposable server development also needs Git and either Linux with bubblewrap (`bwrap`) or macOS with `sandbox-exec`.

The private Agent review, Explain CI failure and Release notes workflows retain Node 24.20.0 because their OpenAI SDK currently declares support for Node 22 and 24, with Node 26 forward-tested. Their runtime pins can move after the SDK's supported matrix includes Node 26 and their CI paths are qualified on it. This exception does not change the development or published server runtime range.

```sh
git clone https://github.com/FabioFiorita/porcelain.git
cd porcelain
pnpm install --frozen-lockfile
pnpm dev:walkthrough
```

Open the web address in the connection card and choose **Pair this browser**. The sample worktree opens a ready Walkthrough with one developer call, two steps and a summary of how the system grew. The card also prints the command that stops that disposable instance.

Build the server and browser app into the npm package:

```sh
pnpm build:package
```

The output is generated in `dist-porcelain/`, including its package readme. Pack it with `npm pack ./dist-porcelain`, then install the printed tarball into a separate directory with `npm install --prefix <directory> <tarball>`. This installs the runtime dependencies; the CLI is `<directory>/node_modules/.bin/porcelain`. Start it with `serve` and pair a browser with `pair`, using the same absolute `--data-directory` for all commands.

Check static rules and run a single named unit test, for example:

```sh
pnpm check:local
pnpm test --project @porcelain/client packages/client/src/features/walkthroughs/rules/conversations.spec.ts
```

Run the tests you changed by name; CI owns the full suites. For a feature's running proof, use the relevant [verification skill](.agents/skills) and its map, such as the [web feature map](.agents/skills/web-verify/features/README.md). Development uses disposable instances and profiles; never point verification at the installed app or its data.
