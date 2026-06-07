<div align="center">
  <img src="src/renderer/src/assets/logo.png" alt="Porcelain" width="120" />
  <h1>Porcelain</h1>
  <p><strong>Review changes as a story.</strong></p>
  <p>A lightweight macOS code viewer and companion for the age of coding agents.</p>
</div>

---

You drive your coding agents from the terminal. But the moment you need to *read* the result — skim a diff, trace a change across files, understand what the agent actually did — you reach for Cursor, Zed, or GitHub Desktop. Heavy editors for a job that isn't editing.

Porcelain fills that gap. It's a fast, focused **viewer** — not an editor, not a terminal — built to read code and review changes alongside your agent and your real terminal (Ghostty, Warp, whatever you like).

## Why Porcelain

- **Flow-ordered review.** A diff isn't an alphabetical list of files — it's one change rippling through your stack. Porcelain orders and groups changed files along their dependency flow (component → query → route → controller → service → schema), so you read a feature as a story from entry point to database instead of jumping around a file tree.
- **Built for huge monorepos.** Stays fast on a ~50 GB repo. Folders can be hidden so only the apps you care about are visible, and pinned for quick access — nothing is indexed until you look at it. No other tool lets you carve a monorepo down to just the part you're working on.
- **A terminal *companion*, not a terminal.** Porcelain has no embedded terminal on purpose — it can't beat Ghostty or Warp and won't try. The git actions it does offer (quick commands, commits) run in-app with output shown inline.
- **Viewer first, lightweight always.** Fast file viewing with Shiki syntax highlighting, no LSP and no extensions. Quick single-file edits are allowed (pencil → edit → save) — but no autocomplete, no format-on-save, no multi-file refactors. It never grows into an IDE.

## Features

- **Flow-ordered diff review** with per-repo layer definitions you can customize
- **Git** — working-tree diffs (unified or split), commit history, worktree switching, in-app commits with conventional-commit chips learned from your history
- **Fast file viewer** — virtualized rendering, Shiki highlighting, image and Markdown support (reader + source modes)
- **Monorepo navigation** — hide/unhide folders, pin paths, lazy per-directory loading
- **Cmd+P fuzzy file finder**, Cmd+F find-in-file, find-references via `git grep`
- **Liquid-glass UI** — native macOS vibrancy, floating sidebars, drag-resizable panels
- **Auto-updating** signed builds

## Install

> Requires macOS (Apple Silicon).

Download the latest `.dmg` from the [Releases](https://github.com/fabiofiorita/porcelain/releases) page, open it, and drag Porcelain to your Applications folder. The app checks for and installs updates automatically.

## Develop

Porcelain is built with Electron (electron-vite), React 19, TypeScript (strict), shadcn/ui on Base UI, Tailwind v4, tRPC over IPC, TanStack Query, and zustand. State and git access run through a single, deliberately uniform architecture — see [CLAUDE.md](CLAUDE.md) and the skills in [`.agents/skills/`](.agents/skills/).

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
