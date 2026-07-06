<div align="center">
  <img src="src/renderer/src/assets/logo.png" alt="Porcelain" width="120" />
  <h1>Porcelain</h1>
  <p><strong>Review changes as a story.</strong></p>
  <p>A lightweight macOS code viewer and companion for the age of coding agents.</p>
</div>

---

Your coding agent writes the code now. But the moment you need to *read* the result (skim a diff, trace a change across files, understand what the agent actually did) you reach for Cursor, Zed, or GitHub Desktop. Heavy editors for a job that isn't editing, and none of them talk to your agent.

Porcelain fills that gap. It's a fast, focused **viewer and review surface** (not an editor) built to read code and review changes alongside your coding agent, with a two-way loop straight back to it.

## Why Porcelain

- **Flow-ordered review.** A diff isn't an alphabetical list of files; it's one change rippling through your stack. Porcelain orders and groups changed files along their dependency flow (component → hook → action → mutation → schema), so you read a feature as a story from entry point to database instead of jumping around a file tree.
- **A two-way loop with your agent.** Bundled Claude Code and Codex plugins run a local MCP server (on your machine, no telemetry). Your review comments become agent context; agent work, resolutions, and the whole-feature manifest flow back to you, on the same feature, in the same order.
- **Built for huge monorepos.** Stays fast on a ~50 GB repo. Folders can be hidden so only the apps you care about are visible, and pinned for quick access; nothing is indexed until you look at it. No other tool lets you carve a monorepo down to just the part you're working on.
- **A companion terminal, not your daily driver.** A real embedded terminal sits beside the review surface to run your agent and its tasks; sessions outlive their tabs, so a background dev server keeps running when you close the tab. It complements Ghostty or Warp; it doesn't try to replace them.
- **Viewer first, lightweight always.** Fast file viewing with Shiki syntax highlighting, no LSP and no extensions. Quick single-file edits are allowed (pencil → edit → save), but no autocomplete, no format-on-save, no multi-file refactors. It never grows into an IDE.

## Features

- **Flow-ordered diff review** with per-repo layer definitions you can customize, agent-managed over MCP
- **Whole-feature review**: widen a diff to the entire feature in flow order (changed · context · shipped files), fed by your agent over a local MCP channel; mark files reviewed as you go
- **Human ↔ agent loop**: review comments on lines or files sync to your agent as context, resolutions sync back; a per-repo todo/doing/done **project board** the agent reads and updates
- **Git**: working-tree diffs (unified or split), per-file staging, commit history, worktree switching with a searchable branch picker, in-app commits with conventional-commit chips learned from your history
- **Embedded terminal & Actions**: real PTYs (xterm.js + node-pty), split-view terminals, sessions that outlive their tabs, and saved **Actions** (named commands your agent curates and you run)
- **Fast file viewer**: virtualized rendering, Shiki highlighting, image and Markdown support (reader + source modes), drag-resizable split view
- **Monorepo navigation**: hide/unhide folders, pin paths, lazy per-directory loading
- **Search & finders**: repo-wide code search, Cmd+P fuzzy file finder, Cmd+F find-in-file, find-references via `git grep`
- **Remote access**: the same client three ways — the Mac app on a local daemon, the Mac app pointed at a remote daemon, or any browser on your tailnet served by the daemon; one token-gated surface, with PTYs and review state living daemon-side so they survive reconnects
- **Multi-window**: one repo per window
- **Liquid-glass UI**: native macOS vibrancy, floating sidebars, drag-resizable panels
- **Auto-updating** signed builds

## Install

> Requires macOS (Apple Silicon).

Download the latest `.dmg` from the [Releases](https://github.com/fabiofiorita/porcelain/releases) page, open it, and drag Porcelain to your Applications folder. The app checks for and installs updates automatically.

## Connect your agent

Porcelain talks to your coding agent through bundled plugins: an MCP server and skills that run locally, over stdio — the agent channel opens no port — and with no telemetry. Install from **Settings → Agents**.

**Claude Code** — one click, or by hand:

```bash
claude plugin marketplace add ~/.porcelain/plugin
claude plugin install porcelain@porcelain
```

Then run `/reload-plugins` (or restart the session).

**Cursor** — one click copies the plugin to `~/.cursor/plugins/local/porcelain`. Or by hand:

```bash
mkdir -p ~/.cursor/plugins/local/porcelain
cp -R ~/.porcelain/plugin/porcelain/. ~/.cursor/plugins/local/porcelain/
```

Then restart Cursor or run **Developer: Reload Window**.

**Codex** — one click, or add the local marketplace and install by hand:

```bash
codex plugin marketplace add ~/.porcelain/codex-plugin
codex plugin add porcelain@porcelain-local
```

Start a new Codex thread after installing.

## Develop

Porcelain is built with Electron (electron-vite), React 19, TypeScript (strict), shadcn/ui on Base UI, Tailwind v4, tRPC over IPC, TanStack Query, and zustand. State and git access run through a single, deliberately uniform architecture; see [CLAUDE.md](CLAUDE.md) and the skills in [`.agents/skills/`](.agents/skills/).

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
| `pnpm build` | Type-check and build |
| `pnpm dist` | Build a signed local `.dmg` / `.zip` |
| `pnpm release` | Build and publish to GitHub Releases |

The verification gate before any commit is `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## License

[MIT](LICENSE) © Fabio Fiorita
