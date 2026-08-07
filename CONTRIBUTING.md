# Contributing

Thanks for looking at Porcelain. Issues and pull requests are welcome.

## Before you start

1. Read [AGENTS.md](AGENTS.md) for how the project works and the defaults agents (and humans) follow.
2. Product identity: [docs/product.md](docs/product.md). Architecture traps when lost:
   [docs/internals/](docs/internals/).

## Setup

```bash
pnpm install
pnpm dev
```

`pnpm dev` uses a throwaway playground repo and isolated config, so it does not touch your real repositories.

If Electron is missing after install (`Error: Electron uninstall`), run `node node_modules/electron/install.js` once (Electron may not download in `postinstall` on every platform).

**Agents and this clone:** project hooks require `pnpm lint` before commit; run `pnpm verify` before push. Work on a fork, open a PR, and keep changes focused. Day-to-day product work uses the **dev** daemon (`pnpm dev:daemon`, port 43118, `~/.porcelain-dev`) — not a production install. See [AGENTS.md](AGENTS.md) and the `ship` skill.

## Verification

```bash
pnpm lint     # every commit (hook-enforced): Biome + real custom lints
pnpm verify   # before push / release: lint + test + build + e2e typecheck
```

CI on `main` runs full `pnpm verify` and browser e2e in parallel.

## Pull requests

- Keep changes focused; match the local code style and architecture.
- Prefer small PRs with a clear why.
- Do not add a second pattern for something the codebase already solves one way; if you think a better approach exists, say so in the PR.

## License

By contributing, you agree your work is licensed under the [MIT License](LICENSE).
