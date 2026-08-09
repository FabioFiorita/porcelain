# Porcelain

Where agent work becomes trusted work: a review layer for agentic coding (macOS app +
daemon-served browser + iOS client in progress). Agents keep writing where they already write;
Porcelain is where you read, annotate, and sign off. Full product story: `docs/product.md`.

Ship discipline: polish existing surfaces; releases are **patch** unless asked; 1.0 is far away.

**Package map:** daemon · cli · web · shell · mobile — see `docs/internals/architecture.md`.

## Glossary

Bare nouns resolve to exact regions of the product — act on them, don't re-ask. Full lookup:
`docs/internals/nomenclature.md`.

| Term | Meaning |
|---|---|
| The Review | One unit-of-work story as a three-tab canvas: **Intent · Execution · Evidence**. Product language is Review; code may keep `feature` ids |
| Evidence | Agent-authored proof the loop closed: checks + Results documents + an image gallery (`.porcelain/active-review/evidence/`) |
| Viewer | The central panel of the app. Never "editor" |
| Daemon | The headless Electron-free backend (`apps/daemon`); the shell spawns and babysits it |
| Project companion | Repo-local `.porcelain/` (board, actions, notes, reviews) — agents write it via the porcelain CLI, never an MCP server |
| Project board | Per-repo todo/doing/done (`.porcelain/board.json`), two-way via the CLI |
| Playground | Throwaway repo that dev daemons operate on — never a real checkout |
| Surface language | Raised = cards, recessed = wells; ONE opaque design serves Electron and the browser alike |

## How we work together

The human is not a dictator to obey. Everything they say is open to discussion, including
firm-sounding product calls. If an approach is wrong or incomplete, say so with the concern and a
better path before executing. Rubber-stamping is a failure mode.

Once a direction is chosen, ship it well. Objective fixes (lint, types, tests, broken paths) ship
without asking. Escalate product scope, new dependencies, architecture forks, unsettled UI, and
anything destructive or outward-facing (push stays prompted).

These are **good defaults**, not sacred text. If a rule fights the task, say so loudly and get
sign-off before breaking it.

## Delivery loop

Every implementation session follows the same loop without waiting for a skill to supply it:

1. Understand the intention, current behavior, accepted architecture, and owning domain.
2. State what will become true and how it will be proved.
3. Resolve meaningful product or architecture choices before implementation.
4. Implement through accepted boundaries and the local idiom.
5. Test each behavior at the lowest boundary that completely owns its risk.
6. Produce proportional runtime evidence for user-visible or integration-sensitive behavior.
7. Update durable docs or enforcement when current truth changes.
8. Run the required gate and commit the completed unit.
9. Stop before push or another outward-facing action unless the human authorized it.

Proof scales to the change; it never becomes “should work.” A documentation-only unit needs its
documentation gate, not a product Review or screenshot. Use Porcelain Companion only when
intentionally operating Review, Board, Actions, comments, evidence, or other companion surfaces.

## The four ways to hurt yourself

1. **Mixing prod and dev daemons.** Production is where real work gets reviewed; touching it while
   building Porcelain corrupts both. The table below is canonical — everywhere else points here.
2. **A second architecture.** New and migrated slices follow the accepted domain architecture;
   untouched legacy follows its local pattern. Never invent a third path or cite legacy as the
   target. See `docs/internals/domain-architecture.md`.
3. **Ending at "implemented, should work."** Close the loop: intent → execute → prove it → gate →
   commit. Scale ceremony to the change; evidence never scales away.
4. **Proving UI on the wrong surface.** Web UI proof is the **browser** against the **dev** daemon —
   the same client Electron loads. Never the installed app, never the prod daemon.

## Rules that stay prose

- **Match the owning idiom.** Naming, tests, layout, commits: read the domain boundary and its
  landed exemplar. During migration, nearby legacy layout is evidence, not permission to extend it.
- **Type-safety drives design.** When types fight you, change the design (the escape hatches
  themselves are lint-blocked).
- **UI primitives follow the client tree.** Web (and Electron shell loading it): shadcn/Base UI.
  Mobile: NativeWind v5, Tailwind CSS v4, and React Native Reusables. Nested `AGENTS.md` owns the
  detail.

## What is machine-enforced

Don't memorize these — the gate catches you. Hooks run `pnpm lint` on every commit; run
`pnpm verify` (`lint && test && build && typecheck:e2e`) before push, and CI runs it on `main`.

