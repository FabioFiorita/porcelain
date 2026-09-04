<div align="center">
  <img src="apps/web/src/assets/logo.png" alt="Porcelain" width="120" />
  <h1>Porcelain</h1>
  <p><strong>Where agent work becomes trusted work.</strong></p>
  <p>A lightweight review layer for agentic coding. Agents keep running where they already run; Porcelain is where you inspect, understand, and sign off their work.</p>
</div>

Porcelain is a daemon with browser, Electron, and mobile clients. It brings worktrees, Git changes,
review material, terminals, and remote access into one place without becoming an IDE or an
in-app agent host. Your code stays on machines you control.

Agents can move faster than people can confidently review. Porcelain helps you regain focus,
understand the work, and spend attention where mistakes matter most. Read the
[product intent](docs/product.md) for its audience, goals, and direction.

## What it provides

- A review story for a unit of work: intent, execution, and evidence.
- Worktree navigation, focused file views, diffs, history, and Git actions.
- Terminals and development servers that belong to the daemon host.
- Browser, Electron, and mobile clients using the same daemon contracts.
- LAN, Tailscale, and Cloudflare access with one-time pairing and independently revocable devices.

## Install

On macOS, download the latest signed application from
[GitHub Releases](https://github.com/FabioFiorita/porcelain/releases). For a browser or mobile
client, run the daemon on the machine that holds the code:

```sh
npx @fabiofiorita/porcelain@latest serve --lan
npx @fabiofiorita/porcelain@latest access issue --name "My phone"
```

Open the one-time link on the device to pair it. Remote exposure and always-on setup are documented in
[docs/remote-access.md](docs/remote-access.md).

## Agent connection

The **Porcelain** plugin gives agents the MCP tools and focused skills for Canvases, comments,
Actions, profiles, and remote-daemon setup. Its MCP connector talks to the Porcelain daemon running
on the same machine and profile as the agent.

### Codex

Install it from Porcelain's Companion settings, or use the Codex CLI:

```sh
codex plugin marketplace add FabioFiorita/porcelain
codex plugin marketplace upgrade fabiofiorita
codex plugin add porcelain@fabiofiorita
```

### Claude Plugin

Claude Code can register the repository as a marketplace:

```text
/plugin marketplace add FabioFiorita/porcelain
/plugin install porcelain@porcelain
```

## Development

Porcelain is a pnpm monorepo. The supported development loop, isolated homes, worktrees, browser,
Electron, mobile, testing, and release pointers are in [docs/development.md](docs/development.md).

```sh
pnpm install
pnpm dev:env
pnpm dev
```

Use the profile and disposable playground printed by `dev:env`, never production state.
Find source owners in the [code map](docs/architecture.md) and product terms in the
[glossary](docs/glossary.md).

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE) © Fabio Fiorita
