---
name: ship
version: 0.49.0
metadata:
  internal: true
description: Development loop for code changes — evidence, testing doctrine, commit shape, worktrees, and autonomy. Load when changing code, verifying, or committing. Not needed for pure Q&A.
---

# Ship

A session that ends with "implemented, should work" forces the human to verify. Close the loop.

Prod vs dev ports and homes are in root `AGENTS.md` — never mix them. Agent channels are the
**porcelain CLI** writing local JSON. Do not reintroduce a Porcelain MCP server.

```bash
pnpm build && pnpm dev:daemon   # when the dev stack is cold
pnpm porcelain -- help          # CLI → ~/.porcelain-dev
# browser: http://127.0.0.1:43118/  (token in ~/.porcelain-dev/admin-token)
```

## The loop

1. **Intent** — what will be true, and how you'll prove it.
2. **Paths** — if multiple approaches matter, pick one (architecture forks: propose first).
3. **Execute** — match existing seams and local idiom.
4. **Test** — per doctrine below.
5. **Evidence** — prove the intent. UI → browser on **dev** daemon. Backend → Vitest / CLI on **dev**
   channels. Mobile → sim/device evidence per `mobile` skill. Never the prod daemon or installed
   production app for product work.
6. **Docs** — only when a durable constraint changed. Reasons live in the commit body.
7. **Gate & commit** — cheap lint is hook-enforced; then commit. **Before push: `pnpm verify`.**
   **Stop; push is prompted.**

Scale ceremony to the change. Evidence never scales away. A Porcelain Review (Intent · Execution ·
Evidence) is optional — publish when the work earns a story or the human asks.

## Gate

| When | Command | What |
|------|---------|------|
| Every commit (husky + git-guard) | `pnpm lint` | Biome + escapes + audit + eas-triggers + agents:check |
| Before push / release | `pnpm verify` | lint + unit tests + build + e2e typecheck |
| On push to `main` (CI) | `pnpm verify` ∥ browser e2e | Clean-room full bar + UI suite |

`.husky/commit-msg` runs `scripts/lint-commit-message.mjs` (1024-char EAS cap).

- `HUSKY=0` = `--no-verify`. `PORCELAIN_SKIP_VERIFY=1` only after a known-good manual lint run.
- Missing husky shims silently ungates — `pnpm agents:doctor` checks them.
- Never add a `GROK_SESSION_ID` skip (fails open).

## Commit messages

```
type(scope): imperative summary            <= 72, no trailing period

Why this path, what it invalidates, traps for the next person.
Wrap at 100.                               whole message <= 1024
```

Body spends budget on decisions and proof, not a restatement of the diff. One-line chores need no
body. Merge/revert/`fixup!` messages are skipped by the linter.

## Worktrees (opt-in)

Default is `main`. Take a worktree when isolation helps: concurrent tasks, long experiments, or a
CI/PR boundary.

`pnpm worktree create <slug>` → work in the worktree on `work/<slug>` → push/PR when asked →
squash-merge → `pnpm worktree remove <slug>`. Each task gets its own port and channel home via
`.porcelain-worktree.json`.

## Autonomy

- **Just fix:** lint/type errors, failing tests, stale docs, broken paths, flaky assertions.
- **Escalate:** product scope, new dependency, architecture fork, unsettled UI/UX, push and other
  outward-facing actions.

## Testing doctrine

- **Backend / business logic** → Vitest (`apps/desktop`; also globs mobile pure modules).
- **No separate `apps/mobile` test script.**
- **Desktop UI** → browser-first on the daemon-served client. `pnpm test:e2e` for the suite (CI on
  main).
- **Electron native e2e** → local Mac only (`pnpm --dir apps/desktop test:e2e:native*`); not CI,
  not `pnpm verify`.
- Locators: `data-testid` via `packages/shared/src/test-ids.ts` + e2e helpers.
- E2e fixtures are pristine — never the human's repos or prod channels.

Release is separate: only when the human asks → `releasing` skill.
