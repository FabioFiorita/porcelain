<div align="center">
  <img src="apps/web/src/assets/logo.png" alt="Porcelain" width="120" />
  <h1>Porcelain</h1>
  <p><strong>Where agent work becomes trusted work.</strong></p>
  <p>The review layer for agentic coding: a focused companion, not a second cockpit. Your agents keep running where they already run. Porcelain is where you review what they built as a story, not a file list.</p>
</div>

---

Coding agents generate faster than anyone can trust. Every tool in this space races to spawn more agents in more worktrees. The pile of unreviewed diffs just grows. Porcelain stands on the other side of that pile: one lightweight window where agent work becomes something you've actually read, understood, and signed off. Not an editor. Not an agent host.

## Why Porcelain

- **The Review.** The home for a unit of work (feature, bug, chore, investigation), from first Intent to sign-off. Your agent publishes three parts: **Intent** (what this is and why), **Execution** (only the files it wants you to read, in the order the change runs, with notes, including unchanged code a plain diff would hide), and **Evidence** (proof it verified its own work). One active story per repo. You read a document, not a pile.
- **Flow that fits *your* repo.** On Changes, files group along flow layers. Those layers are not a fixed stack (no assumed components → hooks → routes layout). They are agent-managed rules for this project: your agent learns how the tree is shaped and groups changes entry-point toward data. Alphabetical is never the real story.
- **A two-way loop.** Leave a comment on a line or a file. It becomes context for your agent, and resolutions come back. A per-repo board keeps work queued as agents ship. Everything stays on machines you control.
- **Focus on the work in front of you.** Hide folders you will not touch. Pin the paths you live in. Your agent can set that up for you. Large trees stay fast: nothing is indexed until you open it.
- **Companion, not replacement.** Porcelain is not an agent host and not an IDE. Keep the tools you already prefer. Run any agent CLI in Porcelain's terminal next to the review surfaces, or keep using your own terminal outside the app.
- **Anywhere is the same place.** Share Porcelain over your LAN, private Tailscale network, or public HTTPS with a Cloudflare tunnel. Pair each Mac, phone, or tablet with a one-time link and revoke it independently. Terminals and review state stay on the host, so reconnects pick up where you left off.

## Features

- **The Review**: Intent · Execution · Evidence as the start-to-end home for a unit of work. Agent-authored story, outline with per-file reviewed marks, keyboard navigation, zen reading mode
- **Agent-shaped flow**: per-repo flow layers your agent defines for *this* layout, flow-ordered Changes and History, plus read-only **flow exploration** of any existing feature (seed from a symbol or file)
- **Human ↔ agent loop**: line and file comments with resolutions, a todo/doing/done **project board**, repo notes, flow layers, and hide/pin. All of it is readable and writable by your agent through the companion skill
- **Embedded terminal**: real PTYs that survive reconnects and follow you across devices. On a remote environment you can open shells on the host and on This device (map a local clone path), and each saved Action chooses which side it runs on.
- **Git**: working-tree diffs (unified or split), per-file staging, history, worktree switching, in-app commits with conventional-commit chips
- **Fast file viewer**: virtualized rendering, Shiki highlighting, always-editable text (autosave), Markdown reader/source, image support, two-pane split
- **Focus navigation**: hide folders, pin paths, lazy per-directory loading. Built for large repos and monorepos alike
- **Search & finders**: repo-wide code search, fuzzy file finder, find-in-file, find references
- **Secure remote access**: LAN, private Tailscale, or Cloudflare; one-time connection links and individually revocable devices
- **Light, dark, and system themes**, themed end to end
- **One window**: projects and worktrees from every connected daemon live in one Hub; clicking a worktree never opens a second window
- **Auto-updating** builds (signed and notarized on macOS)

## Install

**macOS (Apple Silicon):** download the latest `.dmg` from [Releases](https://github.com/FabioFiorita/porcelain/releases), drag Porcelain to Applications. Updates install automatically.

**Everything else (Linux, Windows, iPad, phone):** you don't install Porcelain, you open it. Run the daemon on the machine that holds your code and point a browser at it:

```bash
npx porcelain-daemon@latest serve --lan --cloudflare
```

Then, from another terminal on that host:

```bash
npx porcelain-daemon@latest access issue --name "My phone"
```

Open the one-time link it prints. It expires in 15 minutes and becomes a credential for only that device. The same link can add a remote to the Mac app under **Settings → Remotes**. Network and access administration stays on the host through the CLI; a local Mac app also exposes it under **Settings → Share**.

## Connect your agent

Teach your agents the Porcelain workflow with the single **porcelain-companion** skill (the Review, board, actions, notes, layers, and more), via [skills.sh](https://www.skills.sh):

```bash
npx skills add FabioFiorita/porcelain -g
```

Agents publish and read review state through a small local command that installs with the app (`~/.porcelain/porcelain`), kept current on every launch. New surfaces ship as references inside that one skill. Update with:

```bash
npx skills upgrade -g
```

## Develop

Porcelain is a monorepo: **daemon** (headless Node), **web** (React client), **desktop** (thin Electron shell), **cli** (agent channel), **mobile** (iOS). Stack: React 19, TypeScript (strict), shadcn/ui on Base UI, Tailwind v4, tRPC, TanStack Query, zustand, Expo. Architecture: [AGENTS.md](AGENTS.md), [architecture charter](docs/internals/architecture.md), [docs/product.md](docs/product.md).

```bash
pnpm install      # install dependencies
pnpm build        # daemon + cli + web + shell (dev daemon needs a warm build)
pnpm dev:daemon   # headless on :43118 (browser: http://127.0.0.1:43118/)
pnpm dev          # Electron shell against the same architecture
```

`pnpm dev` / `pnpm dev:daemon` use an isolated config (`~/.porcelain-dev`), so product work never touches the production home.

### Common scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the Electron app in development |
| `pnpm dev:daemon` | Dev daemon on 43118 (`~/.porcelain-dev`) — day-to-day product work |
| `pnpm lint` | Cheap commit gate (Biome + escapes/security-boundaries/eas/agents) |
| `pnpm test` | Run the Vitest suite |
| `pnpm test:e2e` | Playwright e2e (headless browser project) |
| `pnpm build` | Type-check mobile + build desktop |
| `pnpm verify` | Full bar: lint + test + build + e2e typecheck (run before push) |
| `pnpm worktree` | Managed worktrees (`create` / `list` / `pr` / `remove` / …) |
| `pnpm shots` | Regenerate marketing screenshots |
| `pnpm package:mac` | Local Mac package (unsigned path varies by host) |
| `pnpm daemon:dist` | Assemble publishable `dist-daemon/` |
| `pnpm release` | Cut a release (patch by default) |

Mobile lives under `apps/mobile` (`pnpm --dir apps/mobile start`, `sim:build`, …). Snapshot update: `pnpm --dir apps/desktop test:e2e:update`.

Commit is gated by `pnpm lint`. Before push (and on CI): `pnpm verify`. Browser e2e runs on every push to `main`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Fabio Fiorita
