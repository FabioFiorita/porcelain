---
name: close-the-loop
metadata:
  internal: true
description: The development loop every session must complete — intent, paths, execute, test, verify with evidence, sync docs, gate, commit — plus the testing doctrine (unit tests for the daemon, browser-first for the UI) and the autonomy split. Read at the start of any session that will change code.
---

# Close the loop

Porcelain is developed heavily by agents. The human's goal is to interact less, not more — a session that ends with "implemented, should work" forces them to do the verification themselves, which defeats the point. So every session closes the **full loop**, and the loop's meaning never varies.

## Prod vs dev (hard rule)

| | **Production** (human’s day job) | **Development** (building Porcelain) |
|--|--|--|
| When | Always on | On demand during product work |
| Port | **43117** | Primary **43118**; worktrees **43200–43999** |
| User data | `~/.local/share/porcelain` | Primary `porcelain-dev`; worktrees `porcelain-dev-worktrees/<slug>` |
| Channels / CLI home | `~/.porcelain` | Primary `.porcelain-dev`; worktrees `.porcelain-dev-worktrees/<slug>` |
| Binary | systemd `npx porcelain-daemon@latest` | Local tree: `pnpm build` + `pnpm dev:daemon` |
| Network | LAN + tailnet | LAN by default (`pnpm dev:daemon -- --loopback` to opt out) — the Mac's iOS simulator has to reach it |
| Default repo | Real work (e.g. monorepos) | Primary playground or **per-worktree playground only** |
| Agents | **Never** for product work | **Always** for product work |

**Never** hide/pin, board, review, or token-write against the production daemon while improving Porcelain. Earlier mistakes mixed the two — do not repeat.

Agent channels are the **porcelain CLI** (`~/.porcelain/porcelain` in prod, `pnpm porcelain -- …` in dev) writing local channel files. Do not reintroduce a Porcelain MCP server.

```bash
pnpm build              # warm out/ when needed
pnpm dev:daemon         # DEV stack on 43118
pnpm porcelain -- help  # CLI against ~/.porcelain-dev
# browser client: http://127.0.0.1:43118/  (token in ~/.porcelain-dev/admin-token)
```

## The loop

1. **Intent** — one or two sentences: what will be true when this is done, and how you'll prove it.
2. **Paths** — if more than one plausible approach exists, list tradeoffs and pick one (architecture forks need a proposal first).
3. **Execute** — one architecture, shadcn primitives (UI only), type-safety-driven design. Work on `main` by default; opt into a managed `work/<slug>` worktree when the task runs in parallel with another one or is risky enough to want a PR boundary.
4. **Test** — per the testing doctrine below.
5. **Verify with evidence** — prove the *intent*. UI → browser against the **dev** daemon (Playwright MCP or `pnpm test:e2e`). Backend → unit test / CLI on **dev** channels. Never drive the installed **Porcelain** app or the prod daemon for product work.
6. **Docs sync** — update the owning skill in the same commit for decisions/traps changed; cut skill prose that only paraphrases code.
7. **Gate & commit** — `pnpm verify`, then commit. On `main` (the default): push. On a managed task branch: push and open a PR into `main` carrying the Review's evidence; after merge and a local main update, `pnpm worktree remove <slug>` closes the task by deleting its checkout, branch, channels, user data, and playground.

**A main commit is not a shortcut past the loop.** The gate runs identically on every branch, and an agent-authored commit on `main` still ends with a **published Porcelain Review** (Intent · Execution · Evidence) — that Review is what a PR would otherwise carry, and nothing enforces it but you.

**One gate, every host (2026-07-30).** The gate must not depend on which client made the commit. The tracked `.husky/pre-commit` is authoritative and is activated per clone through `prepare` (guarded so an install outside this checkout cannot touch another repo). Claude Code and Grok Build also load the shared `.agents/hooks/git-guard.sh` through the Claude-compatible settings adapter, so they receive failures before invoking Git; Codex and plain terminals reach the tracked hook. Claude Code keeps its host-guaranteed duplicate skip. **Grok deliberately runs the tracked gate again:** `GROK_SESSION_ID` proves only that Grok launched Git, not that this checkout's project hook was trusted, discovered, and successful, so using it as a skip would fail open. `PORCELAIN_SKIP_VERIFY=1` remains the deliberate escape hatch after a verified manual run. Anything else — including a missing `pnpm` — fails closed and refuses the commit. `pnpm agents:check` guards adapter drift; `pnpm agents:doctor` proves local discovery and hook activation.

