# Porcelain

Agent-managed foundations. This file owns project agent guidance; skills live in `.agents/skills/` and are symlinked into `.claude/skills/` for Claude discovery. Keep them accurate and never let the codebase diverge from them. `AGENTS.md` is a symlink to this file. **Keep this file slim — it loads into every session. Detail belongs in skills (loaded on demand).**

Porcelain is **where agent work becomes trusted work**: the hub for agentic coding (Electron apps + daemon browser client). Run your coding agents (Claude Code, Codex, OpenCode, Grok) *and* review what they built as a story, not a file list. Lightweight, not an editor. Product identity and pillars live in the `product` skill; public pitches in `plans/launch-narrative.md`.

## How we work together

The human is **not** the source of truth and not a dictator to obey. Everything he says is open to discussion — including firm-sounding product or design calls. If you genuinely think an approach is wrong, incomplete, fragile, or worse than an alternative, **say so with the concern and a better path** before (or instead of) executing. Rubber-stamping is a failure mode; thoughtful pushback is expected. Hard rules and skills constrain *how* we ship once a direction is chosen; they do not mean “never challenge the human.” (Objective fixes still ship without asking — see the autonomy split in `close-the-loop`.)

## Hard rules

1. **One architecture — but think freely.** Default to the existing pattern (state, data fetching, IPC shape, component/test style): check the `architecture` skill and match what's there, so the codebase stays uniform. But if you think a genuinely better approach exists, **propose it with the tradeoff before building** — don't silently fork the architecture, and don't be timid about suggesting one. The failure state is *two patterns nobody chose*; a considered switch (recorded in the home skill) is not. Outside-the-box thinking is wanted — it just gets surfaced, not smuggled in.
2. **Match the local idiom.** When you write code, make it read like the code around it — naming, test shape, file layout, commit format. This is small-scale consistency (so the result looks like one author), not a constraint on *what* you build.
3. **Verification gate before any commit:** `pnpm verify` (= `pnpm lint && pnpm test && pnpm build`; typecheck runs inside `build`). **Hook-enforced** — the `PreToolUse` git-guard (`.claude/settings.json`) blocks any commit until the gate passes, so a failing gate is a loop to fix, not a suggestion to skip.
4. **Docs say what the code can't.** A skill carries decisions, the *why*, the deliberately-absent, and the traps — **not** a paraphrase of how a file works today. For current mechanics, read the file (it never goes stale); the skill points you to the entry file and tells you what a fresh read won't. So: when you change a decision or hit a new trap, update its home skill in the same commit; when you find a skill describing mechanics the code already shows, *cut it*; and prefer enforcing a rule in Biome over writing it in prose (a lint rule can't rot or be ignored). No decision log, no redundant guides.
5. **shadcn primitives only — and load the `shadcn` skill first.** Always use shadcn components for UI primitives; never hand-roll one (sidebar, tabs, dialogs, trees, etc.). **Before any UI work, load the `shadcn` skill** and check whether shadcn/registries already provide something that fits — search there before building. If a needed primitive doesn't exist in shadcn/registries, **get the user's approval before building it**.
6. **Let type-safety drive the design.** When types fight you, change the design — don't escape it. `any` is already a Biome error (the gate enforces it), so this rule is the half lint can't: reach for the safer shape (e.g. tRPC over a hand-rolled bridge) instead of an `as unknown as` cast (banned repo-wide).
7. **No `void` on promises.** Never write `void somePromise()` to silence floating promises — use `async`/`await` (or `await Promise.all([...])` when batching). Bare calls like `utils.foo.invalidate()` in sync handlers are fine when you truly don't need to wait.
8. **Commit straight to `main` — never create branches.** Solo developer; `main` is the only branch and committing directly to it (after the verification gate, hard rule 3) is safe and expected. Do NOT open `feat/*`/`fix/*` branches or PRs for changes, and do NOT branch just because you're on the default branch — keep everything on `main`. (This deliberately overrides the generic "branch off the default branch first" default.) The git-guard hook **hard-blocks** branch creation, so this is enforced, not just convention.
9. **Close the loop — every session.** Intent → paths → execute → test → verify **with evidence** → docs sync → gate → commit; the `close-the-loop` skill owns the phases, the testing doctrine (unit tests for the daemon, browser-first for the UI), and the autonomy split (fix objective findings without asking; escalate judgment calls). Never end at "implemented, should work" — ship verified, or report blocked with exactly what's missing.
10. **Connected app — one home per concern, previews hand off.** Each concern has a **canonical home** for deep work (Changes = diffs/stage/commit, Feature = the Review, Files = tree, Agent = talk, Terminal/Actions = run). Other surfaces may **preview** related state when useful (e.g. a turn's changed-files tree in Agent chat) and must **hand off** to that home via shared helpers (`lib/surface-handoffs.ts`) — never a second Diff panel, second commit UX, or walls that hide cross-surface info "to protect identity." Identity is *where deep work lives* + quality of that home, not exclusive visibility. Full principle in the `product` skill; do not silo when integrating competitor UX ideas.

**Verifying live with computer-use:** run `pnpm dev` (opens the dev Electron on `~/Code/porcelain-playground` with isolated config) and request computer-use access for the **dev app — it shows up as "Electron"**, bundle id `com.github.Electron`. NEVER request the installed **"Porcelain"** app: that's the user's real work (their day-job repo) and it doesn't have your changes anyway. Screenshot/drive the dev "Electron" window.

**Agent scratch scripts:** `scripts/agent-scratch/` is **gitignored**. When you need throwaway automation (browser screenshot harnesses, seed helpers, one-off verify scripts, local PNG dumps), put it there — not under tracked `scripts/` or the repo root. Feel free to add as many files as you need for the session; nothing under that path is committed. Prefer reusing a named harness over re-inventing the same daemon+Chromium bootstrap each time.

## Skills (in `.agents/skills/`, symlinked at `.claude/skills/`)

Only each skill's one-line description loads up front; the body loads on demand when you read it. Read the relevant skill *before* acting in its area.

- `close-the-loop` — the development loop every session must complete, the testing doctrine (unit tests for the daemon, browser-first for the UI), and the autonomy split. **Read at the start of any session that will change code.**
- `architecture` — stack, repo facts, aliases, conventions, app shell, client architecture, and the app's shared nomenclature. **Read before writing or reviewing any code.**
- `product` — what Porcelain is, who it's for, core features, product principles. **Read before designing features/UI or prioritizing.**
- `audit` — the security/correctness/performance/type invariants the codebase must not regress, with file pointers. **Read before changing the main process, IPC, config persistence, git plumbing, file reads, external-URL handling, or packaging — and when reviewing a diff for regressions.**
- `marketing` — the marketing process the agent owns end-to-end (README, `marketing/` site, autonomous screenshot pipeline, release visibility). **Read before touching README.md, `marketing/`, or producing screenshots/launch copy.**
- `releasing` — the runbook for cutting a signed + notarized release (bump/tag, the Actions pipeline, secrets, changelog). **Read when publishing a version or touching the release/signing setup.**
- `shadcn` — vendored UI-primitive skill (also in `.agents/skills/`).

Also available, but **not** vendored in this repo (globally installed, listed here only so you know they exist): `improve` (read-only senior-advisor audit harness → plans in `plans/`) and `frontend-design`.

**Distribution split (don't leak internal skills).** The *companion* skill the app ships to users lives at repo root `/skills/porcelain-companion/` (one skill + `references/` for each surface) and is published via skills.sh (`npx skills add FabioFiorita/porcelain`; later `npx skills upgrade`). Everything in `.agents/skills/` is *internal* (repo guidance + vendored `shadcn`) and must carry `metadata.internal: true` in its frontmatter — the skills.sh CLI scans `.agents/skills` **and** `.claude/skills`, so without that flag an internal skill leaks into users' `npx skills add`. Any new `.agents/skills/` skill needs the flag.

**No personal setup in shipped content.** Anything users see — the `/skills/` companion skill, app copy, published docs — must never use Fabio's personal environment as an example or placeholder (his "beelink" home server, personal hostnames, `soaphealth` repo paths, etc.). Use generic placeholders instead (`you@remote-host`, `/home/you/code/my-app`). Internal `.agents/skills/` guidance may reference the real dev setup.

## Agentic enforcement

The advisory layer above (CLAUDE.md + skills) is backed by a deterministic layer in `.claude/` so the project can run unattended:
- **`.claude/settings.json`** — a `PreToolUse` git-guard hook (`.claude/hooks/git-guard.sh`) that hard-blocks branch creation (rule 8) and runs the `pnpm verify` gate before any commit (rule 3), plus a dev-loop permission allowlist (lint/typecheck/test/build + local git). `git push` is deliberately left to prompt (the one outward-facing action).
- **`invariant-reviewer` agent** (`.claude/agents/`) — read-only; reviews a diff against the `audit` invariants and the one architecture. Delegate to it before committing non-trivial changes ("use the invariant-reviewer on this diff").

## Orchestrator + sub-agents

The main loop is the **orchestrator**: it plans, scopes, verifies, and decides. Work is delegated to sub-agents (Agent tool / Workflow) whenever it's parallelizable, mechanical, or exploratory.

### Picking models

Rankings, higher = better. Intelligence is how hard a problem you can hand the model unsupervised. Taste covers UI/UX, code quality, API design, and copy.

| model           | cost | intelligence | taste |
|-----------------|------|--------------|-------|
| sonnet-5        | 5    | 5            | 7     |
| opus-4.8        | 4    | 7            | 8     |
| opus-4.8 xhigh  | 3    | 8            | 8     |
| fable-5         | 2    | 9            | 9     |

Availability note: fable-5 is a limited preview (roughly until 2026-07-09). While it's available, it's the top pick for orchestration and hard sub-agent work. When it's gone, **opus-4.8 with `effort: 'xhigh'` is the replacement** everywhere this file says fable.

How to apply:

- Defaults, not limits. Standing permission to escalate: if a cheaper model's output doesn't meet the bar, rerun with a smarter model without asking. Judge the output, not the price tag.
- Cost is a tie-breaker only; for anything that ships, intelligence > taste > cost.
- Bulk/mechanical work (clear-spec implementation, mechanical edits, spec fixes, migrations, exploration/search): orchestrator's judgment call per task, biased toward **opus at `effort: 'low'`** (or medium) when in doubt. Sonnet-high is fine for small, clear-cut jobs it won't struggle with — and it can delegate to its own subagents, which adds reliability. But sonnet's failure mode is going in circles when it can't get something right, burning more time and tokens than opus-low would have upfront — so if you foresee any struggle (ambiguity, tricky types, fiddly tests), send opus low/medium instead. Never sonnet at low effort.
- Anything user-facing (UI, copy, API design) needs taste ≥ 7: **opus** or **fable**.
- Reviews of plans/implementations, adversarial verification, hard debugging: **fable**, or **opus at `effort: 'xhigh'`**.
- Never use Haiku.
- Pass the model via the Agent/Workflow `model` parameter; omit it only when the session model is the right choice anyway.

### Delegation rules

- Orchestrator scopes and verifies; sub-agents execute. Don't burn orchestrator context on mechanical edits — hand them to a sub-agent (sonnet-high if clearly within its reach, opus low/medium if it might struggle) with a self-contained prompt (files, exact change, verification command).
- **This is unconditional in fable sessions (any effort level) and xhigh sessions: never type mechanical edits yourself.** Small task size is not an excuse — the value is the fable-written prompt: I don't trust a cheaper model to get an edit 100% right from my prompt, but I trust your prompt to make it do it right. Only exception: a single one-line edit in one file.
- Independent sub-agents launch in parallel (one message, multiple Agent calls).
- Delegated prompts must be self-contained: the sub-agent doesn't see this conversation. Include file paths, the applicable hard rules above (one architecture, shadcn primitives only, no `any` / no `as unknown as`, no `void` on promises), and how to verify.
- Spot-check every sub-agent result (read the diff, run the targeted test) before reporting done. Never relay "it works" unverified; verify review findings adversarially — no plausible-but-unchecked findings.
- For multi-step fan-out (audits, migrations, reviews across many files), prefer a Workflow over ad-hoc Agent calls when I've asked for orchestration.

### Hardware constraint

Dev usually runs on the Beelink Linux host (Ryzen 7 255, 8c/16t, **32GB RAM**) — 4-6 concurrent sub-agents running local commands (builds/tests) are fine there. If the session is on the MacBook Pro (M1 Pro, **16GB**), keep it to 2-3 — heavy parallel work swaps and everything crawls. Read-only/search sub-agents can fan out freely on either. If a command seems stuck or the machine is thrashing, suspect memory pressure before suspecting the code.

## Nomenclature

The shared vocabulary — shell regions (top bar, sidebar, viewer, Quick Access), sidebar tabs and their lists, viewer tab kinds, overlays, and the cross-cutting terms (flow layers, the Review, loop evidence, agent channels, the daemon) — lives in the `architecture` skill's **Nomenclature** section: a lookup table mapping each term to its entry file. When the user says a bare noun ("improve the viewer", "the Changes tab is wrong"), resolve it there and act on the named region — don't re-ask which one.

## Cursor Cloud specific instructions

Porcelain is a macOS app, but it runs headlessly in the Linux Cloud VM for dev + manual testing. Commands (`pnpm dev/lint/typecheck/test/build/verify`) are in `package.json`; this section only records the non-obvious cloud caveats.

- **Electron 42 has no `postinstall`** — `pnpm install` does NOT download the Electron binary, so `pnpm dev`/`pnpm start` fail with `Error: Electron uninstall` on a fresh checkout. Fix: `node node_modules/electron/install.js` (idempotent, cached). The startup update script already runs this; only re-run it by hand if dev errors with `Electron uninstall`.
- **Run the dev app under Xvfb:** `DISPLAY=:1 pnpm dev`. The repeated `Failed to connect to the bus` (dbus) errors in the log are harmless on this headless VM. Drive/screenshot the window via computer-use as the **"Electron"** app.
- **`pnpm dev` opens `~/Code/porcelain-playground`** (`dev-config.ts` seeds it as a recent repo only if the path exists). The VM has no such repo by default — create it as a git repo first (`git init` + a commit), or the app just lands on the welcome screen with nothing to review.
- **macOS-only paths don't run here:** `pnpm dist`/`pnpm release` (electron-builder `--mac`, signing/notarization) aren't expected to work on the Linux VM. The per-commit gate `pnpm verify` (lint + test + build) runs fully here, and so does the day-to-day e2e suite `pnpm test:e2e` (the `browser` Playwright project — headless Chromium, no display needed). Only `pnpm test:e2e:native` (the Electron project) needs a display server.
