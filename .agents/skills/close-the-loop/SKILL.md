---
name: close-the-loop
metadata:
  internal: true
description: The development loop every session must complete — intent, paths, execute, test, verify with evidence, sync docs, gate, commit — plus the testing doctrine (unit tests for the daemon, browser-first for the UI) and the autonomy split. Read at the start of any session that will change code.
---

# Close the loop

Porcelain is developed heavily by agents. A session that ends with "implemented, should work" forces the human to do the verification themselves, which defeats the point. Every session closes the **full loop**.

## Prod vs dev (hard rule)

| | **Production** (real work) | **Development** (building Porcelain) |
|--|--|--|
| Port | **43117** | Primary **43118**; worktrees **43200–43999** |
| User data | `~/.local/share/porcelain` | `porcelain-dev`; `porcelain-dev-worktrees/<slug>` |
| Channels / CLI home | `~/.porcelain` | `.porcelain-dev`; `.porcelain-dev-worktrees/<slug>` |
| Binary | systemd `npx porcelain-daemon@latest` | Local tree: `pnpm build` + `pnpm dev:daemon` |
| Network | LAN + tailnet | LAN by default (`pnpm dev:daemon -- --loopback` opts out) — the iOS simulator has to reach it |
| Default repo | Real work | Playground only |
| Agents | **Never** for product work | **Always** for product work |

**Never** hide/pin, board, review, or token-write against the production daemon while improving Porcelain.

Agent channels are the **porcelain CLI** writing local channel files. Do not reintroduce a Porcelain MCP server.

```bash
pnpm build              # warm out/ when needed
pnpm dev:daemon         # DEV stack on 43118
pnpm porcelain -- help  # CLI against ~/.porcelain-dev
# browser client: http://127.0.0.1:43118/  (token in ~/.porcelain-dev/admin-token)
```

## The loop

1. **Intent** — one or two sentences: what will be true when this is done, and how you'll prove it.
2. **Paths** — if more than one plausible approach exists, list tradeoffs and pick one (architecture forks need a proposal first).
3. **Execute** — one architecture, shadcn primitives (UI only), type-safety-driven design. Work on `main` by default; opt into a managed `work/<slug>` worktree when the task runs in parallel with another or is risky enough to want a PR boundary.
4. **Test** — per the testing doctrine below.
5. **Verify with evidence** — prove the *intent*. UI → browser against the **dev** daemon (Playwright MCP or `pnpm test:e2e`). Backend → unit test / CLI on **dev** channels. Never drive the installed **Porcelain** app or the prod daemon for product work.
6. **Docs sync** — update the owning skill in the same commit for decisions/traps changed; cut skill prose that only paraphrases code.
7. **Gate & commit** — `pnpm verify`, then commit. On `main` (the default): push. On a managed task branch: push and open a PR into `main` carrying the Review's evidence; after merge and a local main update, `pnpm worktree remove <slug>` closes the task.

**A main commit is not a shortcut past the loop.** The gate runs identically on every branch, and an agent-authored commit on `main` still ends with a **published Porcelain Review** (Intent · Execution · Evidence) — that Review is what a PR would otherwise carry, and nothing enforces it but you.

Scale ceremony to the change. Phase 5 never scales away — no "should work."

## The gate

The tracked `.husky/pre-commit` runs `pnpm verify` and is authoritative for every client; `.husky/commit-msg` runs `scripts/lint-commit-message.mjs`. What the scripts can't tell you:

- `HUSKY=0` skips every hook — an alias for `--no-verify`, not a sanctioned escape. `PORCELAIN_SKIP_VERIFY=1` is the deliberate escape after a verified manual run. Anything else — including a missing `pnpm` — fails closed and refuses the commit.
- Husky's generated `.husky/_` shims are gitignored and only exist after an install. A missing shim silently ungates commits and looks identical to a healthy repo from the outside, so `pnpm agents:doctor` checks shim and body separately; `pnpm agents:check` guards adapter drift.
- Husky sources `~/.config/husky/init.sh` if present — machine-local, never project rules.
- Hook bodies run under `sh -e`, so an intentional failure must stay inside `if`/`||`.
- Never add a `GROK_SESSION_ID` skip: it proves only that Grok launched Git, not that this checkout's hook ran and passed. It would fail open.

## Commit messages

```
type(scope): imperative summary            <= 72, no trailing period
                                           <- line 2 blank
Why this change, what it invalidates, the trap it leaves behind.
Wrap at 100.                               whole message <= 1024
```

**What the body is for.** The diff already says what changed; a body that narrates it is wasted budget. Spend it on: why this path over the alternative, what earlier decision or doc this invalidates, what trap the next person will hit, and what runtime proof was taken. `git log` here is the record of *decisions* — for several entries it is the only place a finding lives. Budget ~60 characters for a `Claude-Session:` trailer.

**Deliberately not enforced:** body presence (a one-line `chore(deps)` needs none) and imperative mood (no honest lint for it — reviewers catch it). Merge, revert, and `fixup!`/`squash!` messages are skipped entirely: Git composes them.

## Managed worktree lifecycle (opt-in)

Serialized work lands straight on `main`. Take a worktree when isolation actually buys something: a second task running concurrently, a long-lived experiment, or a change you want CI to judge before it touches `main`.

1. From primary main: `pnpm worktree create <slug>`.
2. Work only inside `<repo>-worktrees/<slug>` on `work/<slug>`.
3. `pnpm dev:daemon` and `pnpm porcelain` read `.porcelain-worktree.json`, so every task gets a stable unique port, channel home, user-data home, administrator token, and seeded disposable playground.
4. Push the task branch and open a PR. Porcelain remains the review story; the PR is the CI/merge boundary.
5. Squash-merge, update the primary main checkout, then `pnpm worktree remove <slug>`. It fails closed on dirty or unmerged work; `--force` is only for explicitly abandoned work.
6. `pnpm worktree cleanup` removes all other clean managed worktrees already merged into local main.

Cleanup stops only a recorded daemon whose PID, command, and working directory still identify that exact worktree; it never kills an unverified process.

## Autonomy split

- **Just fix:** lint/type errors, failing tests, stale docs, broken paths, flaky assertions.
- **Escalate:** product scope, new dependency, forking architecture, unsettled UI/UX, destructive or outward-facing actions (push stays prompted).

## Testing doctrine

- **Backend / business logic** (daemon, git, stores, CLI) → **Vitest**.
- **Frontend, day-to-day** → **browser-first** against the daemon-served web client (same renderer dist as Electron). Dev: Playwright MCP or live tab on the **dev** daemon. CI/local suite: `pnpm test:e2e` (`browser` project).
- **Electron native** (`pnpm test:e2e:native`) → **optional** (manual, or pre-ship when packaging/shell may have broken). Not part of `pnpm verify` and not required on every push.
- **E2e locator contract:** `data-testid` via `src/shared/test-ids.ts` + `e2e/helpers/locators.ts`.
- **Isolation:** each e2e test gets a pristine fixture repo — never the human's work repos, never production channels.
- **Stress:** `e2e-stress.yml` (manual).

Accepted tradeoff: browser cannot see Electron shell chrome. Catch shell-only bugs with optional native e2e or a real Mac install smoke when packaging changed.

## Release is not the day-to-day loop

Ship only when the human asks. Default bump is **patch** until 1.0 (far away). See the `releasing` skill — simple main + tag + package, no pending branches.
