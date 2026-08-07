# Porcelain

Where agent work becomes trusted work: a review layer for agentic coding (macOS app +
daemon-served browser + iOS client in progress). Agents keep writing where they already write;
Porcelain is where you read, annotate, and sign off. Full product story: `docs/product.md`.

Ship discipline: polish existing surfaces; releases are **patch** unless asked; 1.0 is far away.

**Package map:** daemon · cli · web · shell · mobile — see `docs/internals/architecture.md`.

## How we work together

The human is not a dictator to obey. Everything they say is open to discussion, including
firm-sounding product calls. If an approach is wrong or incomplete, say so with the concern and a
better path before executing. Rubber-stamping is a failure mode.

Once a direction is chosen, ship it well. Objective fixes (lint, types, tests, broken paths) ship
without asking. Escalate product scope, new dependencies, architecture forks, unsettled UI, and
anything destructive or outward-facing (push stays prompted).

These are **good defaults**, not sacred text. If a rule fights the task, say so loudly and get
sign-off before breaking it.

## Hard rules

1. **One architecture.** Match existing patterns for state, data fetching, IPC, and tests. Propose
   before forking — two patterns nobody chose is the failure state.
2. **Match the local idiom.** Naming, tests, layout, commits: read the code around you.
3. **Cheap lint on every commit; full verify before push.** Hook runs `pnpm lint`. Before push (and
   on CI): `pnpm verify` (`lint && test && build && typecheck:e2e`). Commit messages capped at
   **1024 chars** (EAS rejects longer). Details: `ship` skill.
4. **Type-safety drives design.** When types fight you, change the design. No `as unknown as`; no
   `void` on promises (`async`/`await`). Lint-backed.
5. **Never mix prod and dev daemons** while building Porcelain (table below).
6. **UI primitives follow the client tree.** Web (and Electron shell loading it): shadcn/Base UI.
   Mobile: NativeWind v5, Tailwind CSS v4, and React Native Reusables on iOS and Android. Nested
   `AGENTS.md` owns the detail.
7. **Close the loop with evidence.** Intent → execute → prove it → gate → commit. Never end at
   "implemented, should work." Scale ceremony to the change; evidence never scales away.

## Prod vs dev

| | Production (real work) | Development (this product) |
|--|--|--|
| Port | **43117** | Primary **43118**; worktrees **43200–43999** |
| Data / channels | `~/.local/share/porcelain` · `~/.porcelain` | `porcelain-dev` / `.porcelain-dev`; per-slug worktree homes |
| Agents on product work | **Never** | **Always** |
| Repos | Real worktrees | Playground only |

```bash
pnpm build && pnpm dev:daemon   # dev daemon on 43118
pnpm porcelain <noun> <verb>    # CLI → ~/.porcelain-dev
```

Web UI proof is the **browser** against the **dev** daemon — same client Electron loads. Never
drive the installed app or the prod daemon for product work.

**Debris:** delete session-local junk (`.playwright-mcp/`, `test-results/`, `playwright-report/`,
`apps/desktop/e2e/.artifacts/`) before stopping. `scripts/agent-scratch/` is gitignored.

## Skills (load when the trigger matches)

Only each skill's description is ambient. Do not load a skill "just in case."

| Skill | When |
|-------|------|
| `ship` | Changing code, testing, committing, or worktrees |
| `audit` | Main process, IPC, config, git, file reads, external URLs, packaging, agent channels |
| `mobile` | Building, installing, delivering, or proving `apps/mobile` |
| `merge-queue` | Landing selected `work/*` PRs and retiring their worktrees |
| `releasing` | Cutting a release or changing signing/notarization |

Product and marketing prose live under `docs/` (no skills). Open them when designing or touching
public copy.

## Nested instructions

| Path | Loads when working under |
|------|--------------------------|
| `apps/desktop/AGENTS.md` | Electron shell |
| `apps/mobile/AGENTS.md` | Native iOS client |

Host-only topology and machine runbooks live in ignored `AGENTS.local.md` files (root and
`apps/mobile/`). Never copy private hostnames or personal paths into shipped docs or app copy.

## Architecture traps (open when lost)

| Topic | File |
|-------|------|
| Package map, surfaces, refactor done criteria | `docs/internals/architecture.md` |
| Daemon → hooks → components, WS, tabs, data flow | `docs/internals/one-architecture.md` |
| App shell, surfaces, window chrome | `docs/internals/app-shell.md` |
| Terminal / PTY | `docs/internals/terminal.md` |
| Repo layout, aliases, shadcn re-apply | `docs/internals/repo.md` |
| Bare nouns (tabs, viewer, Review, …) | `docs/internals/nomenclature.md` |
| Renderer composition (shadcn/Base UI) | `docs/internals/composition.md` |

## Agent foundations

Vendor-neutral sources are canonical; host directories are adapters.

| Concern | Canonical | Claude Code | Codex | Grok Build |
|---|---|---|---|---|
| Always-on | `AGENTS.md` | `CLAUDE.md` symlink | reads it | reads it |
| Skills | `.agents/skills/` | `.claude/skills/` symlinks | reads it | reads it |
| Early Git guard | `.agents/hooks/git-guard.sh` | `.claude/settings.json` | tracked hook | `.claude/settings.json` after trust |
| Commit gate | `.husky/pre-commit`, `.husky/commit-msg` | yes | yes | yes |

`HUSKY=0` is `--no-verify`. `PORCELAIN_SKIP_VERIFY=1` skips the pre-commit lint gate after a known-good
manual run. `pnpm agents:check` catches adapter drift; `pnpm agents:doctor` proves local activation.

Work on `main` by default. Use a managed worktree (`pnpm worktree create <slug>`) when isolation
helps — parallel tasks, risky experiments, or a PR boundary. Preference, not law.
