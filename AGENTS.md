# Porcelain

The always-on project brief. It loads into **every** session, including backend-only work — keep it slim. Detail, recipes, runbooks, and surface maps belong in skills, loaded on demand.

Porcelain is **where agent work becomes trusted work**: the review layer for agentic coding (Mac app + daemon browser client). A companion, not a cockpit — agents run in the human's own host or terminal; Porcelain is where their work is reviewed as a story, not a file list. Identity and pillars: `product` skill.

Ship discipline: polish existing surfaces; releases are **patch** unless asked; 1.0 is far away.

## How we work together

The human is **not** the source of truth and not a dictator to obey. Everything they say is open to discussion, including firm-sounding product and design calls. If an approach is wrong, incomplete, or worse than an alternative, **say so with the concern and a better path** before executing. Rubber-stamping is a failure mode. Hard rules constrain *how* we ship once a direction is chosen; they never mean "don't challenge the human." Objective fixes still ship without asking (autonomy split: `close-the-loop`).

## Hard rules

1. **One architecture.** Match the existing pattern for state, data fetching, IPC shape, and tests (`architecture` skill). A genuinely better approach gets **proposed before it's built** — the failure state is two patterns nobody chose.
2. **Match the local idiom.** Naming, test shape, file layout, commit format: read like the code around it.
3. **`pnpm verify` before any commit** (`lint && test && build`; typecheck runs inside `build`). Hook-enforced for every client via `.husky/pre-commit`. `.husky/commit-msg` separately caps the message at **1024 chars** — EAS rejects longer and mobile delivery dies silently. Rules and why: `close-the-loop`.
4. **Docs carry constraints; commits carry reasons.** A tracked doc or comment states what a future session must do or avoid, in the fewest lines that stand alone. Why we chose it, what we gave up, what we tried first, and when all belong in the **commit message** — git keeps them without spending every future session's context. Never date a doc, never record an account's plan or billing state, never write "we used to." *Test: "delivery uses `submit`; `testflight` with a `build_id` is paid-tier" is a constraint; the paragraph on what that costs and how to undo it is a commit message.* When a doc only restates the code, *cut it*. Prefer a lint over prose whenever a lint can enforce the rule.
5. **UI primitives follow the client.** Renderer: shadcn only, never hand-rolled (`shadcn` skill). `apps/mobile`: iOS-only, SwiftUI-only — Expo Router plus `@expo/ui/swift-ui` and its `/modifiers`, **never the universal `@expo/ui` root** (`Host` included). A primitive neither library provides needs the human's approval first. Backend work loads neither skill.
6. **Let type-safety drive the design.** When types fight you, change the design — a structural interface at the seam, a zod parse, a narrowing guard. Never escape it. The escapes are lint-enforced, not prose.
7. **No `void` on promises.** Use `async`/`await`. Bare fire-and-forget without `void` is fine when you truly don't need to wait.
8. **Main-first solo flow.** Work on `main`, pass the gate, commit, push. Parallel or risky work opts into `pnpm worktree create <slug>` → PR → squash-merge → `pnpm worktree remove <slug>`. Unmanaged branches stay hook-blocked. No long-lived task branches.
9. **Close the loop — every session.** Intent → paths → execute → test → verify **with evidence** → docs sync → gate → commit. Never end at "implemented, should work." Owned by `close-the-loop`.
10. **One home per concern.** Changes (diffs/stage/commit), Review (canvas), Files (tree), Board (plan), Terminal/Actions (run). Other surfaces may *preview* and must **hand off** via `lib/surface-handoffs.ts` — never a second Diff panel or commit UX. Full principle: `product` skill.

## Prod vs dev daemons

Never mix production and development data while building Porcelain.

| | Production (real work) | Development (this product) |
|--|--|--|
| Port | **43117** | Primary **43118**; worktrees **43200–43999** |
| Data / channels | `~/.local/share/porcelain` · `~/.porcelain` | `porcelain-dev`; per-slug worktree homes |
| Agents on product work | **Never** | **Always** |
| Repos | Real worktrees | Playground only |

```bash
pnpm build && pnpm dev:daemon   # dev daemon on 43118
pnpm porcelain <noun> <verb>    # CLI → ~/.porcelain-dev
```

Proof is the **browser** against the **dev** daemon (`pnpm test:e2e` or a live tab) — never the installed app or the production daemon. Full loop and testing doctrine: `close-the-loop`.

**Debris:** `scripts/agent-scratch/` is gitignored. Before stopping, delete session-local debris (`.playwright-mcp/`, `test-results/`, `playwright-report/`, `e2e/.artifacts/`) and leave a clean worktree.

## Skills (load on demand)

Only each skill's one-line description is ambient; **read the body before acting in its area.**

| Skill | When |
|-------|------|
| `close-the-loop` | Any session that will change code (start here) |
| `architecture` | Writing or reviewing code; nomenclature lookup |
| `product` | Designing features/UI or prioritizing |
| `audit` | Main process, IPC, config, git plumbing, file reads, packaging; regression review |
| `marketing` | README, `marketing/`, screenshots, launch copy |
| `releasing` | Cutting a release or changing signing/notarization |
| `shadcn` | Renderer UI primitive work |
| `expo-*` / `eas-*` | Native mobile structure, UI, routing, builds, delivery |

Internal skills set `metadata.internal: true` so they don't leak into `npx skills add`. **Shipped content carries no personal setup** — public docs and app copy use generic placeholders (`you@remote-host`, `/home/you/code/my-app`), never a maintainer's hostname or private paths.

## Agent foundations

**Vendor-neutral sources are canonical; host directories are adapters.**

| Concern | Canonical source | Claude Code | Codex | Grok Build |
|---|---|---|---|---|
| Always-on instructions | `AGENTS.md` | `CLAUDE.md` symlink | reads it | reads it |
| Skills | `.agents/skills/` | `.claude/skills/` symlinks | reads it | reads it |
| Invariant reviewer | `.agents/agents/invariant-reviewer.md` | `.claude/agents/` symlink | generated `.codex/agents/*.toml` | reads the Claude adapter |
| Early Git guard | `.agents/hooks/git-guard.sh` | `.claude/settings.json` | tracked hook only | `.claude/settings.json` after trust |
| Commit + message gate | `.husky/pre-commit`, `.husky/commit-msg` | yes | yes | yes |

The tracked `.husky/` bodies are the authoritative gate; husky only wires the shims (gitignored, regenerated on install). **`HUSKY=0` skips every hook** — treat it as `--no-verify`. `PORCELAIN_SKIP_VERIFY=1` is the explicit escape after a verified manual run. `pnpm agents:check` catches adapter drift; `pnpm agents:doctor` proves local activation. `invariant-reviewer` is a read-only review against `audit` — use it before committing anything non-trivial.

Personal orchestration belongs in ignored host-local files and never carries project rules.

## Nomenclature

Shell regions, the seven sidebar tabs (**Files · Changes · Review · History · Search · Board · Terminal**, ⌘1–7), viewer tab kinds, and cross-cutting terms live in `.agents/skills/architecture/reference/nomenclature.md` (term → entry file). When the human uses a bare noun ("the viewer", "the Changes tab"), resolve it there and act — don't re-ask.
