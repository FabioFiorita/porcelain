# Plan 019: Point the VS Code workspace at Biome (not Prettier/ESLint)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- .vscode/settings.json .vscode/extensions.json biome.json`
> If any changed since this plan was written, compare the "Current state"
> excerpts against the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Category**: dx
- **Depends on**: none
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

The repo lints and formats with **Biome** (`biome.json`; `pnpm lint` = `biome
check .`). There is no ESLint or Prettier in `package.json`. But the committed
VS Code workspace config tells contributors otherwise: it recommends the ESLint
extension (a dead no-op — no ESLint config exists) and sets **Prettier** as the
default formatter for TS/JS/JSON. Biome formats with single quotes, no semicolons,
2-space indent, width 100 (`biome.json` lines 7-15); Prettier's defaults differ, so
format-on-save reformats files in a way `pnpm lint` then rejects — the classic
"formatter fights the linter" trap, in a repo whose hard rule 2 is uniformity. This
is leftover electron-vite scaffolding never reconciled with the Biome migration.

After this plan, the workspace recommends and uses the Biome extension, so
format-on-save matches `biome.json` and CI's `pnpm lint`.

## Current state

`.vscode/extensions.json`:

```json
{
  "recommendations": ["dbaeumer.vscode-eslint"]
}
```

`.vscode/settings.json`:

```json
{
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

`biome.json` facts to honor: formatter is enabled; `assist.actions.source.organizeImports`
is `"on"` (so VS Code's organize-imports action should be Biome's); CSS and
`src/renderer/src/components/ui` are excluded from Biome (`files.includes`), so do
NOT set Biome as the CSS formatter. The official extension id is `biomejs.biome`.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Lint      | `pnpm lint`      | exit 0 (unchanged)  |
| Validate JSON | `node -e "JSON.parse(require('fs').readFileSync('.vscode/settings.json','utf8'))"` | no error |

(The four-command gate isn't strictly needed — these are editor config files, not
shipped code — but run `pnpm lint` to confirm nothing regressed.)

## Scope

**In scope**:
- `.vscode/extensions.json`
- `.vscode/settings.json`

**Out of scope** (do NOT touch):
- `biome.json` — already correct; do not change the formatter rules.
- Any source file. This plan changes only editor recommendations/settings.
- Do NOT set Biome as the CSS formatter (Biome excludes CSS by config).

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never branch**.
Conventional Commits; example: `chore(dx): point VS Code at Biome instead of Prettier/ESLint`.

## Steps

### Step 1: Recommend the Biome extension

Replace `.vscode/extensions.json` with:

```json
{
  "recommendations": ["biomejs.biome"]
}
```

### Step 2: Make Biome the default formatter + wire format/organize-on-save

Replace `.vscode/settings.json` with:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports.biome": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

(This adds `typescriptreact` and `jsonc`, which the old config omitted, and routes
organize-imports through Biome to match `biome.json`'s assist setting.)

**Verify**:
- `node -e "JSON.parse(require('fs').readFileSync('.vscode/settings.json','utf8')); JSON.parse(require('fs').readFileSync('.vscode/extensions.json','utf8'))"`
  → no error (both files are valid JSON).
- `grep -ri "prettier\|eslint" .vscode/` → no matches.

### Step 3: Confirm the lint gate is unaffected

**Verify**: `pnpm lint` → exit 0.

## Test plan

- No code changes, so no unit tests. Verification is: both JSON files parse,
  no `prettier`/`eslint` references remain in `.vscode/`, and `pnpm lint` still
  passes.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `.vscode/extensions.json` recommends `biomejs.biome` (and not the ESLint ext)
- [ ] `.vscode/settings.json` sets `biomejs.biome` as the default formatter for
      TS/TSX/JS/JSON/JSONC and enables `formatOnSave`
- [ ] `grep -ri "prettier\|eslint" .vscode/` returns no matches
- [ ] Both `.vscode/*.json` files parse as valid JSON
- [ ] `pnpm lint` exits 0
- [ ] No files outside `.vscode/` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `biome.json` no longer enables the formatter or `organizeImports` (the settings
  would then point at a disabled tool — re-confirm `biome.json` first).
- You find a contributor doc that explicitly tells people to use Prettier (then the
  intent is contested — report rather than overriding).

## Maintenance notes

- For the reviewer: confirm CSS is NOT routed to Biome (it's excluded in
  `biome.json`); the settings above deliberately omit `[css]`.
- If a future preset/scaffold re-adds Prettier/ESLint to `.vscode/`, re-apply this
  (the repo standardizes on Biome — `biome.json` is the single source of truth).
