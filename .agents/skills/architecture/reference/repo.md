# Repo facts and packaging

## Repo facts

- **Three workspace packages**: `apps/desktop` (the Electron app — main, preload, renderer, plus the
  daemon and agent CLI it bundles), `apps/mobile` (Expo, iOS-only), `packages/contracts` (wire shapes
  both clients share). The root is a workspace root only — it owns lint, the git hooks and the
  release scripts, and its `package.json` deliberately has **no `version`**:
  `apps/desktop/package.json` holds the one product version electron-builder stamps, so
  `release-cut.mjs` bumps it there.
- **TRAP — `@porcelain/contracts` must stay a `devDependency` of `apps/desktop`.** electron-vite
  externalizes declared `dependencies`, so promoting it emits a bare `require("@porcelain/contracts")`
  into the dependency-free CLI bundle and the standalone daemon.
- **TRAP — pin `dmg.artifactName`.** electron-builder's `${name}` expands to the raw package name, so
  the scoped `@porcelain/desktop` would put a slash in the artifact filename.
- Path aliases are defined in **FOUR places that must stay in sync**: `electron.vite.config.ts`,
  `tsconfig.web.json`, `apps/desktop/tsconfig.json` (the shadcn CLI needs it), `vitest.config.ts`.
- `@main` imports in the renderer are **type-only** — a runtime import leaks Node into the bundle.
- **TRAP — the two `createTRPCReact` instances must never share the default TRPC context.** With no
  `context` option it falls back to a module-level singleton, so nesting the shell Provider inside
  the app Provider silently routes ALL app hooks to the shell client ("No procedure found" hang).
- **Shiki tokenization is whole-file, not per-line**, so grammar state carries across line breaks —
  per-line lost it and mis-colored multiline comments and template literals. Diffs reconstruct each
  hunk's old/new image (cross-hunk context is inherently unavailable). Mono ligatures are disabled
  globally so `===`/`=>`/`??` stay legible.
- shadcn components live in `components/ui/` (excluded from Biome). Base UI uses `render`, not
  Radix's `asChild`.
- **Theme is a renderer-local preference applied pre-paint in `main.tsx`.** `index.html` keeps
  `class="dark"` ONLY as the boot flash-guard main.tsx immediately corrects — do **not** read it as
  "hardwired dark". OS chrome follows a `setThemeSource` shell mutation; `nativeTheme` is used ONLY
  there. The resolved theme name is part of the Shiki `tokenCache` key.
- **TRAP — re-applying a shadcn preset overwrites `ui/` AND the color block, and clobbers non-`ui`
  files too.** Afterwards restore: `lib/utils.ts` (custom `extendTailwindMerge` groups +
  `randomId`/`copyText` — the apply rewrites it to the stock 6-line `cn`), `ui/sonner.tsx` (upstream
  pulls `next-themes` back into `package.json`), the sidebar `shortcut` prop + mobile-width constants
  + dual-rail sheet + `dvh` units, the ScrollArea `orientation` prop, and the
  AlertDialogAction-on-`Close` fix. Diff every touched file against HEAD. (`shadcn apply` needs a
  temporary stub `vite.config.ts` to pass framework detection.)
- **The Review's feature view is agent-curated only.** `buildFeatureView` takes **exactly**
  `reviewSet.files` for membership and order, renders the agent's per-file `layer` verbatim, and tags
  listed dirty paths as `changed`. It does **not** union the working tree or auto-expand imports —
  incidental dirty files stay on Changes — and returns **null** with no review set.
- `groupByLayer` (`flow.ts`) is the regex flow grouping (furthest-right match, then alphabetical),
  shared by Changes/History and the explore reader. `terminal-manager.ts` is the one impure,
  non-unit-tested backend module.
- Daemon `userData/config.json` holds recents + global bind flags only. Notes, layers, reviewed marks,
  and scope live under `~/.porcelain/*.json` for one reason: **the CLI ships with no dependencies and
  no app**, so it must read them off disk. Keep new channels there.

## Packaging, release, conventions

`electron-builder.yml`: mac dmg + zip (arm64 — the **zip** is what electron-updater downloads), hardened
runtime, Developer ID signing. Auto-update no-ops unless `app.isPackaged`. The porcelain CLI is a
**second main build input** importing only Node builtins, so a plain `node` runs it. Release is simple
main + tag: `pnpm release:cut` (default **patch**) bumps, tags, and dispatches one workflow that
packages, publishes the GH Release, and publishes npm `porcelain-daemon` — no pending branches, no
multi-workflow pre-cut gate, native e2e optional. Runbook: `releasing`. Dep placement and the
empty-`CSC_LINK` trap are `audit` invariants.

- shadcn primitives only; a new primitive needs the human's approval.
- Strict TS, no `any`, no `as unknown as`, no dead code, no commented-out code.
- Conventional Commits. Gate before any commit: `pnpm verify`.
- Managed worktrees are runtime-isolated (unique port, per-slug channels/user data/playground).
  `PORCELAIN_DEV_PLAYGROUND` carries the seed into the daemon and **must stay in `terminal-env.ts`'s
  scrub list**.
