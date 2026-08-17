# Porcelain

Where agent work becomes trusted work: a review layer for agentic coding (daemon-served browser +
macOS shell; mobile is frozen). Not an agent host. The **worktree** is the core object. Product:
`docs/product.md`. Current work: `plans/usable.md`.

**Package map:** daemon · cli · web · shell · mobile — `docs/internals/architecture.md`.

These are good defaults. If a rule fights the task, say so and get sign-off before breaking it.
The human is not a dictator. Rubber-stamping is a failure mode. Push stays prompted.

## Glossary

Bare nouns resolve here. Full lookup: `docs/internals/nomenclature.md`.

| Term | Meaning |
|---|---|
| Worktree | Core object (ADR 0003). Pins, hides, and layer order live on its **profile** |
| Canvas | Free HTML surface the agent writes (ADR 0004). The Review is a template on it |
| Evidence | Agent-authored proof plus coverage/mutation/complexity/dead-code as *triage*, never a gate |
| Viewer | Centre panel. Never "editor" |
| Daemon | Headless backend (`apps/daemon`). The shell only babysits it |
| Playground | Throwaway repo a *dev* daemon may open. Never a real checkout |

## Opening a session

```bash
pnpm build && pnpm dev:daemon   # :43118 — browser needs no pairing
# open http://127.0.0.1:43118/
pnpm playground new dirty       # fixture with a shape (`shapes` lists them)
pnpm dev:seed everything        # Reviews, Tasks, Actions, Evidence
```

- Dev = **43118** / `~/.porcelain-dev` / playgrounds only. Prod = **43117** / `~/.porcelain`. Never
  mix. Agents work only against dev.
- `GET /dev-auth` exists only on the dev daemon. Never plant a token in `localStorage`.
- `pnpm dev:daemon -- --no-auto-auth` when pairing itself is under test. `pnpm dev:pair` mints a
  link for another device.
- Stop what you started, by the PID you tracked. Never `pkill -f`.
- Debris: `.playwright-mcp/`, `test-results/`, `playwright-report/`, `apps/desktop/e2e/.artifacts/`.

## Hit every surface

The defect that keeps shipping is “worked on the path I tested.” Before calling UI work done, say
which of these applied:

- **Entry points.** A click in the navigator is usually also a command, a menu, and a keybinding.
- **Clients.** Browser and Electron load the *same* web client. `isBrowser` is true in unit tests
  (no preload). Any `if (!isBrowser)` path needs a test that mocks `@renderer/lib/platform` the way
  `worktree-switcher.test.tsx` does — that is how “click worktree opens a new window” shipped.
- **Environments.** Local daemon and a second remote daemon. Two daemons is the normal case.
- **Reverse states.** A way in needs a way out and a way to see it.
- **Docs.** User-visible behaviour goes in `docs/`. Current backlog is `plans/usable.md`.

## Delivery loop

1. Read the owning surface doc (`docs/surfaces/`) and the local idiom
   (`docs/internals/domain-architecture.md` before a cross-package slice).
2. Implement. Prove at the lowest test that can fail the behaviour. Run `pnpm quality:changed`.
3. Do not run `pnpm verify` while iterating. Run it before push. CI runs it on `main`.
4. Commit the unit. Do not push unless asked.

A passing test is not proof. A test that only checks a mock was called is hollow
(`lint:test-shape`). Break the guard and watch the test fail before you believe it.

Use Porcelain Companion only when intentionally operating Canvas, Tasks, Actions, comments, or
Evidence.

## The four ways to hurt yourself

1. **Mixing prod and dev daemons.** Table below is canonical.
2. **A second architecture.** New work follows `docs/internals/domain-architecture.md`. Legacy is
   not the target.
3. **Ending at "implemented, should work."** Prove it, then commit.
4. **Proving UI on the wrong surface.** Browser against the **dev** daemon. Never the installed
   app, never the prod daemon.

## Prod vs dev

| | Production | Development |
|--|--|--|
| Port | **43117** | **43118** (worktrees **43200–43999**) |
| Home | `~/.porcelain` | `~/.porcelain-dev` |
| Agents | **Never** | **Always** |
| Repos | Real worktrees | Playground fleet only |

`PORCELAIN_DEV` (from `scripts/dev-env.mjs`) arms the playground boundary and `/dev-auth`.
`pnpm porcelain <noun> <verb>` talks to the *dev* home.

## Skills

Load only when the trigger matches: `web-e2e` (browser proof), `mobile` (frozen app build/proof),
`merge-queue`, `releasing`.

## Docs and plans

| Tree | Tense |
|---|---|
| `docs/` | What **is**. Index: `docs/README.md` |
| `plans/` | What **isn't**. Only `plans/usable.md` is active |

A rule a machine can own goes in `pnpm lint`, not here. The gate list is the scripts, not this
file. `HUSKY=0` is `--no-verify`.

Nested: `apps/desktop/AGENTS.md` (Electron), `apps/mobile/AGENTS.md` (frozen iOS). Host-only
runbooks stay in ignored `AGENTS.local.md`.

`pnpm agents:check` / `pnpm agents:doctor` keep Claude/Codex/Grok adapters in sync.

Work on `main`. Use `pnpm worktree create <slug>` when isolation helps.
