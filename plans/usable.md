# Make Porcelain usable

Status: active. This is the only backlog. Do not add gates, ADRs, or docs unless a slice below
cannot ship without them. Delete this file when all four slices are on `main` and Fabio has used
the app on the work monorepo for a week.

You are implementing product. Fabio reviews the running app, not your diff.

## Already true

- Worktree click stays in one window (`apps/web/src/features/projects/hub-tree.tsx`). The
  Electron special-case that called `newWindow` is gone.
- Metrics already exist: coverage, `lint-architecture`, complexity, 450-line ceiling, mutation,
  knip. Do not add a seventh.
- `apps/mobile` is frozen. Do not touch it.
- Do not rewrite. Do not open `plans/refounding.md` or `plans/architecture-refactor/` — they are
  gone on purpose.

## How to ship a slice

1. One slice per PR. Branch `work/<slice-slug>` from current `main`.
2. Read the surface doc named in the slice before editing.
3. Prove at the lowest test that can fail the behaviour. Then `pnpm quality:changed`.
4. Slice 1 and 2 need Mac proof: Electron build, click the flow, screenshot. Linux unit tests
   are not enough for those two.
5. Do not push unless Fabio asked.

## Slice 1 — Mac: one window, two daemons

**Done when:** In the Mac app, clicking a worktree on the SOAP (work) daemon or the personal
daemon switches this window. No second window. Switching back works. Tabs from the previous
worktree stay.

**Where:** already patched in `hub-tree.tsx`. Verify on Mac against both real daemons. If
anything else still calls `newWindow` / `openWindowInEnvironment` on a worktree *click* (not
an explicit "new window" button), delete that path too. Check
`apps/web/src/features/remote/remote-shell.ts` and `apps/web/src/components/git/worktree-switcher.tsx`.

**Proof:** Mac Electron, both remotes connected, click worktree A then B. One window. `pnpm --dir
apps/web exec vitest run src/features/projects/hub-tree.test.tsx`.

## Slice 2 — Cloudflare Tunnel

**Done when:** `porcelain-daemon serve --cloudflare` publishes the loopback daemon on an
`https://*.trycloudflare.com` (quick) or named tunnel (SOAP + personal). Pairing is unchanged.
LAN and Tailscale flags keep working. Fabio opens the Mac app or a browser at that URL and
reviews the work repo without Tailscale or same-LAN.

**Shape:** wrap `cloudflared` the way `--funnel` wraps Tailscale Funnel. Outbound from the
daemon host. Never bind `0.0.0.0`. Never send repo contents to Porcelain. Bearer + pairing
still gate every request.

**Where:** `apps/daemon/src/features/remote/`, `docs/remote-setup.md`,
`skills/porcelain-remote/`. Copy the Funnel listener shape in `remote-listeners.ts` and
`remote-funnel.ts`. Two daemons = two tunnels, two pairing links, two remotes in the Hub.

**Proof:** bring up a named or quick tunnel against the prod daemon on 43117; pair the Mac;
open a worktree. A second daemon on its own home/port gets its own tunnel. Tests for start,
stop, and "cloudflared missing" live next to the Funnel tests.

## Slice 3 — Create and dispose worktrees

**Done when:** Create asks for branch *and* destination on disk. Create runs Actions marked
`on create` after the checkout exists. Dispose asks for confirmation, runs Actions marked
`on dispose`, then removes the worktree. A failing create hook leaves the worktree and shows
the error. A failing dispose hook aborts deletion.

**Where:** `docs/surfaces/navigator.md` is the contract.
`apps/web/src/features/projects/create-worktree-dialog.tsx` already picks a branch — add
destination. Daemon create/remove lives under `apps/daemon/src/features/projects/` and
`apps/daemon/src/features/git/`. Actions already exist; add the create/dispose marking, do
not invent a second hook store (`docs/product.md`, CONTEXT.md Action).

**Proof:** playground `worktrees` shape plus a second destination path. Create, see the hook
run, dispose, see teardown, confirm a failing dispose does not delete.

## Slice 4 — Worktree profile

**Done when:** `porcelain worktree profile get|set` reads and writes pins, hides, and layer
order for *this* worktree. The file tree and the Changes list honour it. A worktree with no
profile is a plain tree. The full tree stays reachable. Profiles are personal, die with the
worktree, and are never written by Porcelain on its own (`docs/surfaces/worktree-profile.md`,
ADR 0003, ADR 0006). Layer grouping stays in `apps/daemon/src/review/flow.ts`.

**Where:** CLI under `apps/cli`. Store on the daemon-root project record, not in tracked
`project.json`. Web tree: `apps/web/src/features/files/`. Changes grouping: extend
`groupByLayer` in `flow.ts`.

**Proof:** set a profile on one worktree of a two-worktree playground; the other worktree is
unchanged. Hide a path, confirm it is folded and still openable. Set layers, confirm Changes
order follows them.

## After slice 4

Stop. Fabio uses it on the work monorepo for a week. UI redesign, Tasks polish, and anything
not in the four slices wait for that week. If he does not open it, the next conversation is
whether to archive, not what to build next.