**Husky runs the hooks, but does not own them (2026-07-31).** Moved from a hand-wired `core.hooksPath=githooks` to husky so activation is a dependency's job rather than a shell one-liner in `prepare`. What did *not* change: the hook bodies are still tracked (`.husky/pre-commit`, `.husky/commit-msg`) and are still the authoritative gate for every client. What did: husky's generated `.husky/_` shims are gitignored and only exist after an install — `pnpm agents:doctor` now checks the shim and the body separately, because a missing shim silently ungates commits and looks identical to a healthy repo from the outside. Two husky behaviours are inherited and cannot be turned off: it sources `~/.config/husky/init.sh` if present (machine-local, never project rules), and `HUSKY=0` skips every hook — an alias for `--no-verify`, not a sanctioned escape. Hook bodies run under `sh -e`, so an intentional failure must stay inside `if`/`||`.

Scale ceremony to the change. Phase 5 never scales away — no "should work."

## Commit messages

Enforced by `.husky/commit-msg` → `scripts/lint-commit-message.mjs`. Read the script for the exact rules; what follows is the part the script can't tell you.

```
type(scope): imperative summary            <= 72, no trailing period
                                           <- line 2 blank
Why this change, what it invalidates, the trap it leaves behind.
Wrap at 100.                               whole message <= 1024
```

**The 1024 ceiling is external and load-bearing (2026-07-31).** EAS caps a workflow `message`/`changelog` at 1024 characters, and `apps/mobile/.eas/workflows/preview.yml` feeds `github.commit_message` into the update, build, and TestFlight jobs. On a push to `main` there is no PR title to fall back on, so an over-long commit body fails the run with `Failed to start job — String must contain at most 1024 character(s)`: TestFlight silently stops tracking `main`. This is not a style preference with a stylistic cost. The workflows also truncate defensively via `substring(…, 0, 1024)` — that covers a squash-merge composed in GitHub's UI, which never reaches a local hook — but truncation makes a worse changelog, so keep it short at the source. Budget ~60 characters for a `Claude-Session:` trailer.

**What the body is for.** The diff already says what changed; a body that narrates it is wasted budget. Spend it on: why this path over the alternative, what earlier decision or doc this invalidates, what trap the next person will hit, and what runtime proof was taken. `git log` here is the record of *decisions* — several entries are the only place a finding lives.

**Deliberately not enforced:** body presence (a one-line `chore(deps)` needs none) and imperative mood (no honest lint for it — reviewers catch it). Merge, revert, and `fixup!`/`squash!` messages are skipped entirely: Git composes them.

## Managed worktree lifecycle (opt-in)

The maintainer works solo, so serialized work lands straight on `main` — a PR round-trip
per change would be ceremony for an audience of one. Take a worktree when isolation
actually buys something: a second task running concurrently, a long-lived experiment, or a
change you want CI to judge before it touches `main`.

1. From primary main: `pnpm worktree create <slug>`.
2. Work only inside `<repo>-worktrees/<slug>` on `work/<slug>`.
3. `pnpm dev:daemon` and `pnpm porcelain` automatically read `.porcelain-worktree.json`, so every task gets a stable unique port, channel home, user-data home, administrator token, and seeded disposable playground.
4. Push the task branch and open a PR. Porcelain remains the review story; the PR is the CI/merge boundary.
5. Squash-merge, update the primary main checkout, then run `pnpm worktree remove <slug>`. It fails closed on dirty or unmerged work. `--force` is only for explicitly abandoned work.
6. `pnpm worktree cleanup` removes all other clean managed worktrees already merged into local main.

The metadata file is ignored and contains only `{version, slug, branch, port}`. Runtime paths are derived from the validated slug instead of trusting deletable paths from the checkout. Cleanup stops only a recorded daemon whose PID, command, and working directory still identify that exact worktree; it never kills an unverified process.

## Autonomy split

- **Just fix:** lint/type errors, failing tests, stale docs, broken paths, flaky assertions.
- **Escalate:** product scope, new dependency, forking architecture, unsettled UI/UX, destructive or outward-facing actions (push stays prompted).

## Testing doctrine

Decided 2026-07-18 (browser-first); simplified 2026-07-27 (no required native on every push):

- **Backend / business logic** (daemon, git, stores, CLI) → **Vitest**.
- **Frontend, day-to-day** → **browser-first** against the daemon-served web client (same renderer dist as Electron). Dev: Playwright MCP or live tab on **dev** daemon. CI/local suite: `pnpm test:e2e` (`browser` project).
- **Electron native** (`pnpm test:e2e:native`) → **optional** (manual workflow or pre-ship when packaging/shell may have broken). Not part of `pnpm verify` and not required on every push.
- **E2e locator contract:** `data-testid` via `src/shared/test-ids.ts` + `e2e/helpers/locators.ts`.
- **Isolation:** each e2e test gets a pristine fixture repo (not the human’s work repos; not production channels).
- **Stress:** `e2e-stress.yml` (manual).

Accepted tradeoff: browser cannot see Electron shell chrome. Catch shell-only bugs with optional native e2e or a real Mac install smoke when packaging changed.

## Release is not the day-to-day loop

Ship only when the human asks. Default bump is **patch** until 1.0 (far away). See the `releasing` skill — simple main + tag + package, no pending branches.