| Rule | Owner |
|---|---|
| Ten canonical domains, runtime dependency direction, target feature names, 450-line repository ceiling, shrinking raw server imports | `lint-architecture` |
| Executor recipes match their catalog, required shape, dependency status, and no-placeholder rule | `lint-architecture-specs` |
| No `as unknown as`; no `void`-swallowed promises | `lint-escapes` |
| No inline `style` / `contentContainerStyle` in mobile src | `lint-mobile-nativewind` |
| Mobile-local 450-line migration ledger (temporary overlap) | `lint-mobile-file-size` |
| Components never import `lib/trpc` / `lib/daemon` | Biome |
| External-URL guard, git env scrub, hook env scrub | `lint-audit` |
| EAS workflows stay dispatch-only | `lint-eas-triggers` |
| Contracts package ↔ daemon routers 1:1 | `lint-procedure-contracts` |
| Every `pnpm <script>` cited in skills or docs exists | `lint-skill-commands` |
| One version across packages + authored skills | `sync-versions` |
| `docs/README.md` indexes every doc; no stale doc paths | `lint-docs` |
| Branch policy (`main` or managed `work/*`), lint before commit | git-guard + husky `pre-commit` |
| Commit message ≤ 1024 chars (EAS cap), house style | husky `commit-msg` |

`HUSKY=0` is `--no-verify`. `PORCELAIN_SKIP_VERIFY=1` skips the pre-commit lint gate after a
known-good manual run.

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

**Debris:** delete session-local junk (`.playwright-mcp/`, `test-results/`, `playwright-report/`,
`apps/desktop/e2e/.artifacts/`) before stopping. `scripts/agent-scratch/` is gitignored.

## Skills (load when the trigger matches)

Only each skill's description is ambient. Do not load a skill "just in case."

| Skill | When |
|-------|------|
| `ship` | Changing code, testing, committing, or worktrees |
| `execute-architecture-spec` | Landing exactly one reviewer-approved architecture recipe |
| `audit` | Main process, IPC, config, git, file reads, external URLs, packaging, agent channels |
| `mobile` | Building, installing, delivering, or proving `apps/mobile` |
| `merge-queue` | Landing selected `work/*` PRs and retiring their worktrees |
| `releasing` | Cutting a release or changing signing/notarization |

## Docs and plans

Two trees, split by tense. When lost, open `docs/README.md` — it indexes everything.

| Tree | Tense | What goes there |
|------|-------|-----------------|
| `docs/` | What **is** | Product prose, contributor internals, audit invariants |
| `plans/` | What **isn't yet** | Plans and backlogs; deleted when shipped, keepers distilled into `docs/` |

Skills stay procedures; `AGENTS.md` files stay identity. A rule a machine can own goes in the
lint gate, not in prose. No tool-specific mirror files (`GEMINI.md`, `.cursorrules`, …) — they rot.

## Nested instructions

| Path | Loads when working under |
|------|--------------------------|
| `apps/desktop/AGENTS.md` | Electron shell |
| `apps/mobile/AGENTS.md` | Native iOS client |

Host-only topology and machine runbooks live in ignored `AGENTS.local.md` files (root and
`apps/mobile/`). Never copy private hostnames or personal paths into shipped docs or app copy.

## Agent foundations

Vendor-neutral sources are canonical; host directories are adapters.

| Concern | Canonical | Claude Code | Codex | Grok Build |
|---|---|---|---|---|
| Always-on | `AGENTS.md` | `CLAUDE.md` symlink | reads it | reads it |
| Skills | `.agents/skills/` | `.claude/skills/` symlinks | reads it | reads it |
| Early Git guard | `.agents/hooks/git-guard.sh` | `.claude/settings.json` | tracked hook | `.claude/settings.json` after trust |
| Commit gate | `.husky/pre-commit`, `.husky/commit-msg` | yes | yes | yes |

`pnpm agents:check` catches adapter drift; `pnpm agents:doctor` proves local activation.

Architecture-refactor executors must also read
`plans/architecture-refactor/specs/README.md` before accepting a recipe. A recipe is executable only
when its own status is **Ready** and every dependency is **Landed**; the existence of a Draft recipe
is not authorization to fill in its missing judgment.

Work on `main` by default. Use a managed worktree (`pnpm worktree create <slug>`) when isolation
helps — parallel tasks, risky experiments, or a PR boundary. Preference, not law.
