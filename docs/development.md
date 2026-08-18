# Development

This is the canonical development loop. Runtime validation continues in
[runtime-proof.md](runtime-proof.md), releases in [release.md](release.md), and remote operations in
[remote-access.md](remote-access.md). Those procedures reuse this setup, isolation, worktree, and
task loop.

## First run

From the primary checkout:

```sh
pnpm install
pnpm build
pnpm dev:daemon
```

Open `http://127.0.0.1:43118/` for the development browser client. Run `pnpm dev` for the
Electron client. The daemon launcher uses `~/.porcelain-dev` and a disposable playground; it is
the only environment for ordinary agent product work.

The development environment is intentionally distinct from the published daemon:

| Environment | Port | Home | Repositories |
| --- | ---: | --- | --- |
| Production | configured listener | `~/.porcelain` | real checkouts |
| Primary development | 43118 | `~/.porcelain-dev` | playgrounds |
| Managed worktree | 43200–43999 | `~/.porcelain-dev-worktrees/<slug>` | per-worktree playground |

`PORCELAIN_DEV` enables the playground boundary and development authentication. Use
`pnpm dev:pair` when another device needs a development pairing link. Never copy production
credentials into a browser or local storage.

## The task loop

1. Read the Porcelain Task and inspect the owning code. Describe the observable outcome.
2. Make the smallest coherent change. Keep unrelated cleanup separate.
3. Format changed files and run the closest useful typecheck or test.
4. Exercise the affected runtime path when the change is user-facing, remote, Electron, or mobile.
5. Repeat until the behavior is demonstrated. Report commands, evidence, and uncertainty.

Use `pnpm verify` for a deliberate broad check or before delivery when it is available and useful;
do not make it the inner loop for every edit. CI is the clean-machine check. The proof should match
the risk: a focused unit test for logic, a daemon procedure check for server behavior, a browser or
Electron interaction for client behavior, and native runtime evidence for mobile behavior.

## Useful commands

The exact scripts are the source of truth (`pnpm run` lists the checkout's commands). Common entry
points are:

```sh
pnpm dev:daemon       # isolated daemon, port 43118 or the worktree allocation
pnpm dev              # Electron client
pnpm format           # write formatting
pnpm lint             # source checks configured by the checkout
pnpm test              # desktop/Vitest suite; pass a focused target when supported
pnpm build            # product build/typechecks
```

Use the package-local command when the affected package has a narrower check. A successful mock
assertion or build is not runtime proof.

## Parallel worktrees

Use a managed worktree when separate changes must proceed at the same time:

```sh
pnpm worktree create companion-review
pnpm worktree create mcp-channel
pnpm worktree list
```

Create from the primary checkout, usually based on `main`. Each managed worktree gets a
`work/<slug>` branch, an allocated development port, isolated channels/user data, and a disposable
playground. Start its daemon from inside that worktree so `scripts/dev-env.mjs` selects the right
profile. Do not point two worktrees at the same home or manually reuse a daemon port.

For handoff, record the branch, task, running daemon PID, port, and validation evidence. Keep
commits coherent so a later merge can identify the product unit. Use `pnpm worktree pr <slug>` only
when publication is requested. After a branch is merged and clean, `pnpm worktree remove <slug>`
stops its recorded daemon and removes its disposable worktree state; review the command output
before confirming removal.

## Runtime proof pointers

Browser and Electron load the same web client, but they have different launch and preload paths.
Mobile adds native lifecycle, simulator/device installation, and terminal rendering. When the
observable outcome needs a real client, continue with [runtime-proof.md](runtime-proof.md). Keep
client-specific commands and traps there; change this document only when the shared development
flow changes.

## Cleanup

Stop daemons and test servers started for the task. Remove generated evidence directories such as
`.playwright-mcp/`, `test-results/`, `playwright-report/`, and `apps/desktop/e2e/.artifacts/` when
they are no longer needed. Never use a broad process kill that could terminate another worktree or
the production daemon.
