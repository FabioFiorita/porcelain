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
| Port | **43117** | **43118** |
| User data | `~/.local/share/porcelain` | `~/.local/share/porcelain-dev` |
| Channels / CLI home | `~/.porcelain` | `~/.porcelain-dev` (`PORCELAIN_HOME`) |
| Binary | systemd `npx porcelain-daemon@latest` | Local tree: `pnpm build` + `pnpm dev:daemon` |
| Network | LAN + tailnet | Loopback only |
| Default repo | Real work (e.g. monorepos) | **`~/code/porcelain-playground` only** |
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
3. **Execute** — one architecture, shadcn primitives (UI only), type-safety-driven design. Agents in this clone: **main only** (no feature branches; fork + PR for external contributors).
4. **Test** — per the testing doctrine below.
5. **Verify with evidence** — prove the *intent*. UI → browser against the **dev** daemon (Playwright MCP or `pnpm test:e2e`). Backend → unit test / CLI on **dev** channels. Never drive the installed **Porcelain** app or the prod daemon for product work.
6. **Docs sync** — update the owning skill in the same commit for decisions/traps changed; cut skill prose that only paraphrases code.
7. **Gate & commit** — `pnpm verify`, commit (agents: straight to `main`), leave the worktree clean.

**One gate, every host (2026-07-30).** The gate must not depend on which client made the commit. The tracked `githooks/pre-commit` is authoritative and is activated per clone by `core.hooksPath=githooks` through `prepare` (guarded so an install outside this checkout cannot touch another repo). Claude Code and Grok Build also load the shared `.agents/hooks/git-guard.sh` through the Claude-compatible settings adapter, so they receive failures before invoking Git; Codex and plain terminals reach the tracked hook. Claude Code keeps its host-guaranteed duplicate skip. **Grok deliberately runs the tracked gate again:** `GROK_SESSION_ID` proves only that Grok launched Git, not that this checkout's project hook was trusted, discovered, and successful, so using it as a skip would fail open. `PORCELAIN_SKIP_VERIFY=1` remains the deliberate escape hatch after a verified manual run. Anything else — including a missing `pnpm` — fails closed and refuses the commit. `pnpm agents:check` guards adapter drift; `pnpm agents:doctor` proves local discovery and hook activation.

Scale ceremony to the change. Phase 5 never scales away — no "should work."

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
