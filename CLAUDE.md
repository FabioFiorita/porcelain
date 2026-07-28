# Porcelain

Agent-managed foundations. This file is the **always-on** project brief for every agent session. Skills live in `.agents/skills/` (symlinked into `.claude/skills/` for discovery). **Keep this file slim** — it loads into every session, including backend-only work. Detail, UI recipes, release runbooks, and surface maps belong in skills (loaded on demand). `AGENTS.md` is a symlink to this file.

Porcelain is **where agent work becomes trusted work**: the focused **review layer for agentic coding** (Mac app + daemon browser client). A companion, not a cockpit: agents run in the human's preferred host or terminal; Porcelain is where you review what they built as a story, not a file list. Identity and pillars live in the `product` skill.

Ship discipline: polish existing surfaces; default release is **patch** unless minor/major is asked; 1.0 is far away. Agent channels = the **porcelain CLI** writing local channel files (do not reintroduce a Porcelain MCP server — implementer note, not a marketing claim).

## How we work together

The human is **not** the source of truth and not a dictator to obey. Everything they say is open to discussion — including firm-sounding product or design calls. If you think an approach is wrong, incomplete, fragile, or worse than an alternative, **say so with the concern and a better path** before (or instead of) executing. Rubber-stamping is a failure mode; thoughtful pushback is expected. Hard rules and skills constrain *how* we ship once a direction is chosen; they do not mean "never challenge the human." Objective fixes still ship without asking (autonomy split in `close-the-loop`).

## Hard rules

1. **One architecture — but think freely.** Default to the existing pattern (state, data fetching, IPC shape, component/test style): check the `architecture` skill and match what's there. If you think a genuinely better approach exists, **propose the tradeoff before building** — don't silently fork the architecture. The failure state is *two patterns nobody chose*.
2. **Match the local idiom.** Naming, test shape, file layout, commit format: read like the code around it.
3. **Verification gate before any commit:** `pnpm verify` (= `pnpm lint && pnpm test && pnpm build`; typecheck runs inside `build`). **Hook-enforced** — the `PreToolUse` git-guard (`.claude/settings.json`) blocks any commit until the gate passes.
4. **Docs say what the code can't.** A skill carries decisions, the *why*, the deliberately-absent, and the traps — **not** a paraphrase of how a file works today. Read the file for mechanics. When you change a decision or hit a new trap, update its home skill in the same commit; when a skill only restates code, *cut it*. Prefer Biome over prose when a lint can enforce the rule.
5. **UI primitives: shadcn only.** Never hand-roll sidebar, tabs, dialogs, trees, etc. **Before any UI work**, load the `shadcn` skill and search shadcn/registries first. A needed primitive that doesn't exist needs the human's approval before building. (Backend/daemon work does not load this skill.)
6. **Let type-safety drive the design.** When types fight you, change the design — don't escape it. `any` is a Biome error; avoid `as unknown as` (banned). Prefer safer shapes (e.g. tRPC over a hand-rolled bridge).
7. **No `void` on promises.** Use `async`/`await` (or `await Promise.all([...])`). Bare fire-and-forget like `utils.foo.invalidate()` in a sync handler is fine when you truly don't need to wait.
8. **Agents commit on `main`; no feature branches in this clone.** The git-guard **hard-blocks** branch creation. Agent sessions commit straight to `main` after the verify gate. External contributors work on a **fork** and open a PR; maintainers merge to `main`. Do not open long-lived `feat/*` / `fix/*` branches in this repository.
9. **Close the loop — every session.** Intent → paths → execute → test → verify **with evidence** → docs sync → gate → commit. The `close-the-loop` skill owns the phases, testing doctrine, and autonomy split. Never end at "implemented, should work."
10. **Connected app — one home per concern, previews hand off.** Canonical homes: Changes (diffs/stage/commit), Review (Review canvas), Files (tree), Board (plan), Terminal/Actions (run). Other surfaces may **preview** related state and must **hand off** via `lib/surface-handoffs.ts` — never a second Diff panel or second commit UX. Full principle in the `product` skill.

## Prod vs dev daemons

Never mix production and development data when building Porcelain. Short form:

