# Scope — monorepo hide / pin

Hide folders that are not yours; pin the ones you care about. Porcelain stays fast on huge monorepos because the tree never indexes what is hidden.

## Channel

`~/.porcelain/scope.json` (override with `PORCELAIN_SCOPE`). Keyed by **absolute** repo path. Values are absolute paths under that repo (the CLI accepts **repo-relative** paths and joins them).

```json
{
  "/home/you/code/my-app": {
    "hiddenPaths": ["/home/you/code/my-app/apps/legacy"],
    "pinnedPaths": ["/home/you/code/my-app/apps/web"]
  }
}
```

Migrated once from daemon `config.json` on startup if you had hide/pin before this channel existed.

## CLI

```bash
~/.porcelain/porcelain scope list
~/.porcelain/porcelain scope hide --path apps/legacy
~/.porcelain/porcelain scope unhide --path apps/legacy
~/.porcelain/porcelain scope pin --path apps/web
~/.porcelain/porcelain scope unpin --path apps/web
~/.porcelain/porcelain scope clear
```

Use `--repo <absolute path>` when not inside the checkout. Prefer **relative** `--path` values.

## When to use

- Human copied the **focus setup prompt** (Files tab when the root looks large and nothing is hidden/pinned yet).
- Human’s monorepo tree is noisy → hide sibling apps that are not in play.
- Remote environment setup → remap and re-apply hide/pin via this CLI (no hand-edit of `config.json`).
- Agent onboarding a huge repo → hide irrelevant packages after surveying layout (tsconfig / package roots / recent commits help).

## Setup path (from the focus prompt)

1. Inspect layout: top-level packages/apps, project boundaries, recent commits; optional git author for “what this human usually touches.”
2. Propose hide paths (siblings not in play) and pin paths (active product roots).
3. `scope list` → `scope hide --path …` / `scope pin --path …` (repo-relative preferred).
4. Confirm list + Files tree (show-hidden reveals hidden rows).

## Rules

- Two-way: app tree context menu and CLI both write the same channel.
- Do not put secrets here — only paths.
- `scope clear` drops **both** hidden and pinned for that repo.
