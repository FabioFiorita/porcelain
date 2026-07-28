# Contributing

Thanks for looking at Porcelain. Issues and pull requests are welcome.

## Before you start

1. Read [AGENTS.md](AGENTS.md) for how the project works and the hard rules agents (and humans) follow.
2. Product identity and principles live in the [product](.agents/skills/product/SKILL.md) skill; architecture in [architecture](.agents/skills/architecture/SKILL.md).

## Setup

```bash
pnpm install
pnpm dev
```

`pnpm dev` uses a throwaway playground repo and isolated config, so it does not touch your real repositories.

## Verification

Every change must pass the gate before commit:

```bash
pnpm verify
```

That is lint + test + build (typecheck runs inside build).

## Pull requests

- Keep changes focused; match the local code style and architecture.
- Prefer small PRs with a clear why.
- Do not add a second pattern for something the codebase already solves one way; if you think a better approach exists, say so in the PR.

## License

By contributing, you agree your work is licensed under the [MIT License](LICENSE).
