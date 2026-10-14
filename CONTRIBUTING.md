# Contributing to Porcelain

Porcelain is built by one developer working with coding agents, and it moves quickly. Issues are the best way to help: a bug with the steps to reproduce it, or a problem you hit while reviewing an agent's work. For anything larger than a small fix, open an issue before a pull request, so we can agree on the shape first.

[AGENTS.md](AGENTS.md) is the full development guide, for people and agents alike. It covers how a feature crosses the repository, testing, verification and pull requests.

## Architecture and decisions

Porcelain is a TypeScript monorepo using pnpm, Turborepo and Effect. The server owns repositories and persistent state; the clients present that state and send commands.

| Path | Responsibility |
| --- | --- |
| [apps/server](apps/server) | HTTP, WebSocket and MCP entry points, server use cases, CLI and installer |
| [apps/web](apps/web) | React and Vite browser views |
| [apps/desktop](apps/desktop) | Electron host around the web app |
| [apps/mobile](apps/mobile) | Expo native client |
| [packages/contracts](packages/contracts) | Schemas for data crossing the wire |
| [packages/client](packages/client) | Shared client queries, commands, stores and rules |
| Domain packages under [packages](packages) | Access, changes, files, projects, reviews and Git actions |

- **The agent supplies the explanation.** The [MCP toolkit](packages/contracts/src/reviews/review-toolkit.ts) defines review publication and feedback; the [review guide](apps/server/src/http/mcp/review-guide.ts) tells agents how to explain their work.
- **Browser pairing and local agent access have different paths.** Browser devices pair with single-use links. The [MCP bridge](apps/server/src/cli/mcp-bridge.ts) relays an agent's standard input/output through a [local owner socket](apps/server/src/config/owner-socket-settings.ts), carrying its working directory.
- **Git remains Git.** Repository operations use the [Git CLI](packages/git/src/shared/commands/run-git.ts); persistent review and access data use SQLite with [migrations](packages/storage/drizzle).
- **Each layer has one job.** Features move from contracts through domain services, server use cases and the shared client to app views. [read-environment-service.ts](packages/access/src/services/read-environment-service.ts) shows the Effect service and Layer pattern. [Architecture checks](scripts/architecture.ts) and [dependency rules](architecture/dependency-cruiser.cjs) enforce the boundaries.

[AGENTS.md](AGENTS.md) is the development guide: it explains these decisions, testing, verification and pull requests.

## Develop from source

Use the Node version in [.node-version](.node-version) and the pnpm version named by `packageManager` in [package.json](package.json). Disposable server development also needs Git and either Linux with bubblewrap (`bwrap`) or macOS with `sandbox-exec`.

```sh
git clone https://github.com/FabioFiorita/porcelain.git
cd porcelain
pnpm install --frozen-lockfile
pnpm dev:review
```

Open the web address in the connection card and choose **Pair this browser**. The sample review opens with a briefing; choose **Continue with 2. Revoke access across devices**, then a numbered step to reach its diff and note. The card also prints the command that stops that disposable instance.

Build the server and browser app into the npm package:

```sh
pnpm build:package
```

The output is generated in `dist-porcelain/`, including its package readme. Pack it with `npm pack ./dist-porcelain`, then install the printed tarball into a separate directory with `npm install --prefix <directory> <tarball>`. This installs the runtime dependencies; the CLI is `<directory>/node_modules/.bin/porcelain`. Start it with `serve` and pair a browser with `pair`, using the same absolute `--data-directory` for all commands. Configure your agent's MCP client to run the built CLI's `mcp` command from the registered repository or worktree. The server must stay running. Ask the agent to read `porcelain://review-guide`, publish with `publish_review`, and read your feedback with `list_comments`; its replies appear in the browser's comment threads.

Check static rules and run a single named unit test, for example:

```sh
pnpm check:local
pnpm test --project @porcelain/client packages/client/src/features/reviews/rules/comments.spec.ts
```

Run the tests you changed by name; CI owns the full suites. For a feature's running proof, use the relevant [verification skill](.agents/skills) and its map, such as the [web feature map](.agents/skills/web-verify/features/README.md). Development uses disposable instances and profiles; never point verification at the installed app or its data.