| | Production (real work) | Development (this product) |
|--|--|--|
| Port | **43117** | **43118** (`pnpm dev:daemon`) |
| Data / channels | `~/.local/share/porcelain` · `~/.porcelain` | `~/.local/share/porcelain-dev` · `~/.porcelain-dev` |
| Agents on product work | **Never** | **Always** |
| Repos | Real worktrees | Playground (e.g. `~/code/porcelain-playground`) only |

```bash
pnpm build && pnpm dev:daemon    # dev daemon on 43118
pnpm porcelain -- <noun> <verb>  # CLI → ~/.porcelain-dev
# browser: http://127.0.0.1:43118/  token: ~/.porcelain-dev/daemon-token
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
| `shadcn` | Any UI primitive work |

**Distribution split.** User-facing companion skill: `/skills/porcelain-companion/` via skills.sh (`npx skills add FabioFiorita/porcelain`). Internal skills under `.agents/skills/` must set `metadata.internal: true` so they do not leak into `npx skills add`.

**No personal setup in shipped content.** Companion skill, app copy, and public docs use generic placeholders (`you@remote-host`, `/home/you/code/my-app`) — never a maintainer's hostname or private repo paths.

## Agentic enforcement

- **`.claude/settings.json`** — `PreToolUse` git-guard blocks branch creation (rule 8) and runs `pnpm verify` before commit (rule 3). `git push` stays prompted.
- **`invariant-reviewer` agent** (`.claude/agents/`) — read-only review against `audit` invariants and the one architecture. Use before committing non-trivial changes.

## Orchestrator + sub-agents

The main loop is the **orchestrator**: it plans, scopes, verifies, and decides. Delegate work that is parallelizable, mechanical, or exploratory to sub-agents (Agent tool / Workflow). Keep orchestrator context for judgment; don't burn it on bulk edits.

### Picking models (when the host supports choice)

Rankings, higher = better. Intelligence = how hard a problem you can hand off unsupervised. Taste = UI/UX, code quality, API design, copy.

| model        | cost | intelligence | taste |
|--------------|------|--------------|-------|
| sonnet-5     | 5    | 5            | 7     |
| grok-4.5     | 5    | 7            | 7     |
| opus-5       | 4    | 7            | 8     |
| opus-5 xhigh | 3    | 8            | 8     |
| fable-5      | 2    | 9            | 9     |

- Defaults, not limits: escalate if output is weak. Intelligence > taste > cost for anything that ships.
- Mechanical / clear-spec work: bias **opus low/medium** when struggle is likely; small clear jobs can use a cheaper model. Never Haiku.
- User-facing UI/copy/API: taste ≥ 7 (**opus** or **fable**).
- Hard review / adversarial verify / deep debug: **fable**, or **opus xhigh**.
- Pass `model` on Agent/Workflow when choosing; omit when the session model is already right.

### Delegation rules

- Orchestrator scopes and verifies; sub-agents execute. Hand mechanical edits to a sub-agent with a **self-contained** prompt (files, exact change, verification command).
- **In fable sessions (any effort) and xhigh sessions: never type mechanical edits yourself** (exception: a single one-line edit in one file). The value is the high-quality prompt; the cheaper model executes it.
- Launch independent sub-agents in parallel (one message, multiple Agent calls).
- Sub-agents do not see this conversation: include paths, the hard rules that apply (one architecture, shadcn if UI, no `any` / no `as unknown as`, no `void` on promises), and how to verify.
- Spot-check every result (read the diff, run the targeted test) before reporting done. Never relay "it works" unverified; verify review findings adversarially.
- Multi-step fan-out (audits, migrations, many-file reviews): prefer a Workflow when orchestration was requested.
- Cap parallel local build/test agents by machine memory: if the host thrashes or commands hang, reduce concurrency and suspect memory before the code.

## Nomenclature

Shared app vocabulary — shell regions (top bar, sidebar, viewer, Quick Access), the seven sidebar tabs (**Files · Changes · Review · History · Search · Board · Terminal**, ⌘1–7), viewer tab kinds, overlays, and cross-cutting terms (flow layers, the Review, loop evidence, agent channels, the daemon) — lives in the **`architecture` skill → Nomenclature** section (term → entry file). When the human uses a bare noun ("improve the viewer", "the Changes tab is wrong"), resolve it there and act on that region. Do not re-ask which one, and do not paste the full map into session context unless you need it.
