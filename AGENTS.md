# Porcelain

Agent-managed foundations. This file is the **canonical always-on project brief** for every agent session. `CLAUDE.md` is a compatibility symlink to it; Grok Build reads `AGENTS.md` directly and also supports the Claude adapters. Skills live canonically in `.agents/skills/` (symlinked into `.claude/skills/` for Claude/Grok discovery). **Keep this file slim** — it loads into every session, including backend-only work. Detail, UI recipes, release runbooks, and surface maps belong in skills (loaded on demand).

Porcelain is **where agent work becomes trusted work**: the focused **review layer for agentic coding** (Mac app + daemon browser client). A companion, not a cockpit: agents run in the human's preferred host or terminal; Porcelain is where you review what they built as a story, not a file list. Identity and pillars live in the `product` skill.

Ship discipline: polish existing surfaces; default release is **patch** unless minor/major is asked; 1.0 is far away. Agent channels = the **porcelain CLI** writing local channel files (do not reintroduce a Porcelain MCP server — implementer note, not a marketing claim).

## How we work together

The human is **not** the source of truth and not a dictator to obey. Everything they say is open to discussion — including firm-sounding product or design calls. If you think an approach is wrong, incomplete, fragile, or worse than an alternative, **say so with the concern and a better path** before (or instead of) executing. Rubber-stamping is a failure mode; thoughtful pushback is expected. Hard rules and skills constrain *how* we ship once a direction is chosen; they do not mean "never challenge the human." Objective fixes still ship without asking (autonomy split in `close-the-loop`).

## Hard rules

1. **One architecture — but think freely.** Default to the existing pattern (state, data fetching, IPC shape, component/test style): check the `architecture` skill and match what's there. If you think a genuinely better approach exists, **propose the tradeoff before building** — don't silently fork the architecture. The failure state is *two patterns nobody chose*.
2. **Match the local idiom.** Naming, test shape, file layout, commit format: read like the code around it.
3. **Verification gate before any commit:** `pnpm verify` (= `pnpm lint && pnpm test && pnpm build`; typecheck runs inside `build`). **Hook-enforced for every client** — the tracked `githooks/pre-commit` is authoritative (`core.hooksPath`, wired by `prepare`); Claude Code and Grok Build also run the shared `.agents/hooks/git-guard.sh` earlier through `.claude/settings.json`. Codex reaches the same tracked hook when it commits. Any path blocks the commit until the gate passes.
4. **Docs say what the code can't.** A skill carries decisions, the *why*, the deliberately-absent, and the traps — **not** a paraphrase of how a file works today. Read the file for mechanics. When you change a decision or hit a new trap, update its home skill in the same commit; when a skill only restates code, *cut it*. Prefer Biome over prose when a lint can enforce the rule.
5. **UI primitives follow the client.** The Electron/browser renderer uses shadcn only: never hand-roll sidebar, tabs, dialogs, trees, etc.; load the `shadcn` skill and search shadcn/registries first. The native client under `apps/mobile` is **iOS-only and SwiftUI-only**: Expo Router navigation plus `@expo/ui/swift-ui` components and `@expo/ui/swift-ui/modifiers` — **never the universal `@expo/ui` root** (`Host` included), no shadcn, Tailwind, or DOM components. Load the relevant `expo-*` skill before mobile work. A needed renderer primitive that shadcn does not provide, or a native primitive that `@expo/ui/swift-ui` does not provide, needs the human's approval before building. (Obvious renderer hand-rolls are lint-flagged by `scripts/lint-shadcn-heuristics.mjs`; universal-root imports are lint-flagged by `scripts/lint-escapes.mjs`; the `invariant-reviewer` stays the judgment layer. Backend/daemon work loads neither UI skill.)
6. **Let type-safety drive the design.** When types fight you, change the design — don't escape it: a structural interface at the seam, a zod parse, a narrowing guard. Prefer safer shapes (e.g. tRPC over a hand-rolled bridge). The escapes are lint-enforced, not prose (`any` → Biome, `as unknown as` → `scripts/lint-escapes.mjs`), so this rule states the intent only.
7. **No `void` on promises.** Use `async`/`await` — a bare fire-and-forget call *without* `void` is fine when you truly don't need to wait. Lint-enforced by `scripts/lint-escapes.mjs`.
8. **Main-first solo flow; worktrees for parallel work.** Default path: work on `main`, pass the rule-3 gate, commit, push. Parallel or riskier tasks opt into `pnpm worktree create <slug>` → commit on `work/<slug>` → PR into `main` with the Review's evidence attached → squash-merge → `pnpm worktree remove <slug>` (deletes checkout, branch, isolated daemon state, playground). Unmanaged branch/worktree creation and commits on unmanaged branches stay hook-blocked. Harness-native worktrees (T3 Code, Codex, Grok, Claude) may commit on their own branches or a detached HEAD, still verify-gated; integrate via PR or handoff. Agent commits on main still close the loop with a published Review (`close-the-loop`) — expectation, not a hook. No long-lived task branches.
9. **Close the loop — every session.** Intent → paths → execute → test → verify **with evidence** → docs sync → gate → commit. The `close-the-loop` skill owns the phases, testing doctrine, and autonomy split. Never end at "implemented, should work."
10. **Connected app — one home per concern, previews hand off.** Canonical homes: Changes (diffs/stage/commit), Review (Review canvas), Files (tree), Board (plan), Terminal/Actions (run). Other surfaces may **preview** related state and must **hand off** via `lib/surface-handoffs.ts` — never a second Diff panel or second commit UX. Full principle in the `product` skill.

## Prod vs dev daemons

