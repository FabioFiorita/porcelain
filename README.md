# Porcelain

Porcelain is where you review what a coding agent changed. The agent publishes its work as a walkthrough of decisions. You read the diffs in that order, mark what you have reviewed and comment, and the agent reads and answers your comments over MCP. One server runs on your machine, and you use it from a browser or the Mac app.

![A decision stop in the walkthrough, with sample data](docs/readme/walkthrough.png)

## Why it exists

Agents write code faster than a person can read a raw diff. A diff shows what changed, but not why, in which order the decisions were made, or which lines nobody explained. Porcelain asks the agent to publish that context and gives you one place to read it, track what you have reviewed and send feedback back to the agent without copying text between windows.

It is for developers who run agents such as Claude Code or Codex on their own computer and want to review the result there or from another device.

## What works today

Porcelain 0.65.4 is published to npm as [`@fabiofiorita/porcelain`](https://www.npmjs.com/package/@fabiofiorita/porcelain) and as a notarized Mac app on [GitHub Releases](https://github.com/FabioFiorita/porcelain/releases). Both are built from this repository with one version number.

Each web feature below has a feature map in [`.agents/skills/web-verify/features`](.agents/skills/web-verify/features/README.md) that says how to reach it and which tests guard it.

**Review**

- Review uncommitted changes, or a whole branch against a base branch you choose.
- A published review opens as a walkthrough: a briefing, one stop per decision with the full diffs of its files and the agent's numbered notes, then the changes no decision explains. `N` and `P` move between stops.
- All changes shows every changed file as one document in walkthrough order.
- Mark files or whole decisions as reviewed. A mark goes stale when the code changes again.
- A readiness panel counts reviewed files, stale marks, unexplained lines, comments waiting on you and failing checks. Proof shows the checks and screenshots the agent attached.
- Agent summary shows the agent's own HTML page in a sandboxed frame.

**Comments, both ways**

- Comment on the whole change, a file or a range of lines. Reply, edit, resolve, reopen and delete resolved threads.
- Agents use six MCP tools, `publish_review`, `read_review`, `list_comments`, `create_comment`, `reply_to_comment` and `resolve_comment`, and read the `porcelain://review-guide` resource before they publish.

![A comment thread with the agent's reply, with sample data](docs/readme/comments.png)

**Code, history and Git**

- Browse the file tree, open files by name, find in a file, and preview Markdown, HTML and images.
- Edit files with autosave. A save is refused if the file changed on disk since you opened it.
- Create, rename, move, duplicate, pin, hide and trash files. Follow a file's timeline across renames.
- Browse history as a list or a graph and open any commit.
- Commit, discard and restore, stash and pop, push and pull. If the `claude` or `codex` CLI is installed on the server's machine, the commit dialog can draft the message.
- Changes on disk appear while the page is open, without a reload.

**Clients and connections**

- **Web:** served by the server itself.
- **Mac app:** runs its own server, shares this computer on the local network, a tailnet or a Cloudflare tunnel, pairs devices with a link or QR code, opens projects on other computers that run Porcelain, and updates itself from Settings.
- Nothing can reach the server until you pair a device with a single-use link. Agents on the same machine connect without a credential.

![Proof with checks and a screenshot the agent attached, with sample data](docs/readme/proof.png)

## Getting started

You need Node 24 (24.20 or later), Git, and macOS or Linux.

### Run the server

```sh
npx @fabiofiorita/porcelain@latest serve
```

It prints `Porcelain listening at http://127.0.0.1:3000`. State lives in `~/.porcelain/`; pass `--data-directory` to keep it elsewhere. `serve --lan` lets other devices on your network connect.

The commands below are written as `porcelain`. If it is not on your `PATH`, run them as `npx @fabiofiorita/porcelain@latest <command>`. `porcelain --help` lists every command.

### Pair a browser

Open the address in a browser. It says the browser is not paired and shows the command to run, with its own address filled in. On the machine running the server:

```sh
porcelain pair "Laptop" --address http://127.0.0.1:3000
```

Open the printed link in that browser. The address must be one the server answers at. The link works once and expires after 15 minutes. `porcelain devices` lists paired devices and pending links, and `porcelain revoke <id>` ends one.

### Open a project and connect an agent

In the browser, choose Open project and pick a folder that is a Git repository. Porcelain only shows folders you open.

Agents connect over MCP through a local socket in the data directory, so they need no credential. Settings → Git and agents shows the command for Claude Code:

```sh
claude mcp add porcelain -- porcelain mcp
```

Without `porcelain` on your `PATH`, use `claude mcp add porcelain -- npx -y @fabiofiorita/porcelain@latest mcp`. If the server uses `--data-directory`, pass the same one to `mcp`. Other MCP clients run `porcelain mcp` as a stdio server.

Start the agent inside the opened repository or one of its worktrees; the tools act on the worktree that contains the agent's working directory. Ask it to publish a review when it finishes, and the walkthrough appears in the open page.

### Keep it running on Linux

```sh
npx @fabiofiorita/porcelain@latest service install
porcelain service update
```

This installs a systemd user service and writes a `porcelain` command to `~/.local/bin`. Run service commands as your own user, never with sudo. The [package readme](https://www.npmjs.com/package/@fabiofiorita/porcelain) covers updates, recovery and uninstalling.

### Reach it from another device

- **Local network:** `porcelain serve --lan`, or `porcelain share lan on` for the service. Traffic is not encrypted.
- **Tailscale:** run `tailscale serve` yourself, then `porcelain share tailscale <hostname>`.
- **Cloudflare:** run your own `cloudflared` tunnel, then `porcelain share cloudflare <hostname>`.

`porcelain share` shows how the server is shared, and `porcelain share check` checks each enabled way in again. Pair each device with an address it can reach.

### Mac app

Download `Porcelain-<version>-arm64.dmg` from [GitHub Releases](https://github.com/FabioFiorita/porcelain/releases). The app runs its own server while it is open. Closing the window keeps the server running; Quit stops it. Settings → Ways in and Devices share the computer and pair phones and browsers.

## Known limitations

- The server runs on macOS and Linux. There is no Windows support.
- `porcelain service` manages a systemd user service, so it works on Linux only. On a Mac, use the Mac app or `porcelain serve`.
- The Mac app is built for Apple silicon only.
- The Mac app installs no `porcelain` command, so the MCP command its Settings shows does not work without the npm package, and `porcelain mcp` looks in `~/.porcelain` rather than the app's own data directory ([#247](https://github.com/FabioFiorita/porcelain/issues/247)). Connect agents through the npm server for now.
- The web app the server serves has no sharing or device settings. Use `porcelain share` and `porcelain pair`, or the Mac app.
- Porcelain does not run Tailscale or Cloudflare tunnels; it uses the one you set up.
- Commit message drafting needs the `claude` or `codex` CLI on the server's machine.
- The iPhone and iPad app in [`apps/mobile`](apps/mobile) has no store release. It builds from source as an Expo development build for iOS 26. It reviews files, shows agent notes and comments, and browses files and history, but has no walkthrough or Git actions, and pairs by pasting a link. Android has its own views but has not been verified.

## Plans

Planned work and known bugs are tracked in [GitHub issues](https://github.com/FabioFiorita/porcelain/issues).

## Architecture

Porcelain is a pnpm and Turborepo monorepo in TypeScript, built on [Effect](https://effect.website) v4.

| Path | What it holds |
| --- | --- |
| [`apps/server`](apps/server) | The HTTP and WebSocket server, its use cases, the MCP server, the CLI and the Linux installer |
| [`apps/web`](apps/web) | The React and Vite web app |
| [`apps/desktop`](apps/desktop) | The Electron Mac app around the web app |
| [`apps/mobile`](apps/mobile) | The Expo app for iPhone and iPad |
| [`packages/contracts`](packages/contracts) | Every schema that crosses the wire |
| [`packages/client`](packages/client) | Client logic shared by web, desktop and mobile |
| `packages/access`, `changes`, `files`, `projects`, `reviews`, `git-actions` | Domain rules and services |
| `packages/git`, `storage`, `agents`, `process`, `kernel`, `effects`, `theme` | Infrastructure |

Key decisions:

- **One server per machine, many clients.** Each computer keeps its own data in SQLite in its data directory ([migrations](packages/storage/drizzle)). Clients pair with each computer separately, and the Mac app can hold several at once.
- **Pairing, not accounts.** A device redeems a single-use link and keeps its own credential. Agents use a Unix socket in the data directory instead of a network credential ([owner socket](apps/server/src/config/owner-socket-settings.ts), [MCP bridge](apps/server/src/cli/mcp-bridge.ts)).
- **The agent writes the review.** Reviews arrive through MCP tools defined once as schemas ([toolkit](packages/contracts/src/reviews/review-toolkit.ts)), with a [guide given to agents](apps/server/src/http/mcp/review-guide.ts).
- **Real Git.** Git work runs the `git` CLI ([run-git.ts](packages/git/src/shared/commands/run-git.ts)).
- **A feature crosses the repository in one order:** contract, domain package, server use case and route, shared client, then each app. Services are Effect `Context.Service` values with Layers; [read-environment-service.ts](packages/access/src/services/read-environment-service.ts) is the example to copy.
- **Rules are enforced, not documented.** TypeScript, Oxlint, Oxfmt and an architecture check ([scripts/architecture.ts](scripts/architecture.ts), [dependency rules](architecture/dependency-cruiser.cjs)) reject code in the wrong layer.

[AGENTS.md](AGENTS.md) explains these rules in full.

## Development

This repository is written mostly by coding agents. [AGENTS.md](AGENTS.md) is the guide for agents and people alike: how features are built, how to test, how to verify and how to open a pull request. Read it before changing code.

You need Node 24.20 (see [`.node-version`](.node-version)) and pnpm 12.3.4. `pnpm dev` also needs macOS, or Linux with bubblewrap (`bwrap`), because it isolates its server.

```sh
pnpm install
pnpm dev
```

`pnpm install` also installs a pre-push hook that runs `pnpm check:local`. `pnpm dev` starts a disposable server with a sample repository and the web app; its not-paired page offers Pair this browser.

| Command | What it does |
| --- | --- |
| `pnpm dev:review` | A disposable server with a published sample review |
| `pnpm dev --desktop` | The Mac app as Porcelain Dev, with its own profile (macOS) |
| `pnpm dev:mobile` | Metro for the mobile development build |
| `pnpm build:package` | The npm package in `dist-porcelain/` |
| `pnpm check:local` | Types, lint, format, the architecture check and the feature maps; no product tests |
| `pnpm test --project <package> <file>` | One unit test file, for example `pnpm test --project @porcelain/access packages/access/src/rules/credential.spec.ts` |

Do not run whole test suites locally; CI runs every suite on each pull request. Run the test files you changed by name, and prove a feature through its verification skill in [`.agents/skills`](.agents/skills) (`web-verify`, `desktop-verify`, `mobile-verify`, `server-verify`).

Never build, install or run the installed Porcelain app or service while developing. Use `pnpm dev` and the disposable instances the skills start.

## Licence

`package.json` declares the MIT licence, and the npm package ships its text. The repository has no `LICENSE` file yet.
