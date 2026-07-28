<div align="center">
  <img src="src/renderer/src/assets/logo.png" alt="Porcelain" width="120" />
  <h1>Porcelain</h1>
  <p><strong>Where agent work becomes trusted work.</strong></p>
  <p>The review layer for agentic coding: a focused companion, not a second cockpit. Your agents stay in Claude Code, Codex, T3 Code, or whatever you already use. Porcelain is where you review what they built like a senior engineer reads a feature: as a story, not a file list.</p>
</div>

---

Coding agents generate faster than anyone can trust. Every tool in this space races to spawn more agents in more worktrees; the pile of unreviewed diffs just grows. Porcelain stands on the other side of that pile: one lightweight window (not an editor, not an agent host) where agent work becomes something you've actually read, understood, and signed off.

## Why Porcelain

- **The Review.** Your agent doesn't just hand you a diff. It publishes a walkthrough of the whole unit of work: **Intent** (what and why), **Execution** (flow-ordered files and prose, including unchanged code across the client→server seam a diff can't show), and **Evidence** (proof it verified its own work). You read a document, not a pile.
- **Flow-ordered diffs.** Even without a published Review, changed files are ordered and grouped along their dependency flow (component → hook → route → service → schema) so a change reads from entry point to database instead of alphabetically.
- **A two-way loop.** Review comments on a line or file flow back to your agent as concrete context, and resolutions flow forward. A per-repo project board keeps work queued and moved as agents ship. All of it runs through a bundled local CLI. No server, no port, no telemetry.
- **Focus on the work in front of you.** Hide monorepo folders that aren't yours, pin the ones that are, and keep one active Review per repo. Built to stay fast on a ~50 GB tree: nothing is indexed until you look at it.
- **Companion, not replacement.** Porcelain does not reimplement Claude Code, Codex, OpenCode, Grok, T3 Code, or your editor. Keep those tools. Optional: run them in Porcelain's embedded terminal next to the review surfaces (or keep them in Ghostty, Warp, or SSH). Sessions are daemon-owned: they survive reloads and follow you to any browser.
- **Anywhere is the same place.** One token-gated daemon, three clients: the Mac app on a local daemon, the same app pointed at a remote daemon (a Linux box, a home server, a cloud VM), or any browser on your LAN or tailnet, including on mobile. Terminals and review state live daemon-side, so they survive reconnects and follow you across devices.

## Features

- **Whole-feature review**: agent-authored Review (Intent · Execution · Evidence), outline with per-file reviewed marks, keyboard navigation, zen reading mode
- **Flow-ordered diff review** with per-repo layer definitions, plus read-only **flow exploration** of any existing feature (seed from a symbol or file)
- **Human ↔ agent channels**: review comments with resolutions, a todo/doing/done **project board**, repo notes, and per-repo flow layers, all over one bundled local CLI
- **Embedded terminal**: real PTYs that survive reconnects, plus saved Actions your agent curates and only you run (optional convenience next to review, not an agent product)
- **Git**: working-tree diffs (unified or split), per-file staging, history, worktree switching, in-app commits with conventional-commit chips
- **Fast file viewer**: virtualized rendering, Shiki highlighting, always-editable text (autosave), Markdown reader/source, image support, two-pane split
- **Monorepo navigation**: hide/unhide folders, pin paths, lazy per-directory loading
- **Search & finders**: repo-wide code search, fuzzy file finder, find-in-file, find references
- **Remote access**: LAN (same Wi-Fi) or tailnet (WireGuard). One command on the host:

  ```bash
  npx porcelain-daemon@latest serve --tailnet --print-token
  ```

  Start it when you work, Ctrl+C when you're done. No always-on service required.
- **Light, dark, and system themes**, themed end to end
- **Multi-window**: one repo per window, each window free to pick its own environment (local or remote)
- **Auto-updating** builds (signed and notarized on macOS)

## Install

**macOS (Apple Silicon):** download the latest `.dmg` from [Releases](https://github.com/FabioFiorita/porcelain/releases), drag Porcelain to Applications. Updates install automatically.

**Everything else — Linux, Windows, iPad, phone:** you don't install Porcelain, you open it. Run the daemon on the machine that holds your code (the command above works anywhere Node does) and point a browser at it. Same client the Mac app ships, same review surfaces, no install.

## Connect your agent

The agent channel is a bundled CLI, installed to `~/.porcelain/porcelain` automatically on every app launch, always current, no per-agent configuration. It only touches local files: no port, no telemetry.

Teach your agents the workflow with the single **porcelain-companion** skill (the Review, board, actions, notes, layers, and more), via [skills.sh](https://www.skills.sh):

```bash
npx skills add FabioFiorita/porcelain
```

Run from any repo and choose global or project-local when prompted. New surfaces ship as references inside that one skill — update with `npx skills upgrade`.

## Positioning

Porcelain sells **trust and review depth**, not agent count and not cockpit breadth. It is a **companion** to the agent hosts and editors you already prefer: they write; Porcelain is where you read, annotate, and sign off. Product site: [fabiofiorita.github.io/porcelain](https://fabiofiorita.github.io/porcelain/).

## Develop

Porcelain is built with Electron (electron-vite), React 19, TypeScript (strict), shadcn/ui on Base UI, Tailwind v4, tRPC, TanStack Query, and zustand. State and git access run through a single, deliberately uniform architecture; see [CLAUDE.md](CLAUDE.md) and the skills in [`.agents/skills/`](.agents/skills/).

```bash
pnpm install   # install dependencies
pnpm dev       # run the app in development
```

`pnpm dev` runs against a throwaway playground repo and an isolated config, so it never touches your real repositories.

### Common scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the app in development |
| `pnpm lint` | Biome lint + format check |
| `pnpm typecheck` | Type-check main and renderer |
| `pnpm test` | Run the Vitest suite |
| `pnpm test:e2e` | Playwright e2e (headless browser project) |
| `pnpm build` | Type-check and build |
| `pnpm shots` | Regenerate marketing screenshots |
| `pnpm dist` | Build a signed local `.dmg` / `.zip` |
| `pnpm daemon:dist` | Assemble publishable `dist-daemon/` (`porcelain-daemon` npm package) |
| `pnpm release` | Build and publish to GitHub Releases |

The verification gate before any commit is `pnpm verify` (lint + test + build; typecheck runs inside build).

## License

[MIT](LICENSE) © Fabio Fiorita