Never mix production and development data when building Porcelain. Short form:

| | Production (real work) | Development (this product) |
|--|--|--|
| Port | **43117** | Primary: **43118**; managed worktrees: **43200–43999** |
| Data / channels | `~/.local/share/porcelain` · `~/.porcelain` | Primary: `porcelain-dev`; worktrees: per-slug `porcelain-dev-worktrees/` |
| Agents on product work | **Never** | **Always** |
| Repos | Real worktrees | Primary playground or per-worktree `~/code/porcelain-playgrounds/<slug>` only |

```bash
pnpm build && pnpm dev:daemon    # dev daemon on 43118
pnpm porcelain <noun> <verb>  # CLI → ~/.porcelain-dev
# pair browser: node scripts/daemon-cli.js access issue --name "Dev browser" --base-url http://127.0.0.1:43118
```

Managed task lifecycle (opt-in, for parallel work):

```bash
pnpm worktree create fix-review     # work/fix-review + isolated runtime + playground
cd ../porcelain-worktrees/fix-review
# build, prove, commit, push, PR → main
cd ../../porcelain
git pull --ff-only
pnpm worktree remove fix-review     # permanently deletes all task-local state
pnpm worktree cleanup               # remove every other clean, merged managed worktree
```

Day-to-day proof = **browser** against the **dev** daemon (`pnpm test:e2e` or a live tab). Do not drive the installed app or the production daemon for product work. Full loop and testing doctrine: `close-the-loop`.

**Scratch + debris:** `scripts/agent-scratch/` is gitignored. Before you stop, delete session-local debris (`.playwright-mcp/`, `test-results/`, `playwright-report/`, `e2e/.artifacts/`, throwaway scratch). Leave a clean worktree (commit each discrete ask after `pnpm verify`).

## Skills (load on demand)

Only each skill's one-line description is ambient; **read the body before acting in its area.** Do not preload UI/marketing/release skills for unrelated work.

| Skill | When |
|-------|------|
| `close-the-loop` | Any session that will change code (start here) |
| `architecture` | Writing or reviewing code; nomenclature lookup |
| `product` | Designing features/UI or prioritizing |
| `audit` | Main process, IPC, config, git plumbing, file reads, external URLs, packaging; regression review |
| `marketing` | README, `marketing/`, screenshots, launch copy |
| `releasing` | Cutting a release or changing signing/notarization |
| `shadcn` | Electron/browser renderer UI primitive work |
| `expo-*` / `eas-*` | Native mobile structure, UI, routing, builds, or delivery |

**Distribution split.** User-facing companion skill: `/skills/porcelain-companion/` via skills.sh (`npx skills add FabioFiorita/porcelain`). Internal skills under `.agents/skills/` must set `metadata.internal: true` so they do not leak into `npx skills add`.

**No personal setup in shipped content.** Companion skill, app copy, and public docs use generic placeholders (`you@remote-host`, `/home/you/code/my-app`) — never a maintainer's hostname or private repo paths.

## Agent foundations

The shared rule is simple: **vendor-neutral sources are canonical; host directories are adapters.**

| Concern | Canonical source | Claude Code | Codex | Grok Build |
|---|---|---|---|---|
| Always-on instructions | `AGENTS.md` | `CLAUDE.md` symlink | reads `AGENTS.md` | reads `AGENTS.md` |
| Skills | `.agents/skills/` | `.claude/skills/` symlinks | reads `.agents/skills/` | reads `.agents/skills/` and Claude-compatible skills |
| Invariant reviewer | `.agents/agents/invariant-reviewer.md` | `.claude/agents/` symlink | generated `.codex/agents/*.toml` | reads the Claude adapter |
| Early Git guard | `.agents/hooks/git-guard.sh` | `.claude/settings.json` | no native adapter; tracked hook is authoritative | reads `.claude/settings.json` after project trust |
| Commit gate | `githooks/pre-commit` | yes | yes | yes |

- **`.agents/hooks/git-guard.sh`** — blocks unmanaged branch/worktree creation and commits on unmanaged branches, then runs `pnpm verify` before any commit on `main` or a managed `work/*` branch. `.claude/settings.json` is the shared Claude/Grok adapter; `git push` stays prompted.
- **`githooks/pre-commit`** — authoritative client-independent rule-3 gate, activated by `pnpm install`; Grok always reaches it even after the early guard because session presence alone cannot prove the trusted project hook succeeded. Claude Code retains its host-guaranteed duplicate skip; `PORCELAIN_SKIP_VERIFY=1` is the explicit manual escape.
- **`pnpm agents:check`** — fails when instruction/reviewer/hook/skill adapters drift.
- **`pnpm agents:doctor`** — reports local hook activation and installed-host discovery. Grok project hooks additionally require `/hooks-trust` once per checkout.
- **`invariant-reviewer`** — read-only review against `audit` invariants and the one architecture. Use before committing non-trivial changes.

Personal orchestration belongs in ignored host-local files and never carries project rules. A host that cannot load an adapter still receives deterministic enforcement through package scripts, the tracked Git hook, and CI.

## Nomenclature

Shared app vocabulary — shell regions (top bar, sidebar, viewer, Quick Access), the seven sidebar tabs (**Files · Changes · Review · History · Search · Board · Terminal**, ⌘1–7), viewer tab kinds, overlays, and cross-cutting terms (flow layers, the Review, loop evidence, agent channels, the daemon) — lives in the **`architecture` skill → Nomenclature** section (term → entry file). When the human uses a bare noun ("improve the viewer", "the Changes tab is wrong"), resolve it there and act on that region. Do not re-ask which one, and do not paste the full map into session context unless you need it.
